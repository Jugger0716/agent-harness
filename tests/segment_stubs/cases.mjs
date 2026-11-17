// Cases for the segment stub runner (run.mjs). Each case drives one Workflow segment script
// through the stub engine and reports whether the CORRECT behaviour was observed:
//
//   { id, defect, script, check(engine) -> { ok, detail } }
//
// `defect` is the finding number in design/v9-subtraction/SPEC.md appendix A (W1, W2, …), or
// null for a representative-arguments case. A case that is expected to fail today is listed in
// known_failures.json — never weaken a check here to make it pass.

const MODELS = { executor: 'sonnet', advisor: 'opus', evaluator: 'opus', verifier: 'haiku' }

// Representative arguments, one per script, in the shape its SKILL.md call site passes.
const REP = {
  'harness.plan': {
    task: 'Add X', repoPath: '.', lang: 'ts', scope: 'src/**', userLang: 'ko', conventions: 'conv',
    qaNotes: 'qa', criticFindings: 'cf', mode: 'standard', models: MODELS,
  },
  'harness.build': {
    specContent: 'SPEC', qaFeedback: '(First round)', repoPath: '.', lang: 'ts', scope: 'src/**',
    maxFiles: 10, testCmd: 'npm test', userLang: 'ko', verifyFailure: '',
    verifyReportPath: 'docs/harness/x/verify_report.md', mode: 'standard', models: MODELS, retry: false,
  },
  'harness.eval': {
    buildCmd: 'npm run build', testCmd: 'npm test', lintCmd: null, typeCheckCmd: null,
    changesMdPath: 'docs/harness/x/changes.md', verifyReportPath: 'docs/harness/x/verify_report.md',
    todoBlocking: false, specContent: 'SPEC', changedFilesList: 'src/a.ts', testAvailable: true,
    roundNum: 1, scope: 'src/**', userLang: 'ko', qaReportPath: 'docs/harness/x/qa_report.md',
    models: MODELS, skipL1: false, onlyL1: false, coldPass: true, coldMaxFiles: 20,
    coldFilesList: 'src/a.ts\nsrc/b.ts', specPath: 'docs/harness/x/spec.md',
  },
  'harness.critic': {
    task: 'T', userLang: 'ko', specContent: 'SPEC', qaNotes: '',
    criticFindingsPath: 'docs/harness/x/plan_critic_findings.md',
    models: { advisor: 'opus', evaluator: 'opus' },
  },
  'deep-review.review': {
    mode: 'thorough', diffContent: 'diff --git a/x b/x\n+foo', fileList: 'x (+1/-0)', userLang: 'ko',
    models: MODELS,
  },
}

const count = (s, needle) => s.split(needle).length - 1
const byLabel = (r, label) => r.calls.filter((c) => c.label === label)
const promptOf = (r, label) => {
  const c = byLabel(r, label)[0]
  if (!c) throw new Error(`no agent call labelled "${label}" (labels: ${r.calls.map((x) => x.label).join(', ') || 'none'})`)
  return c.prompt
}
const resultOf = (r) => {
  if (r.error) throw new Error(`script failed before the check: ${r.error}`)
  return r.result
}
const EMPTY_COUNTS = { critical: 0, major: 0, minor: 0, suggestion: 0 }
// True when the script failed with an error that names the agent whose result was missing.
const namesAgent = (error, label) =>
  Boolean(error) && error.toLowerCase().includes(label) && !error.includes('Cannot read properties of null')

// --- representative arguments: the script runs and leaves no {placeholder} behind -----------
const repCases = Object.keys(REP).map((script) => ({
  id: `rep-${script}`,
  defect: null,
  script,
  async check(e) {
    const r = await e.run(script, REP[script], (p, o) => e.minimal(o.schema))
    const left = [...new Set(r.calls.flatMap((c) => e.residual(c.prompt).map((x) => `${c.label}:${x}`)))]
    if (r.error) return { ok: false, detail: r.error }
    return {
      ok: left.length === 0,
      detail: left.length ? `unsubstituted: ${left.join(' ')}` : `${r.calls.length} agent call(s), no placeholder left`,
    }
  },
}))

