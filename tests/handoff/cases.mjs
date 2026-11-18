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

function cliEnv(env, ...args) {
  return spawnSync(process.execPath, [HANDOFF_JS, ...args], { encoding: 'utf8', env: env ?? process.env })
}

function cli(...args) {
  return cliEnv(undefined, ...args)
}

// An environment in which git never looks for a repository above `dir`: a case about "no repository" must not
// depend on where the OS keeps its temporary folder.
const noRepoAbove = (dir) => ({ ...process.env, GIT_CEILING_DIRECTORIES: dir })

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
        headRaw: '0123456789abcdef0123456789abcdef01234567 Add the sample parser',
        dirtyRaw: '2 files (src/a.js, src/b.js)',
        dirtyPaths: ['src/a.js', 'src/b.js'], // the legacy `Dirty:` line lists them
        worktree: null,
        upstream: 'origin/feature/sample-parser (ahead 1)',
      })
    },
  },
  {
    id: 'parse-legacy-has-no-new-fields',
    run: async () => {
      // A document written before the `Worktree` / `Dirty files` / `Harness :` lines existed still reads:
      // no worktree, the paths come from the legacy `Dirty:` line when it lists them, and a document
      // with neither the five-label record nor a `Harness :` line is "absent" (never "none").
      for (const name of ['legacy-no-labels', 'label-and-inprogress-differ']) {
        const p = parseFixture(name)
        assert.equal(p.header.worktree, null, name)
        assert.equal(p.harness, 'absent', name)
      }
      same(parseFixture('legacy-no-labels').header.dirtyPaths, [])
      same(parseFixture('label-and-inprogress-differ').header.dirtyPaths, ['src/a.js', 'src/b.js'])
      assert.equal(parseFixture('no-ledger-with-docs-label').harness, 'record')
    },
  },
  {
    id: 'parse-new-header-fields',
    run: async () => {
      const text = [
        '# HANDOFF — New header',
        '',
        '**Date:** 2026-02-01  **Project:** sample-service',
        '**Branch:** feature/x  **HEAD:** 0123456789abcdef0123456789abcdef01234567 Subject',
        '**Worktree:** C:\\work\\sample wt',
        '**Dirty:** 4 files  **Upstream:** n/a',
        '**Dirty files:** a.txt; `sub/b c.txt`; Makefile; +1 more',
        '',
        '## In Progress',
        'Harness : none (no .harness/state.json)',
        '',
      ].join('\n')
      const p = await parseText(text)
      assert.equal(p.header.worktree, 'C:\\work\\sample wt')
      // the paths of the new line, wrapping backticks dropped, the `+N more` marker not a path
      same(p.header.dirtyPaths, ['a.txt', 'sub/b c.txt', 'Makefile'])
      assert.equal(p.header.dirtyRaw, '4 files')
      assert.equal(p.harness, 'none')
      // `n/a` is no worktree; a clean tree lists nothing
      const q = await parseText('# HANDOFF — T\n\n**Worktree:** n/a\n**Dirty:** clean\n**Dirty files:** none\n\n## Goal\nx\n')
      assert.equal(q.header.worktree, null)
      same(q.header.dirtyPaths, [])
    },
  },
  {
    id: 'parse-dirty-paths-legacy-line-lists-only-paths',
    run: async () => {
      const paths = async (dirty) => (await parseText(`# HANDOFF — T\n\n**Dirty:** ${dirty}  **Upstream:** n/a\n\n## Goal\nx\n`)).header.dirtyPaths
      same(await paths('3 files (src/a.js, `docs/b.md`, notes.txt)'), ['src/a.js', 'docs/b.md', 'notes.txt'])
      same(await paths('2 files (src/a.js; src/b.js) — **unrelated work**'), ['src/a.js', 'src/b.js'])
      // prose or a count with no list is not a list of paths: a wrong path would raise a false "lost" alarm
      same(await paths('clean'), [])
      same(await paths('4 files, mostly docs'), [])
      same(await paths('3 files (mostly docs, a few tests)'), [])
      // the new line wins over the legacy one
      const both = await parseText('# HANDOFF — T\n\n**Dirty:** 1 file (old.txt)\n**Dirty files:** new.txt\n\n## Goal\nx\n')
      same(both.header.dirtyPaths, ['new.txt'])
    },
  },
  {
    id: 'parse-harness-record-none-or-absent',
    run: async () => {
      const kind = async (inProgress) => (await parseText(mk([['In Progress', inProgress]]))).harness
      assert.equal(await kind('Skill : harness\nTask : t\nPhase : generate_done\nMode : single\nDocs : docs/harness/t/'), 'record')
      assert.equal(await kind('Harness : none (state.json is for another branch)'), 'none')
      assert.equal(await kind('- `Harness : none (completed)`'), 'none')
      assert.equal(await kind('Working on the parser.'), 'absent')
      // the word alone is not the line, and a record beats a `none` line when a document has both
      assert.equal(await kind('Harness : none of the tasks apply, see below'), 'absent')
      assert.equal(await kind('Harness : none (x)\nSkill : harness\nTask : t'), 'record')
      assert.equal((await parseText('# HANDOFF — T\n\n## Goal\nx\n')).harness, 'absent')
    },
  },
  {
    id: 'parse-header-missing-labels-are-null',
    run: async () => {
      const p = await parseText('# HANDOFF — Bare\n\n**Date:** 2026-03-03\n\n## Goal\nx\n')
      assert.equal(p.header.title, 'Bare')
      assert.equal(p.header.date, '2026-03-03')
      for (const k of ['project', 'branch', 'head', 'headRaw', 'dirtyRaw', 'worktree', 'upstream']) {
        assert.equal(p.header[k], null, k)
      }
      same(p.header.dirtyPaths, [])
      assert.ok(!('headSubject' in p.header), 'headSubject had no consumer and is gone')
    },
  },
  {
    id: 'parse-header-head-forms',
    run: async () => {
      const head = (v) => `# HANDOFF — T\n\n**Branch:** main  **HEAD:** ${v}\n\n## Goal\nx\n`
      const a = (await parseText(head('`abc1234` Short sha'))).header
      assert.equal(a.head, 'abc1234')
      assert.equal(a.headRaw, '`abc1234` Short sha')
      const b = (await parseText(head('n/a'))).header
      assert.equal(b.head, null)
      assert.equal(b.headRaw, 'n/a')
      const c = (await parseText(head('0123456789abcdef0123456789abcdef01234567'))).header
      assert.equal(c.head, '0123456789abcdef0123456789abcdef01234567')
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

function plan(doc, budget = 1e9, env = undefined) {
  const r = cliEnv(env, 'reading-plan', '--doc', doc, '--budget', String(budget))
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
        const [e] = plan(doc, 1e9, noRepoAbove(dir)).entries
        assert.equal(e.status, 'skipped-invalid')
        assert.match(e.reason, /root/)
      } finally {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    },
  },
]

// ---- git-state, harness-state and drift: the live facts a resume checks a document against ---------------------------
//
// These cases build throw-away repositories (tests/handoff/mkrepo.mjs) under the OS temp folder with the machine's
// git configuration replaced, write a handoff document next to the repository (never inside it, so the repository
// stays as the case made it) and run the real command line with the same environment. Paths are compared through
// their real paths: git prints the long form of a temp folder that the OS may spell with a short name.

const mkrepoLib = () => lib('tests/handoff/mkrepo.mjs')
const real = (p) => fs.realpathSync.native(p)
const sha40 = /^[0-9a-f]{40}$/

async function withTemp(options, fn, plain = false) {
  const { makeRepo, makePlainDir } = await mkrepoLib()
  const r = plain ? makePlainDir() : makeRepo(options)
  try {
    return await fn(r)
  } finally {
    r.cleanup()
  }
}

// the command line inside a temp repository's environment; exit 0 and an empty stderr, one JSON object
function runIn(r, ...args) {
  const res = spawnSync(process.execPath, [HANDOFF_JS, ...args], { encoding: 'utf8', env: r.env })
  assert.equal(res.status, 0, `exit ${res.status}: ${res.stderr}`)
  assert.equal(res.stderr, '')
  return JSON.parse(res.stdout)
}
const gitStateIn = (r, cwd = r.dir) => runIn(r, 'git-state', '--cwd', cwd)

// A handoff document with the header lines a drift check reads. `worktree` null leaves the line out.
function driftDoc({ branch = 'main', head = null, worktree = null, dirtyFiles = [] } = {}) {
  const lines = [
    '# HANDOFF — Drift sample',
    '',
    '**Date:** 2026-02-01  **Project:** sample-service',
    `**Branch:** ${branch}  **HEAD:** ${head === null ? 'n/a' : `${head} Sample subject`}`,
  ]
  if (worktree !== null) lines.push(`**Worktree:** ${worktree}`)
  lines.push(`**Dirty:** ${dirtyFiles.length ? `${dirtyFiles.length} files` : 'clean'}  **Upstream:** n/a`)
  if (dirtyFiles.length) lines.push(`**Dirty files:** ${dirtyFiles.join('; ')}`)
  lines.push('', '## Goal', 'x', '')
  return lines.join('\n')
}

function driftIn(r, docText, cwd = r.dir) {
  const doc = path.join(r.root, 'doc.md')
  fs.writeFileSync(doc, docText)
  return runIn(r, 'drift', '--doc', doc, '--cwd', cwd)
}

const NO_DIRTY = { currentCount: 0, lost: [], committedSince: [], stillDirty: [] }

const gitStateCases = [
  {
    id: 'git-state-clean',
    run: async () => {
      await withTemp({ commits: [{ message: 'Add the sample file', files: { 'a.txt': 'one\n' } }] }, (r) => {
        const s = gitStateIn(r)
        same(Object.keys(s).sort(), ['branch', 'dirty', 'head', 'isGit', 'subject', 'toplevel', 'upstream'])
        assert.equal(s.isGit, true)
        assert.equal(real(s.toplevel), real(r.dir))
        assert.equal(s.branch, 'main')
        assert.match(s.head, sha40)
        assert.equal(s.head, r.shas[0])
        assert.equal(s.subject, 'Add the sample file')
        same(s.dirty, [])
        assert.equal(s.upstream, null)
      })
    },
  },
  {
    id: 'git-state-dirty-lists-every-path',
    run: async () => {
      const files = { 'a.txt': 'one\n', 'b.txt': 'two\n', 'c.txt': 'three\n' }
      const dirty = { 'a.txt': 'changed\n', 'b.txt': null, 'sub/new file.txt': 'x\n', '한글.txt': 'y\n' }
      for (let i = 1; i <= 12; i++) dirty[`many/f${String(i).padStart(2, '0')}.txt`] = 'z\n'
      await withTemp({ commits: [{ files }], dirty }, (r) => {
        r.write('staged.txt', 's\n')
        r.git('add', 'staged.txt')
        r.git('mv', 'c.txt', 'renamed.txt')
        const s = gitStateIn(r)
        const byPath = Object.fromEntries(s.dirty.map((d) => [d.path, d.status]))
        // every path, no cap: 4 + 12 + the staged add and the rename; a rename is ONE entry under its new name
        assert.equal(s.dirty.length, 4 + 12 + 2)
        assert.equal(byPath['a.txt'], ' M')
        assert.equal(byPath['b.txt'], ' D')
        assert.equal(byPath['sub/new file.txt'], '??')
        assert.equal(byPath['한글.txt'], '??')
        assert.equal(byPath['staged.txt'], 'A ')
        assert.equal(byPath['renamed.txt'], 'R ')
        assert.ok(!('c.txt' in byPath), 'the old name of a rename is not a second entry')
        // untracked files are listed one by one, never as their folder
        assert.ok(!('many/' in byPath) && !('sub/' in byPath))
        assert.equal(byPath['many/f12.txt'], '??')
      })
    },
  },
  {
    id: 'git-state-detached',
    run: async () => {
      await withTemp({ commits: [{ message: 'one' }, { message: 'two' }], detached: true }, (r) => {
        const s = gitStateIn(r)
        assert.equal(s.isGit, true)
        assert.equal(s.branch, '(detached)')
        assert.equal(s.head, r.shas[1])
        assert.equal(s.subject, 'two')
      })
    },
  },
  {
    id: 'git-state-not-a-repo',
    run: async () => {
      await withTemp(null, (r) => {
        const s = gitStateIn(r)
        assert.equal(s.isGit, false)
        for (const k of ['toplevel', 'branch', 'head', 'subject', 'upstream']) assert.equal(s[k], null, k)
        same(s.dirty, [])
      }, true)
    },
  },
  {
    id: 'git-state-from-a-subfolder-reports-the-top-level-and-top-relative-paths',
    run: async () => {
      await withTemp({ commits: [{ files: { 'sub/x.txt': 'one\n' } }], dirty: { 'sub/x.txt': 'two\n', 'top.txt': 't\n' } }, (r) => {
        const s = gitStateIn(r, path.join(r.dir, 'sub'))
        assert.equal(real(s.toplevel), real(r.dir))
        same(s.dirty.map((d) => d.path).sort(), ['sub/x.txt', 'top.txt'])
      })
    },
  },
  {
    id: 'git-state-before-the-first-commit',
    run: async () => {
      await withTemp({ commits: [], dirty: { 'new.txt': 'n\n' } }, (r) => {
        const s = gitStateIn(r)
        assert.equal(s.isGit, true)
        assert.equal(s.branch, 'main')
        assert.equal(s.head, null)
        assert.equal(s.subject, null)
        same(s.dirty.map((d) => d.path), ['new.txt'])
      })
    },
  },
  {
    id: 'git-state-upstream-ahead-and-behind',
    run: async () => {
      await withTemp({ commits: [{ message: 'one' }, { message: 'two' }] }, (r) => {
        const remote = path.join(r.root, 'origin.git')
        r.gitIn(r.root, 'init', '-q', '--bare', '-b', 'main', remote)
        r.git('remote', 'add', 'origin', remote)
        r.git('push', '-q', '-u', 'origin', 'main')
        same(gitStateIn(r).upstream, { ahead: 0, behind: 0 })
        r.git('commit', '-q', '--allow-empty', '-m', 'three')
        same(gitStateIn(r).upstream, { ahead: 1, behind: 0 })
        r.git('reset', '-q', '--hard', 'HEAD~2')
        same(gitStateIn(r).upstream, { ahead: 0, behind: 1 })
      })
    },
  },
  {
    id: 'git-state-and-drift-leave-the-repository-alone',
    run: async () => {
      // `git status` normally rewrites the index to refresh its stat data; the helper must not.
      await withTemp({ commits: [{ files: { 'a.txt': 'one\n' } }] }, (r) => {
        const abs = path.join(r.dir, 'a.txt')
        fs.writeFileSync(abs, 'one\n') // the same content, a new modification time: a stale stat entry
        const later = new Date(Date.now() + 5000)
        fs.utimesSync(abs, later, later)
        const index = path.join(r.dir, '.git', 'index')
        const before = fs.readFileSync(index)
        gitStateIn(r)
        driftIn(r, driftDoc({ head: r.shas[0], dirtyFiles: ['a.txt'] }))
        assert.ok(before.equals(fs.readFileSync(index)), 'the index file is byte for byte the same')
      })
    },
  },
  {
    id: 'git-state-usage-and-input-errors',
    run: async () => {
      const none = cli('git-state')
      assert.equal(none.status, 2)
      assert.equal(none.stdout, '')
      assert.match(none.stderr, /--cwd/)
      const missing = cli('git-state', '--cwd', path.join(FIX, 'no-such-folder'))
      assert.equal(missing.status, 1)
      assert.equal(missing.stdout, '')
      assert.ok(missing.stderr.trim().length > 0)
    },
  },
]

