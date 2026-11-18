// Cases for the handoff script tests (run.mjs). Each case is `{ id, run }`; `run` throws when the
// behaviour is wrong. Fixtures under tests/handoff/fixtures/ are invented text — never a shortened
// real document — and the corpus tools under tests/handoff/corpus/ are exercised on them only.
//
// How the helper is driven: most `parse` cases go through the real command line
// (`node handoff.mjs parse --doc <fixture>`) so what they assert is the JSON a skill would read —
// `undefined` does not survive it, `null` does. Cases that need text a fixture file cannot carry
// (a CRLF copy, a BOM, one-off shapes) call `parseHandoff` on a string and round-trip the result
// through JSON for the same reason.
//
// A CRLF fixture file is deliberately NOT committed: `.gitattributes` has `*.md text eol=lf`, so
// git would turn it into LF and the case would silently test nothing. The CRLF copies are built
// in memory from the LF fixtures.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync, execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const HANDOFF_JS = path.join(ROOT, 'skills', 'handoff', 'scripts', 'handoff.mjs')
const RUN_JS = path.join(ROOT, 'tests', 'handoff', 'run.mjs')
const FIX = path.join(ROOT, 'tests', 'handoff', 'fixtures')

const FIXTURES = [
  'label-and-inprogress-differ', 'no-label-two-inprogress', 'done-only-last-row', 'bold-wrapped-status',
  'no-ledger-with-docs-label', 'no-ledger-no-docs', 'negated-command-token', 'two-command-tokens',
  'path-like-token', 'legacy-no-labels', 'heading-variant', 'reading-order-forms', 'ledger-two-tables',
]

// ---- helpers ---------------------------------------------------------------------------------

const lib = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href)
const parseLib = () => lib('skills/handoff/scripts/lib/parse.mjs')
const legacyLib = () => lib('tests/handoff/corpus/legacy_next.mjs')
const nextLib = () => lib('skills/handoff/scripts/lib/next.mjs')
const snapshotLib = () => lib('tests/handoff/corpus/snapshot.mjs')
const measureLib = () => lib('tests/handoff/corpus/measure.mjs')
const readingLib = () => lib('skills/handoff/scripts/lib/reading.mjs')
const pathsLib = () => lib('skills/handoff/scripts/lib/paths.mjs')
const diffLib = () => lib('tests/handoff/corpus/diff.mjs')

const fixtureText = (name) => fs.readFileSync(path.join(FIX, `${name}.md`), 'utf8')
const viaJson = (v) => JSON.parse(JSON.stringify(v))
const toCrlf = (s) => s.replace(/\n/g, '\r\n')

function cli(...args) {
  return spawnSync(process.execPath, [HANDOFF_JS, ...args], { encoding: 'utf8' })
}

// `parse` through the command line, as JSON.
function parseFixture(name) {
  const r = cli('parse', '--doc', path.join(FIX, `${name}.md`))
  assert.equal(r.status, 0, `exit ${r.status}: ${r.stderr}`)
  return JSON.parse(r.stdout)
}

// `parse` on a string, through the library, as JSON.
async function parseText(text) {
  const { parseHandoff } = await parseLib()
  return viaJson(parseHandoff(text))
}

const HEAD = [
  '# HANDOFF — Synthetic',
  '',
  '**Date:** 2026-02-01  **Project:** sample-service',
  '**Branch:** main  **HEAD:** dddddddddddddddddddddddddddddddddddddddd Synthetic subject',
  '**Dirty:** clean  **Upstream:** n/a',
  '',
  '',
].join('\n')

// A document from `[heading, body]` pairs; order and duplicates are kept.
const mk = (pairs, head = HEAD) => head + pairs.map(([h, b]) => `## ${h}\n${b}\n`).join('\n')

const table = (rows, header = '| Epic | Slice | Status | Evidence | Notes |\n|------|-------|--------|----------|-------|') =>
  header + '\n' + rows.map((r) => `| ${r.join(' | ')} |`).join('\n')

const noTable = 'The slice that applies is named in prose.'

async function legacyOf(text) {
  const { parseHandoff } = await parseLib()
  const { deriveLegacyNext } = await legacyLib()
  return deriveLegacyNext(parseHandoff(text))
}

const same = (a, b, msg) => assert.deepEqual(a, b, msg)

// ---- the command line ------------------------------------------------------------------------

