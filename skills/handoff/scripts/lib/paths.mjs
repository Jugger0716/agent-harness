// The handoff's own path rule, and where a document's Reading Order paths are resolved from — and, apart
// from both, how handoff documents are named and ordered: the slug rule and the collision suffix of a NEW
// document (`normalizeSlug`, `nextDocName`; `resolve-path` is built on them) and the order of the documents
// in a folder (`orderDocs`, a pure function of file names and mtimes that `list`, `latest`, `latest-epic`
// and `ledger-carry --dir` use; `splitDocName` reads the date and the slug out of a name).
// Nothing here reads a file's content; `deriveRepoRoot`, `validateHandoffPath`, `normalizeSlug` and
// `splitDocName` do not touch the file system at all, `nextDocName` lists one folder, and `gitTopLevel` runs
// one `git rev-parse`. (The real-path check of condition 4 is the planner's, in reading.mjs.)
//
// The rule has four conditions. A path is accepted when
//   1. it is relative, or absolute and inside one of the allowed roots (a UNC path, a `~` path and
//      a drive-relative `C:x` path are neither);
//   2. no segment is `..` (an exact segment match, never a substring, after `\` becomes `/`);
//   3. no segment is `.git` (any letter case, with the trailing dots or spaces Windows ignores, and
//      the `GIT~1` short name of the same folder) and no segment holds a `:` — on NTFS
//      `.git::$INDEX_ALLOCATION` names the `.git` folder and `x::$DATA` a file's data stream, so a
//      colon is refused (it is legal in a POSIX file name too, which is not worth a platform split);
//   4. its REAL location — links and junctions followed — is inside an allowed root. This condition
//      is in two parts: `validateHandoffPath` compares the TEXT of the path (a relative path with no
//      `..` segment is inside by construction, an absolute one is compared against each root) and
//      never touches the file system; reading.mjs then compares the real path of the file it found
//      with the real path of each root.
// `docs/harness/…` is allowed: the 9.0.1 rule refused it, and the handoff's own task documents live
// there. The rule is this file's; it does not cite the /harness path validator.
//
// The allowed roots of a document are the folder that holds its `docs/` directory (the nearest
// `docs` folder above the document, its parent) and that folder's git top-level (a document can live
// in a sub-folder of its repository, and its entries are then relative to the top-level). A document
// with neither takes the session's folder (the caller's `--root`) as its one root.
import fs from 'node:fs'
import path from 'node:path'
import { InputError } from './errors.mjs'
import { runGit } from './git.mjs'
import { isParentSegment } from './segment.mjs'

const SHORT_GIT = /^git~\d+$/i
// (The trailing dots and spaces are cut by hand: `/[. ]+$/`, tried at every dot, took quadratic time on a long run.)
function trimDotsAndSpaces(seg) {
  let end = seg.length
  while (end > 0 && (seg[end - 1] === '.' || seg[end - 1] === ' ')) end--
  return seg.slice(0, end)
}
// (reading.mjs applies it again to the REAL path of a file, relative to its root: a link inside the repository can lead
// into `.git/` under a path that names no `.git` segment.)
export const isGitSegment = (seg) => trimDotsAndSpaces(seg).toLowerCase() === '.git' || SHORT_GIT.test(seg)

// Is `abs` (already resolved) inside `root`? -> the path relative to the root, or null.
function relativeInside(root, abs) {
  const rel = path.relative(root, abs)
  if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) return null
  return rel
}

