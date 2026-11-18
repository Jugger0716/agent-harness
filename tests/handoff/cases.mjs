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
import { spawnSync } from 'node:child_process'
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
const snapshotLib = () => lib('tests/handoff/corpus/snapshot.mjs')
const measureLib = () => lib('tests/handoff/corpus/measure.mjs')

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
  ...corpusCases,
  ...corpusToolCases,
  ...runnerCases,
]