// --- W6: a script must refuse missing arguments before dispatching any agent ----------------
// Three shapes, because a guard that only rejects `undefined` would still run on `{}` or on
// arguments that lack the one payload the script exists to process.
const REQUIRED = {
  'harness.plan': ['task'],
  'harness.build': ['specContent'],
  'harness.eval': ['specContent', 'verifyReportPath', 'qaReportPath'],
  'harness.critic': ['specContent', 'criticFindingsPath'],
  'deep-review.review': ['diffContent'],
}
const without = (obj, key) => Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key))
const refusal = (r, mustName) => {
  const refused = Boolean(r.error) && r.calls.length === 0 && (!mustName || r.error.includes(mustName))
  return {
    ok: refused,
    detail: r.error ? `error after ${r.calls.length} agent call(s): ${r.error}` : `ran ${r.calls.length} agent call(s)`,
  }
}
const emptyArgsCases = Object.keys(REP).flatMap((script) => [
  {
    id: `empty-args-${script}`,
    defect: 'W6',
    script,
    check: async (e) => refusal(await e.run(script, undefined, (p, o) => e.minimal(o.schema))),
  },
  {
    id: `empty-object-${script}`,
    defect: 'W6',
    script,
    check: async (e) => refusal(await e.run(script, {}, (p, o) => e.minimal(o.schema))),
  },
  // The error has to name the missing argument, so the caller can tell which one it was.
  ...REQUIRED[script].map((key) => ({
    id: `missing-${key}-${script}`,
    defect: 'W6',
    script,
    check: async (e) => refusal(await e.run(script, without(REP[script], key), (p, o) => e.minimal(o.schema)), key),
  })),
])
const argShapeCases = [
  {
    // Whitespace is not a payload: a reviewer run over a blank diff reports a clean result.
    id: 'blank-diffContent-deep-review.review',
    defect: 'W6',
    script: 'deep-review.review',
    check: async (e) =>
      refusal(await e.run('deep-review.review', { ...REP['deep-review.review'], diffContent: '  \n' }, (p, o) => e.minimal(o.schema)), 'diffContent'),
  },
  {
    // Arguments may arrive as a JSON string; the guard has to run on the parsed object.
    id: 'string-args-harness.build',
    defect: 'W6',
    script: 'harness.build',
    check: async (e) =>
      refusal(await e.run('harness.build', JSON.stringify(without(REP['harness.build'], 'specContent')), (p, o) => e.minimal(o.schema)), 'specContent'),
  },
]

