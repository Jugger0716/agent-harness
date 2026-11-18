// The handoff's own path rule, and where a document's Reading Order paths are resolved from — and, apart
// from both, the order of the handoff documents in a folder (`orderDocs`, a pure function of file names and
// mtimes that `latest-epic` and `ledger-carry --dir` use).
// Nothing here reads a file's content; `deriveRepoRoot` and `validateHandoffPath` do not touch the
// file system at all, and `gitTopLevel` runs one `git rev-parse`. (The real-path check of condition
// 4 is the planner's, in reading.mjs.)
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
import path from 'node:path'
import { runGit } from './git.mjs'
import { isParentSegment } from './segment.mjs'

const SHORT_GIT = /^git~\d+$/i
const isGitSegment = (seg) => seg.replace(/[. ]+$/, '').toLowerCase() === '.git' || SHORT_GIT.test(seg)

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
// that name is taken, appends `-2`, `-3`, … — the plain name is the OLDEST of its slug's files that day. So:
//   1. the date in the file name, later first (a name with no date is the oldest);
//   2. within one date and one slug, the larger numeric suffix first (a plain name counts as 1; the suffix is
//      compared as a number, so `-10` is newer than `-3`);
//   3. between two slugs, the one whose newest file has the later mtime first (a slug is placed by its newest
//      file, so a `-2` file that was written before another slug's file does not outrank it);
//   4. what is still equal (a clone gives every file the same mtime): the larger name first, so the result
//      never depends on the order of the input.
// The mtime only separates different slugs: it is the weakest signal, because a copy or a checkout resets it.
// Pure — no file system access; a new array comes back and the input is left as it is.
function docKey(name) {
  const base = String(name).split(/[\\/]/).pop().replace(/\.md$/i, '')
  const m = /^(\d{4}-\d{2}-\d{2})(?:-(.*))?$/.exec(base)
  const date = m ? m[1] : ''
  const rest = m ? (m[2] ?? '') : base
  const s = /^(.*?)-(\d+)$/.exec(rest)
  return s ? { date, slug: s[1], n: Number(s[2]) } : { date, slug: rest, n: 1 }
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

export function orderDocs(docs) {
  const items = docs.map((d) => ({ d, ...docKey(d.name), mtime: Number.isFinite(d.mtimeMs) ? d.mtimeMs : 0, name: String(d.name) }))
  const slugs = new Map()
  for (const it of items) {
    const key = `${it.date}\0${it.slug}`
    if (!slugs.has(key)) slugs.set(key, [])
    slugs.get(key).push(it)
  }
  const groups = [...slugs.values()]
  for (const g of groups) g.sort((a, b) => b.n - a.n || b.mtime - a.mtime || cmp(b.name, a.name))
  groups.sort((a, b) => cmp(b[0].date, a[0].date) || b[0].mtime - a[0].mtime || b[0].n - a[0].n || cmp(b[0].slug, a[0].slug))
  return groups.flat().map((it) => it.d)
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
