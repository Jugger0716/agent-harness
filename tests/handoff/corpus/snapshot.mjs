#!/usr/bin/env node
// Corpus snapshot tool — freezes the real handoff documents so that every before/after
// comparison in the handoff diet (v9 stage 3) runs against one fixed copy.
//
// The "corpus" is the set of documents whose FIRST LINE starts with `# HANDOFF —`, found at the
// TOP LEVEL of each root folder passed in `--roots` (sub-folders and other .md files in a root
// are ignored). The documents are private work records: this tool never prints or stores a root
// path or a repository name, no document is ever committed, and `--out` must be a new, empty
// folder OUTSIDE this repository (the tool refuses a folder inside it). Nothing here is
// CI-wired; it is run by hand. This is a test-side tool, so human-readable progress lines on
// stdout are allowed.
//
// Usage:
//   node tests/handoff/corpus/snapshot.mjs --roots <dir> [<dir> ...] --out <dir>
//
// Output in `--out`:
//   d001.md, d002.md, ...  byte-identical copies, numbered in root order, then file-name order
//   manifest.json          { schema, createdAt, count, docs[] }; one docs[] entry per copy:
//     id, file, rootIndex (1-based position in --roots), sha256, bytes, mtimeMs, readingOrderItems,
//     readingOrder[] = { raw, kind: "path"|"self", exists, isDir, self, bytes, lines }
//   Every Reading Order number is measured HERE, at snapshot time, so a later measurement never
//   depends on the live file system. The manifest holds no source path (a `raw` is the text the
//   document itself wrote, nothing more).
//
// Reading Order extraction (an approximation; exactness is not the goal, using the same rule on
// the "before" and the "after" side is). Since the helper script was added the rule is ITS code —
// skills/handoff/scripts/lib/parse.mjs — imported here, so the two cannot drift; on the 292
// documents of the first snapshot it returned exactly what the earlier copy of the rule had
// (items, raw, path), and `diff.mjs --what extract-agree` re-checks a manifest against it. The
// shipped version also tracks fences by character and length and skips list lines inside a
// fence; the description below is the rule's substance.
// Section = a level-2 heading outside code fences whose text starts with `Reading Order`
// (case-insensitive, first match). Item = a list line with at most 3 leading spaces (`1.` / `1)` /
// `-` / `*`).
//   - An item that starts with `이 문서` is the document itself (kind "self").
//   - Otherwise the candidate is the FIRST backtick-quoted token of the item that looks like a file
//     path; an earlier token that does not (a label, a command, a heading) is passed over. A
//     trailing hint is stripped before the test and before resolving — ` §heading`, a trailing
//     `(...)`, then `:12-34` / `#L12-L34` — but `raw` keeps the token as written. "Looks like a
//     file path" = no whitespace, no glob character, and either a `/` (or `\`) or a file-extension
//     ending (`.` followed by letters or digits only). An item with no such token has no entry.
// Resolution, first existing candidate wins:
//   1. an absolute path as written (`C:/`, `/`, `~`; `~` expands through os.homedir());
//   2. relative to the repo root derived from the document's own location (the parent of the
//      nearest `docs` folder above it);
//   3. relative to the git top-level of that root (`git rev-parse --show-toplevel`).
// `self` is true when the entry resolves to the document itself. `lines` follows the earlier
// audit's rule, `split('\n').length` (a count of LF bytes plus one). Unlike that audit, files of
// 5,000,000 bytes or more are counted too (they are almost surely over the 2000-line cap and
// dropping them would understate the over-cap share); `lines` is null only above 256 MiB.
// The earlier audit script (private) used a first-token rule and stripped hints in another order,
// so a `path:12-34 §x` token kept its range there; this tool does neither.
//
// A leading BOM is ignored when testing the first line.
//
// Exit codes: 0 ok; 1 input problem, with a one-line message and no usage banner (a root that is
// not a folder, a non-empty or in-repo `--out`, no document found, or an I/O error); 2 usage or
// internal error (a flag problem, printed with the usage banner, or an unexpected exception).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
// The Reading Order rule is the shipped helper's, not a copy of it: what a snapshot records and
// what `/handoff resume` reads cannot drift apart. (`diff.mjs --what extract-agree` checks a
// frozen manifest against the helper.)
import { InputError, HANDOFF_PREFIX, stripHint, looksLikePath, readingOrderOf } from '../../../skills/handoff/scripts/lib/parse.mjs'

export { HANDOFF_PREFIX, InputError, stripHint, looksLikePath }
const MAX_COUNTED_BYTES = 256 * 1024 * 1024

// ---- parsing helpers (exported: measure.mjs and later tools reuse them) ----------------------

export function isHandoffText(text) {
  return text.replace(/^\uFEFF/, '').split('\n', 1)[0].startsWith(HANDOFF_PREFIX)
}