// validateHandoffPath(p, root) -> { ok: true } | { ok: false, reason }
// `root` is one folder or an array of them (the allowed roots).
export function validateHandoffPath(p, root) {
  const roots = (Array.isArray(root) ? root : [root]).filter(Boolean).map((r) => path.resolve(r))
  if (typeof p !== 'string' || p === '') return { ok: false, reason: 'empty path' }
  if (p.includes('\0')) return { ok: false, reason: 'path contains a NUL character' }
  const norm = p.replace(/\\/g, '/')
  if (norm.startsWith('//')) return { ok: false, reason: 'UNC paths are not allowed' }
  const segs = norm.split('/')
  if (segs.some(isParentSegment)) return { ok: false, reason: 'path contains a ".." segment' }
  if (norm.startsWith('~')) return { ok: false, reason: 'a ~ path is outside the repository' }
  if (/^[A-Za-z]:(?![/])/.test(norm)) return { ok: false, reason: 'drive-relative path is not allowed' }
  if (norm.replace(/^[A-Za-z]:\//, '').split('/').some((s) => s.includes(':'))) {
    return { ok: false, reason: 'NTFS stream name (a colon in a path segment)' }
  }
  const absolute = /^([A-Za-z]:\/|\/)/.test(norm)
  let below = segs
  if (absolute) {
    const abs = path.resolve(p)
    let rel = null
    for (const r of roots) {
      rel = relativeInside(r, abs)
      if (rel !== null) break
    }
    if (rel === null) return { ok: false, reason: 'absolute path outside the repository' }
    below = rel.split(/[\\/]/)
  }
  if (below.some(isGitSegment)) return { ok: false, reason: 'path is inside .git/' }
  return { ok: true }
}

// The parent of the nearest `docs` folder above the document; null when there is none.
export function deriveRepoRoot(docPath) {
  let a = path.dirname(path.resolve(docPath))
  for (;;) {
    if (path.basename(a) === 'docs') return path.dirname(a)
    const up = path.dirname(a)
    if (up === a) return null
    a = up
  }
}

// `git rev-parse --show-toplevel` run in `dir` (git.mjs's runner: the same environment and options as every
// other git call of the helper); null outside a repository, in a folder that does not exist, or without git.
export function gitTopLevel(dir) {
  try {
    const r = runGit(dir, ['rev-parse', '--show-toplevel'])
    const out = r.ok ? r.out.trim() : ''
    return out ? path.resolve(out) : null
  } catch {
    return null
  }
}

// The order of handoff documents, newest first. A document is `{ name, mtimeMs }`; `name` is its file name (a
// folder part is ignored). The location convention (SKILL.md) names a file `YYYY-MM-DD-<slug>.md` and, when
// that name is taken, appends `-2`, `-3`, … — so of the files that share a slug that day the plain name is the
// OLDEST. Two rules say what is newer, and they are kept apart:
//   - the same slug on one date: the larger numeric suffix is newer (a plain name counts as 1; the suffix is
//     compared as a number, so `-10` is newer than `-3`), whatever the mtimes say;
//   - any other pair: the later mtime is newer.
// Both rules hold at once through an EFFECTIVE mtime: within a slug the files are taken by ascending suffix and
// each gets the highest mtime seen so far, so a file is never older than a smaller suffix of its own slug.
// The order is then, all later first: date (a name with no date is the oldest), effective mtime, suffix, slug,
// name — a total order, so the result does not depend on the order of the input. With consistent mtimes it
// is the pairwise rule; with contradicting ones (a clock, a copy, a checkout) the suffix wins inside its slug
// and the slug stays where its highest mtime puts it: `a` 50, `b` 75, `a-2` 100 is `a-2`, `b`, `a`.
// Two limits. The mtime is the weakest signal, because a copy or a checkout resets it: files that differ by
// nothing else are then told apart by suffix, slug and name only. And a name that really ends in `-<digits>`
// is read as a collision of the shorter name only when a LOWER sibling exists the same day — a file with the
// shorter name itself, or the same shorter name with a smaller number: `stage-2` alone is a name of its own,
// and so is the lowest number beside higher ones (`stage-2` beside `stage-3`: it has no lower sibling), while
// each higher number joins the `stage` family and ranks by its effective mtime in that family — its own mtime
// only while no smaller number of the family is later (`stage-3` here; add `stage-4` and it ranks by the later
// of its own mtime and `stage-3`'s).
// `stage` beside `stage-2` is read as a collision too, so a real pair like that is ordered by the number. A name that another file's suffix hangs on is plain whatever else exists: `task-8`
// beside `task-8-2` is a plain name, not the `-8` of `task`.
// Pure — no file system access; a new array comes back and the input is left as it is.
function docKey(name) {
  const base = String(name).split(/[\\/]/).pop().replace(/\.md$/i, '')
  const m = /^(\d{4}-\d{2}-\d{2})(?:-(.*))?$/.exec(base)
  const date = m ? m[1] : ''
  const rest = m ? (m[2] ?? '') : base
  // at most nine digits, as in nextDocName: a longer number is a name, not a collision suffix (past 2^53, n + 1 is n)
  const s = /^(.*?)-(\d{1,9})$/.exec(rest)
  return { date, rest, suffixed: s ? { slug: s[1], n: Number(s[2]) } : null }
}

// A document name -> { date, slug }: `2026-11-19-x-2.md` is `2026-11-19` and `x-2` (the slug as the name has it, a
// collision suffix included — only `orderDocs`, which sees the siblings, can tell a suffix from a name that ends in
// digits). A name with no date has the date `` (the oldest, see `orderDocs`) and its whole base as the slug.
export function splitDocName(name) {
  const { date, rest } = docKey(name)
  return { date, slug: rest }
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

export function orderDocs(docs) {
  const items = docs.map((d) => ({ d, ...docKey(d.name), mtime: Number.isFinite(d.mtimeMs) ? d.mtimeMs : 0, name: String(d.name) }))
  // per date: which names some suffix hangs on (`bases`), which names exist (`names`), the lowest suffix of each slug
  const byDate = new Map()
  for (const it of items) {
    if (!byDate.has(it.date)) byDate.set(it.date, { bases: new Set(), names: new Set(), lowest: new Map() })
    const t = byDate.get(it.date)
    t.names.add(it.rest)
    if (it.suffixed) {
      t.bases.add(it.suffixed.slug)
      t.lowest.set(it.suffixed.slug, Math.min(t.lowest.get(it.suffixed.slug) ?? Infinity, it.suffixed.n))
    }
  }
  for (const it of items) {
    const t = byDate.get(it.date)
    // a collision: not itself the plain name of one, and with a lower sibling — the shorter name, or a smaller number
    const collision = it.suffixed !== null && !t.bases.has(it.rest) && (t.names.has(it.suffixed.slug) || it.suffixed.n > t.lowest.get(it.suffixed.slug))
    it.slug = collision ? it.suffixed.slug : it.rest
    it.n = collision ? it.suffixed.n : 1
  }
  const slugs = new Map()
  for (const it of items) {
    const key = `${it.date}\0${it.slug}`
    if (!slugs.has(key)) slugs.set(key, [])
    slugs.get(key).push(it)
  }
  for (const g of slugs.values()) {
    g.sort((a, b) => a.n - b.n || a.mtime - b.mtime || cmp(a.name, b.name))
    let high = -Infinity
    for (const it of g) {
      high = Math.max(high, it.mtime)
      it.effective = high
    }
  }
  items.sort((a, b) => cmp(b.date, a.date) || b.effective - a.effective || b.n - a.n || cmp(b.slug, a.slug) || cmp(b.name, a.name))
  return items.map((it) => it.d)
}

// ---- naming a new document ------------------------------------------------------------------------------------

export const SLUG_MAX = 40

// The slug rule (SKILL.md, location convention): `[a-z0-9-]`, at most SLUG_MAX characters. Upper-case ASCII letters
// become lower case, every other run of characters becomes ONE `-`, a leading or trailing `-` is dropped — and nothing
// is transliterated: an accented or non-Latin letter is a separator (the model supplies the English words, the
// helper never guesses them). Only A-Z is lower-cased by hand, because `toLowerCase()` also turns a non-ASCII letter
// (the Kelvin sign) into an ASCII one. A slug longer than SLUG_MAX is cut at a `-` boundary when there is one: the
// first SLUG_MAX characters are kept when the character after them is a `-` (they end a word), else back to the last
// `-` inside them; one long word is cut at SLUG_MAX. No `-` is left at the end. `` when nothing is left.
export function normalizeSlug(input) {
  const s = String(input)
    .replace(/[A-Z]/g, (c) => c.toLowerCase())
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  if (s.length <= SLUG_MAX) return s
  let cut = s.slice(0, SLUG_MAX)
  if (s[SLUG_MAX] !== '-') {
    const k = cut.lastIndexOf('-')
    if (k > 0) cut = cut.slice(0, k)
  }
  return cut.replace(/-+$/, '')
}

// The file name a NEW document of `date` and `slug` gets in `dir`: `<date>-<slug>.md`, or the same with `-N` when the
// name is taken. N is one more than the highest number any file of that slug and day has (the plain name counts as 1),
// not the first free one: orderDocs ranks the files of one slug by that number, so a gap left by a deleted file must
// not give the NEWEST document a lower number than an older one (`latest` would then pick the older). Names are
// compared in lower case, because the file system may; whatever the arithmetic says, a name that exists in any form
// (a folder, a link, another letter case) is skipped. A folder that does not exist holds no document, and a path
// that is not a folder is an InputError. Nothing is created.
export function nextDocName(dir, date, slug) {
  const stem = `${date}-${slug}`
  let names
  try {
    names = fs.readdirSync(dir)
  } catch (e) {
    if (e.code !== 'ENOENT') throw new InputError(`cannot read folder ${dir}: ${e.code || e.message}`)
    names = []
  }
  let top = 0
  for (const name of names) {
    const lower = name.toLowerCase()
    if (!lower.endsWith('.md')) continue
    const base = lower.slice(0, -3)
    if (base === stem) top = Math.max(top, 1)
    else if (base.startsWith(`${stem}-`)) {
      const tail = base.slice(stem.length + 1)
      // a collision number has at most nine digits: a longer one is a name of its own (and one past 2^53 would make
      // `n + 1` equal `n`, so the search below would never end)
      if (/^([2-9]|[1-9]\d{1,8})$/.test(tail)) top = Math.max(top, Number(tail))
    }
  }
  const nameOf = (n) => (n === 1 ? `${stem}.md` : `${stem}-${n}.md`)
  for (let n = top === 0 ? 1 : top + 1; ; n++) {
    const file = path.join(dir, nameOf(n))
    try {
      fs.lstatSync(file)
    } catch (e) {
      if (e.code === 'ENOENT') return nameOf(n)
      throw new InputError(`cannot check ${file}: ${e.code || e.message}`)
    }
  }
}

// The folders a document's entries may be resolved against, in the order they are tried:
// the derived root, then the git top-level of the folder git is asked about (the derived root, else
// the document's own folder). Duplicates and missing roots are dropped. `fallbackRoot` — the
// session's folder, passed as `--root` — is a root ONLY when the two above do not exist: a document
// that lives outside every `docs/` folder and every repository would otherwise read nothing, and a
// document that has a root of its own never reads from anywhere else.
export function allowedRoots(docPath, fallbackRoot = null) {
  const derived = deriveRepoRoot(docPath)
  const top = gitTopLevel(derived || path.dirname(path.resolve(docPath)))
  const roots = []
  for (const r of [derived, top]) if (r && !roots.includes(path.resolve(r))) roots.push(path.resolve(r))
  if (roots.length === 0 && fallbackRoot) roots.push(path.resolve(fallbackRoot))
  return roots
}