const defectCases = [
  {
    id: 'build-null-implementation',
    defect: 'W1',
    script: 'harness.build',
    async check(e) {
      const r = await e.run('harness.build', REP['harness.build'], (p, o) =>
        o.label === 'implementation' ? null : e.minimal(o.schema))
      return { ok: namesAgent(r.error, 'implementation'), detail: r.error ? r.error : 'returned a result although the implementation agent returned null' }
    },
  },
  {
    id: 'build-null-plan-label',
    defect: 'W1',
    script: 'harness.build',
    async check(e) {
      const r = await e.run('harness.build', REP['harness.build'], (p, o) =>
        o.label === 'lead_developer' ? null : e.minimal(o.schema))
      // Either fix is acceptable: fail with an error that names the planner, or carry on with a
      // digest that does not blame the advisor for a plan that never arrived.
      if (r.error) return { ok: namesAgent(r.error, 'lead_developer'), detail: r.error }
      const digest = String(r.result.planDigest)
      return { ok: !digest.includes('advisor unavailable'), detail: `planDigest = ${JSON.stringify(digest.slice(0, 60))}` }
    },
  },
  {
    id: 'plan-resubstitution',
    defect: 'W2',
    script: 'harness.plan',
    async check(e) {
      const task = "TASK<<rename the {task_description} placeholder; keep $& and $' literal>>"
      const r = await e.run('harness.plan', { ...REP['harness.plan'], task }, (p, o) =>
        o.label === 'synthesis'
          ? e.minimal(o.schema)
          : { persona: o.label, summary: 'templates/x.md uses {task_description} and {critic_findings}', keyPoints: ['replace {task_description}'] })
      const n = count(promptOf(r, 'synthesis'), task)
      return { ok: n === 1, detail: `the task text appears verbatim ${n} time(s) in the synthesis prompt (expected 1)` }
    },
  },
  {
    id: 'build-resubstitution',
    defect: 'W2',
    script: 'harness.build',
    async check(e) {
      const spec = 'SPEC<<' + 'x'.repeat(50) + '>>'
      const args = { ...REP['harness.build'], specContent: spec, qaFeedback: 'QA mentions {spec_content} too', mode: 'multi' }
      const r = await e.run('harness.build', args, (p, o) => {
        if (o.label === 'lead_developer') {
          return { persona: 'lead_developer', summary: 'edit template', keyPoints: ['templates/a.md — modify — replace {spec_content} with {spec_path}'] }
        }
        if (o.label === 'implementation') return { modifiedFiles: [], summary: 's' }
        return { persona: o.label, summary: 'ok', keyPoints: [] }
      })
      const n = count(promptOf(r, 'implementation'), 'SPEC<<')
      return { ok: n === 1, detail: `spec body appears ${n} time(s) in the implementation prompt (expected 1)` }
    },
  },
  {
    id: 'review-resubstitution',
    defect: 'W2',
    script: 'deep-review.review',
    async check(e) {
      const diff = 'diff --git a/t.md b/t.md\n+## Diff to Review\n+{diff_content}\n' + 'DIFFLINE\n'.repeat(1000)
      const args = { mode: 'thorough', diffContent: diff, fileList: 't.md', userLang: 'ko', models: MODELS }
      const r = await e.run('deep-review.review', args, (p, o) => {
        if (o.label === 'synthesis') return { findings: [], counts: EMPTY_COUNTS, filesReviewed: ['t.md'], summary: 's' }
        if (String(o.label).startsWith('xv_')) return { reviewer: o.label, verdicts: [], newFindings: [], summary: 's' }
        return {
          findings: [{ file: 't.md', line: 2, severity: 'minor', category: 'Maintainability', title: 'raw {diff_content} token', detail: 'the template keeps {diff_content} unescaped' }],
          counts: { ...EMPTY_COUNTS, minor: 1 }, filesReviewed: ['t.md'], summary: 's',
        }
      })
      const xv = r.calls.find((c) => String(c.label).startsWith('xv_'))
      if (!xv) throw new Error('no cross-verify agent call')
      const n = count(xv.prompt, 'DIFFLINE')
      return { ok: n === 1000, detail: `a 1000-line diff appears as ${n} line(s) in the cross-verify prompt` }
    },
  },
  {
    id: 'review-dropped-findings',
    defect: 'W7',
    script: 'deep-review.review',
    async check(e) {
      const args = { mode: 'thorough', diffContent: 'diff --git a/a.ts b/a.ts\n+x', fileList: 'a.ts', userLang: 'ko', models: MODELS }
      const r = await e.run('deep-review.review', args, (p, o) => {
        if (o.label === 'synthesis') return { findings: [], counts: EMPTY_COUNTS, filesReviewed: ['a.ts'], summary: 's' }
        if (String(o.label).startsWith('xv_')) return { reviewer: o.label, verdicts: [], newFindings: [], summary: 's' }
        return {
          findings: [{ file: `src/${o.label}.ts`, line: 1, severity: 'major', category: 'Correctness', title: `found by ${o.label}`, detail: 'd' }],
          counts: { ...EMPTY_COUNTS, major: 1 }, filesReviewed: ['a.ts'], summary: 's',
        }
      })
      const dropped = resultOf(r).droppedFindings
      const n = Array.isArray(dropped) ? dropped.length : null
      return {
        ok: n === 3,
        detail: n === null ? 'three reviewers reported a major finding, synthesis returned none, and the result has no droppedFindings' : `droppedFindings has ${n} entr(ies) (expected 3)`,
      }
    },
  },
  {
    id: 'plan-null-synthesis',
    defect: 'W9',
    script: 'harness.plan',
    async check(e) {
      const r = await e.run('harness.plan', REP['harness.plan'], (p, o) =>
        o.label === 'synthesis' ? null : { persona: o.label, summary: 's', keyPoints: [] })
      return { ok: namesAgent(r.error, 'synthesis'), detail: r.error ? r.error : `returned ${JSON.stringify(r.result).slice(0, 80)} although synthesis returned null` }
    },
  },
  // The same rule for every other single agent() a script cannot go on without: the error has
  // to say which agent came back empty, not die on a null read.
  ...[
    ['eval-null-l1', 'harness.eval', 'verify_l1'],
    ['eval-null-evaluator', 'harness.eval', 'evaluator'],
    ['critic-null', 'harness.critic', 'critic'],
    ['review-null-synthesis', 'deep-review.review', 'synthesis'],
  ].map(([id, script, label]) => ({
    id,
    defect: 'W9',
    script,
    async check(e) {
      const r = await e.run(script, REP[script], (p, o) => (o.label === label ? null : e.minimal(o.schema)))
      return { ok: namesAgent(r.error, label), detail: r.error ? r.error : `returned a result although the ${label} agent returned null` }
    },
  })),
  {
    id: 'eval-scope-placeholder',
    defect: 'W15',
    script: 'harness.eval',
    async check(e) {
      const args = { ...REP['harness.eval'], lintCmd: 'pylint {scope}', scope: 'src' }
      const r = await e.run('harness.eval', args, (p, o) => e.minimal(o.schema))
      // Not merely "no {scope} left": the command has to arrive resolved, or Layer 1 runs
      // something other than what the project declared.
      const prompt = promptOf(r, 'verify_l1')
      const ok = !prompt.includes('{scope}') && prompt.includes('pylint src')
      return { ok, detail: ok ? 'the Layer 1 prompt carries `pylint src`' : 'the Layer 1 prompt does not carry `pylint src`' }
    },
  },
  {
    // A session without a scope stores "(no limit)"; a command cannot run on that.
    id: 'eval-scope-default',
    defect: 'W15',
    script: 'harness.eval',
    async check(e) {
      const args = { ...REP['harness.eval'], lintCmd: 'pylint {scope}', scope: '(no limit)' }
      const r = await e.run('harness.eval', args, (p, o) => e.minimal(o.schema))
      const prompt = promptOf(r, 'verify_l1')
      const ok = !prompt.includes('{scope}') && prompt.includes('pylint .')
      return { ok, detail: ok ? 'the Layer 1 prompt carries `pylint .`' : 'the Layer 1 prompt does not carry `pylint .`' }
    },
  },
  {
    id: 'eval-scope-evaluator',
    defect: 'W15',
    script: 'harness.eval',
    async check(e) {
      const args = { ...REP['harness.eval'], testCmd: 'pytest {scope}', scope: 'src' }
      const r = await e.run('harness.eval', args, (p, o) => e.minimal(o.schema))
      const ok = promptOf(r, 'evaluator').includes('pytest src')
      return { ok, detail: ok ? 'the evaluator prompt carries `pytest src`' : 'the evaluator prompt does not carry `pytest src`' }
    },
  },
  {
    id: 'eval-pass-with-critical',
    defect: 'W16',
    script: 'harness.eval',
    async check(e) {
      const args = { ...REP['harness.eval'], coldFilesList: 'a.ts' }
      const r = await e.run('harness.eval', args, (p, o) => {
        if (o.label === 'verify_l1') return { verdict: 'PASS', layer: 'L1', failures: [] }
        if (o.label === 'evaluator') return { verdict: 'PASS', layer: 'L1', failures: [{ file: 'a.ts', severity: 'critical', fix: 'f' }] }
        return null
      })
      const res = resultOf(r)
      const contradictory = res.verdict === 'PASS' && (res.failures || []).some((f) => String(f.severity).toLowerCase() === 'critical')
      return { ok: !contradictory, detail: `verdict=${res.verdict} layer=${res.layer} failures=${(res.failures || []).length}` }
    },
  },
  // The caller branches on (layer, verdict). `layer` is a label the model attaches, so the
  // script has to set it from where the result came from, not trust it.
  {
    id: 'eval-fail-l2-mislabelled',
    defect: 'W16',
    script: 'harness.eval',
    async check(e) {
      const r = await e.run('harness.eval', REP['harness.eval'], (p, o) => {
        if (o.label === 'verify_l1') return { verdict: 'PASS', layer: 'L1', failures: [] }
        if (o.label === 'evaluator') return { verdict: 'FAIL_L2', layer: 'L1', failures: [] }
        return null
      })
      const res = resultOf(r)
      return { ok: res.layer === 'L2', detail: `verdict=${res.verdict} layer=${res.layer} (an evaluator FAIL_L2 must read as layer L2)` }
    },
  },
  {
    id: 'eval-l1-mislabelled',
    defect: 'W16',
    script: 'harness.eval',
    async check(e) {
      const r = await e.run('harness.eval', REP['harness.eval'], (p, o) =>
        o.label === 'verify_l1' ? { verdict: 'FAIL_L2', layer: 'L3', failures: [] } : e.minimal(o.schema))
      const res = resultOf(r)
      return { ok: res.layer === 'L1' && r.calls.length === 1, detail: `layer=${res.layer} after ${r.calls.length} agent call(s) (a Layer 1 failure must read as layer L1)` }
    },
  },
  {
    id: 'eval-pass-with-major',
    defect: 'W16',
    script: 'harness.eval',
    async check(e) {
      const r = await e.run('harness.eval', REP['harness.eval'], (p, o) => {
        if (o.label === 'verify_l1') return { verdict: 'PASS', layer: 'L1', failures: [] }
        if (o.label === 'evaluator') return { verdict: 'PASS', layer: 'L3', failures: [{ file: 'a.ts', severity: 'major', fix: 'f' }] }
        return null
      })
      const res = resultOf(r)
      return { ok: res.verdict === 'FAIL_L3' && res.layer === 'L3', detail: `verdict=${res.verdict} layer=${res.layer} with one major failure listed` }
    },
  },
  {
    // The other side of the rule: a minor note under PASS is not a contradiction.
    id: 'eval-pass-with-minor',
    defect: 'W16',
    script: 'harness.eval',
    async check(e) {
      const r = await e.run('harness.eval', REP['harness.eval'], (p, o) => {
        if (o.label === 'verify_l1') return { verdict: 'PASS', layer: 'L1', failures: [] }
        if (o.label === 'evaluator') return { verdict: 'PASS', layer: 'L3', failures: [{ file: 'a.ts', severity: 'minor', fix: 'f' }] }
        return e.minimal(o.schema)
      })
      const res = resultOf(r)
      return { ok: res.verdict === 'PASS', detail: `verdict=${res.verdict} layer=${res.layer} with one minor failure listed` }
    },
  },
  {
    id: 'critic-summary',
    defect: 'W17',
    script: 'harness.critic',
    async check(e) {
      const r = await e.run('harness.critic', REP['harness.critic'], () => ({
        counts: { critical: 5, major: 0, minor: 0 },
        items: [{ id: '[C1]', severity: 'Critical', title: 't', issue: 'i', suggestedFix: 'f' }],
        summary: 'Critical=5, Major=0, Minor=0',
      }))
      const res = resultOf(r)
      return { ok: String(res.summary).includes('Critical=1'), detail: `counts=${JSON.stringify(res.counts)} summary=${JSON.stringify(res.summary)}` }
    },
  },
]

export const cases = [...repCases, ...emptyArgsCases, ...argShapeCases, ...defectCases]