// An input problem (a bad root or `--out`, an unreadable corpus) is an `InputError`, shared with
// the helper: exit 1 with the message only.

// Shared top-level handler. InputError and fs errors -> 1 (input/I-O problem; an fs error prints
// its code only, never the path it failed on); anything else is an internal error -> 2.
export function exitOnError(tool, e) {
  if (e instanceof InputError) {
    console.error(`${tool}: ${e.message}`)
    process.exit(1)
  }
  if (e && e.code) {
    console.error(`${tool}: ${e.code} (${e.syscall || 'fs'})`)
    process.exit(1)
  }
  console.error(`${tool}: internal error: ${e && e.message ? e.message : e}`)
  process.exit(2)
}

// Level-2 sections outside code fences: [{ heading, body: string[], line }]. The body excludes
// the heading line and runs to the next level-2 heading.
export function splitSections(text) {
  const lines = text.split(/\r?\n/)
  const secs = []
  let cur = null
  let fence = false
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (/^\s*(```|~~~)/.test(l)) fence = !fence
    if (!fence && /^## (?!#)/.test(l)) {
      cur = { heading: l.replace(/^## /, '').replace(/<!--.*?-->/g, '').trim(), body: [], line: i + 1 }
      secs.push(cur)
    } else if (cur) cur.body.push(l)
  }
  return secs
}

export function isAbsoluteRef(p) {
  return /^([A-Za-z]:[\\/]|[\\/]|~)/.test(p)
}

// -> { items, entries: [{ raw, kind, path }] }   (path = stripped candidate, "" for self)
// `items` counts every list item of the section; `entries` keeps the document itself and the
// items that have a path-like token — the shipped helper's entries, in this tool's older shape.
export function extractReadingOrder(text) {
  const all = readingOrderOf(text)
  const entries = all
    .filter((e) => e.self || e.isFile)
    .map((e) => (e.self ? { raw: e.raw, kind: 'self', path: '' } : { raw: e.raw, kind: 'path', path: e.path }))
  return { items: all.length, entries }
}

// ---- file measuring --------------------------------------------------------------------------

export function countLines(buf) {
  let n = 0
  let i = -1
  while ((i = buf.indexOf(10, i + 1)) !== -1) n++
  return n + 1
}

function realKey(p) {
  let r
  try { r = fs.realpathSync(p) } catch { r = path.resolve(p) }
  return process.platform === 'win32' ? r.toLowerCase() : r
}

function measureTarget(full, docKey) {
  let st
  try { st = fs.statSync(full) } catch { return { exists: false, isDir: false, self: false, bytes: null, lines: null } }
  if (st.isDirectory()) return { exists: true, isDir: true, self: false, bytes: null, lines: null }
  if (!st.isFile()) return { exists: false, isDir: false, self: false, bytes: null, lines: null }
  let lines = null
  if (st.size <= MAX_COUNTED_BYTES) {
    try { lines = countLines(fs.readFileSync(full)) } catch { lines = null }
  }
  return { exists: true, isDir: false, self: realKey(full) === docKey, bytes: st.size, lines }
}

// The parent of the nearest `docs` folder above (or at) `dir`; null when there is none.
export function deriveRepoRoot(dir) {
  let a = path.resolve(dir)
  for (;;) {
    if (path.basename(a) === 'docs') return path.dirname(a)
    const up = path.dirname(a)
    if (up === a) return null
    a = up
  }
}

function gitTopLevel(dir) {
  try {
    const out = execFileSync('git', ['-C', dir, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return out ? path.resolve(out) : null
  } catch {
    return null
  }
}

function candidatesFor(p, repoRoot, gitTop) {
  const norm = p.replace(/\\/g, '/')
  if (isAbsoluteRef(norm)) {
    return [norm.startsWith('~') ? path.join(os.homedir(), norm.slice(1)) : path.resolve(norm)]
  }
  const list = []
  for (const base of [repoRoot, gitTop]) {
    if (!base) continue
    const c = path.resolve(base, norm)
    if (!list.includes(c)) list.push(c)
  }
  return list
}

export function measureEntry(entry, ctx) {
  if (entry.kind === 'self') {
    const m = measureTarget(ctx.docPath, ctx.docKey)
    return { raw: entry.raw, kind: 'self', exists: m.exists, isDir: false, self: true, bytes: m.bytes, lines: m.lines }
  }
  let found = null
  for (const c of candidatesFor(entry.path, ctx.repoRoot, ctx.gitTop)) {
    const m = measureTarget(c, ctx.docKey)
    if (m.exists) { found = m; break }
  }
  const m = found || { exists: false, isDir: false, self: false, bytes: null, lines: null }
  return { raw: entry.raw, kind: 'path', exists: m.exists, isDir: m.isDir, self: m.self, bytes: m.bytes, lines: m.lines }
}

// ---- CLI -------------------------------------------------------------------------------------

function usage(msg) {
  if (msg) console.error(`snapshot: ${msg}`)
  console.error('usage: node tests/handoff/corpus/snapshot.mjs --roots <dir> [<dir> ...] --out <dir>')
  process.exit(2)
}

function parseArgs(argv) {
  const a = { roots: [], out: null }
  let mode = null
  for (const t of argv) {
    if (t === '--roots') { mode = 'roots'; continue }
    if (t === '--out') { mode = 'out'; continue }
    if (t === '-h' || t === '--help') usage()
    if (t.startsWith('--')) usage(`unknown flag ${t}`)
    if (mode === 'roots') a.roots.push(t)
    else if (mode === 'out' && a.out === null) a.out = t
    else usage(`unexpected argument ${t}`)
  }
  if (!a.roots.length) usage('--roots needs at least one folder')
  if (!a.out) usage('--out is required')
  return a
}

function main(argv) {
  const args = parseArgs(argv)
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
  const out = path.resolve(args.out)
  const rel = path.relative(repoRoot, out)
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
    throw new InputError('--out must be outside this repository (corpus data is never committed)')
  }
  if (fs.existsSync(out) && (!fs.statSync(out).isDirectory() || fs.readdirSync(out).length > 0)) {
    throw new InputError('--out must be a new or empty folder')
  }
  const roots = args.roots.map((r, i) => {
    const abs = path.resolve(r)
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) throw new InputError(`root #${i + 1} is not a folder`)
    return abs
  })

  const found = []
  const seen = new Set()
  roots.forEach((root, ri) => {
    const stat = { handoff: 0, otherMd: 0, subdirs: 0, other: 0, duplicate: 0 }
    const names = fs.readdirSync(root).sort((x, y) => (x < y ? -1 : x > y ? 1 : 0))
    for (const name of names) {
      const full = path.join(root, name)
      let st
      try { st = fs.statSync(full) } catch { stat.other++; continue }
      if (st.isDirectory()) { stat.subdirs++; continue }
      if (!st.isFile() || !/\.md$/i.test(name)) { stat.other++; continue }
      const buf = fs.readFileSync(full)
      if (!isHandoffText(buf.toString('utf8'))) { stat.otherMd++; continue }
      const key = realKey(full)
      if (seen.has(key)) { stat.duplicate++; continue }
      seen.add(key)
      stat.handoff++
      found.push({ full, key, rootIndex: ri + 1, buf, mtimeMs: Math.round(st.mtimeMs), mtime: st.mtime })
    }
    console.log(`root #${ri + 1}: ${stat.handoff} handoff, ${stat.otherMd} other .md, ${stat.subdirs} sub-folders, ${stat.other} other files, ${stat.duplicate} duplicate`)
  })
  if (!found.length) throw new InputError('no handoff document found in any root')

  fs.mkdirSync(out, { recursive: true })
  const gitTopCache = new Map()
  const docs = found.map((f, i) => {
    const id = 'd' + String(i + 1).padStart(3, '0')
    const file = `${id}.md`
    const dest = path.join(out, file)
    fs.writeFileSync(dest, f.buf, { flag: 'wx' })
    fs.utimesSync(dest, f.mtime, f.mtime)
    const text = f.buf.toString('utf8')
    const docDir = path.dirname(f.full)
    const root = deriveRepoRoot(docDir)
    const gitKey = root || docDir
    if (!gitTopCache.has(gitKey)) gitTopCache.set(gitKey, gitTopLevel(gitKey))
    const ctx = { repoRoot: root, gitTop: gitTopCache.get(gitKey), docPath: f.full, docKey: f.key }
    const ro = extractReadingOrder(text)
    return {
      id,
      file,
      rootIndex: f.rootIndex,
      sha256: crypto.createHash('sha256').update(f.buf).digest('hex'),
      bytes: f.buf.length,
      mtimeMs: f.mtimeMs,
      readingOrderItems: ro.items,
      readingOrder: ro.entries.map((e) => measureEntry(e, ctx)),
    }
  })
  const manifest = { schema: 1, createdAt: new Date().toISOString(), count: docs.length, docs }
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n', { flag: 'wx' })
  const entries = docs.reduce((a, d) => a + d.readingOrder.length, 0)
  console.log(`snapshot: ${docs.length} documents, ${entries} Reading Order entries -> manifest.json`)
}

function isMain() {
  if (!process.argv[1]) return false
  try { return pathToFileURL(fs.realpathSync(process.argv[1])).href === import.meta.url } catch { return false }
}

if (isMain()) {
  try {
    main(process.argv.slice(2))
  } catch (e) {
    exitOnError('snapshot', e)
  }
}