// ---- harness-state ---------------------------------------------------------------------------------------------

function withStateDir(state, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-state-'))
  try {
    if (state !== null) {
      fs.mkdirSync(path.join(dir, '.harness'))
      fs.writeFileSync(path.join(dir, '.harness', 'state.json'), typeof state === 'string' ? state : JSON.stringify(state))
    }
    return fn(dir)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

function harnessState(dir, branch) {
  const r = cli('harness-state', '--branch', branch, '--cwd', dir)
  assert.equal(r.status, 0, `exit ${r.status}: ${r.stderr}`)
  assert.equal(r.stderr, '')
  return JSON.parse(r.stdout)
}

const STATE = { version: '3.0', skill: 'harness', task: 'Add the parser', mode: 'single', phase: 'generate_done', branch: 'harness/add-parser', docs_path: 'docs/harness/add-parser/' }

const harnessStateCases = [
  {
    id: 'harness-state-absent',
    run: async () => {
      withStateDir(null, (dir) => {
        const s = harnessState(dir, 'main')
        assert.equal(s.exists, false)
        assert.equal(s.relevant, false)
        assert.match(s.reason, /state\.json/)
        assert.equal(s.fields, null)
        same(Object.keys(s).sort(), ['exists', 'fields', 'reason', 'relevant'])
      })
    },
  },
  {
    id: 'harness-state-other-branch',
    run: async () => {
      withStateDir(STATE, (dir) => {
        const s = harnessState(dir, 'main')
        assert.equal(s.exists, true)
        assert.equal(s.relevant, false)
        assert.ok(s.reason.includes('harness/add-parser') && s.reason.includes('main'), `the reason names both branches: ${s.reason}`)
      })
    },
  },
  {
    id: 'harness-state-completed',
    run: async () => {
      withStateDir({ ...STATE, phase: 'completed' }, (dir) => {
        const s = harnessState(dir, 'harness/add-parser')
        assert.equal(s.exists, true)
        assert.equal(s.relevant, false)
        assert.match(s.reason, /completed/)
      })
    },
  },
  {
    id: 'harness-state-match',
    run: async () => {
      withStateDir(STATE, (dir) => {
        const s = harnessState(dir, 'harness/add-parser')
        assert.equal(s.exists, true)
        assert.equal(s.relevant, true)
        assert.ok(typeof s.reason === 'string' && s.reason.length > 0)
        same(s.fields, { skill: 'harness', task: 'Add the parser', phase: 'generate_done', mode: 'single', docs_path: 'docs/harness/add-parser/' })
      })
    },
  },
  {
    id: 'harness-state-detached-and-non-git-values-never-match-a-branch',
    run: async () => {
      withStateDir(STATE, (dir) => {
        assert.equal(harnessState(dir, '(detached)').relevant, false)
        assert.equal(harnessState(dir, 'n/a').relevant, false)
      })
      // a task started without git records no branch: with no branch to equal the current one it is not relevant
      const { branch, ...noBranch } = STATE
      withStateDir({ ...noBranch, has_git: false }, (dir) => {
        const s = harnessState(dir, 'n/a')
        assert.equal(s.exists, true)
        assert.equal(s.relevant, false)
        assert.match(s.reason, /branch/)
      })
    },
  },
  {
    id: 'harness-state-unreadable-file-is-a-reason-not-a-crash',
    run: async () => {
      for (const bad of ['{ not json', '[]', '"text"', '']) {
        withStateDir(bad, (dir) => {
          const s = harnessState(dir, 'main')
          assert.equal(s.exists, true, JSON.stringify(bad))
          assert.equal(s.relevant, false, JSON.stringify(bad))
          assert.equal(s.fields, null, JSON.stringify(bad))
          assert.match(s.reason, /state\.json/)
        })
      }
    },
  },
  {
    id: 'harness-state-reads-and-never-writes',
    run: async () => {
      withStateDir(STATE, (dir) => {
        const file = path.join(dir, '.harness', 'state.json')
        const before = fs.readFileSync(file)
        const mtime = fs.statSync(file).mtimeMs
        harnessState(dir, 'harness/add-parser')
        assert.ok(before.equals(fs.readFileSync(file)))
        assert.equal(fs.statSync(file).mtimeMs, mtime)
        same(fs.readdirSync(path.join(dir, '.harness')), ['state.json'])
      })
    },
  },
  {
    id: 'harness-state-usage-errors',
    run: async () => {
      const noBranch = cli('harness-state', '--cwd', FIX)
      assert.equal(noBranch.status, 2)
      assert.equal(noBranch.stdout, '')
      assert.match(noBranch.stderr, /--branch/)
      const gone = cli('harness-state', '--branch', 'main', '--cwd', path.join(FIX, 'no-such-folder'))
      assert.equal(gone.status, 1)
      assert.equal(gone.stdout, '')
    },
  },
]

// ---- drift -------------------------------------------------------------------------------------------------------

const driftCases = [
  {
    id: 'drift-same',
    run: async () => {
      await withTemp({ commits: [{ files: { 'a.txt': 'one\n' } }] }, (r) => {
        const d = driftIn(r, driftDoc({ head: r.shas[0] }))
        same(Object.keys(d).sort(), ['branch', 'dirty', 'head', 'skipped'])
        same(d.branch, { recorded: 'main', current: 'main', same: true, viaWorktree: false })
        same(d.head, { relation: 'same', ahead: [], more: 0 })
        same(d.dirty, NO_DIRTY)
        same(d.skipped, [])
        // an abbreviated recorded sha is the same commit
        same(driftIn(r, driftDoc({ head: r.shas[0].slice(0, 12) })).head, { relation: 'same', ahead: [], more: 0 })
      })
    },
  },
  {
    id: 'drift-forward',
    run: async () => {
      await withTemp({ commits: [{ message: 'one' }, { message: 'two' }, { message: 'three' }] }, (r) => {
        const d = driftIn(r, driftDoc({ head: r.shas[0] }))
        assert.equal(d.head.relation, 'forward')
        same(d.head.ahead, [{ sha: r.shas[2], subject: 'three' }, { sha: r.shas[1], subject: 'two' }])
        assert.equal(d.head.more, 0)
      })
    },
  },
  {
    id: 'drift-forward-caps-the-list-at-twenty',
    run: async () => {
      const commits = Array.from({ length: 26 }, (_, i) => ({ message: `c${i + 1}` }))
      await withTemp({ commits }, (r) => {
        const d = driftIn(r, driftDoc({ head: r.shas[0] }))
        assert.equal(d.head.relation, 'forward')
        assert.equal(d.head.ahead.length, 20)
        assert.equal(d.head.more, 5)
        same(d.head.ahead[0], { sha: r.shas[25], subject: 'c26' })
      })
    },
  },
  {
    id: 'drift-backward',
    run: async () => {
      await withTemp({ commits: [{ message: 'one' }, { message: 'two' }, { message: 'three' }] }, (r) => {
        const recorded = r.shas[2]
        r.git('reset', '-q', '--hard', 'HEAD~2')
        const d = driftIn(r, driftDoc({ head: recorded }))
        assert.equal(d.head.relation, 'backward')
        same(d.head.ahead, [])
        assert.equal(d.head.more, 0)
      })
    },
  },
  {
    id: 'drift-diverged',
    run: async () => {
      await withTemp({ commits: [{ message: 'one' }, { message: 'two' }] }, (r) => {
        const recorded = r.shas[1]
        r.git('commit', '-q', '--amend', '--allow-empty', '-m', 'two, reworded')
        assert.notEqual(r.git('rev-parse', 'HEAD'), recorded)
        const d = driftIn(r, driftDoc({ head: recorded }))
        assert.equal(d.head.relation, 'diverged')
        same(d.head.ahead, [])
      })
    },
  },
  {
    id: 'drift-unknown-commit-is-not-checked-and-raises-no-lost-work-alarm',
    run: async () => {
      await withTemp({ commits: [{ files: { 'a.txt': 'one\n' } }], dirty: { 'a.txt': 'two\n', 'b.txt': 'b\n' } }, (r) => {
        const d = driftIn(r, driftDoc({ head: '1234567890abcdef1234567890abcdef12345678', dirtyFiles: ['a.txt', 'gone.txt', 'b.txt'] }))
        assert.equal(d.head.relation, 'unknown')
        assert.ok(d.skipped.some((s) => /not found/.test(s)), `a reason: ${d.skipped}`)
        // without the recorded commit "committed since" cannot be told from "lost": nothing is called lost
        same(d.dirty.lost, [])
        same(d.dirty.committedSince, [])
        same(d.dirty.stillDirty, ['a.txt', 'b.txt'])
        assert.equal(d.dirty.currentCount, 2)
        // the branch is still compared
        assert.equal(d.branch.same, true)
      })
    },
  },
  {
    id: 'drift-branch-differs',
    run: async () => {
      await withTemp({}, (r) => {
        const d = driftIn(r, driftDoc({ branch: 'feature/other', head: r.shas[0] }))
        same(d.branch, { recorded: 'feature/other', current: 'main', same: false, viaWorktree: false })
        assert.equal(d.head.relation, 'same')
      })
    },
  },
  {
    id: 'drift-dirty-lost',
    run: async () => {
      await withTemp({ commits: [{ files: { 'a.txt': 'one\n' } }], dirty: { 'a.txt': 'two\n' } }, (r) => {
        const doc = driftDoc({ head: r.shas[0], dirtyFiles: gitStateIn(r).dirty.map((d) => d.path) })
        same(driftIn(r, doc).dirty, { currentCount: 1, lost: [], committedSince: [], stillDirty: ['a.txt'] })
        r.git('checkout', '--', 'a.txt') // the edit is thrown away (this is a test: the contract never runs it)
        const d = driftIn(r, doc)
        same(d.dirty, { currentCount: 0, lost: ['a.txt'], committedSince: [], stillDirty: [] })
        assert.equal(d.head.relation, 'same')
      })
    },
  },
  {
    id: 'drift-dirty-committed-since',
    run: async () => {
      await withTemp({ commits: [{ files: { 'a.txt': 'one\n' } }], dirty: { 'a.txt': 'two\n' } }, (r) => {
        const doc = driftDoc({ head: r.shas[0], dirtyFiles: ['a.txt'] })
        r.git('commit', '-q', '-a', '-m', 'save the edit')
        const d = driftIn(r, doc)
        same(d.dirty, { currentCount: 0, lost: [], committedSince: ['a.txt'], stillDirty: [] })
        assert.equal(d.head.relation, 'forward')
      })
    },
  },
  {
    id: 'drift-dirty-classifies-each-recorded-path',
    run: async () => {
      const files = { 'a.txt': '1\n', 'b.txt': '2\n', 'c.txt': '3\n' }
      await withTemp({ commits: [{ files }], dirty: { 'a.txt': 'x\n', 'b.txt': 'x\n', 'c.txt': 'x\n', 'd.txt': 'x\n', 'dir/e.txt': 'x\n' } }, (r) => {
        const doc = driftDoc({ head: r.shas[0], dirtyFiles: ['a.txt', 'b.txt', 'c.txt', 'd.txt', 'dir/e.txt'] })
        r.git('checkout', '--', 'a.txt') // reverted: lost
        r.git('add', 'b.txt')
        r.git('commit', '-q', '-m', 'save b') // committed since
        // c.txt stays dirty; d.txt is an untracked file that was deleted: lost; dir/e.txt is an untracked file that stays
        fs.rmSync(path.join(r.dir, 'd.txt'))
        r.write('unrelated.txt', 'u\n') // dirty now, never recorded
        const d = driftIn(r, doc)
        same(d.dirty.lost, ['a.txt', 'd.txt'])
        same(d.dirty.committedSince, ['b.txt'])
        same(d.dirty.stillDirty, ['c.txt', 'dir/e.txt'])
        assert.equal(d.dirty.currentCount, 3) // c.txt, dir/e.txt, unrelated.txt
      })
    },
  },
  {
    id: 'drift-dirty-path-after-a-directory-entry-and-literal-names',
    run: async () => {
      await withTemp({ commits: [{ files: { 'a.txt': '1\n' } }], dirty: { 'newdir/f.txt': 'x\n', 'weird[1].txt': 'x\n' } }, (r) => {
        // a legacy document may list an untracked folder as `newdir/`; a name with glob characters is a name
        const d = driftIn(r, driftDoc({ head: r.shas[0], dirtyFiles: ['newdir/', 'weird[1].txt', ':(top)a.txt', '*.txt'] }))
        same(d.dirty.stillDirty, ['newdir/', 'weird[1].txt'])
        same(d.dirty.lost, [':(top)a.txt', '*.txt'])
      })
    },
  },
  {
    id: 'drift-from-a-subfolder',
    run: async () => {
      await withTemp({ commits: [{ files: { 'sub/x.txt': 'one\n' } }], dirty: { 'sub/x.txt': 'two\n' } }, (r) => {
        const doc = driftDoc({ head: r.shas[0], dirtyFiles: ['sub/x.txt'] })
        r.git('checkout', '--', 'sub/x.txt')
        const d = driftIn(r, doc, path.join(r.dir, 'sub'))
        same(d.dirty.lost, ['sub/x.txt'])
        assert.equal(d.head.relation, 'same')
      })
    },
  },
  {
    id: 'drift-worktree-from-main',
    run: async () => {
      await withTemp({ commits: [{ message: 'one' }], worktree: { branch: 'feature' } }, (r) => {
        fs.writeFileSync(path.join(r.worktreeDir, 'w.txt'), 'work\n') // dirty in the linked worktree only
        const text = driftDoc({ branch: 'feature', head: r.shas[0], worktree: r.worktreeDir, dirtyFiles: ['w.txt'] })
        // resumed from the main tree: the branch the document recorded is the worktree's, so it is NOT "different"
        const d = driftIn(r, text, r.dir)
        same(d.branch, { recorded: 'feature', current: 'feature', same: true, viaWorktree: true })
        assert.equal(d.head.relation, 'same')
        same(d.dirty, { currentCount: 1, lost: [], committedSince: [], stillDirty: ['w.txt'] })
        same(d.skipped, [])
        // the control: the same document without the worktree line IS compared with the main tree
        const plain = driftIn(r, driftDoc({ branch: 'feature', head: r.shas[0], dirtyFiles: ['w.txt'] }), r.dir)
        same(plain.branch, { recorded: 'feature', current: 'main', same: false, viaWorktree: false })
        same(plain.dirty.lost, ['w.txt'])
        // resumed inside the worktree itself nothing is "via" anything
        const inside = driftIn(r, text, r.worktreeDir)
        same(inside.branch, { recorded: 'feature', current: 'feature', same: true, viaWorktree: false })
      })
    },
  },
  {
    id: 'drift-worktree-gone',
    run: async () => {
      await withTemp({ commits: [{ files: { 'a.txt': 'one\n' } }] }, (r) => {
        const gone = path.join(r.root, 'removed-worktree')
        const d = driftIn(r, driftDoc({ branch: 'feature', head: r.shas[0], worktree: gone, dirtyFiles: ['a.txt'] }))
        assert.ok(d.skipped.length >= 1 && d.skipped.some((s) => s.includes(gone)), `a reason naming the folder: ${d.skipped}`)
        // no alarm: nothing was compared, so nothing is "different", "lost" or "diverged"
        assert.equal(d.branch.same, null)
        assert.equal(d.branch.viaWorktree, false)
        assert.equal(d.head.relation, 'unknown')
        same(d.dirty, NO_DIRTY)
      })
    },
  },
  {
    id: 'drift-worktree-folder-that-is-no-longer-a-work-tree',
    run: async () => {
      await withTemp({ commits: [{ message: 'one' }] }, (r) => {
        const folder = path.join(r.root, 'left-behind')
        fs.mkdirSync(folder)
        const d = driftIn(r, driftDoc({ head: r.shas[0], worktree: folder }))
        assert.ok(d.skipped.length >= 1)
        assert.equal(d.branch.same, null)
        same(d.dirty, NO_DIRTY)
      })
    },
  },
  {
    id: 'drift-in-a-folder-that-is-not-a-repository',
    run: async () => {
      await withTemp(null, (r) => {
        const d = driftIn(r, driftDoc({ head: '1234567890abcdef1234567890abcdef12345678', dirtyFiles: ['a.txt'] }), r.dir)
        assert.ok(d.skipped.length >= 1 && d.skipped.some((s) => /git/.test(s)), `a reason: ${d.skipped}`)
        assert.equal(d.branch.current, null)
        assert.equal(d.branch.same, null)
        assert.equal(d.head.relation, 'unknown')
        same(d.dirty, NO_DIRTY)
      }, true)
    },
  },
  {
    id: 'drift-document-written-outside-git',
    run: async () => {
      await withTemp({}, (r) => {
        // `Branch: n/a` and `HEAD: n/a`: the document knows no branch and no commit to compare
        const d = driftIn(r, driftDoc({ branch: 'n/a', head: null }))
        assert.equal(d.branch.recorded, 'n/a')
        assert.equal(d.branch.current, 'main')
        assert.equal(d.branch.same, null)
        assert.equal(d.head.relation, 'unknown')
        assert.ok(d.skipped.length >= 1)
      })
    },
  },
  {
    id: 'drift-usage-and-input-errors',
    run: async () => {
      const doc = path.join(FIX, 'legacy-no-labels.md')
      assert.equal(cli('drift', '--cwd', FIX).status, 2)
      assert.equal(cli('drift', '--doc', doc).status, 2)
      const missing = cli('drift', '--doc', path.join(FIX, 'does-not-exist.md'), '--cwd', FIX)
      assert.equal(missing.status, 1)
      assert.equal(missing.stdout, '')
      const foreign = cli('drift', '--doc', path.join(FIX, 'non-handoff.md'), '--cwd', FIX)
      assert.equal(foreign.status, 1)
      assert.match(foreign.stderr, /# HANDOFF —/)
      const gone = cli('drift', '--doc', doc, '--cwd', path.join(FIX, 'no-such-folder'))
      assert.equal(gone.status, 1)
      assert.equal(gone.stdout, '')
    },
  },
]

// ---- drift: a recorded Worktree is data, and what git cannot check is never reported as lost ---------------------------------

// A repository whose own configuration would run a program on a plain `git status`: a clean-filter driver
// that creates PWNED_FILTER next to the files. The precondition is checked, not assumed: the same `status`
// run directly creates the marker, so a case that sees no marker later proves the helper never ran git there.
async function withFilterRepo(fn) {
  const { makeRepo } = await mkrepoLib()
  const evil = makeRepo({ commits: [{ files: { '.gitattributes': '* filter=evil\n', 'a.txt': 'one\n' } }] })
  try {
    // the marker lives beside the repository, not in it, so it can be told from anything a case creates there
    const marker = path.join(evil.root, 'PWNED_FILTER')
    evil.git('config', 'filter.evil.clean', `touch "${marker.replace(/\\/g, '/')}" && cat`)
    // the same attribute through the repository's own info file: a `.git` gitfile that points here selects it too
    fs.mkdirSync(path.join(evil.dir, '.git', 'info'), { recursive: true })
    fs.writeFileSync(path.join(evil.dir, '.git', 'info', 'attributes'), '* filter=evil\n')
    const touchStat = (secs, dir = evil.dir) => {
      const when = new Date(Date.now() + secs * 1000)
      fs.utimesSync(path.join(dir, 'a.txt'), when, when)
    }
    evil.restat = touchStat
    touchStat(5)
    evil.git('status', '--porcelain')
    assert.ok(fs.existsSync(marker), 'precondition: a plain `git status` in this repository runs the filter')
    fs.rmSync(marker)
    touchStat(15) // the index entry is stale again, so the next `status` would hash the file once more
    return await fn(evil, marker)
  } finally {
    evil.cleanup()
  }
}

const driftSafetyCases = [
  {
    id: 'drift-worktree-of-an-unrelated-repository-is-never-opened',
    run: async () => {
      await withFilterRepo(async (evil, marker) => {
        await withTemp({ commits: [{ files: { 'a.txt': 'one\n' } }] }, (r) => {
          const d = driftIn(r, driftDoc({ branch: 'main', head: r.shas[0], worktree: evil.dir, dirtyFiles: ['a.txt'] }))
          assert.ok(!fs.existsSync(marker), 'no program of the unrelated repository ran')
          assert.ok(d.skipped.some((s) => s.includes(evil.dir)), `a reason naming the folder: ${d.skipped}`)
          // and no false reassurance either: nothing was compared
          assert.equal(d.branch.viaWorktree, false)
          assert.equal(d.branch.same, null)
          assert.equal(d.head.relation, 'unknown')
          same(d.dirty, NO_DIRTY)
        })
      })
    },
  },
  {
    id: 'drift-worktree-is-skipped-when-the-current-folder-is-not-a-repository',
    run: async () => {
      await withFilterRepo(async (evil, marker) => {
        await withTemp(null, (plain) => {
          const d = driftIn(plain, driftDoc({ head: evil.shas[0], worktree: evil.dir, dirtyFiles: ['a.txt'] }), plain.dir)
          assert.ok(!fs.existsSync(marker), 'no program of the recorded repository ran')
          assert.ok(d.skipped.length >= 1)
          assert.equal(d.branch.viaWorktree, false)
          assert.equal(d.branch.same, null)
          same(d.dirty, NO_DIRTY)
        }, true)
      })
    },
  },
  {
    id: 'drift-worktree-must-be-an-absolute-path',
    run: async () => {
      await withTemp({ commits: [{ message: 'one' }], worktree: { branch: 'feature' } }, (r) => {
        // a relative path would be read from the helper's own working directory, which the document does not choose
        for (const rel of ['.', '..', 'wt', path.join('..', 'wt')]) {
          const d = driftIn(r, driftDoc({ branch: 'feature', head: r.shas[0], worktree: rel }))
          assert.ok(d.skipped.some((s) => /absolute/.test(s)), `${rel}: a reason: ${d.skipped}`)
          assert.equal(d.branch.viaWorktree, false, rel)
          assert.equal(d.branch.same, null, rel)
          same(d.dirty, NO_DIRTY)
        }
      })
    },
  },
  {
    id: 'drift-worktree-main-tree-from-a-linked-worktree',
    run: async () => {
      // the repository's own work-tree list holds the main tree too: a document written there is still found
      await withTemp({ commits: [{ message: 'one' }], worktree: { branch: 'feature' } }, (r) => {
        const d = driftIn(r, driftDoc({ branch: 'main', head: r.shas[0], worktree: r.dir }), r.worktreeDir)
        same(d.branch, { recorded: 'main', current: 'main', same: true, viaWorktree: true })
        same(d.skipped, [])
      })
    },
  },
  {
    id: 'drift-a-skipped-comparison-says-how-many-recorded-paths-it-could-not-check',
    run: async () => {
      await withTemp({ commits: [{ files: { 'a.txt': 'one\n', 'b.txt': 'two\n' } }] }, (r) => {
        const gone = path.join(r.root, 'removed-worktree')
        const d = driftIn(r, driftDoc({ head: r.shas[0], worktree: gone, dirtyFiles: ['a.txt', 'b.txt'] }))
        assert.ok(d.skipped.some((s) => /2 recorded dirty path/.test(s)), `the count: ${d.skipped}`)
      })
      await withTemp(null, (plain) => {
        const d = driftIn(plain, driftDoc({ head: null, dirtyFiles: ['a.txt'] }), plain.dir)
        assert.ok(d.skipped.some((s) => /1 recorded dirty path/.test(s)), `the count: ${d.skipped}`)
      }, true)
    },
  },
  {
    id: 'drift-dirty-rename-keeps-its-original-path-dirty',
    run: async () => {
      const text = Array.from({ length: 10 }, (_, i) => `line ${i + 1} of the file`).join('\n') + '\n'
      await withTemp({ commits: [{ files: { 'a.txt': text } }], dirty: { 'a.txt': text.replace('line 10', 'LINE 10') } }, (r) => {
        const doc = driftDoc({ head: r.shas[0], dirtyFiles: ['a.txt'] })
        r.git('add', 'a.txt')
        r.git('mv', 'a.txt', 'b.txt') // the edit travels with the rename: it is staged under the new name
        assert.equal(gitStateIn(r).dirty.find((d) => d.path === 'b.txt').status, 'R ')
        const d = driftIn(r, doc)
        same(d.dirty.lost, [])
        same(d.dirty.stillDirty, ['a.txt'])
        same(d.dirty.committedSince, [])
        assert.equal(d.dirty.currentCount, 1) // git-state's list is unchanged: one entry for the rename
      })
    },
  },
  {
    id: 'drift-dirty-paths-git-cannot-check-are-skipped-not-lost',
    run: async () => {
      await withTemp({ commits: [{ files: { 'a.txt': '1\n', 'sub/b.txt': '2\n' } }], dirty: { 'a.txt': 'x\n' } }, (r) => {
        const outside = ['../outside.txt', 'C:/Windows/win.ini', '/etc/hosts', 'sub/../a.txt']
        const d = driftIn(r, driftDoc({ head: r.shas[0], dirtyFiles: [...outside, 'a.txt'] }))
        same(d.dirty.lost, [])
        same(d.dirty.committedSince, [])
        same(d.dirty.stillDirty, ['a.txt'])
        assert.ok(d.skipped.some((s) => /4 recorded dirty path/.test(s) && /outside the repository/.test(s)), `skipped: ${d.skipped}`)
      })
    },
  },
]

// ---- drift: the folder a work-tree list vouches for must still be that repository's work tree --------------------------------

const driftIdentityCases = [
  {
    id: 'drift-registered-worktree-whose-gitfile-is-gone-is-not-read-as-the-main-tree',
    run: async () => {
      // an in-tree work tree stays registered after its `.git` file is deleted; git then finds the MAIN tree above it
      await withTemp({ commits: [{ files: { 'a.txt': 'one\n' } }] }, (r) => {
        const wt = path.join(r.dir, 'wt-in')
        r.git('worktree', 'add', '-q', '-b', 'intree', wt)
        fs.writeFileSync(path.join(wt, 'w.txt'), 'work\n')
        fs.rmSync(path.join(wt, '.git'))
        const d = driftIn(r, driftDoc({ branch: 'intree', head: r.shas[0], worktree: wt, dirtyFiles: ['w.txt'] }))
        assert.ok(d.skipped.some((s) => /does not belong to this repository/.test(s)), `a reason: ${d.skipped}`)
        assert.equal(d.branch.viaWorktree, false)
        assert.equal(d.branch.same, null, 'nothing was compared with the main tree')
        assert.equal(d.branch.current, null)
        same(d.dirty, NO_DIRTY)
        assert.ok(d.skipped.some((s) => /1 recorded dirty path/.test(s)))
      })
    },
  },
  {
    id: 'drift-registered-worktree-path-inside-another-repository-is-never-opened',
    run: async () => {
      // the registration outlives the folder: the path is now an empty folder inside a hostile repository
      await withFilterRepo(async (evil, marker) => {
        await withTemp({ commits: [{ files: { 'a.txt': 'one\n' } }] }, (r) => {
          const sub = path.join(evil.dir, 'sub')
          r.git('worktree', 'add', '-q', '-b', 'moved', sub)
          fs.rmSync(sub, { recursive: true, force: true })
          fs.mkdirSync(sub)
          evil.restat(25)
          const d = driftIn(r, driftDoc({ branch: 'moved', head: r.shas[0], worktree: sub, dirtyFiles: ['a.txt'] }))
          assert.ok(!fs.existsSync(marker), 'no program of the repository that now holds the folder ran')
          assert.ok(d.skipped.some((s) => /does not belong to this repository/.test(s)), `a reason: ${d.skipped}`)
          assert.equal(d.branch.viaWorktree, false)
          assert.equal(d.branch.same, null)
          same(d.dirty, NO_DIRTY)
        })
      })
    },
  },
  {
    id: 'drift-registered-worktree-whose-gitfile-points-elsewhere-is-never-opened',
    run: async () => {
      await withFilterRepo(async (evil, marker) => {
        await withTemp({ commits: [{ files: { 'a.txt': 'one\n' } }], worktree: { branch: 'feature' } }, (r) => {
          // the work tree's `.git` file now names the hostile repository's git directory
          const gitfile = path.join(r.worktreeDir, '.git')
          fs.rmSync(gitfile, { force: true }) // git marks it read-only on Windows
          fs.writeFileSync(gitfile, `gitdir: ${path.join(evil.dir, '.git').replace(/\\/g, '/')}\n`)
          // precondition: a plain `status` in the tampered work tree runs the filter
          r.gitIn(r.worktreeDir, 'status', '--porcelain')
          assert.ok(fs.existsSync(marker), 'precondition: git status in the tampered work tree runs the hostile filter')
          fs.rmSync(marker)
          evil.restat(40, r.worktreeDir)
          const d = driftIn(r, driftDoc({ branch: 'feature', head: r.shas[0], worktree: r.worktreeDir, dirtyFiles: ['a.txt'] }))
          assert.ok(!fs.existsSync(marker), 'no program of the hostile git directory ran')
          assert.ok(d.skipped.some((s) => /does not belong to this repository/.test(s)), `a reason: ${d.skipped}`)
          assert.equal(d.branch.viaWorktree, false)
          assert.equal(d.branch.same, null)
          same(d.dirty, NO_DIRTY)
        })
      })
    },
  },
  {
    id: 'drift-unc-and-device-worktree-paths-are-not-evaluated',
    run: async () => {
      // a UNC name would be opened (a connection to a host the document chose) before anything decided it was no
      // work tree of this repository; none of these hosts exist, and the answer must not wait for them
      await withTemp({ commits: [{ message: 'one' }] }, (r) => {
        const bs = String.fromCharCode(92)
        const values = [
          `${bs}${bs}nonexistent-host-7f3a${bs}share${bs}wt`,
          '//nonexistent-host-7f3a/share/wt',
          `${bs}${bs}.${bs}pipe${bs}handoff-nonexistent`,
          `${bs}${bs}?${bs}C:${bs}nope`,
        ]
        for (const v of values) {
          const t0 = Date.now()
          const d = driftIn(r, driftDoc({ head: r.shas[0], worktree: v, dirtyFiles: ['a.txt'] }))
          assert.ok(Date.now() - t0 < 8000, `${v}: answered at once`)
          assert.ok(d.skipped.some((s) => /UNC and device paths are not evaluated/.test(s)), `${v}: a reason: ${d.skipped}`)
          assert.equal(d.branch.viaWorktree, false, v)
          assert.equal(d.branch.same, null, v)
          same(d.dirty, NO_DIRTY)
        }
      })
    },
  },
  {
    id: 'drift-skipped-reasons-hold-no-control-characters-and-stay-short',
    run: async () => {
      await withTemp({ commits: [{ message: 'one' }] }, (r) => {
        // controls (ESC, BEL) and the invisible kinds a terminal or a reader is misled by: line and paragraph
        // separators, a right-to-left override, a zero-width space, a byte order mark
        const odd = [27, 7, 0x2028, 0x2029, 0x202e, 0x200b, 0xfeff].map((c) => String.fromCharCode(c)).join('')
        const d = driftIn(r, driftDoc({ head: r.shas[0], worktree: `relative${odd}[31mred${'x'.repeat(600)}` }))
        const reason = d.skipped[0]
        assert.ok(reason.includes('relative'), 'the value is still named')
        const invisible = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u
        for (const s of d.skipped) assert.ok(!invisible.test(s), `no control or format character: ${JSON.stringify(s.slice(0, 60))}`)
        assert.ok(reason.length < 500, `a short reason: ${reason.length} characters`)
      })
    },
  },
  {
    id: 'drift-git-log-failure-is-skipped-not-lost',
    run: async () => {
      // the branch that counts a path git could not check: a stand-in for git whose `log -- <path>` fails
      const { drift, runGit } = await lib('skills/handoff/scripts/lib/git.mjs')
      const { parseHandoff } = await parseLib()
      await withTemp({ commits: [{ files: { 'a.txt': 'one\n' } }] }, (r) => {
        const saved = { ...process.env }
        Object.assign(process.env, { GIT_CONFIG_GLOBAL: r.env.GIT_CONFIG_GLOBAL, GIT_CONFIG_NOSYSTEM: '1', GIT_CEILING_DIRECTORIES: r.root })
        try {
          const parsed = parseHandoff(driftDoc({ head: r.shas[0], dirtyFiles: ['gone.txt', 'also-gone.txt'] }))
          const real = drift(parsed, r.dir)
          same(real.dirty.lost, ['gone.txt', 'also-gone.txt']) // with a working git both are plainly lost
          const failing = (cwd, args) => (args[0] === 'log' && args.includes('--') ? { ok: false, status: 128, out: '', err: 'fatal: stand-in' } : runGit(cwd, args))
          const d = drift(parsed, r.dir, { git: failing })
          same(d.dirty.lost, [])
          same(d.dirty.committedSince, [])
          assert.ok(d.skipped.some((s) => /git could not check 2 recorded dirty path/.test(s)), `skipped: ${d.skipped}`)
          assert.equal(d.head.relation, 'same')
        } finally {
          for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]
          Object.assign(process.env, saved)
        }
      })
    },
  },
  {
    id: 'drift-recorded-dirty-path-with-a-padded-parent-segment-is-skipped',
    run: async () => {
      // Windows resolves `.. ` (a trailing space) as `..`, and the reading path rule already refuses it
      await withTemp({ commits: [{ files: { 'a.txt': '1\n' } }] }, (r) => {
        const d = driftIn(r, driftDoc({ head: r.shas[0], dirtyFiles: ['a/.. /b.txt', '.. /c.txt', 'a.txt'] }))
        same(d.dirty.lost, ['a.txt'])
        assert.ok(d.skipped.some((s) => /2 recorded dirty path/.test(s) && /outside the repository/.test(s)), `skipped: ${d.skipped}`)
      })
    },
  },
  {
    id: 'parse-dirty-files-trailing-semicolon-is-part-of-the-name',
    run: async () => {
      const paths = async (value) => (await parseText(`# HANDOFF — T\n\n**Dirty files:** ${value}\n\n## Goal\nx\n`)).header.dirtyPaths
      same(await paths('a.txt; b;'), ['a.txt', 'b;'])
      same(await paths('a.txt; `c;`;'), ['a.txt', 'c;'])
      same(await paths('a.txt; b; +2 more'), ['a.txt', 'b'])
    },
  },
  {
    id: 'resume-contract-names-lost-work-the-same-way-in-the-bullet-and-the-state-row',
    run: async () => {
      const text = readText('templates', 'handoff', 'resume.md')
      const row = text.split('\n').find((l) => /^ {2}State {3}:/.test(l))
      assert.ok(row, 'the briefing has a State row')
      const phrase = 'recorded dirty work not found'
      assert.ok(row.includes(phrase), 'the State row token says "not found", which is all the script knows')
      assert.ok(!/uncommitted work gone/.test(text), 'the old, stronger token is gone')
      const step3 = between(text, '### Step 3 —', '### Step 3.5').replace(/\s+/g, ' ')
      assert.ok(step3.includes(`\`${phrase}\``), 'the bullet that reports `dirty.lost` names the same token')
    },
  },
]

// ---- drift: the registered work tree's git directory must be the repository's own -------------------------------------------------

const fwd = (p) => p.replace(/\\/g, '/')

// A linked work tree whose `.git` file now names a git directory H outside the repository. H carries a
// `commondir` file that names the REAL common directory, so toplevel (the folder) and common dir (the real
// one) both look right; only H itself is hostile: a forged HEAD, and a per-work-tree config that defines a
// clean filter. `worktreeConfig` switches on the extension that makes git read that config (`git
// sparse-checkout` turns it on, so the premise is common).
function forgeLinkedWorktree(r, { worktreeConfig }) {
  const W = r.worktreeDir
  if (worktreeConfig) r.git('config', 'extensions.worktreeConfig', 'true')
  const H = path.join(r.root, 'forged-admin')
  fs.cpSync(path.join(r.dir, '.git', 'worktrees', path.basename(W)), H, { recursive: true })
  fs.writeFileSync(path.join(H, 'commondir'), `${fwd(path.join(r.dir, '.git'))}\n`)
  fs.writeFileSync(path.join(H, 'HEAD'), 'ref: refs/heads/spoofed\n')
  const marker = path.join(r.root, 'PWNED_WORKTREE_CONFIG')
  if (worktreeConfig) fs.writeFileSync(path.join(H, 'config.worktree'), `[filter "evil"]\n\tclean = touch "${fwd(marker)}" && cat\n`)
  fs.writeFileSync(path.join(W, '.gitattributes'), '* filter=evil\n')
  const gitfile = path.join(W, '.git')
  fs.rmSync(gitfile, { force: true }) // git marks it read-only on Windows
  fs.writeFileSync(gitfile, `gitdir: ${fwd(H)}\n`)
  const restat = (secs) => {
    const when = new Date(Date.now() + secs * 1000)
    fs.utimesSync(path.join(W, 'a.txt'), when, when)
  }
  return { W, marker, restat }
}

const driftGitDirCases = [
  {
    id: 'drift-registered-worktree-with-a-forged-git-dir-and-the-real-common-dir-is-never-opened',
    run: async () => {
      await withTemp({ commits: [{ files: { 'a.txt': 'one\n' } }], worktree: { branch: 'feature' } }, (r) => {
        const { W, marker, restat } = forgeLinkedWorktree(r, { worktreeConfig: true })
        // precondition: a plain `status` in the forged work tree runs the filter from the forged config
        restat(30)
        r.gitIn(W, 'status', '--porcelain')
        assert.ok(fs.existsSync(marker), 'precondition: git status in the forged work tree runs the hostile filter')
        fs.rmSync(marker)
        restat(60)
        const d = driftIn(r, driftDoc({ branch: 'feature', head: r.shas[0], worktree: W, dirtyFiles: ['a.txt'] }))
        assert.ok(!fs.existsSync(marker), 'no program of the forged git directory ran')
        assert.ok(d.skipped.some((s) => /does not belong to this repository/.test(s)), `a reason: ${d.skipped}`)
        assert.equal(d.branch.viaWorktree, false)
        assert.equal(d.branch.same, null)
        same(d.dirty, NO_DIRTY)
      })
    },
  },
  {
    id: 'drift-registered-worktree-with-a-forged-git-dir-reports-no-forged-branch',
    run: async () => {
      // no extension, no filter: the forged HEAD alone would be reported as this work tree's branch
      await withTemp({ commits: [{ files: { 'a.txt': 'one\n' } }], worktree: { branch: 'feature' } }, (r) => {
        const { W } = forgeLinkedWorktree(r, { worktreeConfig: false })
        const d = driftIn(r, driftDoc({ branch: 'feature', head: r.shas[0], worktree: W, dirtyFiles: ['a.txt'] }))
        assert.notEqual(d.branch.current, 'spoofed', 'the forged HEAD is not reported')
        assert.equal(d.branch.current, null)
        assert.equal(d.branch.same, null)
        assert.equal(d.branch.viaWorktree, false)
        assert.ok(d.skipped.some((s) => /does not belong to this repository/.test(s)), `a reason: ${d.skipped}`)
        same(d.dirty, NO_DIRTY)
      })
    },
  },
  {
    id: 'drift-registered-worktrees-that-are-the-repositorys-own-still-evaluate',
    run: async () => {
      const { execFileSync } = await import('node:child_process')
      await withTemp({ commits: [{ files: { 'a.txt': 'one\n' } }], worktree: { branch: 'feature' } }, (r) => {
        const sha = r.shas[0]
        // an ordinary linked work tree, and a detached one
        const det = path.join(r.root, 'detached-wt')
        r.git('worktree', 'add', '-q', '--detach', det)
        same(driftIn(r, driftDoc({ branch: 'feature', head: sha, worktree: r.worktreeDir })).branch, { recorded: 'feature', current: 'feature', same: true, viaWorktree: true })
        same(driftIn(r, driftDoc({ branch: '(detached)', head: sha, worktree: det })).branch, { recorded: '(detached)', current: '(detached)', same: true, viaWorktree: true })
        // a main tree whose git directory lives elsewhere (`--separate-git-dir`) with a linked work tree (git itself lists that
        // main tree under its git directory, so a document written IN it is not found: a known, safe-side skip)
        const sep = path.join(r.root, 'sep')
        const sepGit = path.join(r.root, 'sep.gitdir')
        execFileSync('git', ['init', '-q', '-b', 'main', '--separate-git-dir', sepGit, sep], { env: r.env })
        const sg = (...a) => r.gitIn(sep, ...a)
        sg('config', 'user.name', 'Sample Tester')
        sg('config', 'user.email', 'tester@example.invalid')
        sg('config', 'core.autocrlf', 'false')
        fs.writeFileSync(path.join(sep, 'b.txt'), '1\n')
        sg('add', '-A')
        sg('commit', '-q', '-m', 'one')
        const sepSha = sg('rev-parse', 'HEAD')
        const sepWt = path.join(r.root, 'sep-wt')
        sg('worktree', 'add', '-q', '-b', 'sepbranch', sepWt)
        same(driftIn(r, driftDoc({ branch: 'sepbranch', head: sepSha, worktree: sepWt }), sep).branch, { recorded: 'sepbranch', current: 'sepbranch', same: true, viaWorktree: true })
        // a bare main repository with linked work trees
        const bare = path.join(r.root, 'bare.git')
        execFileSync('git', ['clone', '-q', '--bare', r.dir, bare], { env: r.env })
        const a = path.join(r.root, 'bare-a')
        const b = path.join(r.root, 'bare-b')
        r.gitIn(bare, 'worktree', 'add', '-q', '-b', 'ba', a)
        r.gitIn(bare, 'worktree', 'add', '-q', '-b', 'bb', b)
        same(driftIn(r, driftDoc({ branch: 'bb', head: sha, worktree: b }), a).branch, { recorded: 'bb', current: 'bb', same: true, viaWorktree: true })
        same(driftIn(r, driftDoc({ branch: 'ba', head: sha, worktree: a }), a).skipped, [])
      })
    },
  },
  {
    id: 'drift-document-values-in-the-report-hold-no-format-characters',
    run: async () => {
      await withTemp({ commits: [{ message: 'one' }] }, (r) => {
        const odd = [27, 7, 0x2028, 0x202e, 0x200b, 0xfeff].map((c) => String.fromCharCode(c)).join('')
        const d = driftIn(r, driftDoc({ branch: `feat${odd}ure/${'y'.repeat(300)}`, head: r.shas[0] }))
        const invisible = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u
        assert.ok(!invisible.test(d.branch.recorded), 'the recorded branch is printed without control or format characters')
        assert.ok(d.branch.recorded.startsWith('feat') && d.branch.recorded.length <= 201, `short: ${d.branch.recorded.length}`)
        // the comparison is made on what the document wrote, not on what is printed
        assert.equal(d.branch.same, false)
        // a plain value is untouched
        assert.equal(driftIn(r, driftDoc({ branch: 'main', head: r.shas[0] })).branch.recorded, 'main')
      })
    },
  },
]

// ---- git-state: the environment and a repository git cannot read ---------------------------------------------------------------

const gitEnvCases = [
  {
    id: 'git-state-ignores-a-git-dir-inherited-from-the-environment',
    run: async () => {
      await withTemp({ commits: [{ message: 'mine' }] }, async (r) => {
        await withTemp({ commits: [{ message: 'theirs' }] }, (other) => {
          other.git('checkout', '-q', '-b', 'other-branch')
          const env = { ...r.env, GIT_DIR: path.join(other.dir, '.git'), GIT_INDEX_FILE: path.join(other.dir, '.git', 'index') }
          const res = spawnSync(process.execPath, [HANDOFF_JS, 'git-state', '--cwd', r.dir], { encoding: 'utf8', env })
          assert.equal(res.status, 0, res.stderr)
          const s = JSON.parse(res.stdout)
          assert.equal(s.branch, 'main')
          assert.equal(s.head, r.shas[0])
          assert.equal(s.subject, 'mine')
          assert.equal(real(s.toplevel), real(r.dir))
        })
      })
    },
  },
  {
    id: 'git-state-a-repository-git-cannot-read-is-an-error-not-a-non-repository',
    run: async () => {
      await withTemp({ commits: [{ message: 'one' }] }, (r) => {
        fs.writeFileSync(path.join(r.dir, '.git', 'HEAD'), 'garbage, not a ref\n')
        for (const cwd of [r.dir, path.join(r.dir, 'sub')]) {
          fs.mkdirSync(cwd, { recursive: true })
          const res = spawnSync(process.execPath, [HANDOFF_JS, 'git-state', '--cwd', cwd], { encoding: 'utf8', env: r.env })
          assert.equal(res.status, 2, `${cwd}: ${res.stdout}`)
          assert.equal(res.stdout, '')
          assert.ok(res.stderr.trim().length > 0 && /git/.test(res.stderr))
        }
      })
      // a folder with no repository above it is still just "not a repository", and so is one under a stray,
      // empty `.git` folder (git itself walks past that)
      await withTemp(null, (plain) => {
        assert.equal(gitStateIn(plain).isGit, false)
        fs.mkdirSync(path.join(plain.dir, '.git'))
        fs.mkdirSync(path.join(plain.dir, 'inner'))
        assert.equal(gitStateIn(plain, path.join(plain.dir, 'inner')).isGit, false)
      }, true)
    },
  },
]

// ---- reading-plan --root: the session folder as a last-resort root -----------------------------------------------

const rootFallbackCases = [
  {
    id: 'reading-plan-root-fallback',
    run: async () => {
      // A document outside any docs/ folder and any repository has no root of its own; the session's folder
      // (--root) is then the one root. It is ONLY that: a document that has a root never reads from --root.
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-rootarg-'))
      try {
        const session = path.join(dir, 'session')
        const elsewhere = path.join(dir, 'elsewhere')
        fs.mkdirSync(path.join(session, 'src'), { recursive: true })
        fs.mkdirSync(elsewhere)
        fs.writeFileSync(path.join(session, 'src', 'a.md'), 'from the session folder\n')
        fs.writeFileSync(path.join(elsewhere, 'b.md'), 'not reachable\n')
        const doc = path.join(dir, 'loose', 'doc.md')
        fs.mkdirSync(path.dirname(doc))
        fs.writeFileSync(doc, mk([['Reading Order', '1. `src/a.md` — in the session folder\n2. `../elsewhere/b.md` — outside it\n3. `src/none.md` — missing']]))
        const env = noRepoAbove(dir)
        const without = cliEnv(env, 'reading-plan', '--doc', doc, '--budget', '1000000')
        assert.equal(without.status, 0, without.stderr)
        assert.equal(JSON.parse(without.stdout).entries[0].status, 'skipped-invalid')
        const r = cliEnv(env, 'reading-plan', '--doc', doc, '--budget', '1000000', '--root', session)
        assert.equal(r.status, 0, r.stderr)
        const [a, b, none] = JSON.parse(r.stdout).entries
        assert.equal(a.status, 'read')
        assert.equal(real(a.file), real(path.join(session, 'src', 'a.md')))
        assert.equal(b.status, 'skipped-invalid') // the `..` rule still holds under the fallback root
        assert.equal(none.status, 'skipped-missing')
        // a document that has its own root ignores --root
        const repoDoc = path.join(dir, 'repo', 'docs', 'harness', 'handoff', 'doc.md')
        fs.mkdirSync(path.dirname(repoDoc), { recursive: true })
        fs.writeFileSync(path.join(dir, 'repo', 'own.md'), 'own\n')
        fs.writeFileSync(repoDoc, mk([['Reading Order', '1. `own.md` — in the document repository\n2. `src/a.md` — only under --root']]))
        const own = cliEnv(env, 'reading-plan', '--doc', repoDoc, '--budget', '1000000', '--root', session)
        assert.equal(own.status, 0, own.stderr)
        const [x, y] = JSON.parse(own.stdout).entries
        assert.equal(x.status, 'read')
        assert.equal(y.status, 'skipped-missing')
      } finally {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    },
  },
  {
    id: 'reading-plan-root-needs-a-value',
    run: async () => {
      const doc = path.join(FIX, 'reading-order-forms.md')
      const r = cli('reading-plan', '--doc', doc, '--budget', '100', '--root')
      assert.equal(r.status, 2)
      assert.match(r.stderr, /--root/)
      const empty = cli('reading-plan', '--doc', doc, '--budget', '100', '--root', '')
      assert.equal(empty.status, 2)
      assert.match(empty.stderr, /--root/)
    },
  },
]

// ---- diff.mjs --what state: what the relevance rule does to the recorded task state ---------------------------------------

const rec = (phase, docs = 'docs/harness/sample-task/', task = 'Sample') => `Skill : harness\nTask : ${task}\nPhase : ${phase}\nMode : single\nDocs : ${docs}`

const stateDiffCases = [
  {
    id: 'corpus-diff-state-counts-records-phases-and-stale-markers',
    run: async () => {
      const onHarnessBranch = HEAD.replace('**Branch:** main', '**Branch:** harness/sample-task')
      const docs = {
        'a-open-record': mk([['In Progress', rec('verify_done')]]),
        'b-completed-record': mk([['In Progress', rec('completed')]]),
        // the marker sits on a label line: the shape of the audit's stale-label sample
        'c-open-record-marked-on-a-label': mk([['In Progress', `${rec('generate_done', undefined, 'other-track (stale)')}\nThis task is unrelated to the next work.`]]),
        // the marker is prose in the same section, not on a label line
        'd-completed-record-marked-in-prose': mk([['In Progress', `${rec('completed')}\n오래된 기록이라 무관하다.`]]),
        'e-none': mk([['In Progress', 'Harness : none (state.json is for another branch)']]),
        'f-no-record': mk([['In Progress', 'Working on the parser.'], ['Goal', 'A stale cache is mentioned here, outside In Progress.']]),
        'g-partial-record': mk([['In Progress', 'Docs : docs/harness/partial-task/']]),
        // the session was on the branch the harness gives the task: the one record the new rule keeps relevant
        'h-on-the-harness-branch': mk([['In Progress', rec('verify_done')]], onHarnessBranch),
      }
      withSnapshotOfDocs(docs, (snap) => {
        const d = node('diff.mjs', '--corpus', snap, '--what', 'state', '--json')
        assert.equal(d.status, 0, d.stderr)
        const out = JSON.parse(d.stdout)
        assert.equal(out.what, 'state')
        assert.equal(out.documents, 8)
        same(out.record, { any: 6, five: 5, partial: 1 })
        assert.equal(out.recordedCompleted, 2)
        assert.equal(out.harnessNone, 1)
        assert.equal(out.noRecord, 1)
        // the marker list is part of the output; three scopes, the narrowest being the audit's sample
        assert.ok(Array.isArray(out.staleMarker.markers) && out.staleMarker.markers.length >= 4)
        same(out.staleMarker.onLabelLine, { documents: 1, recordedCompleted: 0, recordedOpen: 1 })
        same(out.staleMarker.inProgress, { documents: 2, withRecord: 2, recordedCompleted: 1, recordedOpen: 1 })
        assert.equal(out.staleMarker.anywhere, 3)
        // the method is stated, and it never claims a per-document live check
        assert.match(out.method, /no live/i)
        same(out.newRule, { notRelevantByRecordedPhase: 2, relevantIfLiveStateMatches: 4 })
        // the simulation states its assumption: only the document that sits on its harness branch keeps a hint
        assert.match(out.simulation.assumption, /harness\//)
        same({ ...out.simulation, assumption: null }, { assumption: null, records: 5, oldRuleHint: 3, newRuleHint: 1, staleSample: { documents: 1, oldRuleHint: 1, newRuleHint: 0 } })
        same(out.pathRule, { docsUnderHarness: 5, accepted: 5 })
        const h = node('diff.mjs', '--corpus', snap, '--what', 'state')
        assert.equal(h.status, 0, h.stderr)
        assert.match(h.stdout, /^state: 8 documents/m)
        assert.match(h.stdout, /no record/)
        assert.match(h.stdout, /simulation \(an estimate/)
        assert.ok(!h.stdout.includes('sample-task') && !h.stdout.includes('parser') && !h.stdout.includes('other-track'), 'no document text in the report')
      })
    },
  },
  {
    id: 'corpus-diff-next-normalises-before-calling-a-finished-slice-kept',
    run: async () => {
      const { classifyNextChange } = await diffLib()
      const now = (slice, source) => ({ slice, source, ambiguous: [], commandCandidates: [] })
      // 9.0.1 printed `**s2**` (it strips a backtick pair only); the new rule prints `s2`: still the finished slice
      assert.equal(classifyNextChange({ slice: '**s2**', source: 'last-row' }, now('s2', 'docs')), 'kept-finished-slice')
      assert.equal(classifyNextChange({ slice: '__s2__', source: 'last-row' }, now('s2', 'docs')), 'kept-finished-slice')
      assert.equal(classifyNextChange({ slice: 's2', source: 'last-row' }, now('s3', 'docs')), 'became-docs-or-step-one')
      // end to end: a `blocked` last row with a bold slice that Docs names keeps its value
      const docs = { 'a-bold-blocked': epicDoc({ docs: 'docs/harness/s2-store/', rows: [row('s1-load', 'done'), row('**s2-store**', 'blocked')] }) }
      withSnapshotOfDocs(docs, (snap) => {
        const out = JSON.parse(node('diff.mjs', '--corpus', snap, '--what', 'next', '--json').stdout)
        same(out.ids['kept-finished-slice'], ['d001'])
        same(out.ids['became-docs-or-step-one'], [])
        assert.equal(out.lastRow.valueKept, 1)
        assert.equal(out.lastRow.valueChanged, 0)
      })
    },
  },
]

// ---- the contract text: the sentences this change added ---------------------------------------------------------------------

const readText = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8')
const between = (text, from, to) => {
  const a = text.indexOf(from)
  const b = to === null ? text.length : text.indexOf(to, a + from.length)
  assert.ok(a >= 0 && b > a, `the text between ${JSON.stringify(from)} and ${JSON.stringify(to)} exists`)
  return text.slice(a, b)
}

const stateContractCases = [
  {
    id: 'generate-contract-collects-git-and-task-state-through-the-scripts',
    run: async () => {
      const text = readText('templates', 'handoff', 'generate.md')
      const step1 = between(text, '### Step 1', '### Step 2')
      assert.match(step1, /node "\{HANDOFF_JS\}" git-state --cwd /)
      assert.match(step1, /node "\{HANDOFF_JS\}" harness-state --branch /)
      // this file is read without resume.md: the script path, the exit rule and the no-fallback rule are here
      assert.ok(step1.includes('${CLAUDE_PLUGIN_ROOT}/skills/handoff/scripts/handoff.mjs'))
      assert.match(step1, /stderr verbatim/)
      assert.match(step1, /never (fall back|run git by hand)/i)
      // the values a non-git folder and a detached HEAD record
      assert.match(step1, /`isGit`[^\n]{0,80}false[^\n]{0,80}`n\/a`/)
      assert.ok(step1.includes('`(detached)`'))
      // the record is written only for a relevant state; otherwise ONE `Harness : none (<reason>)` line
      const item2 = between(step1, '2. **Harness task state', '3. **Task artifacts')
      assert.ok(item2.includes('`relevant`'))
      assert.ok(item2.includes('Harness : none (<reason>)'))
      assert.match(item2, /(one|1) line/i)
      assert.match(item2, /not by hand|never judge/i)
      // the task's files become Reading Order candidates only when the state is relevant
      const item3 = between(step1, '3. **Task artifacts', '4. **Conversation')
      assert.ok(item3.includes('`relevant`'))
      // the header template carries both new lines, and the dirty paths are listed once
      const header = between(text, '```markdown\n# HANDOFF', '## Goal')
      assert.ok(header.includes('**Worktree:**'))
      assert.ok(header.includes('**Dirty files:**'))
      assert.match(step1, /40/)
      assert.match(step1, /\+N more/)
      // the five-line format keeps its marker and tokens (the SYNC group's own lint guards the count)
      assert.ok(text.includes('<!-- SYNC-WITH: templates/handoff/generate.md §Fixed Label Record Format -->'))
    },
  },
  {
    id: 'generate-contract-item-4-matches-the-current-next-rule',
    run: async () => {
      const text = readText('templates', 'handoff', 'generate.md')
      const item4 = between(text, '4. **Conversation-derived content**', '5. **Progress Ledger')
      for (const gone of ["ledger's LAST row", 'bare token', 'Status` normalization', 'normalization']) {
        assert.ok(!item4.includes(gone), `the stale sentence part "${gone}" is gone`)
      }
      // it cites resume Step 5 by name, and says what the missing label costs in today's terms
      assert.match(item4, /templates\/handoff\/resume\.md`? Step 5/)
      assert.match(item4, /in-progress/)
      assert.match(item4, /verbatim/)
    },
  },
  {
    id: 'resume-contract-checks-drift-through-the-script',
    run: async () => {
      const text = readText('templates', 'handoff', 'resume.md')
      const step3 = between(text, '### Step 3 —', '### Step 3.5')
      assert.match(step3, /node "\{HANDOFF_JS\}" drift --doc "[^"]+" --cwd "\."/)
      for (const hand of ['git cat-file', 'git merge-base', 'git status', 'git log']) assert.ok(!step3.includes(hand), `${hand} is the script's, not a step to run by hand`)
      assert.ok(step3.includes('`dirty.lost`'))
      assert.ok(step3.includes('was dirty when recorded, now gone'))
      assert.ok(step3.includes('`viaWorktree`'))
      assert.ok(step3.includes('`skipped`'))
      for (const rel of ['same', 'forward', 'backward', 'diverged', 'unknown']) assert.ok(step3.includes(`\`${rel}\``), `the ${rel} relationship is reported`)
      assert.match(step3, /never (checks out|mutates)|NEVER mutate/i)
      // a script that fails is shown and stops the step; the contract never falls back to prose
      assert.match(text, /stderr\s+verbatim/)
    },
  },
  {
    id: 'resume-contract-judges-the-task-state-through-the-script',
    run: async () => {
      const text = readText('templates', 'handoff', 'resume.md')
      const step35 = between(text, '### Step 3.5', '### Step 4')
      assert.match(step35, /node "\{HANDOFF_JS\}" harness-state --branch "[^"]+" --cwd "\."/)
      assert.ok(step35.includes('`relevant`'))
      // not relevant: no re-entry hint and no Docs tier
      assert.match(step35, /not relevant[^\n]*\n?[^\n]*(re-entry|`\/harness`)/i)
      assert.match(step35, /`Docs` tier/)
      // the three states of a document, in the words the briefing prints
      assert.ok(step35.includes('no record — task state is not a verification target'))
      assert.ok(step35.includes('no harness task'))
      assert.ok(!/legacy/i.test(step35), 'a document without a record is not called "legacy"')
      // the recorded Docs value: conditions 1-3 are applied by hand, 4 is the script's, and it only checks existence
      assert.match(step35, /conditions? 1[–-]3/)
      assert.ok(!/four path\s+conditions/.test(step35), 'the Docs check no longer claims all four conditions by hand')
      // the Task row of the briefing
      const task = text.split('\n').find((l) => /^ {2}Task {4}:/.test(l))
      assert.ok(task, 'the briefing has a Task row')
      assert.ok(!/legacy/i.test(task), 'the Task row never says legacy')
      assert.ok(task.includes('no record — task state is not a verification target') && task.includes('no harness task'))
      // Step 5 passes the script's verdict to `next`
      const step5 = between(text, '### Step 5', '**`Next :` derivation')
      assert.ok(step5.includes('harness-state') && step5.includes('`relevant`'))
      assert.ok(!/full cross-check found/.test(step5), 'the old trigger (the file was found) is gone')
      assert.match(text, /node "\{HANDOFF_JS\}" next --doc "[^"]+" --state-relevant <true\|false>/)
    },
  },
  {
    id: 'resume-contract-passes-the-session-folder-to-the-reading-plan',
    run: async () => {
      const text = readText('templates', 'handoff', 'resume.md')
      assert.match(text, /reading-plan --doc "[^"]+" --budget \d+ --root "\."/)
      const skill = readText('skills', 'handoff', 'SKILL.md')
      // the base directory rule, once, in the dispatcher: the session folder, never the header's Worktree
      assert.equal(skill.split('**Base directory').length - 1, 1, 'the base directory rule is written once')
      const rule = between(skill, '**Base directory', '---')
      assert.match(rule, /current working directory/)
      assert.match(rule, /`docs\/harness\/handoff\/`/)
      assert.match(rule, /`Worktree`[^.]*(never|not)/)
    },
  },
  {
    id: 'skill-contract-non-goals-name-the-live-fact-next-depends-on',
    run: async () => {
      const skill = readText('skills', 'handoff', 'SKILL.md')
      assert.ok(!skill.includes("entirely from THIS document's own recorded text"), 'the derivation is no longer all document text')
      const goal = between(skill, '- `/handoff` does not read `slice_plan.md`', '- Not a replacement')
      assert.ok(goal.includes('`relevant`') || goal.includes('harness-state'))
      assert.match(goal, /recorded `Docs`/)
    },
  },
  {
    id: 'session-boundary-says-when-generate-writes-the-record',
    run: async () => {
      const text = readText('templates', '_shared', 'session_boundary.md')
      const sentences = text.split(/(?<=\.)\s+/).filter((s) => s.includes('Harness : none (<reason>)'))
      assert.equal(sentences.length, 1, 'one sentence names the `none` line')
      const s = sentences[0]
      assert.ok(s.includes('`branch`') && s.includes('`phase`') && s.includes('`completed`'))
      for (const token of ['Skill :', 'Task :', 'Phase :', 'Mode :', 'Docs :']) assert.ok(text.includes(token), token)
      assert.equal(text.split('<!-- SYNC-WITH:').length - 1, 1, 'no new SYNC marker')
    },
  },
]

// ---- fix round: the sentences the review found to contradict each other or to claim too much -------------------------------------

const fixRoundCases = [
  {
    id: 'parse-dirty-files-path-with-a-semicolon-roundtrips',
    run: async () => {
      // a name that holds "; " is written between backticks (generate Step 1 item 1) and read back whole
      const paths = async (value) => (await parseText(`# HANDOFF — T\n\n**Dirty files:** ${value}\n\n## Goal\nx\n`)).header.dirtyPaths
      same(await paths('`x; y.txt`; z.txt; `docs/a b.md`; +1 more'), ['x; y.txt', 'z.txt', 'docs/a b.md'])
      same(await paths('a.txt; b;c.txt'), ['a.txt', 'b;c.txt']) // a bare `;` with no space after it is part of a name
      same(await paths('`only; one.txt`'), ['only; one.txt'])
    },
  },
  {
    id: 'generate-contract-wraps-a-dirty-path-that-holds-a-semicolon',
    run: async () => {
      const step1 = between(readText('templates', 'handoff', 'generate.md'), '### Step 1', '### Step 2')
      assert.match(step1, /contains `; `[^.]*backtick/)
    },
  },
  {
    id: 'resume-contract-uses-a-recorded-worktree-only-as-the-script-verifies-it',
    run: async () => {
      const step3 = between(readText('templates', 'handoff', 'resume.md'), '### Step 3 —', '### Step 3.5')
      const flat = step3.replace(/\s+/g, ' ')
      assert.match(flat, /absolute path/)
      assert.match(flat, /one of this repository's work trees/)
      assert.match(flat, /never opens any other folder/)
      // what is not verified compares nothing, and says why
      assert.match(flat, /compares nothing/)
      assert.ok(flat.includes('`skipped`'))
    },
  },
  {
    id: 'resume-contract-does-not-claim-lost-work-vanished',
    run: async () => {
      const step3 = between(readText('templates', 'handoff', 'resume.md'), '### Step 3 —', '### Step 3.5')
      const flat = step3.replace(/\s+/g, ' ')
      // the script only looks at this branch since the recorded HEAD: other explanations stay open
      assert.ok(!/vanished/.test(flat), 'the contract does not assert that the work vanished')
      assert.match(flat, /on another branch/)
      assert.match(flat, /stash/)
      assert.match(flat, /discarded/)
      assert.match(flat, /ask the human to check/i)
      assert.ok(flat.includes('was dirty when recorded, now gone'))
      // only what generate records can be checked
      assert.match(flat, /first 40 recorded dirty paths/)
      // no command that discards or moves work, in any form
      assert.ok(!/git (stash|reset|clean|checkout|restore)/.test(flat))
    },
  },
  {
    id: 'resume-contract-has-one-rule-for-the-re-entry-hint',
    run: async () => {
      const text = readText('templates', 'handoff', 'resume.md')
      const step35 = between(text, '### Step 3.5', '### Step 4')
      // the reduced check (a) is information; the hint is item 4's, decided by `relevant` alone — for every kind of document
      const a = between(step35, '(a) **', '(b) **')
      assert.ok(!/no re-entry hint/i.test(a), 'check (a) must not forbid a hint that item 4 gives')
      assert.match(step35.replace(/\s+/g, ' '), /item 4 below still applies/)
      const flat = step35.replace(/\s+/g, ' ')
      // every sentence that says there is NO hint is conditioned on `relevant`
      const sentences = flat.split(/(?<=\.)\s+/).filter((x) => /re-entry/.test(x) && /\bno\b|\bnever\b|\bwithout\b/i.test(x))
      assert.ok(sentences.length >= 1)
      for (const x of sentences) assert.ok(/relevant/.test(x), `a "no hint" sentence that does not name relevance: ${x}`)
      // item 4 gives the hint on `relevant` true and the harness skill, nothing about the document's record
      const item4 = between(step35, '4. **Never auto-correct', null)
      assert.match(item4, /`relevant` is true and `fields\.skill` is\s+`"harness"`/)
    },
  },
  {
    id: 'resume-contract-step-5-passes-only-the-relevance-verdict',
    run: async () => {
      const text = readText('templates', 'handoff', 'resume.md')
      const step5 = between(text, '### Step 5', '**`Next :` derivation').replace(/\s+/g, ' ')
      assert.match(step5, /`harness-state` call returned `relevant` true/)
      assert.ok(!/document with no record/.test(step5), 'what the document records plays no part in the flag')
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

// ---- ledger-carry, latest-epic and orderDocs: the Progress Ledger a new handoff starts from ---------------------------
//
// Every document here is invented text in a folder of its own under the OS temp folder, removed in a
// `finally`. The commands are driven through the command line (what a skill would read: JSON, an exit
// code, nothing on stderr); `orderDocs` and `carryLedger` are called as libraries.

const ledgerLib = () => lib('skills/handoff/scripts/lib/ledger.mjs')

async function inTmp(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-ledger-'))
  try {
    return await fn(dir)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

// Write one file; `mtimeMs`, when given, is set as its modification time (the tie-breaker of orderDocs).
function put(dir, name, text, mtimeMs) {
  const f = path.join(dir, name)
  fs.writeFileSync(f, text)
  if (mtimeMs !== undefined) fs.utimesSync(f, mtimeMs / 1000, mtimeMs / 1000)
  return f
}

// A command that must succeed: exit 0, ONE JSON object on stdout, nothing on stderr.
function cliOk(...args) {
  const r = cli(...args)
  assert.equal(r.status, 0, `exit ${r.status}: ${r.stderr}`)
  assert.equal(r.stderr, '')
  assert.ok(r.stdout.endsWith('\n') && !r.stdout.slice(0, -1).includes('\n'), 'one line of JSON')
  return JSON.parse(r.stdout)
}

const carryDoc = (file, epic) => cliOk('ledger-carry', '--doc', file, '--epic', epic)
const carryDir = (dir, epic) => cliOk('ledger-carry', '--dir', dir, '--epic', epic)
const latestEpic = (dir) => cliOk('latest-epic', '--dir', dir)

// A handoff document whose Progress Ledger holds `rows` (the `row` helper above), plus any text after the table.
const ledgerOf = (rows, after = '') => mk([['Next Steps', '1. Carry on.'], ['Progress Ledger', table(rows) + after]])
const finished = (n, from = 1, epic) => Array.from({ length: n }, (_, i) => row(`d${from + i}`, 'done', epic))
const sliceList = (out) => out.rows.map((r) => r.slice)
const NOTHING = { doc: null, rows: [], pointer: null, droppedDone: 0, unknownStatusRows: 0, chained: false }

const ledgerCarryCases = [
  {
    id: 'ledger-carry-keeps-every-unfinished',
    run: async () => {
      await inTmp((dir) => {
        // three unfinished kinds among seven finished rows: all three survive, in document order
        const rows = [row('d1', 'done'), row('u1', 'in-progress'), row('d2', 'done'), row('u2', 'blocked'), ...finished(5, 3), row('u3', 'planned')]
        const out = carryDoc(put(dir, '2026-02-01-prev.md', ledgerOf(rows)), 'ep-a')
        const kept = sliceList(out)
        for (const u of ['u1', 'u2', 'u3']) assert.ok(kept.includes(u), `${u} is carried`)
        same(kept.filter((s) => s.startsWith('u')), ['u1', 'u2', 'u3'])
        assert.ok(kept.indexOf('u1') < kept.indexOf('u2') && kept.indexOf('u2') < kept.indexOf('u3'), 'document order')
      })
    },
  },
  {
    id: 'ledger-carry-keeps-last-five-done',
    run: async () => {
      await inTmp((dir) => {
        // eight finished rows with one in-progress row between the 4th and the 5th: the last five finished stay,
        // the other three are counted, and the rows keep the order of the document
        const rows = [...finished(4), row('u1', 'in-progress'), ...finished(4, 5)]
        const out = carryDoc(put(dir, '2026-02-01-prev.md', ledgerOf(rows)), 'ep-a')
        same(sliceList(out), ['d4', 'u1', 'd5', 'd6', 'd7', 'd8'])
        assert.equal(out.droppedDone, 3)
        // five or fewer finished rows: nothing is left out
        const few = carryDoc(put(dir, '2026-02-02-few.md', ledgerOf(finished(5))), 'ep-a')
        same(sliceList(few), ['d1', 'd2', 'd3', 'd4', 'd5'])
        assert.equal(few.droppedDone, 0)
      })
    },
  },
  {
    id: 'ledger-carry-counts-dropped-as-finished',
    run: async () => {
      await inTmp((dir) => {
        const rows = [row('d1', 'done'), row('x1', 'dropped'), row('d2', 'done'), row('x2', 'dropped'), row('d3', 'done'), row('x3', 'dropped'), row('d4', 'done'), row('u1', 'in-progress')]
        const out = carryDoc(put(dir, '2026-02-01-prev.md', ledgerOf(rows)), 'ep-a')
        // seven finished rows (done and dropped alike): the last five stay, two are counted as left out
        same(sliceList(out), ['d2', 'x2', 'd3', 'x3', 'd4', 'u1'])
        assert.equal(out.droppedDone, 2)
      })
    },
  },
  {
    id: 'ledger-carry-planned-is-unfinished',
    run: async () => {
      await inTmp((dir) => {
        const rows = [...finished(7), row('p1', 'planned'), row('p2', 'planned'), row('p3', '**planned**')]
        const out = carryDoc(put(dir, '2026-02-01-prev.md', ledgerOf(rows)), 'ep-a')
        same(sliceList(out), ['d3', 'd4', 'd5', 'd6', 'd7', 'p1', 'p2', 'p3'])
        same(out.rows.map((r) => r.status), ['done', 'done', 'done', 'done', 'done', 'planned', 'planned', 'planned'])
        assert.equal(out.unknownStatusRows, 0, '`planned` is in the enum')
        assert.equal(out.droppedDone, 2)
      })
    },
  },
  {
    id: 'ledger-carry-unknown-status-is-carried-and-counted',
    run: async () => {
      await inTmp((dir) => {
        // a value outside the enum is never a reason to lose a row: it is carried as unfinished and counted
        const rows = [...finished(7), row('q1', 'not-started'), row('q2', 'todo'), row('q3', 'done(partial)'), row('q4', ''), row('u1', 'in-progress')]
        const out = carryDoc(put(dir, '2026-02-01-prev.md', ledgerOf(rows)), 'ep-a')
        same(sliceList(out), ['d3', 'd4', 'd5', 'd6', 'd7', 'q1', 'q2', 'q3', 'q4', 'u1'])
        assert.equal(out.unknownStatusRows, 4)
        assert.equal(out.droppedDone, 2)
        assert.equal(out.rows.find((r) => r.slice === 'q3').status, 'done(partial)', 'the value is carried as written')
      })
    },
  },
  {
    id: 'ledger-carry-pointer',
    run: async () => {
      await inTmp((dir) => {
        // the pointer is the previous document's file name (no folder), whether or not rows were left out
        const many = put(dir, '2026-02-01-prev-doc.md', ledgerOf(finished(8)))
        const few = put(dir, '2026-02-02-other-doc.md', ledgerOf(finished(2)))
        const a = carryDoc(many, 'ep-a')
        const b = carryDoc(few, 'ep-a')
        assert.equal(a.pointer, '2026-02-01-prev-doc.md')
        assert.equal(b.pointer, '2026-02-02-other-doc.md')
        assert.equal(a.droppedDone, 3)
        assert.equal(b.droppedDone, 0)
        assert.equal(a.doc, path.resolve(many))
        assert.equal(a.chained, false, 'neither document carries an `Earlier rows:` line')
        assert.equal(b.chained, false)
      })
    },
  },
  {
    id: 'ledger-carry-pointer-is-the-previous-document-not-its-own-pointer',
    run: async () => {
      await inTmp((dir) => {
        // the previous document already carries an `Earlier rows:` line: the new pointer names THAT document,
        // and the old line's text appears nowhere in the output; the line is not a ledger row, with or without
        // a blank line between it and the table
        const rows = [...finished(8), row('u1', 'in-progress')]
        for (const [name, after] of [['2026-02-01-blank.md', '\n\nEarlier rows: 2026-01-01-oldest-doc.md'], ['2026-02-02-tight.md', '\nEarlier rows: 2026-01-01-oldest-doc.md']]) {
          const f = put(dir, name, ledgerOf(rows, after))
          const r = cli('ledger-carry', '--doc', f, '--epic', 'ep-a')
          assert.equal(r.status, 0, r.stderr)
          const out = JSON.parse(r.stdout)
          assert.equal(out.pointer, name)
          assert.equal(out.chained, true, 'the document carries an `Earlier rows:` line, whatever sits between it and the table')
          assert.ok(!r.stdout.includes('oldest-doc'), 'the old pointer text is not copied')
          same(sliceList(out), ['d4', 'd5', 'd6', 'd7', 'd8', 'u1'])
        }
      })
    },
  },
  {
    id: 'ledger-carry-other-epic-not-carried',
    run: async () => {
      await inTmp((dir) => {
        const rows = [row('a1', 'in-progress', 'ep-a'), row('b1', 'blocked', 'ep-b'), row('a2', 'planned', 'ep-a'), row('b2', 'in-progress', 'ep-b'), row('b3', 'done', 'ep-b')]
        const f = put(dir, '2026-02-01-prev.md', ledgerOf(rows))
        same(sliceList(carryDoc(f, 'ep-a')), ['a1', 'a2'])
        same(sliceList(carryDoc(f, 'ep-b')), ['b1', 'b2', 'b3'])
        for (const r of carryDoc(f, 'ep-a').rows) assert.equal(r.epic, 'ep-a')
        // an Epic the document does not hold: nothing, but the pointer is still the document
        const none = carryDoc(f, 'ep-z')
        same(none.rows, [])
        assert.equal(none.droppedDone, 0)
        assert.equal(none.pointer, '2026-02-01-prev.md')
      })
    },
  },
  {
    id: 'ledger-carry-normalizes-cells',
    run: async () => {
      await inTmp((dir) => {
        // an Epic written with backticks or bold is the same Epic; a Status written bold is the bare value
        const rows = [
          ['`ep-a`', 's1', '**blocked**', 'n/a', 'waits for s0'],
          ['**ep-a**', 's2', '__in-progress__', '0123456789abcdef0123456789abcdef01234567', ''],
          ['ep-a', 's3', '`planned`', 'docs/x/s3.md', 'a \\| b'],
          ['ep-other', 's9', 'blocked', 'n/a', ''],
        ]
        const f = put(dir, '2026-02-01-prev.md', ledgerOf(rows))
        for (const epic of ['ep-a', '`ep-a`', '**ep-a**']) {
          const out = carryDoc(f, epic)
          same(out.rows, [
            { epic: 'ep-a', slice: 's1', status: 'blocked', evidence: 'n/a', notes: 'waits for s0' },
            { epic: 'ep-a', slice: 's2', status: 'in-progress', evidence: '0123456789abcdef0123456789abcdef01234567', notes: '' },
            { epic: 'ep-a', slice: 's3', status: 'planned', evidence: 'docs/x/s3.md', notes: 'a \\| b' },
          ])
          assert.equal(out.unknownStatusRows, 0)
        }
      })
    },
  },
  {
    id: 'ledger-carry-never-drops-unfinished-when-large',
    run: async () => {
      await inTmp((dir) => {
        const kinds = ['in-progress', 'blocked', 'planned']
        const unfinished = (n) => Array.from({ length: n }, (_, i) => row(`u${i + 1}`, kinds[i % 3]))
        // fifteen unfinished rows among ten finished ones: all fifteen and the last five finished stay (20 rows)
        const mixed = []
        const u15 = unfinished(15)
        const d10 = finished(10)
        for (let i = 0; i < 15; i++) mixed.push(u15[i], ...(i < 10 ? [d10[i]] : []))
        const out = carryDoc(put(dir, '2026-02-01-prev.md', ledgerOf(mixed)), 'ep-a')
        assert.equal(out.rows.length, 20)
        for (const u of u15) assert.ok(sliceList(out).includes(u[1]), `${u[1]} survives`)
        assert.equal(out.droppedDone, 5)
        // there is no ceiling on unfinished rows: forty stay, and no finished row is added for them
        const big = carryDoc(put(dir, '2026-02-02-big.md', ledgerOf([...unfinished(40), ...finished(10)])), 'ep-a')
        assert.equal(big.rows.length, 45)
        assert.equal(big.rows.filter((r) => r.slice.startsWith('u')).length, 40)
      })
    },
  },
  {
    id: 'ledger-carry-previous-document-without-rows-gives-none',
    run: async () => {
      await inTmp((dir) => {
        const noLedger = put(dir, '2026-02-01-single.md', mk([['Next Steps', '1. Do it.']]))
        const headerOnly = put(dir, '2026-02-02-empty.md', mk([['Progress Ledger', '| Epic | Slice | Status | Evidence | Notes |\n|---|---|---|---|---|']]))
        for (const [f, name] of [[noLedger, '2026-02-01-single.md'], [headerOnly, '2026-02-02-empty.md']]) {
          const out = carryDoc(f, 'ep-a')
          same(out.rows, [])
          assert.equal(out.droppedDone, 0)
          assert.equal(out.unknownStatusRows, 0)
          assert.equal(out.pointer, name)
        }
      })
    },
  },
  {
    id: 'ledger-carry-reads-a-crlf-previous-document',
    run: async () => {
      await inTmp((dir) => {
        const text = ledgerOf([...finished(7), row('u1', 'in-progress'), row('b1', 'blocked', 'ep-b')], '\n\nEarlier rows: 2026-01-01-oldest-doc.md')
        const lf = carryDoc(put(dir, '2026-02-01-lf.md', text), 'ep-a')
        const crlf = carryDoc(put(dir, '2026-02-01-crlf.md', toCrlf(text)), 'ep-a')
        same({ rows: crlf.rows, droppedDone: crlf.droppedDone, unknownStatusRows: crlf.unknownStatusRows, chained: crlf.chained }, { rows: lf.rows, droppedDone: lf.droppedDone, unknownStatusRows: lf.unknownStatusRows, chained: true })
        same(sliceList(crlf), ['d3', 'd4', 'd5', 'd6', 'd7', 'u1'])
        assert.equal(crlf.pointer, '2026-02-01-crlf.md')
      })
    },
  },
  {
    id: 'ledger-carry-chained-says-whether-the-previous-document-has-an-earlier-rows-line',
    run: async () => {
      await inTmp((dir) => {
        const rows = [...finished(3), row('u1', 'in-progress')]
        const chainedOf = (name, text) => carryDoc(put(dir, name, text), 'ep-a').chained
        const line = 'Earlier rows: 2026-04-01-old.md'
        // a line under the table — after a blank line or directly under it, bare or bold, with the template's trailing comment — chains
        assert.equal(chainedOf('2026-05-01-a.md', ledgerOf(rows, `\n\n${line}`)), true)
        assert.equal(chainedOf('2026-05-02-b.md', ledgerOf(rows, `\n${line}`)), true)
        assert.equal(chainedOf('2026-05-03-c.md', ledgerOf(rows, '\n\n**Earlier rows:** 2026-04-01-old.md')), true)
        assert.equal(chainedOf('2026-05-04-d.md', ledgerOf(rows, `\n\n${line}   <!-- only when item 5d applies -->`)), true)
        assert.equal(chainedOf('2026-05-05-e.md', toCrlf(ledgerOf(rows, `\n\n${line}`))), true)
        // no line, or a line with nothing after the colon, does not
        assert.equal(chainedOf('2026-05-06-f.md', ledgerOf(rows)), false)
        assert.equal(chainedOf('2026-05-07-g.md', ledgerOf(rows, '\n\nEarlier rows:')), false)
        // a line inside a code fence is an example, not a pointer; a real line after the fence still is one
        assert.equal(chainedOf('2026-05-08-h.md', ledgerOf(rows, `\n\n\`\`\`\n${line}\n\`\`\``)), false)
        assert.equal(chainedOf('2026-05-09-i.md', ledgerOf(rows, `\n\n\`\`\`\n${line}\n\`\`\`\n\n${line}`)), true)
        // the same words in another section are prose; a document with no ledger has no such line
        assert.equal(chainedOf('2026-05-10-j.md', mk([['Next Steps', `1. Look at\n${line}`], ['Progress Ledger', table(rows)]])), false)
        assert.equal(chainedOf('2026-05-11-k.md', mk([['Next Steps', `1. Do it.\n${line}`]])), false)
        // the Epic does not matter: it is a fact about the document
        assert.equal(carryDoc(path.join(dir, '2026-05-01-a.md'), 'ep-z').chained, true)
      })
    },
  },
  {
    id: 'ledger-carry-dir-mode-reports-chained-of-the-document-it-picked',
    run: async () => {
      await inTmp((dir) => {
        put(dir, '2026-05-10-x.md', ledgerOf([row('a1', 'in-progress', 'ep-a')], '\n\nEarlier rows: 2026-04-01-old.md'))
        put(dir, '2026-05-11-y.md', ledgerOf([row('b1', 'in-progress', 'ep-b')]))
        const a = carryDir(dir, 'ep-a')
        assert.equal(path.basename(a.doc), '2026-05-10-x.md')
        assert.equal(a.chained, true)
        assert.equal(a.droppedDone, 0)
        assert.equal(carryDir(dir, 'ep-b').chained, false)
        assert.equal(carryDir(dir, 'ep-z').chained, false)
      })
    },
  },
  {
    id: 'ledger-carry-doc-mode-with-an-epic-the-document-lacks-has-a-document-and-no-rows',
    run: async () => {
      await inTmp((dir) => {
        // `--doc` always names a document: `doc` can never be the "no source" signal in this mode, the empty `rows` is
        const f = put(dir, '2026-05-01-a.md', ledgerOf([row('a1', 'in-progress', 'ep-a')]))
        const out = carryDoc(f, 'ep-z')
        assert.equal(out.doc, path.resolve(f))
        same(out.rows, [])
        assert.equal(out.droppedDone, 0)
        // so the contract's no-source condition (item 5e) and Step 4's broken-chain report both name the empty `rows`
        const text = readText('templates', 'handoff', 'generate.md')
        const e = between(text, 'e. **No source found**', 'f. **').replace(/\s+/g, ' ')
        assert.match(e, /`doc` is `null`[^)]*or `rows` is empty/)
        assert.match(between(text, '### Step 4', null).replace(/\s+/g, ' '), /returned `doc` `null` or no `rows`/)
      })
    },
  },
  {
    id: 'ledger-carry-input-and-usage-errors',
    run: async () => {
      await inTmp((dir) => {
        const f = put(dir, '2026-02-01-prev.md', ledgerOf(finished(1)))
        // an input problem: exit 1, nothing on stdout, the reason on stderr
        for (const doc of [path.join(dir, 'missing.md'), path.join(FIX, 'non-handoff.md')]) {
          const r = cli('ledger-carry', '--doc', doc, '--epic', 'ep-a')
          assert.equal(r.status, 1, r.stderr)
          assert.equal(r.stdout, '')
          assert.ok(r.stderr.trim().length > 0)
        }
        // a usage problem: exit 2 — both modes together, neither mode, no Epic, an empty Epic, a folder that is a file
        const usage = [
          ['--doc', f, '--dir', dir, '--epic', 'ep-a'],
          ['--epic', 'ep-a'],
          ['--doc', f],
          ['--doc', f, '--epic', ''],
          ['--dir', dir, '--epic', '  '],
        ]
        for (const args of usage) {
          const r = cli('ledger-carry', ...args)
          assert.equal(r.status, 2, `ledger-carry ${args.join(' ')}`)
          assert.equal(r.stdout, '')
          assert.ok(r.stderr.trim().length > 0)
        }
        const notAFolder = cli('ledger-carry', '--dir', f, '--epic', 'ep-a')
        assert.equal(notAFolder.status, 1)
        assert.equal(notAFolder.stdout, '')
      })
    },
  },
  {
    id: 'ledger-carry-dir-mode-picks-the-newest-document-that-holds-the-epic',
    run: async () => {
      await inTmp((dir) => {
        put(dir, '2026-03-01-first.md', ledgerOf([row('a1', 'done', 'ep-a'), row('a2', 'in-progress', 'ep-a')]))
        put(dir, '2026-03-02-single-task.md', mk([['Next Steps', '1. A task with no ledger.']]))
        put(dir, '2026-03-03-other.md', ledgerOf([row('b1', 'in-progress', 'ep-b')]))
        // the ledger-less document in between does not break the chain; the newer document of another Epic is not carried in
        const a = carryDir(dir, 'ep-a')
        assert.equal(path.basename(a.doc), '2026-03-01-first.md')
        assert.equal(a.pointer, '2026-03-01-first.md')
        same(sliceList(a), ['a1', 'a2'])
        const b = carryDir(dir, 'ep-b')
        assert.equal(path.basename(b.doc), '2026-03-03-other.md')
        same(sliceList(b), ['b1'])
        // an Epic no document holds, a folder with no document, a folder that does not exist: nothing, and no error
        same(carryDir(dir, 'ep-z'), NOTHING)
        const empty = path.join(dir, 'empty')
        fs.mkdirSync(empty)
        same(carryDir(empty, 'ep-a'), NOTHING)
        same(carryDir(path.join(dir, 'no-such-folder'), 'ep-a'), NOTHING)
        // `--doc` mode names the document it was given
        assert.equal(path.basename(carryDoc(path.join(dir, '2026-03-01-first.md'), 'ep-a').doc), '2026-03-01-first.md')
      })
    },
  },
  {
    id: 'ledger-carry-dir-mode-orders-by-the-file-name-then-the-collision-suffix',
    run: async () => {
      await inTmp((dir) => {
        // the plain name is the OLDER of the two (the collision rule gives the second file `-2`), whatever the mtimes say
        put(dir, '2026-03-01-x.md', ledgerOf([row('old', 'in-progress', 'ep-a')]), Date.UTC(2026, 2, 1, 20))
        put(dir, '2026-03-01-x-2.md', ledgerOf([row('new', 'in-progress', 'ep-a')]), Date.UTC(2026, 2, 1, 9))
        const out = carryDir(dir, 'ep-a')
        assert.equal(path.basename(out.doc), '2026-03-01-x-2.md')
        same(sliceList(out), ['new'])
      })
    },
  },
  {
    id: 'ledger-scan-counts-handoff-documents-only-and-stops-at-the-twenty-newest',
    run: async () => {
      await inTmp((dir) => {
        const pad = (n) => String(n).padStart(2, '0')
        // 21 handoff documents: the 20 newest have no ledger, the oldest has one — it is out of reach
        for (let i = 1; i <= 21; i++) put(dir, `2026-01-${pad(i)}-d.md`, i === 1 ? ledgerOf([row('s1', 'in-progress', 'ep-old')]) : mk([['Next Steps', '1. x']]))
        same(latestEpic(dir), { epic: null, doc: null })
        same(carryDir(dir, 'ep-old'), NOTHING)
        // other files do not use up the 20: 25 newer notes (first line is not `# HANDOFF —`), a folder named like a
        // document and a text file are all skipped, and the older handoff document is found
        const dir2 = path.join(dir, 'second')
        fs.mkdirSync(dir2)
        put(dir2, '2026-01-01-d.md', ledgerOf([row('s1', 'in-progress', 'ep-old')]))
        for (let i = 1; i <= 25; i++) put(dir2, `2026-02-${pad(i)}-notes.md`, '# Notes\n\n## Progress Ledger\n\n' + table([row('n1', 'in-progress', 'ep-notes')]) + '\n')
        fs.mkdirSync(path.join(dir2, '2026-03-01-folder.md'))
        put(dir2, '2026-03-02-readme.txt', ledgerOf([row('t1', 'in-progress', 'ep-txt')]))
        const found = latestEpic(dir2)
        assert.equal(found.epic, 'ep-old')
        assert.equal(path.basename(found.doc), '2026-01-01-d.md')
      })
    },
  },
  {
    id: 'latest-epic-newest-ledger-doc',
    run: async () => {
      await inTmp((dir) => {
        put(dir, '2026-04-01-first.md', ledgerOf([row('a1', 'done', 'ep-a')]))
        put(dir, '2026-04-02-second.md', ledgerOf([row('b1', 'in-progress', 'ep-b')]))
        put(dir, '2026-04-03-single.md', mk([['Next Steps', '1. A task with no ledger.']]))
        put(dir, '2026-04-04-empty.md', mk([['Progress Ledger', '| Epic | Slice | Status | Evidence | Notes |\n|---|---|---|---|---|']]))
        // a newer note that is not a handoff document is ignored, however much it looks like one
        put(dir, '2026-04-05-notes.md', '# Notes\n\n## Progress Ledger\n\n' + table([row('n1', 'in-progress', 'ep-notes')]) + '\n')
        // the Epic of the newest document that has a ledger with at least one row: not the newest document, not an older Epic
        const out = latestEpic(dir)
        assert.equal(out.epic, 'ep-b')
        assert.equal(out.doc, path.resolve(dir, '2026-04-02-second.md'))
        assert.equal(Object.keys(out).sort().join(), 'doc,epic')
      })
    },
  },
  {
    id: 'latest-epic-last-row-when-several',
    run: async () => {
      await inTmp((dir) => {
        // several Epics in one ledger: the Epic of the LAST row, read normalised
        put(dir, '2026-04-01-multi.md', ledgerOf([row('a1', 'in-progress', 'ep-a'), row('b1', 'blocked', '`ep-b`'), row('a2', 'done', 'ep-a'), row('b2', 'done', '**ep-b**')]))
        assert.equal(latestEpic(dir).epic, 'ep-b')
        put(dir, '2026-04-02-multi.md', ledgerOf([row('b1', 'done', '**ep-b**'), row('a1', 'planned', 'ep-a')]))
        assert.equal(latestEpic(dir).epic, 'ep-a')
      })
    },
  },
  {
    id: 'latest-epic-none',
    run: async () => {
      await inTmp((dir) => {
        // no document, a folder that is not there (the first handoff of a project), documents without a ledger
        same(latestEpic(dir), { epic: null, doc: null })
        same(latestEpic(path.join(dir, 'no-such-folder')), { epic: null, doc: null })
        put(dir, '2026-04-01-single.md', mk([['Next Steps', '1. A task with no ledger.']]))
        put(dir, '2026-04-02-notes.md', '# Notes\n')
        put(dir, 'readme.txt', 'x')
        same(latestEpic(dir), { epic: null, doc: null })
        // a folder that is a file is an input problem
        const r = cli('latest-epic', '--dir', path.join(dir, 'readme.txt'))
        assert.equal(r.status, 1)
        assert.equal(r.stdout, '')
        assert.equal(cli('latest-epic').status, 2)
      })
    },
  },
  {
    id: 'latest-epic-reads-a-bom-and-crlf-document',
    run: async () => {
      await inTmp((dir) => {
        put(dir, '2026-04-01-bom.md', String.fromCharCode(0xfeff) + toCrlf(ledgerOf([row('a1', 'in-progress', 'ep-a')])))
        assert.equal(latestEpic(dir).epic, 'ep-a')
      })
    },
  },
  {
    id: 'orderDocs-date-then-collision-suffix-then-mtime',
    run: async () => {
      const { orderDocs } = await pathsLib()
      const order = (docs) => orderDocs(docs).map((d) => d.name)
      const at = (name, mtimeMs) => ({ name, mtimeMs })
      // 1. the date in the file name comes first, whatever the mtimes say
      same(order([at('2026-11-18-a.md', 900), at('2026-11-19-b.md', 100)]), ['2026-11-19-b.md', '2026-11-18-a.md'])
      // 2. the same slug on one day: the larger numeric suffix is newer, compared as a number, whatever the mtimes say
      same(
        order([at('2026-11-19-x.md', 500), at('2026-11-19-x-2.md', 100), at('2026-11-19-x-10.md', 50), at('2026-11-19-x-3.md', 10)]),
        ['2026-11-19-x-10.md', '2026-11-19-x-3.md', '2026-11-19-x-2.md', '2026-11-19-x.md'],
      )
      // 3. other slugs on the same day: the newer mtime first
      same(order([at('2026-11-19-a.md', 100), at('2026-11-19-b.md', 200)]), ['2026-11-19-b.md', '2026-11-19-a.md'])
      // a `-2` file written before another slug's file does not outrank it: the suffix only orders one slug's own files
      same(order([at('2026-11-19-x.md', 100), at('2026-11-19-x-2.md', 200), at('2026-11-19-y.md', 300)]), ['2026-11-19-y.md', '2026-11-19-x-2.md', '2026-11-19-x.md'])
      same(order([at('2026-11-19-y.md', 100), at('2026-11-19-x.md', 200), at('2026-11-19-x-2.md', 300)]), ['2026-11-19-x-2.md', '2026-11-19-x.md', '2026-11-19-y.md'])
      // a name with no date is the oldest; a folder part of the name is ignored
      same(order([at('notes.md', 9999), at('dir/2026-01-01-a.md', 1), at('dir\\2026-01-02-b.md', 1)]), ['dir\\2026-01-02-b.md', 'dir/2026-01-01-a.md', 'notes.md'])
      // nothing to separate two files but their names: the result does not depend on the input order
      const same2 = [at('2026-11-19-a.md', 100), at('2026-11-19-b.md', 100)]
      same(order(same2), order([...same2].reverse()))
      // the input is not modified and a new array comes back
      const input = [at('2026-11-18-a.md', 1), at('2026-11-19-b.md', 2)]
      const out = orderDocs(input)
      assert.notEqual(out, input)
      same(input.map((d) => d.name), ['2026-11-18-a.md', '2026-11-19-b.md'])
      same(orderDocs([]), [])
    },
  },
  {
    id: 'ledger-lib-carry-ledger-keep-done-parameter',
    run: async () => {
      const { carryLedger } = await ledgerLib()
      const { parseHandoff } = await parseLib()
      const rows = parseHandoff(ledgerOf([...finished(6), row('u1', 'blocked')])).ledger.rows
      same(carryLedger(rows, 'ep-a').rows.map((r) => r.slice), ['d2', 'd3', 'd4', 'd5', 'd6', 'u1'])
      same(carryLedger(rows, 'ep-a', { keepDone: 2 }).rows.map((r) => r.slice), ['d5', 'd6', 'u1'])
      same(carryLedger(rows, 'ep-a', { keepDone: 0 }).rows.map((r) => r.slice), ['u1'])
      same(carryLedger(rows, 'ep-a', { keepDone: 0 }), { rows: carryLedger(rows, 'ep-a', { keepDone: 0 }).rows, droppedDone: 6, unknownStatusRows: 0 })
      assert.equal(carryLedger(rows, 'ep-a', { keepDone: 100 }).droppedDone, 0)
      for (const bad of [-1, 1.5, '5', NaN]) assert.throws(() => carryLedger(rows, 'ep-a', { keepDone: bad }), /keepDone/)
      same(carryLedger([], 'ep-a'), { rows: [], droppedDone: 0, unknownStatusRows: 0 })
    },
  },
  {
    id: 'cli-usage-lists-the-ledger-commands',
    run: async () => {
      const r = cli('no-such-command')
      assert.equal(r.status, 2)
      assert.match(r.stderr, /ledger-carry/)
      assert.match(r.stderr, /latest-epic/)
    },
  },
]

// ---- diff.mjs --what ledger: the carry rule on every ledger document of a snapshot ---------------------------------------

// `n` rows of one Epic: `done` first, then `unfinished` rows of the given status
const manyRows = (done, unfinished, status, epic = 'ep-a') => [...finished(done, 1, epic), ...Array.from({ length: unfinished }, (_, i) => row(`u${i + 1}`, status, epic))]

const ledgerDiffCases = [
  {
    id: 'corpus-diff-ledger-reports-the-carry-rule-over-the-ledger-documents',
    run: async () => {
      const docs = {
        // 110 rows, 10 unfinished: carried 15, inside the criterion
        'a-big-ok': ledgerOf([...finished(100), ...Array.from({ length: 6 }, (_, i) => row(`p${i}`, 'in-progress')), ...Array.from({ length: 4 }, (_, i) => row(`q${i}`, 'blocked'))]),
        // 105 rows, 25 unfinished: carried 30, the criterion fails and the reason is the 25 unfinished rows
        'b-big-fail': ledgerOf(manyRows(80, 25, 'blocked')),
        // two Epics: only the last row's Epic comes out; 2 unfinished rows of the other one stay behind
        'c-multi': ledgerOf([row('x1', 'blocked', 'ep-x'), row('x2', 'blocked', 'ep-x'), row('y1', 'done', 'ep-y'), row('y2', 'in-progress', 'ep-y')]),
        // two values outside the enum, carried as unfinished
        'd-unknown': ledgerOf([row('s1', 'done'), row('s2', 'todo'), row('s3', 'done(partial)'), row('s4', 'todo')]),
        'e-no-ledger': mk([['Next Steps', '1. A task with no ledger.']]),
        'f-empty-ledger': mk([['Progress Ledger', '| Epic | Slice | Status | Evidence | Notes |\n|---|---|---|---|---|']]),
      }
      withSnapshotOfDocs(docs, (snap) => {
        const r = node('diff.mjs', '--corpus', snap, '--what', 'ledger', '--json')
        assert.equal(r.status, 0, r.stderr)
        const o = JSON.parse(r.stdout)
        assert.equal(o.what, 'ledger')
        assert.equal(o.documents, 6)
        assert.equal(o.ledgerDocuments, 4)
        assert.equal(o.keepDone, 5)
        // rows per ledger document: the chosen Epic's rows before, the carried rows after
        same(o.rows.before, { median: 54.5, p90: 110, max: 110 })
        same(o.rows.after, { median: 9.5, p90: 30, max: 30 })
        // (a) documents over 100 rows
        same(o.over100.byTable, { documents: 2, atMost20: 1, above20: 1, maxCarried: 30, failing: [{ id: 'd002', carried: 30, unfinished: 25, finished: 80 }] })
        same(o.over100.byEpicRows, o.over100.byTable)
        same(o.above20, { documents: 1, ids: ['d002'] })
        // (b) no unfinished row is lost: 10 + 25 + 1 + 3 of the chosen Epics, and the rule's own count holds everywhere
        same(o.unfinished, { rows: 39, lostRows: 0, lostDocuments: [], ruleHolds: 4 })
        // (c) one document holds two Epics: only the chosen Epic's rows come out, 2 unfinished rows stay behind
        same(o.multiEpic, { documents: 1, ids: ['d003'], onlyChosenEpic: 1, otherEpicUnfinishedRows: 2 })
        // (d) values outside the enum
        same(o.unknownStatus, { documents: 1, rows: 3, rowsCarried: 3, values: { todo: { documents: 1, rows: 2 }, 'done(partial)': { documents: 1, rows: 1 } } })
        // the readable form reports the same and prints no document text
        const h = node('diff.mjs', '--corpus', snap, '--what', 'ledger')
        assert.equal(h.status, 0, h.stderr)
        assert.match(h.stdout, /^ledger: 6 documents, 4 with a ledger/m)
        assert.match(h.stdout, /d002/)
        assert.ok(!/ep-a|ep-x|ep-y/.test(h.stdout), 'no Epic name in the report')
      })
    },
  },
  {
    id: 'corpus-diff-ledger-is-listed-in-the-usage',
    run: async () => {
      const r = node('diff.mjs')
      assert.equal(r.status, 2)
      assert.match(r.stderr, /\bledger\b/)
    },
  },
]

// ---- the contract text: the Progress Ledger steps of generate -----------------------------------------------------------------

const ledgerContractCases = [
  {
    id: 'generate-contract-reads-earlier-ledgers-through-the-scripts',
    run: async () => {
      const text = readText('templates', 'handoff', 'generate.md')
      const item5 = between(text, '5. **Progress Ledger', '### Step 2')
      const flat = item5.replace(/\s+/g, ' ')
      // the model no longer reads, scans or ranks earlier documents: the two scripts do
      assert.match(item5, /node "\{HANDOFF_JS\}" latest-epic --dir "[^"]+"/)
      assert.match(item5, /node "\{HANDOFF_JS\}" ledger-carry --dir "[^"]+" --epic "[^"]+"/)
      assert.ok(!/newest-first/i.test(item5) && !/\b90 days\b/.test(item5) && !/capped at/i.test(item5), 'no scan instruction (newest-first, a cap, 90 days) is left for the model')
      assert.ok(!/Confirm the Epic identifier first|carry it forward unchanged from the source document/.test(flat), 'the circular Epic rule is gone')
      assert.match(flat, /never (open|read|scan)[^.]*(by hand|yourself)|not (open|read|scan)[^.]*by hand/i)
      // a script that fails is shown and stops the step, as in item 1
      assert.match(flat, /non-zero exit[^.]*item 1|item 1[^.]*non-zero exit/i)
      // the Epic is proposed from the previous ledger; the user is asked only when there is none or the session names another
      const a = between(item5, 'a. **', 'b. **')
      assert.match(a, /proposal/i)
      assert.match(a.replace(/\s+/g, ' '), /only when[^.]*`null`[^.]*(different|another)/i)
      // the script's reach is stated as a fact about the script, so a `null` is not read as "no document anywhere"
      assert.match(a.replace(/\s+/g, ' '), /none of the 20 newest handoff documents, which is all the script reads/)
    },
  },
  {
    id: 'generate-contract-carries-only-unfinished-rows-and-points-at-the-earlier-ones',
    run: async () => {
      const text = readText('templates', 'handoff', 'generate.md')
      const item5 = between(text, '5. **Progress Ledger', '### Step 2')
      const flat = item5.replace(/\s+/g, ' ')
      // the rule: every unfinished row (named), only the most recent five finished ones
      for (const s of ['in-progress', 'blocked', 'planned']) assert.ok(flat.includes(`\`${s}\``), `${s} is named as carried in full`)
      assert.match(flat, /most recent (5|five)/i)
      assert.match(flat, /unfinished/i)
      assert.ok(flat.includes('`droppedDone`') && flat.includes('`unknownStatusRows`') && flat.includes('`chained`'), 'the script\'s counts and its `chained` flag are used')
      // a ledger holds one Epic
      assert.match(flat, /(different|another) Epic[^.]*never carried|never carr[^.]*(different|another) Epic/i)
      // the pointer line: written under the table only when finished rows were left out; the file name, not the old line's text
      const sentences = flat.split(/(?<=\.)\s+/).filter((x) => x.includes('Earlier rows:'))
      assert.ok(sentences.length >= 1, 'the pointer line is named')
      const pointer = sentences.join(' ')
      assert.ok(pointer.includes('`droppedDone`') && /greater than 0|> 0|is not 0|above 0/.test(pointer), 'written only when `droppedDone` is above 0')
      assert.ok(pointer.includes('`pointer`'), 'the line carries the script\'s `pointer` value')
      assert.match(flat, /never (copy|reuse)[^.]*(old|its own|earlier)[^.]*(line|pointer)|(line|pointer)[^.]*(is|are) never copied/i)
      // the chain: the line is ALSO written when the source itself carries one, so the way to still earlier rows stays open —
      // even when this carry left nothing out — and only when a source was found (never under an empty ledger)
      const d = between(item5, 'd. **The earlier rows.**', 'e. **').replace(/\s+/g, ' ')
      assert.match(d, /`droppedDone`[^.]*(greater than 0|> 0)[^.]*\bor\b[^.]*`chained`/)
      assert.match(d, /source was found/)
      assert.match(d, /`droppedDone` 0 and `chained` false write no such line/, 'no line when nothing was left out and the source has none')
      // no source: an empty ledger and a loud report line, as before; the 20-document reach and an empty `rows` are both named
      const e = between(item5, 'e. **No source found**', 'f. **').replace(/\s+/g, ' ')
      assert.match(e, /`doc` is `null`[^)]*20 newest handoff documents[^)]*or `rows` is empty/)
      assert.match(e, /empty ledger/i)
    },
  },
  {
    id: 'generate-contract-column-contract-has-planned-and-bare-cells',
    run: async () => {
      const text = readText('templates', 'handoff', 'generate.md')
      const item5 = between(text, '5. **Progress Ledger', '### Step 2')
      const cells = item5.split('\n').map((l) => l.trim())
      const status = cells.find((l) => l.startsWith('| `Status`'))
      assert.ok(status, 'the Status row of the column contract')
      const at = ['`done`', '`in-progress`', '`blocked`', '`planned`', '`dropped`'].map((t) => status.indexOf(t))
      assert.ok(at.every((i) => i >= 0) && at.every((i, k) => k === 0 || i > at[k - 1]), `the five values, in this order: ${at}`)
      // a slice not started yet is `planned`; a backlog is never piled into `blocked`
      const flat = status.replace(/\s+/g, ' ')
      assert.match(flat, /not (been )?started/i)
      assert.match(flat, /never `blocked`|not `blocked`|instead of `blocked`/)
      // Evidence: a full 40-char sha or a path, or n/a — stated once; cells are written bare
      const evidence = cells.filter((l) => l.startsWith('| `Evidence`'))
      assert.equal(evidence.length, 1)
      assert.ok(/40-char/.test(evidence[0]) && evidence[0].includes('`n/a`'))
      assert.match(item5.replace(/\s+/g, ' '), /bare|no `\*\*`/i)
      // the Epic row no longer points at the removed scan rule
      const epic = cells.find((l) => l.startsWith('| `Epic`'))
      assert.ok(epic && !/see \(b\) above/.test(epic))
      assert.ok(epic.includes('latest-epic') || epic.includes('ledger-carry'))
    },
  },
  {
    id: 'generate-contract-composes-the-pointer-line-and-reports-the-broken-chain',
    run: async () => {
      const text = readText('templates', 'handoff', 'generate.md')
      // the document template: the pointer line sits under the ledger table, after a blank line
      const template = between(text, '## Progress Ledger        <!--', '## Resume')
      assert.match(template, /\|------\|-------\|--------\|----------\|-------\|\n\nEarlier rows: /)
      // Step 4 still reports the case where no carry-forward source was found, and names the script field behind it
      const step4 = between(text, '### Step 4', null).replace(/\s+/g, ' ')
      assert.match(step4, /no carry-forward source/i)
      assert.ok(step4.includes('`doc`') && step4.includes('`null`'))
      assert.match(step4, /returned `doc` `null` or no `rows`/)
      assert.match(step4, /outside the enum/i)
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
  ...gitStateCases,
  ...harnessStateCases,
  ...driftCases,
  ...driftSafetyCases,
  ...driftIdentityCases,
  ...driftGitDirCases,
  ...gitEnvCases,
  ...rootFallbackCases,
  ...stateDiffCases,
  ...readingSimCases,
  ...contractCases,
  ...stateContractCases,
  ...fixRoundCases,
  ...ledgerCarryCases,
  ...ledgerDiffCases,
  ...ledgerContractCases,
  ...runnerCases,
]