const cliCases = [
  {
    id: 'cli-parse-prints-one-json-object',
    run: async () => {
      const r = cli('parse', '--doc', path.join(FIX, 'label-and-inprogress-differ.md'))
      assert.equal(r.status, 0, r.stderr)
      assert.equal(r.stderr, '')
      assert.ok(r.stdout.endsWith('\n') && !r.stdout.slice(0, -1).includes('\n'), 'one line of JSON')
      const o = JSON.parse(r.stdout)
      assert.ok(o && typeof o === 'object' && !Array.isArray(o))
    },
  },
  {
    id: 'cli-no-arguments-is-a-usage-error',
    run: async () => {
      const r = cli()
      assert.equal(r.status, 2)
      assert.equal(r.stdout, '')
      assert.ok(r.stderr.trim().length > 0, 'a message on stderr')
    },
  },
  {
    id: 'cli-unknown-subcommand-is-a-usage-error',
    run: async () => {
      const r = cli('no-such-command')
      assert.equal(r.status, 2)
      assert.equal(r.stdout, '')
      assert.match(r.stderr, /no-such-command/)
    },
  },
  {
    id: 'cli-parse-without-doc-is-a-usage-error',
    run: async () => {
      const r = cli('parse')
      assert.equal(r.status, 2)
      assert.equal(r.stdout, '')
      assert.match(r.stderr, /--doc/)
    },
  },
  {
    id: 'cli-parse-missing-file-exits-1',
    run: async () => {
      const r = cli('parse', '--doc', path.join(FIX, 'does-not-exist.md'))
      assert.equal(r.status, 1)
      assert.equal(r.stdout, '')
      assert.ok(r.stderr.trim().length > 0)
    },
  },
  {
    id: 'parse-rejects-non-handoff',
    run: async () => {
      const r = cli('parse', '--doc', path.join(FIX, 'non-handoff.md'))
      assert.equal(r.status, 1)
      assert.equal(r.stdout, '')
      assert.match(r.stderr, /# HANDOFF —/)
    },
  },
  {
    id: 'cli-parse-reads-a-crlf-file',
    run: async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-cases-'))
      try {
        const f = path.join(dir, 'crlf.md')
        fs.writeFileSync(f, toCrlf(fixtureText('label-and-inprogress-differ')))
        const r = cli('parse', '--doc', f)
        assert.equal(r.status, 0, r.stderr)
        same(JSON.parse(r.stdout), parseFixture('label-and-inprogress-differ'))
      } finally {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    },
  },
]

// ---- parse: header, sections ------------------------------------------------------------------

const headerCases = [
  {
    id: 'parse-header-fields',
    run: async () => {
      const p = parseFixture('label-and-inprogress-differ')
      same(p.header, {
        title: 'Sample parser epic',
        date: '2026-01-05',
        project: 'sample-service',
        branch: 'feature/sample-parser',
        head: '0123456789abcdef0123456789abcdef01234567',
        headSubject: 'Add the sample parser',
        headRaw: '0123456789abcdef0123456789abcdef01234567 Add the sample parser',
        dirtyRaw: '2 files (src/a.js, src/b.js)',
        dirtyPaths: [],
        worktree: null,
        upstream: 'origin/feature/sample-parser (ahead 1)',
      })
    },
  },
  {
    id: 'parse-legacy-has-no-new-fields',
    run: async () => {
      for (const name of ['legacy-no-labels', 'label-and-inprogress-differ']) {
        const p = parseFixture(name)
        assert.equal(p.header.worktree, null, name)
        same(p.header.dirtyPaths, [], name)
        assert.equal(p.harness, 'absent', name)
      }
    },
  },
  {
    id: 'parse-header-missing-labels-are-null',
    run: async () => {
      const p = await parseText('# HANDOFF — Bare\n\n**Date:** 2026-03-03\n\n## Goal\nx\n')
      assert.equal(p.header.title, 'Bare')
      assert.equal(p.header.date, '2026-03-03')
      for (const k of ['project', 'branch', 'head', 'headSubject', 'headRaw', 'dirtyRaw', 'upstream']) {
        assert.equal(p.header[k], null, k)
      }
    },
  },
  {
    id: 'parse-header-head-forms',
    run: async () => {
      const head = (v) => `# HANDOFF — T\n\n**Branch:** main  **HEAD:** ${v}\n\n## Goal\nx\n`
      const a = (await parseText(head('`abc1234` Short sha'))).header
      assert.equal(a.head, 'abc1234')
      assert.equal(a.headSubject, 'Short sha')
      const b = (await parseText(head('n/a'))).header
      assert.equal(b.head, null)
      assert.equal(b.headRaw, 'n/a')
      const c = (await parseText(head('0123456789abcdef0123456789abcdef01234567'))).header
      assert.equal(c.head, '0123456789abcdef0123456789abcdef01234567')
      assert.equal(c.headSubject, null)
    },
  },
  {
    id: 'parse-header-reads-only-before-the-first-section',
    run: async () => {
      const p = await parseText('# HANDOFF — T\n\n**Branch:** main\n\n## Goal\n**Date:** 2020-01-01\n')
      assert.equal(p.header.branch, 'main')
      assert.equal(p.header.date, null)
    },
  },
  {
    id: 'parse-header-keeps-bold-remarks-in-the-value',
    run: async () => {
      const text = '# HANDOFF — T\n\n**Dirty:** 3 files (a, b, c) — **unrelated work**  **Upstream:** origin/x (in sync)\n\n## Goal\nx\n'
      const p = await parseText(text)
      assert.equal(p.header.dirtyRaw, '3 files (a, b, c) — **unrelated work**')
      assert.equal(p.header.upstream, 'origin/x (in sync)')
    },
  },
]

const sectionCases = [
  {
    id: 'parse-sections-in-document-order',
    run: async () => {
      const p = parseFixture('label-and-inprogress-differ')
      same(Object.keys(p.sections), [
        'Goal', 'Current State (verified)', 'In Progress', 'Blockers / Risks', 'Next Steps',
        'Definition of Done', 'Reading Order', 'Do NOT', 'Progress Ledger', 'Resume',
      ])
      assert.equal(p.sections.Goal, 'Build the sample parser in three slices.')
      assert.equal(p.sections['Blockers / Risks'], '- none')
    },
  },
  {
    id: 'parse-heading-prefix',
    run: async () => {
      const p = parseFixture('heading-variant')
      same(Object.keys(p.sections), [
        'Goal', 'Current State (verified)', 'In Progress', 'Blockers / Risks', 'Next Steps',
        'Definition of Done', 'Reading Order', 'Do NOT', 'Notes for the next session', 'Resume',
      ])
      assert.equal(p.sections['Definition of Done'], '- The v3 plan is met.')
      assert.equal(p.sections.Goal, 'Read a heading that carries a suffix after the English title.')
    },
  },
  {
    id: 'parse-heading-comment-is-not-part-of-the-name',
    run: async () => {
      const p = parseFixture('label-and-inprogress-differ')
      assert.ok('Progress Ledger' in p.sections)
      const q = parseFixture('heading-variant')
      assert.equal(q.sections['Reading Order'], '1. 이 문서 — read first')
    },
  },
  {
    id: 'parse-first-heading-wins-on-a-repeat',
    run: async () => {
      const p = await parseText(mk([['Goal', 'first'], ['Goal', 'second']]))
      assert.equal(p.sections.Goal, 'first')
    },
  },
  {
    id: 'parse-section-named-like-an-object-property-is-kept',
    run: async () => {
      // `name in {}` is true for toString, constructor and friends, so a section with such a title
      // used to be dropped; `__proto__` must not become the prototype either.
      const p = await parseText(mk([['toString', 'a'], ['constructor', 'b'], ['__proto__', 'c'], ['Goal', 'd']]))
      same(Object.keys(p.sections), ['toString', 'constructor', '__proto__', 'Goal'])
      assert.equal(p.sections.toString, 'a')
      assert.equal(p.sections.constructor, 'b')
      assert.equal(Object.getOwnPropertyDescriptor(p.sections, '__proto__').value, 'c')
      assert.equal(p.sections.Goal, 'd')
      const head = '# HANDOFF — T\n\n**constructor:** x  **Date:** 2026-03-03\n\n## Goal\nx\n'
      assert.equal((await parseText(head)).header.date, '2026-03-03')
    },
  },
  {
    id: 'parse-fenced-heading-is-not-a-section',
    run: async () => {
      const p = await parseText(mk([['Goal', '```\n## Fake\n```'], ['Next Steps', '1. x']]))
      same(Object.keys(p.sections), ['Goal', 'Next Steps'])
      assert.equal(p.sections.Goal, '```\n## Fake\n```')
    },
  },
  {
    id: 'parse-fence-tracking-respects-character-and-length',
    run: async () => {
      // A four-backtick fence holding a three-backtick fence, and a tilde fence holding backticks:
      // a bare on/off toggle on any ``` or ~~~ line loses its place in both.
      const four = '````md\n```\n## Fake\n```\n````'
      const tilde = '~~~\n```\n## Fake too\n~~~'
      const p = await parseText(mk([['Goal', four], ['In Progress', tilde], ['Next Steps', '1. x']]))
      same(Object.keys(p.sections), ['Goal', 'In Progress', 'Next Steps'])
    },
  },
  {
    id: 'parse-level-three-heading-stays-in-the-body',
    run: async () => {
      const p = await parseText(mk([['Goal', 'a\n### Detail\nb'], ['Next Steps', '1. x']]))
      assert.equal(p.sections.Goal, 'a\n### Detail\nb')
    },
  },
]

// ---- parse: fixed labels, harness --------------------------------------------------------------

const fixedCases = [
  {
    id: 'parse-fixed-labels-all-five',
    run: async () => {
      same(parseFixture('no-ledger-with-docs-label').fixedLabels, {
        Skill: 'harness',
        Task: 'sample single task',
        Phase: 'generate_done',
        Mode: 'standard',
        Docs: 'docs/harness/sample-single-task/',
      })
    },
  },
  {
    id: 'parse-fixed-labels-none-is-null',
    run: async () => {
      assert.equal(parseFixture('legacy-no-labels').fixedLabels, null)
      assert.equal(parseFixture('label-and-inprogress-differ').fixedLabels, null)
    },
  },
  {
    id: 'parse-fixed-labels-partial-keeps-what-is-there',
    run: async () => {
      const p = await parseText(mk([['In Progress', 'Docs : docs/harness/x'], ['Next Steps', '1. y']]))
      same(p.fixedLabels, { Skill: null, Task: null, Phase: null, Mode: null, Docs: 'docs/harness/x' })
    },
  },
  {
    id: 'parse-fixed-labels-read-only-from-in-progress',
    run: async () => {
      const p = await parseText(mk([['Goal', 'Docs : docs/harness/elsewhere'], ['In Progress', 'nothing'], ['Next Steps', '1. y']]))
      assert.equal(p.fixedLabels, null)
    },
  },
  {
    id: 'parse-fixed-labels-bullet-and-backtick-forms',
    run: async () => {
      const body = '- Skill : harness\n- `Task : a task`\n* Phase : verify_done\nMode : standard\nDocs : docs/harness/y'
      const p = await parseText(mk([['In Progress', body], ['Next Steps', '1. y']]))
      same(p.fixedLabels, { Skill: 'harness', Task: 'a task', Phase: 'verify_done', Mode: 'standard', Docs: 'docs/harness/y' })
    },
  },
]

// ---- parse: ledger -------------------------------------------------------------------------------

const ledgerCases = [
  {
    id: 'parse-ledger-null-without-a-section',
    run: async () => {
      assert.equal(parseFixture('legacy-no-labels').ledger, null)
      assert.equal(parseFixture('no-ledger-with-docs-label').ledger, null)
    },
  },
  {
    id: 'parse-ledger-rows',
    run: async () => {
      same(parseFixture('label-and-inprogress-differ').ledger, {
        rows: [
          { epic: 'alpha-epic', epicRaw: 'alpha-epic', slice: 's1-scan', status: 'done', evidence: '0123456789abcdef0123456789abcdef01234567', notes: 'merged' },
          { epic: 'alpha-epic', epicRaw: 'alpha-epic', slice: 's2-parse', status: 'in-progress', evidence: 'n/a', notes: 'half written' },
        ],
      })
    },
  },
  {
    id: 'parse-ledger-status-strips-emphasis',
    run: async () => {
      const rows = parseFixture('bold-wrapped-status').ledger.rows
      same(rows.map((r) => r.status), ['done', 'blocked', 'in-progress', 'dropped'])
      assert.equal(rows[2].status, 'in-progress')
    },
  },
  {
    id: 'parse-ledger-epic-is-stripped-and-the-raw-cell-is-kept',
    run: async () => {
      const t = table([['**ep-a**', 's1', 'done', 'n/a', ''], ['`ep-b`', 's2', '__done__', 'n/a', '']])
      const rows = (await parseText(mk([['Progress Ledger', t]]))).ledger.rows
      same(rows.map((r) => [r.epic, r.epicRaw]), [['ep-a', '**ep-a**'], ['ep-b', '`ep-b`']])
    },
  },
  {
    id: 'parse-ledger-slice-cell-is-kept-as-written',
    run: async () => {
      const t = table([['ep-a', '`s-1`', 'done', 'n/a', ''], ['ep-a', '**s-2**', 'done', 'n/a', '']])
      const rows = (await parseText(mk([['Progress Ledger', t]]))).ledger.rows
      same(rows.map((r) => r.slice), ['`s-1`', '**s-2**'])
    },
  },
  {
    id: 'parse-ledger-first-table-only',
    run: async () => {
      const rows = parseFixture('ledger-two-tables').ledger.rows
      same(rows.map((r) => r.slice), ['s1-first', 's2-second'])
    },
  },
  {
    id: 'parse-ledger-table-inside-a-fence-is-skipped',
    run: async () => {
      const fenced = '```\n' + table([['ep-a', 's-fenced', 'in-progress', 'n/a', '']]) + '\n```'
      const body = fenced + '\n\n' + table([['ep-a', 's-real', 'done', 'n/a', '']])
      const rows = (await parseText(mk([['Progress Ledger', body]]))).ledger.rows
      same(rows.map((r) => r.slice), ['s-real'])
    },
  },
  {
    id: 'parse-ledger-section-without-a-table-has-no-rows',
    run: async () => {
      same((await parseText(mk([['Progress Ledger', noTable]]))).ledger, { rows: [] })
      const headerOnly = '| Epic | Slice | Status | Evidence | Notes |\n|---|---|---|---|---|'
      same((await parseText(mk([['Progress Ledger', headerOnly]]))).ledger, { rows: [] })
    },
  },
  {
    id: 'parse-ledger-missing-column-is-null',
    run: async () => {
      const t = table([['ep-a', 's1', 'done']], '| Epic | Slice | Status |\n|---|---|---|')
      const rows = (await parseText(mk([['Progress Ledger', t]]))).ledger.rows
      same(rows, [{ epic: 'ep-a', epicRaw: 'ep-a', slice: 's1', status: 'done', evidence: null, notes: null }])
    },
  },
  {
    id: 'parse-ledger-columns-are-found-by-name',
    run: async () => {
      const t = '| Slice | Epic | Notes | Status |\n|---|---|---|---|\n| s1 | ep-a | n | done |'
      const rows = (await parseText(mk([['Progress Ledger', t]]))).ledger.rows
      same(rows, [{ epic: 'ep-a', epicRaw: 'ep-a', slice: 's1', status: 'done', evidence: null, notes: 'n' }])
    },
  },
  {
    id: 'parse-ledger-escaped-pipe-stays-in-its-cell',
    run: async () => {
      const t = table([['ep-a', 's1', 'done', 'n/a', 'a \\| b']])
      const rows = (await parseText(mk([['Progress Ledger', t]]))).ledger.rows
      assert.equal(rows[0].notes, 'a \\| b')
    },
  },
]

// ---- parse: Next Steps item 1 --------------------------------------------------------------------

const LABEL_FORMS = [
  ['on the item line', '1. Slice : s-one\n   more text', 's-one'],
  ['on its own indented line', '1. Do the thing first.\n   Slice : s-two\n   more text', 's-two'],
  ['no space before the colon', '1. Slice: s-three', 's-three'],
  ['value in backticks is kept as written', '1. Slice : `s-four`', '`s-four`'],
  ['bold-wrapped label and value', '1. **Slice : `s-five`**', '`s-five`'],
  ['bold with the colon inside', '1. **Slice :** s-six', 's-six'],
  ['bullet marker', '- Slice : s-seven', 's-seven'],
  ['a bold sentence that merely starts with the word', '1. **Slice A is confirmed**, then continue.', null],
  ['the word in the middle of a line', '1. Start the next Slice : never mind.', null],
  ['label with no value', '1. Slice :', null],
  ['label only in item 2', '1. Do the thing first.\n2. Slice : s-late', null],
  ['no label at all', '1. Do the thing first.', null],
]

const stepOneCases = [
  {
    id: 'parse-step-one-text-drops-only-the-marker',
    run: async () => {
      const p = parseFixture('no-ledger-no-docs')
      assert.equal(p.stepOne.text, 'Add the missing retry test for the auto-fix loop, then re-run verify.')
      same(p.stepOne.candidates, [])
      assert.equal(p.stepOne.sliceLabel, null)
      assert.equal(parseFixture('label-and-inprogress-differ').stepOne.text, 'Slice : s3-render\n   Finish the renderer after slice two lands.')
    },
  },
  {
    id: 'parse-step-one-candidates-skip-nothing',
    run: async () => {
      // A backtick token that starts with a slash is listed whether or not it is a command;
      // telling them apart is the `next` command's job.
      same(parseFixture('path-like-token').stepOne.candidates, [
        '/dev/null',
        '/handoff resume docs/harness/handoff/2026-01-13-slash-path.md',
      ])
    },
  },
  {
    id: 'parse-step-one-negated-token-is-still-a-candidate',
    run: async () => {
      same(parseFixture('negated-command-token').stepOne.candidates, ['/harness'])
    },
  },
  {
    id: 'parse-step-one-two-candidates-in-order',
    run: async () => {
      same(parseFixture('two-command-tokens').stepOne.candidates, ['/harness-gate', '/harness-build --epic'])
      same(parseFixture('done-only-last-row').stepOne.candidates, ['/harness --output-dir docs/harness/next-slice "next-slice"'])
    },
  },
  {
    id: 'parse-step-one-slice-label-forms',
    run: async () => {
      for (const [what, body, want] of LABEL_FORMS) {
        const p = await parseText(mk([['Next Steps', body]]))
        assert.equal(p.stepOne.sliceLabel, want, what)
      }
    },
  },
  {
    id: 'parse-step-one-slice-label-from-a-fixture',
    run: async () => {
      assert.equal(parseFixture('label-and-inprogress-differ').stepOne.sliceLabel, 's3-render')
      assert.equal(parseFixture('no-label-two-inprogress').stepOne.sliceLabel, null)
    },
  },
  {
    id: 'parse-step-one-ends-at-the-next-sibling',
    run: async () => {
      const body = '1. First step.\n   - a nested bullet\n   1. a nested numbered line\n   2. another nested line\n\n   A continuation paragraph.\n2. Second step.'
      const p = await parseText(mk([['Next Steps', body]]))
      assert.equal(
        p.stepOne.text,
        'First step.\n   - a nested bullet\n   1. a nested numbered line\n   2. another nested line\n\n   A continuation paragraph.',
      )
    },
  },
  {
    id: 'parse-step-one-ignores-list-lines-inside-a-fence',
    run: async () => {
      const body = '1. First step:\n   ```\n2. not an item\n   ```\n2. Second step.'
      const p = await parseText(mk([['Next Steps', body]]))
      assert.equal(p.stepOne.text, 'First step:\n   ```\n2. not an item\n   ```')
    },
  },
  {
    id: 'parse-step-one-falls-back-to-the-first-bullet',
    run: async () => {
      const p = await parseText(mk([['Next Steps', '- First bullet.\n- Second bullet.']]))
      assert.equal(p.stepOne.text, 'First bullet.')
    },
  },
  {
    id: 'parse-step-one-prefers-item-one-over-an-earlier-bullet',
    run: async () => {
      const p = await parseText(mk([['Next Steps', '- A preamble bullet.\n\n1. The real first step.\n2. The second.']]))
      assert.equal(p.stepOne.text, 'The real first step.')
    },
  },
  {
    id: 'parse-step-one-absent-is-empty',
    run: async () => {
      const none = { text: '', candidates: [], sliceLabel: null }
      same((await parseText(mk([['Goal', 'x']]))).stepOne, none)
      same((await parseText(mk([['Next Steps', 'Only prose, no list.']]))).stepOne, none)
    },
  },
]

// ---- parse: Reading Order ----------------------------------------------------------------------------

const file = (raw, p, range = null) => ({ raw, path: p, range, isFile: true, self: false })
const nonFile = (raw) => ({ raw, path: null, range: null, isFile: false, self: false })

const readingOrderCases = [
  {
    id: 'parse-reading-order-forms',
    run: async () => {
      same(parseFixture('reading-order-forms').readingOrder, [
        { raw: '이 문서', path: null, range: null, isFile: false, self: true },
        file('docs/guide/overview.md', 'docs/guide/overview.md'),
        file('src/lib/reader.js:120-180', 'src/lib/reader.js', { type: 'lines', start: 120, end: 180 }),
        file('docs/guide/overview.md §Install steps', 'docs/guide/overview.md', { type: 'section', heading: 'Install steps' }),
        file('src/lib/writer.js:42', 'src/lib/writer.js'),
        file('src/lib/other.js#L10-L20', 'src/lib/other.js'),
        file('src/lib/third.js (entry point)', 'src/lib/third.js'),
        file('src/lib/reversed.js:30-10', 'src/lib/reversed.js'),
        file('src/lib/', 'src/lib/'),
        nonFile('Skim the `Goal` section of the previous handoff — a token that is not a path'),
        nonFile('Everything under the sample folder — no backtick token at all'),
        file('src/lib/bullet.js:1-5', 'src/lib/bullet.js', { type: 'lines', start: 1, end: 5 }),
        nonFile('`LICENSE` — a bare name with no slash and no extension is not a path'),
      ])
    },
  },
  {
    id: 'parse-reading-order-absent-is-empty',
    run: async () => {
      same((await parseText(mk([['Goal', 'x']]))).readingOrder, [])
    },
  },
  {
    id: 'parse-reading-order-both-forms-prefers-the-line-range',
    run: async () => {
      const body = '1. `src/a.js:3-9 §Heading` — both\n2. `src/b.js §Heading (note)` — section, then a parenthesis'
      const ro = (await parseText(mk([['Reading Order', body]]))).readingOrder
      same(ro[0].range, { type: 'lines', start: 3, end: 9 })
      assert.equal(ro[0].path, 'src/a.js')
      same(ro[1].range, { type: 'section', heading: 'Heading (note)' })
      assert.equal(ro[1].path, 'src/b.js')
    },
  },
  {
    id: 'parse-reading-order-ignores-list-lines-inside-a-fence',
    run: async () => {
      const body = '1. `src/a.js` — real\n```\n2. `src/in-fence.js` — not an item\n```'
      const ro = (await parseText(mk([['Reading Order', body]]))).readingOrder
      same(ro.map((e) => e.path), ['src/a.js'])
    },
  },
]

// ---- parse: line endings, BOM --------------------------------------------------------------------------

const encodingCases = [
  {
    id: 'parse-crlf-gives-the-same-result-as-lf',
    run: async () => {
      for (const name of FIXTURES) {
        const text = fixtureText(name)
        assert.ok(!text.includes('\r'), `${name} fixture must be committed with LF`)
        same(await parseText(toCrlf(text)), await parseText(text), name)
      }
    },
  },
  {
    id: 'parse-leading-bom-is-ignored',
    run: async () => {
      const text = fixtureText('label-and-inprogress-differ')
      same(await parseText('\uFEFF' + text), await parseText(text))
    },
  },
  {
    id: 'parse-lib-throws-an-input-error-for-a-non-handoff',
    run: async () => {
      const { parseHandoff } = await parseLib()
      assert.throws(() => parseHandoff('# Meeting notes\n'), (e) => e.name === 'InputError' && /# HANDOFF —/.test(e.message))
      assert.throws(() => parseHandoff(''), (e) => e.name === 'InputError')
    },
  },
]

// ---- the current Next derivation (legacy_next.mjs) -------------------------------------------------------

const legacyCases = [
  {
    id: 'legacy-next-in-progress-row-beats-the-label',
    run: async () => {
      same(await legacyOf(fixtureText('label-and-inprogress-differ')), { slice: 's2-parse', source: 'in-progress' })
    },
  },
  {
    id: 'legacy-next-last-in-progress-row-wins',
    run: async () => {
      same(await legacyOf(fixtureText('no-label-two-inprogress')), { slice: 's3-export', source: 'in-progress' })
    },
  },
  {
    id: 'legacy-next-done-only-falls-back-to-the-last-row',
    run: async () => {
      same(await legacyOf(fixtureText('done-only-last-row')), { slice: 's2-store', source: 'last-row' })
    },
  },
  {
    id: 'legacy-next-label-is-used-when-no-row-is-in-progress',
    run: async () => {
      const t = table([['ep-a', 's1', 'done', 'n/a', ''], ['ep-a', 's2', 'done', 'n/a', '']])
      const text = mk([['Next Steps', '1. Slice : s3-next'], ['Progress Ledger', t]])
      same(await legacyOf(text), { slice: 's3-next', source: 'label' })
    },
  },
  {
    id: 'legacy-next-bold-wrapped-status-counts-as-in-progress',
    run: async () => {
      same(await legacyOf(fixtureText('bold-wrapped-status')), { slice: 's3-publish', source: 'in-progress' })
    },
  },
  {
    id: 'legacy-next-reads-only-the-first-ledger-table',
    run: async () => {
      same(await legacyOf(fixtureText('ledger-two-tables')), { slice: 's2-second', source: 'in-progress' })
    },
  },
  {
    id: 'legacy-next-docs-last-segment-without-a-ledger',
    run: async () => {
      same(await legacyOf(fixtureText('no-ledger-with-docs-label')), { slice: 'sample-single-task', source: 'docs' })
    },
  },
  {
    id: 'legacy-next-docs-strips-one-trailing-slash',
    run: async () => {
      for (const docs of ['docs/harness/x-task', 'docs/harness/x-task/']) {
        const text = mk([['In Progress', `Docs : ${docs}`], ['Next Steps', '1. Do it.']])
        same(await legacyOf(text), { slice: 'x-task', source: 'docs' }, docs)
      }
    },
  },
  {
    id: 'legacy-next-a-lone-docs-label-counts',
    run: async () => {
      const text = mk([['In Progress', 'Docs : docs/harness/lone'], ['Next Steps', '1. Do it.']])
      same(await legacyOf(text), { slice: 'lone', source: 'docs' })
    },
  },
  {
    id: 'legacy-next-prose-docs-path-is-not-a-label',
    run: async () => {
      same(await legacyOf(fixtureText('legacy-no-labels')), { slice: 'Finish reviewing the second note.', source: 'step-one' })
    },
  },
  {
    id: 'legacy-next-step-one-verbatim-without-ledger-or-docs',
    run: async () => {
      same(await legacyOf(fixtureText('no-ledger-no-docs')), {
        slice: 'Add the missing retry test for the auto-fix loop, then re-run verify.',
        source: 'step-one',
      })
    },
  },
  {
    id: 'legacy-next-nothing-at-all-is-an-empty-step-one',
    run: async () => {
      same(await legacyOf(mk([['Goal', 'x']])), { slice: '', source: 'step-one' })
    },
  },
  {
    id: 'legacy-next-a-ledger-beats-a-docs-label',
    run: async () => {
      const t = table([['ep-a', 's1', 'done', 'n/a', '']])
      const text = mk([['In Progress', 'Docs : docs/harness/x-task/'], ['Next Steps', '1. Do it.'], ['Progress Ledger', t]])
      same(await legacyOf(text), { slice: 's1', source: 'last-row' })
    },
  },
  {
    id: 'legacy-next-an-empty-ledger-falls-through-to-docs',
    run: async () => {
      const text = mk([['In Progress', 'Docs : docs/harness/x-task/'], ['Next Steps', '1. Do it.'], ['Progress Ledger', noTable]])
      same(await legacyOf(text), { slice: 'x-task', source: 'docs' })
    },
  },
  {
    id: 'legacy-next-a-label-without-a-ledger-is-not-read',
    run: async () => {
      const text = mk([['Next Steps', '1. Slice : s-orphan\n   Then more.']])
      const got = await legacyOf(text)
      assert.equal(got.source, 'step-one')
      assert.match(got.slice, /^Slice : s-orphan/)
    },
  },
  {
    id: 'legacy-next-slice-backticks-lose-exactly-one-pair',
    run: async () => {
      const cell = async (slice) => {
        const t = table([['ep-a', slice, 'in-progress', 'n/a', '']])
        return (await legacyOf(mk([['Progress Ledger', t]]))).slice
      }
      assert.equal(await cell('`s-a`'), 's-a')
      assert.equal(await cell('`s-b'), '`s-b') // unbalanced: verbatim
      assert.equal(await cell('**s-c**'), '**s-c**') // only backticks are normalised
      assert.equal(await cell('``s-d``'), '`s-d`') // exactly one pair
    },
  },
  {
    id: 'legacy-next-label-backticks-lose-one-pair',
    run: async () => {
      const t = table([['ep-a', 's1', 'done', 'n/a', '']])
      same(await legacyOf(mk([['Next Steps', '1. Slice : `s-lbl`'], ['Progress Ledger', t]])), { slice: 's-lbl', source: 'label' })
    },
  },
  {
    id: 'legacy-next-epic-of-the-last-row-selects-the-rows',
    run: async () => {
      const t = table([['ep-a', 'a1', 'in-progress', 'n/a', ''], ['ep-b', 'b1', 'done', 'n/a', '']])
      same(await legacyOf(mk([['Progress Ledger', t]])), { slice: 'b1', source: 'last-row' })
    },
  },
  {
    id: 'legacy-next-epic-cell-is-not-normalised',
    run: async () => {
      // 9.0.1 reads the Epic cell raw (the contract lists normalising it as deferred), so a
      // bold-wrapped Epic and a bare one are two different epics. This pins that defect; the
      // new derivation must not inherit it, and when it stops doing so this case is replaced.
      const t = table([['**ep-a**', 'a1', 'in-progress', 'n/a', ''], ['ep-a', 'a2', 'done', 'n/a', '']])
      same(await legacyOf(mk([['Progress Ledger', t]])), { slice: 'a2', source: 'last-row' })
    },
  },
  {
    id: 'legacy-next-tiers-expose-every-candidate',
    run: async () => {
      const { parseHandoff } = await parseLib()
      const { legacyTiers } = await legacyLib()
      same(viaJson(legacyTiers(parseHandoff(fixtureText('label-and-inprogress-differ')))), {
        ledger: true, inProgress: 's2-parse', label: 's3-render', lastRow: 's2-parse', docs: null, stepOne: 'Slice : s3-render\n   Finish the renderer after slice two lands.',
      })
      same(viaJson(legacyTiers(parseHandoff(fixtureText('no-ledger-with-docs-label')))), {
        ledger: false, inProgress: null, label: null, lastRow: null, docs: 'sample-single-task', stepOne: 'Re-run the verify step, then review the result.',
      })
    },
  },
  {
    id: 'legacy-next-a-ledger-without-a-slice-column-is-no-value-not-a-crash',
    run: async () => {
      // The Slice column is missing, so every row's slice is null: that is "no value" (a TypeError
      // here was a deferred defect). The row cannot name a slice, so the derivation moves on.
      const header = '| Epic | Status |\n|---|---|'
      const rows = [['ep-a', 'done'], ['ep-a', 'in-progress']]
      const bare = mk([['Next Steps', '1. Carry on.'], ['Progress Ledger', table(rows, header)]])
      same(await legacyOf(bare), { slice: 'Carry on.', source: 'step-one' })
      const labelled = mk([['Next Steps', '1. Slice : s-lbl'], ['Progress Ledger', table(rows, header)]])
      same(await legacyOf(labelled), { slice: 's-lbl', source: 'label' })
      const docs = mk([['In Progress', 'Docs : docs/harness/x-task/'], ['Next Steps', '1. Carry on.'], ['Progress Ledger', table(rows, header)]])
      same(await legacyOf(docs), { slice: 'x-task', source: 'docs' })
    },
  },
]

// ---- the new Next derivation and the command candidates (lib/next.mjs) --------------------------------------
//
// `next` reads the PARSED document. Most cases build the document in memory (mk/table) and call the
// library; the cases that assert what a skill would read go through the command line on a fixture.

const row = (slice, status, epic = 'ep-a') => [epic, slice, status, 'n/a', '']

// An epic-style document: Next Steps item 1, optional ledger rows, optional recorded Docs value.
function epicDoc({ step = '1. Carry on.', rows = null, docs = null, header } = {}) {
  const pairs = []
  if (docs !== null) pairs.push(['In Progress', `Docs : ${docs}`])
  pairs.push(['Next Steps', step])
  if (rows !== null) pairs.push(['Progress Ledger', table(rows, header)])
  return mk(pairs)
}

async function nextOf(text, stateRelevant) {
  const { parseHandoff } = await parseLib()
  const { deriveNext } = await nextLib()
  return viaJson(deriveNext(parseHandoff(text), stateRelevant === undefined ? undefined : { stateRelevant }))
}

// `next` through the command line, as JSON; an undefined `stateRelevant` leaves the flag out.
function nextFixture(name, stateRelevant) {
  const args = ['next', '--doc', path.join(FIX, `${name}.md`)]
  if (stateRelevant !== undefined) args.push('--state-relevant', String(stateRelevant))
  const r = cli(...args)
  assert.equal(r.status, 0, `exit ${r.status}: ${r.stderr}`)
  assert.equal(r.stderr, '')
  return JSON.parse(r.stdout)
}

// The derivation's answer without the command candidates (those have their own cases).
const core = ({ slice, source, ambiguous }) => ({ slice, source, ambiguous })

const nextCases = [
  {
    id: 'next-label-wins',
    run: async () => {
      // The label names X while two rows are in progress (Y, Z): the label is the answer, not a tie-break.
      const t = epicDoc({ step: '1. Slice : s-x\n   Then carry on.', rows: [row('s-w', 'done'), row('s-y', 'in-progress'), row('s-z', 'in-progress')] })
      same(core(await nextOf(t)), { slice: 's-x', source: 'label', ambiguous: [] })
      // the fixture whose single in-progress row names another slice, read as a skill reads it
      same(core(nextFixture('label-and-inprogress-differ')), { slice: 's3-render', source: 'label', ambiguous: [] })
      // the label is read without a ledger too
      same(core(await nextOf(epicDoc({ step: '1. Slice : s-orphan\n   Then more.' }))), { slice: 's-orphan', source: 'label', ambiguous: [] })
    },
  },
  {
    id: 'next-single-in-progress',
    run: async () => {
      const last = epicDoc({ rows: [row('s-a', 'done'), row('s-b', 'in-progress')] })
      same(core(await nextOf(last)), { slice: 's-b', source: 'in-progress', ambiguous: [] })
      // the live row need not be the last one
      const middle = epicDoc({ rows: [row('s-a', 'in-progress'), row('s-b', 'done')] })
      same(core(await nextOf(middle)), { slice: 's-a', source: 'in-progress', ambiguous: [] })
      same(core(nextFixture('ledger-two-tables')), { slice: 's2-second', source: 'in-progress', ambiguous: [] })
    },
  },
  {
    id: 'next-two-in-progress-no-label',
    run: async () => {
      // No row is picked: the result is the ambiguity, its source is Next Steps item 1, `slice` is null.
      same(core(nextFixture('no-label-two-inprogress')), { slice: null, source: 'step-one', ambiguous: ['s2-validate', 's3-export'] })
      // the Docs tier does not settle it either, however relevant the task state is
      const t = epicDoc({ docs: 'docs/harness/x-task/', rows: [row('s-a', 'in-progress'), row('s-b', 'in-progress')] })
      same(core(await nextOf(t, true)), { slice: null, source: 'step-one', ambiguous: ['s-a', 's-b'] })
    },
  },
  {
    id: 'next-done-only',
    run: async () => {
      // The last row is the slice that just finished; it must not come back as the next one.
      const r = nextFixture('done-only-last-row')
      assert.notEqual(r.slice, 's2-store')
      same(core(r), { slice: 'Start the next slice with `/harness --output-dir docs/harness/next-slice "next-slice"`.', source: 'step-one', ambiguous: [] })
      // with a recorded Docs value and a relevant task state the Docs tier comes before item 1
      const t = epicDoc({ docs: 'docs/harness/x-task/', rows: [row('s1', 'done'), row('s2', 'done')] })
      same(core(await nextOf(t, true)), { slice: 'x-task', source: 'docs', ambiguous: [] })
      same(core(await nextOf(t, false)), { slice: 'Carry on.', source: 'step-one', ambiguous: [] })
    },
  },
  {
    id: 'next-bold-status',
    run: async () => {
      same(core(nextFixture('bold-wrapped-status')), { slice: 's3-publish', source: 'in-progress', ambiguous: [] })
      // emphasis and backticks around a Status cell are removed once each, whichever the status
      const t = epicDoc({ rows: [row('s-a', '**done**'), row('s-b', '__`in-progress`__')] })
      same(core(await nextOf(t)), { slice: 's-b', source: 'in-progress', ambiguous: [] })
    },
  },
  {
    id: 'next-docs-tier-needs-relevance',
    run: async () => {
      same(core(nextFixture('no-ledger-with-docs-label', true)), { slice: 'sample-single-task', source: 'docs', ambiguous: [] })
      // not relevant, or the flag left out: the Docs value is not used
      for (const flag of [false, undefined]) {
        const want = { slice: 'Re-run the verify step, then review the result.', source: 'step-one', ambiguous: [] }
        same(core(nextFixture('no-ledger-with-docs-label', flag)), want, String(flag))
      }
      // one trailing slash is dropped first; a value with no segment is no value
      for (const [docs, want] of [['docs/harness/x-task', 'x-task'], ['docs/harness/x-task/', 'x-task'], ['x-task', 'x-task']]) {
        same(core(await nextOf(epicDoc({ docs }), true)), { slice: want, source: 'docs', ambiguous: [] }, docs)
      }
      same(core(await nextOf(epicDoc({ docs: '/' }), true)), { slice: 'Carry on.', source: 'step-one', ambiguous: [] })
    },
  },
  {
    id: 'next-docs-names-a-done-slice',
    run: async () => {
      // The recorded Docs folder is the slice that has just finished: that tier has no value, item 1 answers.
      const t = epicDoc({ docs: 'docs/harness/s2-store/', rows: [row('s1-load', 'done'), row('s2-store', 'done')] })
      same(core(await nextOf(t, true)), { slice: 'Carry on.', source: 'step-one', ambiguous: [] })
      // the Slice cell is compared with its wrapper removed, and the Docs value with its own
      const wrapped = epicDoc({ docs: '`docs/harness/s2-store/`', rows: [row('s1-load', 'done'), row('**s2-store**', 'done')] })
      same(core(await nextOf(wrapped, true)), { slice: 'Carry on.', source: 'step-one', ambiguous: [] })
      // a done slice of ANOTHER Epic does not count, nor does a Docs folder that is not a done slice
      const other = epicDoc({ docs: 'docs/harness/s9-other/', rows: [row('s9-other', 'done', 'ep-b'), row('s1-load', 'done')] })
      same(core(await nextOf(other, true)), { slice: 's9-other', source: 'docs', ambiguous: [] })
      const live = epicDoc({ docs: 'docs/harness/x-task/', rows: [row('s1-load', 'done'), row('s2-store', 'done')] })
      same(core(await nextOf(live, true)), { slice: 'x-task', source: 'docs', ambiguous: [] })
    },
  },
  {
    id: 'next-docs-value-in-backticks-is-unwrapped',
    run: async () => {
      same(core(await nextOf(epicDoc({ docs: '`docs/harness/x-task/`' }), true)), { slice: 'x-task', source: 'docs', ambiguous: [] })
      same(core(await nextOf(epicDoc({ docs: '`docs/harness/x-task`' }), true)), { slice: 'x-task', source: 'docs', ambiguous: [] })
    },
  },
  {
    id: 'next-slice-cells-lose-one-wrapper-pair',
    run: async () => {
      const cell = async (slice) => (await nextOf(epicDoc({ rows: [row(slice, 'in-progress')] }))).slice
      assert.equal(await cell('`s-a`'), 's-a')
      assert.equal(await cell('**s-b**'), 's-b')
      assert.equal(await cell('__s-c__'), 's-c')
      assert.equal(await cell('**`s-d`**'), 's-d')
      assert.equal(await cell('``s-e``'), '`s-e`') // exactly one backtick pair
      assert.equal(await cell('`s-f'), '`s-f') // unbalanced: verbatim
      // the label value is read the same way
      const label = async (v) => nextOf(epicDoc({ step: `1. Slice : ${v}` }))
      assert.equal((await label('**s-g**')).slice, 's-g')
      assert.equal((await label('`s-h`')).slice, 's-h')
      assert.equal((await label('s-i')).slice, 's-i')
      // a label that is nothing but a wrapper has no value, so the derivation moves on
      const bare = await label('``')
      assert.equal(bare.source, 'step-one')
      assert.equal(bare.slice, 'Slice : ``')
    },
  },
  {
    id: 'next-epic-of-the-last-row-selects-the-rows',
    run: async () => {
      // rows of another Epic do not count
      const other = epicDoc({ rows: [row('a1', 'in-progress', 'ep-a'), row('b1', 'done', 'ep-b')] })
      same(core(await nextOf(other)), { slice: 'Carry on.', source: 'step-one', ambiguous: [] })
      // the Epic cell is read with its emphasis removed: `**ep-a**` and `ep-a` are one Epic
      const wrapped = epicDoc({ rows: [row('a1', 'in-progress', '**ep-a**'), row('a2', 'done', 'ep-a')] })
      same(core(await nextOf(wrapped)), { slice: 'a1', source: 'in-progress', ambiguous: [] })
    },
  },
  {
    id: 'next-missing-or-empty-slice-is-no-value',
    run: async () => {
      // No Slice column at all: no crash, and the row cannot name a slice.
      const header = '| Epic | Status |\n|---|---|'
      const rows = [['ep-a', 'in-progress']]
      same(core(await nextOf(epicDoc({ rows, header }))), { slice: 'Carry on.', source: 'step-one', ambiguous: [] })
      same(core(await nextOf(epicDoc({ rows, header, docs: 'docs/harness/x-task/' }), true)), { slice: 'x-task', source: 'docs', ambiguous: [] })
      same(core(await nextOf(epicDoc({ rows, header, step: '1. Slice : s-lbl' }))), { slice: 's-lbl', source: 'label', ambiguous: [] })
      // An empty Slice cell is the same: one in-progress row with no value is not an ambiguity.
      same(core(await nextOf(epicDoc({ rows: [row('', 'in-progress')] }))), { slice: 'Carry on.', source: 'step-one', ambiguous: [] })
    },
  },
  {
    id: 'next-all-valueless-in-progress-rows-fall-through',
    run: async () => {
      // Two in-progress rows that cannot name a slice are no ambiguity: the tier has no value, the next one answers.
      const header = '| Epic | Status |\n|---|---|'
      const rows = [['ep-a', 'in-progress'], ['ep-a', 'in-progress']]
      same(core(await nextOf(epicDoc({ rows, header }))), { slice: 'Carry on.', source: 'step-one', ambiguous: [] })
      same(core(await nextOf(epicDoc({ rows, header, docs: 'docs/harness/x-task/' }), true)), { slice: 'x-task', source: 'docs', ambiguous: [] })
      same(core(await nextOf(epicDoc({ rows: [row('', 'in-progress'), row('', 'in-progress')] }))), { slice: 'Carry on.', source: 'step-one', ambiguous: [] })
    },
  },
  {
    id: 'next-mixed-valueless-in-progress-rows-are-ambiguous',
    run: async () => {
      // One row with a slice and one without are still two in-progress rows: ambiguous (D6). `ambiguous`
      // lists the slice that exists; `inProgressRows` is the count the briefing prints, blanks included.
      const t = epicDoc({ rows: [row('s-a', 'in-progress'), row('', 'in-progress')] })
      const r = await nextOf(t)
      same(core(r), { slice: null, source: 'step-one', ambiguous: ['s-a'] })
      assert.equal(r.inProgressRows, 2)
      // a plain ambiguity counts its rows too, and a result that is not one still carries the count
      assert.equal((await nextOf(epicDoc({ rows: [row('s-a', 'in-progress'), row('s-b', 'in-progress'), row('s-c', 'in-progress')] }))).inProgressRows, 3)
      assert.equal((await nextOf(epicDoc({ rows: [row('s-a', 'in-progress')] }))).inProgressRows, 1)
      assert.equal((await nextOf(epicDoc({}))).inProgressRows, 0)
    },
  },
  {
    id: 'next-without-any-item-one',
    run: async () => {
      same(core(await nextOf(mk([['Goal', 'x']]))), { slice: '', source: 'step-one', ambiguous: [] })
      same((await nextOf(mk([['Goal', 'x']]))).commandCandidates, [])
    },
  },
  {
    id: 'cli-next-prints-one-json-object-and-checks-its-flag',
    run: async () => {
      const doc = path.join(FIX, 'no-ledger-with-docs-label.md')
      const ok = cli('next', '--doc', doc, '--state-relevant', 'true')
      assert.equal(ok.status, 0, ok.stderr)
      assert.equal(ok.stderr, '')
      assert.ok(ok.stdout.endsWith('\n') && !ok.stdout.slice(0, -1).includes('\n'), 'one line of JSON')
      same(Object.keys(JSON.parse(ok.stdout)).sort(), ['ambiguous', 'commandCandidates', 'inProgressRows', 'slice', 'source'])
      // exactly `true` or `false`; anything else is a usage error
      for (const bad of ['maybe', '1', 'TRUE', '']) {
        const r = cli('next', '--doc', doc, '--state-relevant', bad)
        assert.equal(r.status, 2, `[${bad}]`)
        assert.equal(r.stdout, '')
        assert.match(r.stderr, /--state-relevant/)
      }
      assert.equal(cli('next').status, 2, '--doc is required')
      const notHandoff = cli('next', '--doc', path.join(FIX, 'non-handoff.md'))
      assert.equal(notHandoff.status, 1)
      assert.equal(notHandoff.stdout, '')
    },
  },
  {
    id: 'cmd-skips-path-like',
    run: async () => {
      const t = epicDoc({ step: '1. Send it to `/dev/null`, read `/usr/bin/x`, `/C:/x`, `/templates/` and `//`, then run `/harness-build`.' })
      same((await nextOf(t)).commandCandidates, ['/harness-build'])
      // the name must start with a lowercase letter
      same((await nextOf(epicDoc({ step: '1. Try `/Harness`, `/1x` and `/-x`.' }))).commandCandidates, [])
      // the fixture whose only slash tokens are a device path and the self call
      same(nextFixture('path-like-token').commandCandidates, [])
    },
  },
  {
    id: 'cmd-skips-self',
    run: async () => {
      const t = epicDoc({ step: '1. Resume with `/handoff resume docs/x.md`, `/handoff` or `/agent-harness:handoff list`, then run `/harness-build`.' })
      same((await nextOf(t)).commandCandidates, ['/harness-build'])
      // the name is matched whole: a command that merely starts with it is not the self call
      same((await nextOf(epicDoc({ step: '1. Run `/handoff-notes now`.' }))).commandCandidates, ['/handoff-notes now'])
    },
  },
  {
    id: 'cmd-whole-token',
    run: async () => {
      // the token is one candidate with its arguments, byte for byte
      same(nextFixture('done-only-last-row').commandCandidates, ['/harness --output-dir docs/harness/next-slice "next-slice"'])
      same((await nextOf(epicDoc({ step: '1. Run `/agent-harness:harness-build --epic`.' }))).commandCandidates, ['/agent-harness:harness-build --epic'])
    },
  },
  {
    id: 'cmd-two-candidates-both-listed',
    run: async () => {
      same(nextFixture('two-command-tokens').commandCandidates, ['/harness-gate', '/harness-build --epic'])
      // order is the order of first appearance
      same((await nextOf(epicDoc({ step: '1. Run `/harness-gate`, then `/ship`.' }))).commandCandidates, ['/harness-gate', '/ship'])
    },
  },
  {
    id: 'cmd-identical-tokens-count-once',
    run: async () => {
      // A token that is byte-identical to an earlier one is the same candidate, not another one.
      same((await nextOf(epicDoc({ step: '1. Run `/ship`, and if it stops run `/ship` again.' }))).commandCandidates, ['/ship'])
      same((await nextOf(epicDoc({ step: '1. `/a-cmd x`, `/b-cmd`, `/a-cmd x`, `/b-cmd`.' }))).commandCandidates, ['/a-cmd x', '/b-cmd'])
      // a token that differs by a single byte is another one
      same((await nextOf(epicDoc({ step: '1. `/ship`, then `/ship now`.' }))).commandCandidates, ['/ship', '/ship now'])
    },
  },
  {
    id: 'cmd-zero',
    run: async () => {
      same(nextFixture('no-ledger-no-docs').commandCandidates, [])
      same(nextFixture('legacy-no-labels').commandCandidates, [])
    },
  },
  {
    id: 'cmd-negation-stays-prose',
    run: async () => {
      // The script returns what has the shape of a command; deciding that item 1 says "not a command"
      // is the model's reading of the prose.
      same(nextFixture('negated-command-token').commandCandidates, ['/harness'])
    },
  },
]

// ---- corpus tools (test-side): the parsers they export, on invented text ----------------------------------

const corpusCases = [
  {
    id: 'corpus-strip-hint',
    run: async () => {
      const { stripHint } = await snapshotLib()
      const want = {
        'src/a.js': 'src/a.js',
        'src/a.js:12-34': 'src/a.js',
        'src/a.js#L12-L34': 'src/a.js',
        'src/a.js:12': 'src/a.js',
        'src/a.js §Some heading': 'src/a.js',
        'src/a.js (a note)': 'src/a.js',
        'src/a.js:12-34 §x': 'src/a.js',
        'docs/a.md §Heading (note)': 'docs/a.md',
      }
      for (const [raw, p] of Object.entries(want)) assert.equal(stripHint(raw), p, raw)
    },
  },
  {
    id: 'corpus-looks-like-path',
    run: async () => {
      const { looksLikePath } = await snapshotLib()
      for (const yes of ['src/a.js', 'a.md', 'dir/', 'C:\\x\\y', '/abs/path', '~/x']) assert.equal(looksLikePath(yes), true, yes)
      for (const no of ['Spec', 'LICENSE', 'a b.js', 'src/*.js', '{a,b}.js', '']) assert.equal(looksLikePath(no), false, no)
      // Known and left alone: a version string ends in `.<digits>`, so it passes the extension
      // test. Tightening it would change the frozen Reading Order baseline (the real corpus has
      // no such entry, measured), so the behaviour is pinned here instead of fixed.
      assert.equal(looksLikePath('v9.0.1'), true)
    },
  },
  {
    id: 'corpus-extract-reading-order',
    run: async () => {
      const { extractReadingOrder } = await snapshotLib()
      const r = extractReadingOrder(fixtureText('reading-order-forms'))
      assert.equal(r.items, 13)
      same(r.entries.map((e) => [e.kind, e.raw, e.path]), [
        ['self', '이 문서', ''],
        ['path', 'docs/guide/overview.md', 'docs/guide/overview.md'],
        ['path', 'src/lib/reader.js:120-180', 'src/lib/reader.js'],
        ['path', 'docs/guide/overview.md §Install steps', 'docs/guide/overview.md'],
        ['path', 'src/lib/writer.js:42', 'src/lib/writer.js'],
        ['path', 'src/lib/other.js#L10-L20', 'src/lib/other.js'],
        ['path', 'src/lib/third.js (entry point)', 'src/lib/third.js'],
        ['path', 'src/lib/reversed.js:30-10', 'src/lib/reversed.js'],
        ['path', 'src/lib/', 'src/lib/'],
        ['path', 'src/lib/bullet.js:1-5', 'src/lib/bullet.js'],
      ])
    },
  },
  {
    id: 'corpus-parse-facts',
    run: async () => {
      const { parseFacts } = await measureLib()
      const a = parseFacts(fixtureText('bold-wrapped-status'))
      assert.equal(a.ledger.present, true)
      assert.equal(a.ledger.rows, 4)
      assert.equal(a.ledger.inProgress, 1)
      assert.equal(a.fixedAll, false)
      const b = parseFacts(fixtureText('no-ledger-with-docs-label'))
      assert.equal(b.ledger.present, false)
      assert.equal(b.fixedAll, true)
      assert.equal(b.docsUnderHarness, true)
      const c = parseFacts(fixtureText('ledger-two-tables'))
      assert.equal(c.ledger.rows, 2)
      assert.equal(c.ledger.inProgress, 1)
    },
  },
  {
    id: 'parse-agrees-with-the-corpus-tools-on-every-fixture',
    run: async () => {
      const { extractReadingOrder } = await snapshotLib()
      const { parseFacts } = await measureLib()
      const { parseHandoff } = await parseLib()
      for (const name of FIXTURES) {
        const text = fixtureText(name)
        const p = viaJson(parseHandoff(text))
        const fromParse = p.readingOrder.filter((e) => e.self || e.isFile).map((e) => [e.self ? 'self' : 'path', e.raw])
        const fromCorpus = extractReadingOrder(text).entries.map((e) => [e.kind, e.raw])
        same(fromParse, fromCorpus, `${name}: Reading Order`)
        const facts = parseFacts(text)
        const rows = p.ledger ? p.ledger.rows : []
        assert.equal(rows.length, facts.ledger.rows, `${name}: ledger rows`)
        assert.equal(rows.filter((r) => r.status === 'in-progress').length, facts.ledger.inProgress, `${name}: in-progress rows`)
        assert.equal(Boolean(p.fixedLabels && Object.values(p.fixedLabels).every((v) => v !== null)), facts.fixedAll, `${name}: five labels`)
      }
    },
  },
]

// ---- the corpus tools end to end, on a snapshot of the invented fixtures ------------------------------------

const CORPUS_DIR = path.join(ROOT, 'tests', 'handoff', 'corpus')
const node = (script, ...args) => spawnSync(process.execPath, [path.join(CORPUS_DIR, script), ...args], { encoding: 'utf8' })

function withSnapshot(fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-snap-'))
  try {
    const out = path.join(tmp, 'snap')
    const r = node('snapshot.mjs', '--roots', FIX, '--out', out)
    assert.equal(r.status, 0, r.stderr)
    return fn(out, tmp)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

const corpusToolCases = [
  {
    id: 'corpus-snapshot-measure-and-diff-on-the-fixtures',
    run: async () => {
      withSnapshot((snap) => {
        const m = node('measure.mjs', '--corpus', snap, '--json')
        assert.equal(m.status, 0, m.stderr)
        const { metrics } = JSON.parse(m.stdout)
        assert.equal(metrics.docs, FIXTURES.length)
        const next = Object.fromEntries(Object.entries(metrics).filter(([k]) => k.startsWith('next.')))
        same(next, {
          'next.inProgress': 4, 'next.label': 0, 'next.lastRow': 1, 'next.docs': 1, 'next.stepOne': 7, 'next.stepOneEmpty': 0,
          'next.ledgerNoInProgress': 1, 'next.labelDocs': 1, 'next.labelUnused': 1, 'next.labelAndInProgress': 1, 'next.labelDiffers': 1,
        })
        const d = node('diff.mjs', '--corpus', snap, '--what', 'next-legacy', '--json')
        assert.equal(d.status, 0, d.stderr)
        same(JSON.parse(d.stdout).counts, { 'in-progress': 4, label: 0, 'last-row': 1, docs: 1, 'step-one': 7 })
        const e = node('diff.mjs', '--corpus', snap, '--what', 'extract-agree')
        assert.equal(e.status, 0, e.stderr)
        assert.match(e.stdout, /^extract-agree: 13 documents, 13 agree, 0 differ$/m)
      })
    },
  },
  {
    id: 'corpus-diff-reports-a-reading-order-difference-by-id',
    run: async () => {
      // Edit the manifest after the fact — one document loses an entry, another has an entry
      // whose text changed: the comparison must name both documents, and never print their text.
      withSnapshot((snap) => {
        const mf = path.join(snap, 'manifest.json')
        const man = JSON.parse(fs.readFileSync(mf, 'utf8'))
        const [missing, changed] = man.docs.filter((d) => d.readingOrder.length >= 2)
        missing.readingOrder.pop()
        changed.readingOrder[1].raw += '-changed'
        fs.writeFileSync(mf, JSON.stringify(man))
        const e = node('diff.mjs', '--corpus', snap, '--what', 'extract-agree')
        assert.equal(e.status, 0, e.stderr)
        assert.match(e.stdout, /11 agree, 2 differ/)
        assert.match(e.stdout, new RegExp(`${missing.id}: entries 1 \\(manifest\\) vs 2 \\(shipped\\)`))
        assert.match(e.stdout, new RegExp(`${changed.id}: entries 2 \\(manifest\\) vs 2 \\(shipped\\).*first difference at entry 2`))
        assert.ok(!e.stdout.includes('-changed'), 'no document text in the report')
      })
    },
  },
  {
    id: 'corpus-diff-usage-and-input-errors',
    run: async () => {
      assert.equal(node('diff.mjs').status, 2)
      assert.equal(node('diff.mjs', '--corpus', FIX, '--what', 'no-such-comparison').status, 2)
      const noManifest = node('diff.mjs', '--corpus', FIX, '--what', 'next-legacy')
      assert.equal(noManifest.status, 1)
      assert.match(noManifest.stderr, /manifest\.json/)
    },
  },
]

// ---- diff.mjs --what next: the new derivation against the 9.0.1 one -------------------------------------------

// A snapshot of in-memory documents (a folder of their own under the OS temp folder, never inside this
// repository), for the changes the shared fixtures do not hold.
function withSnapshotOfDocs(docs, fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-nextdiff-'))
  try {
    const roots = path.join(tmp, 'roots')
    fs.mkdirSync(roots)
    for (const [name, text] of Object.entries(docs)) fs.writeFileSync(path.join(roots, `${name}.md`), text)
    const out = path.join(tmp, 'snap')
    const r = node('snapshot.mjs', '--roots', roots, '--out', out)
    assert.equal(r.status, 0, r.stderr)
    return fn(out)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

const nextDiffCases = [
  {
    id: 'corpus-diff-next-classifies-the-fixture-changes',
    run: async () => {
      withSnapshot((snap) => {
        const d = node('diff.mjs', '--corpus', snap, '--what', 'next', '--json')
        assert.equal(d.status, 0, d.stderr)
        const out = JSON.parse(d.stdout)
        assert.equal(out.documents, FIXTURES.length)
        same(out.classes, { unchanged: 10, 'normalisation-only': 0, 'became-label': 1, 'became-ambiguous': 1, 'became-docs-or-step-one': 1, 'kept-finished-slice': 0, other: 0 })
        same(out.ids.other, [])
        assert.equal(out.ids['became-label'].length, 1)
        same(out.labelCheck, { withLabelAndInProgress: 1, valuesDiffered: 1, newIsLabel: 1 })
        same(out.noLabelOneInProgress, { documents: 2, unchanged: 2, normalisationOnly: 0, other: 0 })
        assert.equal(out.ambiguous, 1)
        assert.equal(out.lastRow.documents, 1)
        assert.equal(out.lastRow.valueChanged, 1)
        // the readable form carries the same counts and no document text
        const h = node('diff.mjs', '--corpus', snap, '--what', 'next')
        assert.equal(h.status, 0, h.stderr)
        assert.match(h.stdout, /^next: 13 documents/m)
        assert.match(h.stdout, /became-label\s+1/)
        assert.ok(!h.stdout.includes('s3-render') && !h.stdout.includes('Finish the renderer'), 'no document text in the report')
      })
    },
  },
  {
    id: 'corpus-diff-next-separates-normalisation-and-flags-the-unexplained',
    run: async () => {
      const docs = {
        'a-bold-cell': epicDoc({ rows: [row('**s-bold**', 'in-progress')] }),
        'b-empty-cell': epicDoc({ rows: [row('', 'in-progress')] }),
        'c-plain': epicDoc({ rows: [row('s-plain', 'in-progress')] }),
        // The Docs guard covers a `done` row only: a last row that is `blocked` and named by Docs keeps
        // the 9.0.1 value, and the report has to count it rather than call it unchanged.
        'd-blocked-row': epicDoc({ docs: 'docs/harness/s2-store/', rows: [row('s1-load', 'done'), row('s2-store', 'blocked')] }),
      }
      withSnapshotOfDocs(docs, (snap) => {
        const out = JSON.parse(node('diff.mjs', '--corpus', snap, '--what', 'next', '--json').stdout)
        same(out.classes, { unchanged: 1, 'normalisation-only': 1, 'became-label': 0, 'became-ambiguous': 0, 'became-docs-or-step-one': 0, 'kept-finished-slice': 1, other: 1 })
        same(out.ids['normalisation-only'], ['d001'])
        same(out.ids.other, ['d002'])
        same(out.ids['kept-finished-slice'], ['d004'])
        assert.equal(out.lastRow.valueKept, 1)
        // check (b) counts the same documents: one in-progress row, no label
        same(out.noLabelOneInProgress, { documents: 3, unchanged: 1, normalisationOnly: 1, other: 1 })
      })
    },
  },
  {
    id: 'corpus-diff-next-classifier-calls-an-unexplained-ambiguity-other',
    run: async () => {
      const { classifyNextChange } = await diffLib()
      const now = (slice, source) => ({ slice, source, ambiguous: [], commandCandidates: [] })
      const ambiguous = now(null, 'step-one')
      // ambiguity is explained only where 9.0.1 took the last of two or more in-progress rows
      assert.equal(classifyNextChange({ slice: 's2', source: 'in-progress' }, ambiguous, { legacyLiveRows: 2 }), 'became-ambiguous')
      assert.equal(classifyNextChange({ slice: 's2', source: 'in-progress' }, ambiguous, { legacyLiveRows: 1 }), 'other')
      assert.equal(classifyNextChange({ slice: 's2', source: 'last-row' }, ambiguous, { legacyLiveRows: 0 }), 'other')
      assert.equal(classifyNextChange({ slice: 's2', source: 'docs' }, ambiguous), 'other')
      // a last-row document whose value is STILL the finished slice is its own class, not `unchanged`
      assert.equal(classifyNextChange({ slice: 's2', source: 'last-row' }, now('s2', 'docs')), 'kept-finished-slice')
      assert.equal(classifyNextChange({ slice: 's2', source: 'last-row' }, now('s2', 'step-one')), 'kept-finished-slice')
      assert.equal(classifyNextChange({ slice: 's2', source: 'in-progress' }, now('s2', 'in-progress')), 'unchanged')
      // a label takes over only where the facts explain it: a label that differed from the in-progress
      // row under 9.0.1, or a document with no ledger
      const differed = { labelDiffers: true, hasLedger: true }
      assert.equal(classifyNextChange({ slice: 's2', source: 'in-progress' }, now('s3', 'label'), differed), 'became-label')
      assert.equal(classifyNextChange({ slice: 'x', source: 'docs' }, now('s3', 'label'), { labelDiffers: false, hasLedger: false }), 'became-label')
      assert.equal(classifyNextChange({ slice: 's2', source: 'in-progress' }, now('s3', 'label'), { labelDiffers: false, hasLedger: true }), 'other')
      assert.equal(classifyNextChange({ slice: 's2', source: 'in-progress' }, now('s3', 'label')), 'other')
      // the other classes
      assert.equal(classifyNextChange({ slice: 's2', source: 'in-progress' }, now('s2', 'label')), 'unchanged')
      assert.equal(classifyNextChange({ slice: 's2', source: 'last-row' }, now('Do it.', 'step-one')), 'became-docs-or-step-one')
      assert.equal(classifyNextChange({ slice: '**s2**', source: 'in-progress' }, now('s2', 'in-progress')), 'normalisation-only')
      assert.equal(classifyNextChange({ slice: 's2', source: 'in-progress' }, now('s9', 'in-progress')), 'other')
      assert.equal(classifyNextChange({ slice: 's2', source: 'in-progress' }, now('Do it.', 'step-one')), 'other')
    },
  },
  {
    id: 'corpus-diff-next-state-not-relevant-is-reported-apart',
    run: async () => {
      // Without a live task state the Docs tier is not used: the documents that took it move to item 1.
      withSnapshot((snap) => {
        const out = JSON.parse(node('diff.mjs', '--corpus', snap, '--what', 'next', '--json').stdout)
        assert.equal(out.stateNotRelevant.valueChanges, 1)
      })
    },
  },
]

// ---- reading-plan: which Reading Order entries are read, and how much ------------------------------------------
//
// These cases build a throwaway repository under the OS temp folder (never inside this one), write
// invented files and a handoff document at docs/harness/handoff/doc.md, and run the real command
// line on it. Cases that need an absolute path call `planReading` on hand-built entries instead, so
// they do not depend on the temp folder's name being a single word.

const L = (n) => `line ${String(n).padStart(3, '0')}`
const lineText = (from, to, f = L) => Array.from({ length: to - from + 1 }, (_, i) => f(from + i)).join('\n') + '\n'
const bytesOf = (s) => Buffer.byteLength(s)
const entry = (p, range = null) => ({ raw: p, path: p, range, isFile: true, self: false })

function withRepo(files, readingOrder, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-plan-'))
  try {
    const repo = path.join(dir, 'repo')
    const put = (abs, content) => {
      fs.mkdirSync(path.dirname(abs), { recursive: true })
      fs.writeFileSync(abs, content)
    }
    for (const [rel, content] of Object.entries(files)) put(path.join(repo, rel), content)
    const doc = path.join(repo, 'docs', 'harness', 'handoff', 'doc.md')
    put(doc, mk([['Goal', 'x'], ['Reading Order', readingOrder]]))
    return fn({ dir, repo, doc, put })
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

function plan(doc, budget = 1e9) {
  const r = cli('reading-plan', '--doc', doc, '--budget', String(budget))
  assert.equal(r.status, 0, `exit ${r.status}: ${r.stderr}`)
  assert.equal(r.stderr, '')
  return JSON.parse(r.stdout)
}

const X_MD = [
  '# Title', // 1
  'intro', // 2
  '```', // 3
  '## Foo decoy', // 4 (inside a fence: not a heading)
  '```', // 5
  '## Setup', // 6
  'setup text', // 7
  '## Foo bar', // 8
  'foo text', // 9
  '### Foo detail', // 10
  'detail text', // 11
  '```', // 12
  '## fenced in foo', // 13 (inside a fence)
  '```', // 14
  'more foo', // 15
  '## Next', // 16
  'next text', // 17
  '#### Deep', // 18
].join('\n') + '\n'
const xLines = X_MD.split('\n')
const xBytes = (from, to) => bytesOf(xLines.slice(from - 1, to).join('\n') + '\n')

// 2,500 lines: a title, a fenced `# ` line, two headings that count and one that does not.
const BIG_MD =
  Array.from({ length: 2500 }, (_, i) => {
    const n = i + 1
    if (n === 1) return '# Big'
    if (n === 9) return '```'
    if (n === 10) return '# not a heading, it is inside a fence'
    if (n === 11) return '```'
    if (n === 700) return '## Mid'
    if (n === 2300) return '### Late'
    if (n === 2301) return '#### Deeper'
    return L(n)
  }).join('\n') + '\n'
const BIG_OUTLINE = [
  { line: 1, level: 1, text: 'Big' },
  { line: 700, level: 2, text: 'Mid' },
  { line: 2300, level: 3, text: 'Late' },
]
const bigFirst400 = bytesOf(BIG_MD.split('\n').slice(0, 400).join('\n') + '\n')

const readingPlanCases = [
  {
    id: 'reading-plan-line-range',
    run: async () => {
      const files = { 'src/a.js': lineText(1, 300), 'src/b.js': lineText(1, 10) }
      withRepo(files, '1. `src/a.js:120-180` — the part that matters\n2. `src/b.js` — a whole small file', ({ doc, repo }) => {
        const p = plan(doc)
        const want = bytesOf(lineText(120, 180))
        const [a, b] = p.entries
        assert.equal(a.status, 'range')
        same(a.range, { type: 'lines', start: 120, end: 180 })
        assert.equal(a.lines, 61)
        assert.equal(a.bytes, want)
        assert.equal(a.fileLines, 300)
        assert.equal(a.file, path.join(repo, 'src', 'a.js'))
        assert.equal(b.status, 'read')
        assert.equal(b.range, null)
        assert.equal(b.bytes, bytesOf(lineText(1, 10)))
        assert.equal(p.totalBytes, want + b.bytes)
        assert.equal(p.budget, 1e9)
      })
    },
  },
  {
    id: 'reading-plan-line-range-past-the-end',
    run: async () => {
      withRepo({ 'src/a.js': lineText(1, 300) }, '1. `src/a.js:250-400` — runs past the end\n2. `src/a.js:400-500` — starts past the end', ({ doc }) => {
        const [clipped, beyond] = plan(doc).entries
        assert.equal(clipped.status, 'range')
        same(clipped.range, { type: 'lines', start: 250, end: 300 })
        assert.equal(clipped.bytes, bytesOf(lineText(250, 300)))
        assert.equal(beyond.status, 'partial')
        assert.equal(beyond.range, null)
        assert.equal(beyond.bytes, 0)
        assert.match(beyond.reason, /after the end/)
      })
    },
  },
  {
    id: 'reading-plan-section-range',
    run: async () => {
      const ro = [
        '1. `docs/x.md §foo` — the first heading that contains it, case-insensitively',
        '2. `docs/x.md §Foo detail` — a deeper heading ends at the next heading of the same or a higher level',
        '3. `docs/x.md §Foo bar (see note)` — a trailing parenthesis is a remark, not part of the title',
      ].join('\n')
      withRepo({ 'docs/x.md': X_MD }, ro, ({ doc }) => {
        const [a, b, c] = plan(doc).entries
        for (const [e, start, end, heading] of [[a, 8, 15, 'Foo bar'], [b, 10, 15, 'Foo detail'], [c, 8, 15, 'Foo bar']]) {
          assert.equal(e.status, 'range', e.raw)
          same(e.range, { type: 'lines', start, end, heading }, e.raw)
          assert.equal(e.lines, end - start + 1, e.raw)
          assert.equal(e.bytes, xBytes(start, end), e.raw)
        }
      })
    },
  },
  {
    id: 'reading-plan-section-range-missing-heading',
    run: async () => {
      withRepo({ 'docs/x.md': X_MD }, '1. `docs/x.md §Nope` — no such heading', ({ doc }) => {
        const [e] = plan(doc).entries
        assert.equal(e.status, 'partial')
        assert.equal(e.range, null)
        assert.equal(e.bytes, 0)
        assert.match(e.reason, /Nope/)
        same(e.outline, [
          { line: 1, level: 1, text: 'Title' },
          { line: 6, level: 2, text: 'Setup' },
          { line: 8, level: 2, text: 'Foo bar' },
          { line: 10, level: 3, text: 'Foo detail' },
          { line: 16, level: 2, text: 'Next' },
        ])
      })
    },
  },
  {
    id: 'reading-plan-oversize-without-range',
    run: async () => {
      withRepo({ 'docs/big.md': BIG_MD }, '1. `docs/big.md` — a long file with no range', ({ doc }) => {
        const p = plan(doc)
        const [e] = p.entries
        assert.equal(e.status, 'partial')
        same(e.range, { type: 'lines', start: 1, end: 400 })
        assert.equal(e.lines, 400)
        assert.equal(e.fileLines, 2500)
        assert.equal(e.bytes, bigFirst400)
        same(e.outline, BIG_OUTLINE)
        assert.equal(e.outlineBytes, 180)
        assert.equal(e.truncated, false)
        assert.equal(p.totalBytes, bigFirst400 + 180)
        assert.ok(!e.status.startsWith('skipped'), 'an over-long file is read in part, never skipped')
      })
    },
  },
  {
    id: 'reading-plan-reads-crlf-and-bom-files',
    run: async () => {
      const text = '\uFEFF# Title\r\nintro\r\n## Foo\r\nfoo text\r\n## Bar\r\nbar\r\n'
      withRepo({ 'docs/c.md': text }, '1. `docs/c.md §Foo` — a section of a CRLF file\n2. `docs/c.md §Nope` — the outline of the same file', ({ doc }) => {
        const [a, b] = plan(doc).entries
        same(a.range, { type: 'lines', start: 3, end: 4, heading: 'Foo' })
        assert.equal(a.bytes, bytesOf('## Foo\r\nfoo text\r\n'))
        same(b.outline.map((h) => h.text), ['Title', 'Foo', 'Bar'])
      })
    },
  },
  {
    id: 'reading-plan-line-cap-boundary',
    run: async () => {
      const ro = '1. `a.md` — exactly 2000 lines\n2. `b.md` — 2001 lines'
      withRepo({ 'a.md': lineText(1, 2000), 'b.md': lineText(1, 2001) }, ro, ({ doc }) => {
        const [a, b] = plan(doc).entries
        assert.equal(a.status, 'read')
        assert.equal(a.fileLines, 2000)
        assert.equal(b.status, 'partial')
        assert.equal(b.fileLines, 2001)
      })
    },
  },
  {
    id: 'reading-plan-budget-degrades-to-partial',
    run: async () => {
      const mid = ['# Mid', ...Array.from({ length: 999 }, (_, i) => L(i + 2))].join('\n') + '\n'
      const first400 = bytesOf(mid.split('\n').slice(0, 400).join('\n') + '\n')
      const small = lineText(1, 5)
      const tiny = 'x'.repeat(19) + '\n'
      const budget = bytesOf(small) + first400 + 60 + bytesOf(tiny)
      assert.ok(budget < bytesOf(small) + bytesOf(mid), 'the whole file must not fit')
      const ro = '1. `small.txt` — small\n2. `mid.md` — does not fit whole, its head and outline do\n3. `tiny.txt` — fits exactly'
      withRepo({ 'small.txt': small, 'mid.md': mid, 'tiny.txt': tiny }, ro, ({ doc }) => {
        const p = plan(doc, budget)
        const [s, m, t] = p.entries
        assert.equal(s.status, 'read')
        assert.equal(m.status, 'partial')
        same(m.range, { type: 'lines', start: 1, end: 400 })
        assert.equal(m.bytes, first400)
        same(m.outline, [{ line: 1, level: 1, text: 'Mid' }])
        assert.match(m.reason, /budget/)
        assert.equal(t.status, 'read')
        assert.equal(p.totalBytes, budget)
      })
    },
  },
  {
    id: 'reading-plan-budget-skips-and-continues',
    run: async () => {
      const one = 'x'.repeat(19) + '\n'
      const files = {
        'src/one.txt': one.repeat(5), // 100 bytes
        'src/two.txt': one.repeat(30), // 600 bytes, 30 lines: no shorter form
        'src/three.txt': 'xxxx\n'.repeat(10), // 50 bytes
      }
      const ro = '1. `src/one.txt` — first\n2. `src/two.txt` — too large for what is left\n3. `src/three.txt` — smaller, comes later'
      withRepo(files, ro, ({ doc }) => {
        const p = plan(doc, 150)
        same(p.entries.map((e) => e.path), ['src/one.txt', 'src/two.txt', 'src/three.txt'])
        same(p.entries.map((e) => e.status), ['read', 'skipped-budget', 'read'])
        assert.match(p.entries[1].reason, /budget/)
        assert.equal(p.entries[1].bytes, 0)
        assert.equal(p.totalBytes, 150)
      })
    },
  },
  {
    id: 'reading-plan-budget-never-shrinks-a-range-or-a-partial',
    run: async () => {
      const files = {
        'src/one.txt': ('x'.repeat(19) + '\n').repeat(5), // 100 bytes
        'src/a.js': lineText(1, 300),
        'docs/big.md': BIG_MD,
        'src/three.txt': 'xxxx\n'.repeat(10), // 50 bytes
      }
      const ro = '1. `src/one.txt` — first\n2. `src/a.js:1-100` — a range that does not fit\n3. `docs/big.md` — a partial that does not fit\n4. `src/three.txt` — fits'
      withRepo(files, ro, ({ doc }) => {
        const p = plan(doc, 500)
        same(p.entries.map((e) => e.status), ['read', 'skipped-budget', 'skipped-budget', 'read'])
        assert.equal(p.totalBytes, 150)
      })
    },
  },
  {
    id: 'reading-plan-docs-harness-allowed',
    run: async () => {
      withRepo({ 'docs/harness/x/y.md': 'hello\n' }, '1. `docs/harness/x/y.md` — a recorded task document', ({ doc }) => {
        const [e] = plan(doc).entries
        assert.equal(e.status, 'read')
        assert.equal(e.bytes, 6)
      })
    },
  },
  {
    id: 'reading-plan-rejects',
    run: async () => {
      const files = { '../x': 'secret\n', '.git/config': '[core]\n', 'src/a.js': 'ok\n' }
      const ro = '1. `../x` — outside the repository\n2. `.git/config` — inside .git\n3. `docs/../src/a.js` — a `..` segment anywhere\n4. `src/a.js` — the control'
      withRepo(files, ro, ({ doc }) => {
        const p = plan(doc)
        same(p.entries.map((e) => e.status), ['skipped-invalid', 'skipped-invalid', 'skipped-invalid', 'read'])
        assert.match(p.entries[0].reason, /\.\./)
        assert.match(p.entries[1].reason, /\.git/)
        assert.match(p.entries[2].reason, /\.\./)
        assert.equal(p.totalBytes, 3)
      })
    },
  },
  {
    id: 'reading-plan-rejects-an-absolute-path-outside-the-repository',
    run: async () => {
      const { planReading } = await readingLib()
      withRepo({ 'src/a.js': 'ok\n' }, '1. `src/a.js` — placeholder', ({ dir, repo, doc, put }) => {
        const outside = path.join(dir, 'outside', 'secret.txt')
        put(outside, 'secret\n')
        const inside = path.join(repo, 'src', 'a.js')
        const p = planReading([entry(outside), entry('~/notes.md'), entry('//server/share/x.md'), entry(inside)], [repo], 1e6, doc)
        same(p.entries.map((e) => e.status), ['skipped-invalid', 'skipped-invalid', 'skipped-invalid', 'read'])
        assert.match(p.entries[0].reason, /outside/)
        assert.equal(p.entries[3].file, inside)
        assert.equal(p.entries[3].bytes, 3)
      })
    },
  },
  {
    id: 'reading-plan-rejects-ntfs-stream-names',
    run: async () => {
      // `.git::$INDEX_ALLOCATION` is another spelling of the .git folder on NTFS, and `x::$DATA` is a
      // file's own data stream: a colon in a path segment is refused.
      const { planReading } = await readingLib()
      const ro = '1. `.git::$INDEX_ALLOCATION/config` — a stream spelling of .git\n2. `.git:$I30:$INDEX_ALLOCATION/config` — another one\n3. `in.md` — the control'
      withRepo({ '.git/config': '[core]\n', 'in.md': 'text\n' }, ro, ({ repo, doc }) => {
        const p = plan(doc)
        same(p.entries.map((e) => e.status), ['skipped-invalid', 'skipped-invalid', 'read'])
        for (const e of p.entries.slice(0, 2)) assert.match(e.reason, /stream/)
        // `in.md::$DATA` does not look like a path to the parser, so hand the entry in directly.
        const q = planReading([entry('in.md::$DATA'), entry('docs/x.md:$DATA')], [repo], 1e6, doc)
        same(q.entries.map((e) => e.status), ['skipped-invalid', 'skipped-invalid'])
        for (const e of q.entries) assert.match(e.reason, /stream/)
      })
    },
  },
  {
    id: 'reading-plan-rejects-a-link-that-leaves-the-repository',
    run: async () => {
      const ro = '1. `link/secret.md` — through a link to a folder outside the repository\n2. `inlink/ok.md` — through a link that stays inside\n3. `real/ok.md` — the control'
      withRepo({ 'real/ok.md': 'fine\n' }, ro, ({ dir, repo, doc, put }) => {
        put(path.join(dir, 'outside', 'secret.md'), 'secret\n')
        // A junction on Windows (no privilege needed), a symbolic link elsewhere.
        fs.symlinkSync(path.join(dir, 'outside'), path.join(repo, 'link'), 'junction')
        fs.symlinkSync(path.join(repo, 'real'), path.join(repo, 'inlink'), 'junction')
        const p = plan(doc)
        same(p.entries.map((e) => e.status), ['skipped-invalid', 'read', 'read'])
        assert.equal(p.entries[0].reason, 'link leaves the repository')
        assert.equal(p.entries[0].bytes, 0)
        assert.equal(p.entries[1].bytes, 5)
        assert.equal(p.totalBytes, 10)
      })
    },
  },
  {
    id: 'reading-plan-outline-is-capped',
    run: async () => {
      // 201 headings (and 200, the exact limit) at the top of a 2,100-line file, so it is read as a partial.
      const body = (n) =>
        [...Array.from({ length: n }, (_, i) => `## H${String(i + 1).padStart(3, '0')}`), ...Array.from({ length: 2100 - n }, (_, i) => L(i + 1))].join('\n') + '\n'
      const ro = '1. `docs/many.md` — 201 headings\n2. `docs/exact.md` — 200 headings'
      withRepo({ 'docs/many.md': body(201), 'docs/exact.md': body(200) }, ro, ({ doc }) => {
        const p = plan(doc)
        const [many, exact] = p.entries
        assert.equal(many.status, 'partial')
        assert.equal(many.outline.length, 200)
        assert.equal(many.outline[199].text, 'H200')
        assert.equal(many.truncated, true)
        assert.equal(many.outlineBytes, 200 * 60, 'the charge follows the entries returned')
        assert.equal(exact.outline.length, 200)
        assert.equal(exact.truncated, false)
        assert.equal(p.totalBytes, many.bytes + many.outlineBytes + exact.bytes + exact.outlineBytes)
      })
    },
  },
  {
    id: 'reading-plan-no-outline-for-a-file-that-is-not-markdown',
    run: async () => {
      // `# ` lines in a Python file are comments, not headings.
      const py = Array.from({ length: 3000 }, (_, i) => (i % 3 === 0 ? `# comment ${i}` : `x = ${i}`)).join('\n') + '\n'
      const first400 = bytesOf(py.split('\n').slice(0, 400).join('\n') + '\n')
      const ro = '1. `src/big.py` — 3,000 lines\n2. `src/big.py §comment` — a section hint on a file with no headings\n3. `docs/big.markdown` — the other Markdown extension'
      withRepo({ 'src/big.py': py, 'docs/big.markdown': BIG_MD }, ro, ({ doc }) => {
        const [a, b, c] = plan(doc).entries
        assert.equal(a.status, 'partial')
        same(a.range, { type: 'lines', start: 1, end: 400 })
        assert.equal(a.bytes, first400)
        same(a.outline, [])
        assert.equal(a.outlineBytes, 0)
        assert.equal(a.truncated, false)
        assert.equal(b.status, 'partial')
        assert.equal(b.range, null)
        same(b.outline, [])
        same(c.outline, BIG_OUTLINE)
      })
    },
  },
  {
    id: 'reading-plan-says-when-a-range-hint-is-ignored',
    run: async () => {
      const files = { 'src/a.js': lineText(1, 30), 'docs/x.md': X_MD }
      const ro = [
        '1. `src/a.js:20-10` — reversed',
        '2. `src/a.js:0-5` — starts at line 0',
        '3. `docs/x.md §` — an empty heading',
        '4. `src/a.js:42` — one line is a hint, not a range',
        '5. `src/a.js (entry point)` — a remark in parentheses',
        '6. `src/a.js:5-7` — a real range',
      ].join('\n')
      withRepo(files, ro, ({ doc }) => {
        const es = plan(doc).entries
        for (const e of es.slice(0, 4)) {
          assert.equal(e.status, 'read', e.raw) // the behaviour is unchanged: the whole file is read
          assert.match(e.reason, /range hint ignored/, e.raw)
        }
        assert.equal(es[0].bytes, bytesOf(lineText(1, 30)))
        assert.equal(es[4].status, 'read')
        assert.equal(es[4].reason, null)
        assert.equal(es[5].status, 'range')
        assert.equal(es[5].reason, null)
      })
    },
  },
  {
    id: 'reading-plan-non-file-entry',
    run: async () => {
      const ro = '1. Memory item "design notes" — recall it before starting\n2. `git log --oneline -5` — recent history\n3. `src/a.js` — a real file'
      withRepo({ 'src/a.js': 'ok\n' }, ro, ({ doc }) => {
        const p = plan(doc)
        for (const e of p.entries.slice(0, 2)) {
          assert.equal(e.isFile, false)
          assert.equal(e.status, 'skipped-invalid')
          assert.equal(e.reason, 'not a file')
          assert.equal(e.path, null)
          assert.equal(e.bytes, 0)
        }
        assert.equal(p.entries[2].status, 'read')
      })
    },
  },
  {
    id: 'reading-plan-self-entry',
    run: async () => {
      const ro = '1. 이 문서 — read first\n2. `docs/harness/handoff/doc.md` — the same document, by path\n3. `src/a.js` — a real file'
      withRepo({ 'src/a.js': 'ok\n' }, ro, ({ doc }) => {
        const p = plan(doc, 10)
        const [self, byPath, real] = p.entries
        assert.equal(self.self, true)
        assert.equal(self.status, 'read')
        assert.equal(self.bytes, 0)
        assert.equal(self.file, doc)
        assert.equal(byPath.status, 'read')
        assert.equal(byPath.bytes, 0)
        assert.match(byPath.reason, /itself/)
        assert.equal(real.bytes, 3)
        assert.equal(p.totalBytes, 3)
      })
    },
  },
  {
    id: 'reading-plan-missing-file-and-directory',
    run: async () => {
      withRepo({ 'src/a.js': 'ok\n' }, '1. `src/nope.js` — gone\n2. `src/` — a folder', ({ doc }) => {
        const [missing, dir] = plan(doc).entries
        assert.equal(missing.status, 'skipped-missing')
        assert.equal(dir.status, 'skipped-invalid')
        assert.match(dir.reason, /directory/)
      })
    },
  },
  {
    id: 'reading-plan-entry-shape',
    run: async () => {
      withRepo({ 'src/a.js': 'ok\n', 'docs/big.md': BIG_MD }, '1. `src/a.js` — read\n2. `docs/big.md` — partial\n3. `src/nope.js` — missing', ({ doc }) => {
        const p = plan(doc)
        same(Object.keys(p).sort(), ['budget', 'entries', 'totalBytes'])
        const common = ['bytes', 'file', 'fileLines', 'isFile', 'lines', 'path', 'range', 'raw', 'reason', 'self', 'status']
        same(Object.keys(p.entries[0]).sort(), common)
        same(Object.keys(p.entries[1]).sort(), [...common, 'outline', 'outlineBytes', 'truncated'].sort())
        same(Object.keys(p.entries[2]).sort(), common)
      })
    },
  },
  {
    id: 'reading-plan-roots-are-tried-in-order',
    run: async () => {
      const { planReading } = await readingLib()
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-roots-'))
      try {
        const a = path.join(dir, 'a')
        const b = path.join(dir, 'b')
        for (const [root, name, text] of [[a, 'both.md', 'from a\n'], [b, 'both.md', 'from b\n'], [b, 'only-b.md', 'b\n']]) {
          fs.mkdirSync(root, { recursive: true })
          fs.writeFileSync(path.join(root, name), text)
        }
        const p = planReading([entry('both.md'), entry('only-b.md'), entry('none.md')], [a, b], 1e6)
        same(p.entries.map((e) => e.file), [path.join(a, 'both.md'), path.join(b, 'only-b.md'), null])
        assert.equal(p.entries[2].status, 'skipped-missing')
        const none = planReading([entry('both.md')], [], 1e6)
        assert.equal(none.entries[0].status, 'skipped-invalid')
        assert.match(none.entries[0].reason, /root/)
      } finally {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    },
  },
  {
    id: 'reading-plan-git-top-level-is-a-second-root',
    run: async () => {
      // A document in a sub-folder of its repository: entries may be relative to the repository's top.
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-git-'))
      try {
        const top = path.join(dir, 'top')
        execFileSync('git', ['init', '-q', top], { stdio: 'ignore' })
        const doc = path.join(top, 'sub', 'docs', 'harness', 'handoff', 'doc.md')
        const put = (abs, t) => {
          fs.mkdirSync(path.dirname(abs), { recursive: true })
          fs.writeFileSync(abs, t)
        }
        put(doc, mk([['Goal', 'x'], ['Reading Order', '1. `shared/f.md` — relative to the top\n2. `g.md` — relative to the sub-folder']]))
        put(path.join(top, 'shared', 'f.md'), 'f\n')
        put(path.join(top, 'sub', 'g.md'), 'gg\n')
        const [f, g] = plan(doc).entries
        const real = (p) => fs.realpathSync(p)
        assert.equal(f.status, 'read')
        assert.equal(real(f.file), real(path.join(top, 'shared', 'f.md')))
        assert.equal(g.status, 'read')
        assert.equal(real(g.file), real(path.join(top, 'sub', 'g.md')))
      } finally {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    },
  },
  {
    id: 'reading-plan-usage-and-input-errors',
    run: async () => {
      const doc = path.join(FIX, 'reading-order-forms.md')
      const noBudget = cli('reading-plan', '--doc', doc)
      assert.equal(noBudget.status, 2)
      assert.equal(noBudget.stdout, '')
      assert.match(noBudget.stderr, /--budget/)
      assert.equal(cli('reading-plan', '--budget', '100').status, 2)
      for (const bad of ['abc', '0', '-5', '1.5', '']) {
        const r = cli('reading-plan', '--doc', doc, '--budget', bad)
        assert.equal(r.status, 2, `budget ${JSON.stringify(bad)}`)
        assert.equal(r.stdout, '')
        assert.match(r.stderr, /--budget/)
      }
      const missing = cli('reading-plan', '--doc', path.join(FIX, 'does-not-exist.md'), '--budget', '100')
      assert.equal(missing.status, 1)
      assert.equal(missing.stdout, '')
      const foreign = cli('reading-plan', '--doc', path.join(FIX, 'non-handoff.md'), '--budget', '100')
      assert.equal(foreign.status, 1)
      assert.match(foreign.stderr, /# HANDOFF —/)
    },
  },
  {
    id: 'reading-plan-a-document-outside-any-docs-folder-has-no-root',
    run: async () => {
      // Without a `docs` folder above it (and outside a git repository) a document has no root
      // to resolve against, so nothing is read — the entries say why.
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-noroot-'))
      try {
        const doc = path.join(dir, 'loose.md')
        fs.writeFileSync(doc, mk([['Reading Order', '1. `a.md` — a file next to the document']]))
        fs.writeFileSync(path.join(dir, 'a.md'), 'x\n')
        const [e] = plan(doc).entries
        assert.equal(e.status, 'skipped-invalid')
        assert.match(e.reason, /root/)
      } finally {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    },
  },
]

// ---- paths.mjs: the handoff's own path rule ------------------------------------------------------------------

const pathCases = [
  {
    id: 'paths-validate-handoff-path',
    run: async () => {
      const { validateHandoffPath } = await pathsLib()
      const root = path.resolve(os.tmpdir(), 'handoff-rule-root')
      const accepted = [
        'src/a.js', 'docs/harness/x/y.md', 'a\\b.md', './a.md', '.github/x.yml', '.gitignore', 'src/.gitkeep', 'a/b.git/c',
        'dir/', path.join(root, 'src', 'a.js'),
      ]
      for (const p of accepted) assert.equal(validateHandoffPath(p, root).ok, true, `accept ${p}`)
      const rejected = [
        '', '../x', 'a/../x', 'a\\..\\x', '..', '.. /x', '.git', '.git/config', 'a/.git/hooks/x', '.GIT/config', '.git./config',
        'git~1/config', '.git::$INDEX_ALLOCATION/config', '.git:$I30:$INDEX_ALLOCATION/config', 'in.md::$DATA', 'C:/repo/in.md::$DATA', '//server/share/x', '\\\\server\\share\\x', '/etc/passwd', 'C:/Windows/x', 'C:foo', '~/x', 'a\0b',
        path.join(root, '.git', 'config'), root + '/../elsewhere/x', path.resolve(root, '..', 'elsewhere', 'x'),
      ]
      for (const p of rejected) {
        const r = validateHandoffPath(p, root)
        assert.equal(r.ok, false, `reject ${JSON.stringify(p)}`)
        assert.equal(typeof r.reason, 'string', `a reason for ${JSON.stringify(p)}`)
      }
      // `root` may be several folders: an absolute path is accepted inside any of them.
      const other = path.resolve(os.tmpdir(), 'handoff-rule-other')
      assert.equal(validateHandoffPath(path.join(other, 'x.md'), [root, other]).ok, true)
      assert.equal(validateHandoffPath(path.join(other, 'x.md'), root).ok, false)
    },
  },
  {
    id: 'paths-derive-repo-root',
    run: async () => {
      const { deriveRepoRoot } = await pathsLib()
      const snap = await snapshotLib()
      const base = path.resolve(os.tmpdir(), 'handoff-derive')
      const doc = path.join(base, 'repo', 'docs', 'harness', 'handoff', 'doc.md')
      assert.equal(deriveRepoRoot(doc), path.join(base, 'repo'))
      assert.equal(deriveRepoRoot(path.join(base, 'repo', 'docs', 'docs', 'x', 'doc.md')), path.join(base, 'repo', 'docs'))
      for (const p of [doc, path.join(base, 'repo', 'notes', 'doc.md')]) {
        assert.equal(deriveRepoRoot(p), snap.deriveRepoRoot(path.dirname(p)), p)
      }
    },
  },
]

// ---- diff.mjs --what reading: the budget simulation ----------------------------------------------------------

const ent = (raw, bytes, lines, extra = {}) => ({ raw, kind: 'path', exists: true, isDir: false, self: false, bytes, lines, ...extra })

const readingSimCases = [
  {
    id: 'corpus-reading-simulation-follows-the-policy',
    run: async () => {
      const { simulateReading } = await diffLib()
      const docs = [
        // 1,000 + 4,000 (partial form 1,600 + 60 x 25 = 3,100) + 500
        { readingOrder: [ent('a.md', 1000, 100), ent('b.md', 4000, 1000), ent('c.md', 500, 50)] },
        // over 2,000 lines, no range: partial 20,000 + 60 x 100 = 26,000; nothing shorter exists
        { readingOrder: [ent('z.md', 200000, 4000)] },
        // a line range (10 of 100 lines), a section (25%), a file that is gone, the document itself, a `..` path
        { readingOrder: [ent('s.js:11-20', 1000, 100), ent('d.md §Foo', 2000, 50), ent('gone.md', null, null, { exists: false }), { raw: '이 문서', kind: 'self', exists: true, isDir: false, self: true, bytes: 9, lines: 3 }, ent('../up.md', 800, 80)] },
      ]
      const r = simulateReading(docs, { budgets: [3000, 4500, 5000, 1e9] })
      same(r.unbudgeted.perDoc, [5500, 26000, 600])
      assert.equal(r.unbudgeted.max, 26000)
      assert.equal(r.readable, 3 + 1 + 2)
      same(r.estimates, { lineRange: 1, sectionRange: 1, partial: 1 })
      const by = Object.fromEntries(r.byBudget.map((b) => [b.budget, b]))
      same(by[3000].perDoc, [1500, 0, 600])
      assert.equal(by[3000].skipped, 2)
      assert.equal(by[3000].degraded, 0)
      assert.equal(by[3000].zeroRead, 1)
      assert.equal(by[3000].docsAtCap, 2)
      same(by[4500].perDoc, [4100, 0, 600])
      same(by[4500].status, { read: 1, range: 2, partial: 1, 'skipped-budget': 2 })
      assert.equal(by[4500].degraded, 1)
      assert.equal(by[4500].skipped, 2)
      same(by[5000].perDoc, [5000, 0, 600])
      assert.equal(by[5000].degraded, 0)
      assert.equal(by[5000].skipped, 2)
      same(by[1e9].perDoc, [5500, 26000, 600])
      assert.equal(by[1e9].skipped, 0)
      assert.equal(by[1e9].docsAtCap, 0)
      assert.equal(by[1e9].zeroRead, 0)
    },
  },
  {
    id: 'corpus-reading-simulation-agrees-with-the-planner-on-whole-files',
    run: async () => {
      // The simulation works from recorded sizes; on whole files (no estimate involved) it must
      // spend a budget exactly as the shipped planner does.
      const { simulateReading } = await diffLib()
      const one = 'x'.repeat(19) + '\n'
      const files = { 'src/one.txt': one.repeat(5), 'src/two.txt': one.repeat(30), 'src/three.txt': 'xxxx\n'.repeat(10) }
      const ro = '1. `src/one.txt` — a\n2. `src/two.txt` — b\n3. `src/three.txt` — c'
      withRepo(files, ro, ({ doc }) => {
        const p = plan(doc, 150)
        const manifest = [ent('src/one.txt', 100, 6), ent('src/two.txt', 600, 31), ent('src/three.txt', 50, 11)] // the snapshot counts one line more
        const sim = simulateReading([{ readingOrder: manifest }], { budgets: [150] }).byBudget[0]
        same(sim.status, { read: 2, range: 0, partial: 0, 'skipped-budget': 1 })
        assert.equal(sim.perDoc[0], p.totalBytes)
        assert.equal(p.entries.filter((e) => e.status === 'skipped-budget').length, sim.skipped)
      })
    },
  },
  {
    id: 'corpus-reading-simulation-charges-an-outline-only-for-markdown',
    run: async () => {
      const { simulateReading } = await diffLib()
      // 4,000 lines -> 100 headings estimated; 20,000 lines -> 500, capped at 200; a .py file has none.
      const docs = [{ readingOrder: [ent('a.md', 200000, 4000), ent('b.md', 1000000, 20000), ent('c.py', 200000, 4000)] }]
      const r = simulateReading(docs)
      // a: 20,000 + 60 x 100; b: 20,000 + 60 x 200; c: 20,000
      assert.equal(r.unbudgeted.perDoc[0], 26000 + 32000 + 20000)
    },
  },
  {
    id: 'corpus-reading-path-rule-checks',
    run: async () => {
      const { pathRuleChecks } = await diffLib()
      const docs = [
        { facts: { docsUnderHarness: true }, parsed: { fixedLabels: { Docs: 'docs/harness/x-task/' } }, readingOrder: [ent('../x.md', 1, 1), ent('.git/config', 1, 1), ent('src/a.js', 1, 1), ent('a/../b.md', 1, 1)] },
        { facts: { docsUnderHarness: true }, parsed: { fixedLabels: { Docs: 'docs/harness/../y' } }, readingOrder: [] },
        { facts: { docsUnderHarness: false }, parsed: { fixedLabels: null }, readingOrder: [] },
      ]
      same(pathRuleChecks(docs), { docsUnderHarness: 2, docsUnderHarnessPass: 1, dotEntries: 3, dotEntriesRejected: 3 })
    },
  },
  {
    id: 'corpus-diff-reading-runs-on-a-snapshot',
    run: async () => {
      withSnapshot((snap) => {
        const j = node('diff.mjs', '--corpus', snap, '--what', 'reading', '--json')
        assert.equal(j.status, 0, j.stderr)
        const o = JSON.parse(j.stdout)
        assert.equal(o.what, 'reading')
        assert.equal(o.documents, FIXTURES.length)
        assert.ok(Array.isArray(o.byBudget) && o.byBudget.length >= 3)
        const t = node('diff.mjs', '--corpus', snap, '--what', 'reading')
        assert.equal(t.status, 0, t.stderr)
        assert.match(t.stdout, /^reading: 13 documents/m)
        assert.match(t.stdout, /B = /)
      })
    },
  },
]

// ---- the contract text and the sources ---------------------------------------------------------------------------

const contractCases = [
  {
    id: 'resume-contract-owns-its-path-rule-and-writes-the-budget-once',
    run: async () => {
      const text = fs.readFileSync(path.join(ROOT, 'templates', 'handoff', 'resume.md'), 'utf8')
      assert.ok(!/validate_path|Path Validator/.test(text), 'resume.md must not cite the /harness path validator')
      const given = text.match(/--budget (\d+)/g) || []
      assert.equal(given.length, 1, 'the budget is passed in one place')
      const b = /--budget (\d+)/.exec(text)[1]
      assert.equal(text.split(b).length - 1, 1, 'the budget value is written once')
      assert.ok(!/128 KiB/.test(text), 'the budget is not restated in another unit')
    },
  },
  {
    id: 'resume-contract-next-rule-is-label-first-and-self-contained',
    run: async () => {
      const text = fs.readFileSync(path.join(ROOT, 'templates', 'handoff', 'resume.md'), 'utf8')
      const once = (s, what) => assert.equal(text.split(s).length - 1, 1, `${what} is written exactly once`)
      // the literals resume prints (the dash is U+2014); the ambiguity line is defined in one place
      once('(Next : ambiguous — <N> in-progress rows; Next Steps item 1 follows)', 'the ambiguity line')
      assert.ok(text.includes('(no single command — see Next Steps item 1)'), 'the no-single-command literal')
      // the old derivation is gone: its name, both disclaimer lines and the unfinished gate branch
      for (const gone of [
        'three-tier fallback',
        'no in-progress ledger row — taken from Next Steps item 1',
        'came from a ledger row that is not in-progress',
        'ask which command to run (rule 1)',
      ]) assert.ok(!text.includes(gone), `the old text "${gone}" must be gone`)
      // the script does the derivation, and the flag is passed
      assert.match(text, /node "\{HANDOFF_JS\}" next --doc "[^"]+" --state-relevant /)
      // the four tiers, in priority order
      const from = text.indexOf('**`Next :` derivation')
      const to = text.indexOf('Then STOP and ask via AskUserQuestion')
      assert.ok(from > 0 && to > from, 'the derivation precedes the gate')
      const rules = text.slice(from, to)
      const at = ['1. **The label.**', '2. **One in-progress row.**', '3. **The recorded `Docs`.**', '4. **Item 1 verbatim.**'].map((m) => rules.indexOf(m))
      assert.ok(at.every((i) => i >= 0) && at.every((i, k) => k === 0 || i > at[k - 1]), `the four tiers appear in order: ${at}`)
      // rules only: no dated observation or measurement in the derivation
      assert.ok(!/\b(observed|measured)\b[^\n]{0,60}\d{4}-\d{2}-\d{2}/i.test(rules), 'no dated narrative in the derivation')
      // the ambiguous example is a whole block: the literal sits under a `Do NOT` row, not under `Next cmd:`
      assert.match(text, /^ {2}Do NOT {2}: [^\n]+\n\(Next : ambiguous — 2 in-progress rows; Next Steps item 1 follows\)$/m)
      // the count in the literal is the script's `inProgressRows`, and a value-less row still counts
      assert.ok(rules.includes('`inProgressRows`'), 'the literal counts in-progress rows, blanks included')
      // the Docs tier never answers with the slice that has just finished
      assert.match(rules, /equals the `Slice` of one\s+of that Epic's `done` rows/)
      assert.ok(rules.includes('listed once'), 'a repeated identical token is listed once')
      // everything printed under the aligned block has one order
      assert.ok(rules.includes('**Under the aligned block**, print what applies in this order'), 'the render order under the block is stated')
      // lines of the new text stay near the file's width (the briefing template rows are the only long ones)
      for (const l of rules.split('\n')) assert.ok([...l].length <= 100, `a line of ${[...l].length} characters: ${l.slice(0, 40)}`)
      // self-contained: the label line's shape is defined here, not by a pointer into generate.md
      assert.ok(rules.includes('`Slice : <kebab-case identifier>`'), 'the label line shape is written out')
      // a reference to generate's step names the file, because this file is read without it
      once('drafted in `templates/handoff/generate.md` Step 1 item 4', 'the qualified generate reference')
      // the gate: two or more candidates are listed numbered and "Adjust plan" is recommended
      const forms = text.slice(text.indexOf("**The first option's forms.**"), text.indexOf('**NEVER start executing work'))
      assert.ok(forms.length > 100, "the first option's forms section exists")
      assert.match(forms, /two or more candidates/i)
      // both forms' descriptions carry the `Next :` identifier, which is item 1 itself when `Next :` is ambiguous
      assert.ok(forms.includes('or `Next Steps item 1` when `Next :` is ambiguous'), 'the identifier in the first option is defined for an ambiguous Next :')
      assert.ok(forms.includes('rules 2–5'), 'a picked candidate is executed under rules 2-5, not rule 2 alone')
      assert.match(forms, /not all of\s+`commandCandidates`/, 'the numbered list holds the candidates left after rule 1, not every shape match')
      assert.match(forms, /numbered/)
      assert.match(forms, /Adjust plan/)
      // rule 2's second conjunct cannot compare a picked candidate with a row that printed the literal
      assert.ok(text.includes('a candidate the human picked from the numbered list, that list entry'), 'rule 2 conjunct (ii) covers the numbered list')
    },
  },
  {
    id: 'sources-carry-no-literal-bom-character',
    run: async () => {
      // A BOM in source is invisible in a review; write it as an escape.
      const bom = String.fromCharCode(0xfeff)
      const dirs = ['skills/handoff/scripts', 'skills/handoff/scripts/lib', 'tests/handoff', 'tests/handoff/corpus']
      for (const d of dirs) {
        for (const name of fs.readdirSync(path.join(ROOT, d))) {
          if (!name.endsWith('.mjs')) continue
          const text = fs.readFileSync(path.join(ROOT, d, name), 'utf8')
          assert.ok(!text.includes(bom), `${d}/${name} contains the character U+FEFF; write it as an escape`)
        }
      }
    },
  },
]

// ---- the runner's own exit codes ----------------------------------------------------------------------------

function runnerExit(casesSource) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-runner-'))
  try {
    const f = path.join(dir, 'tiny-cases.mjs')
    fs.writeFileSync(f, casesSource)
    return spawnSync(process.execPath, [RUN_JS, f], { encoding: 'utf8' })
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

const runnerCases = [
  {
    id: 'runner-exit-0-and-counts-when-every-case-passes',
    run: async () => {
      const r = runnerExit('export const cases = [{ id: "a", run: async () => {} }, { id: "b", run: async () => {} }]')
      assert.equal(r.status, 0)
      assert.match(r.stdout, /^2 pass, 0 fail$/m)
    },
  },
  {
    id: 'runner-exit-1-when-a-case-fails',
    run: async () => {
      const r = runnerExit('export const cases = [{ id: "a", run: async () => {} }, { id: "b", run: async () => { throw new Error("boom") } }]')
      assert.equal(r.status, 1)
      assert.match(r.stdout, /FAIL b: boom/)
      assert.match(r.stdout, /^1 pass, 1 fail$/m)
    },
  },
  {
    id: 'runner-exit-2-on-a-duplicate-case-id',
    run: async () => {
      const r = runnerExit('export const cases = [{ id: "a", run: async () => {} }, { id: "a", run: async () => {} }]')
      assert.equal(r.status, 2)
      assert.match(r.stdout, /duplicate case id\(s\): a/)
    },
  },
  {
    id: 'runner-exit-2-when-the-cases-module-cannot-load',
    run: async () => {
      const r = runnerExit('export const cases = ( ')
      assert.equal(r.status, 2)
    },
  },
]

export const cases = [
  ...cliCases,
  ...headerCases,
  ...sectionCases,
  ...fixedCases,
  ...ledgerCases,
  ...stepOneCases,
  ...readingOrderCases,
  ...encodingCases,
  ...legacyCases,
  ...nextCases,
  ...corpusCases,
  ...corpusToolCases,
  ...nextDiffCases,
  ...readingPlanCases,
  ...pathCases,
  ...readingSimCases,
  ...contractCases,
  ...runnerCases,
]
