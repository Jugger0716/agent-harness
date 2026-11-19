// Which handoff documents a folder holds and which one a resume starts from.
//
//   listDocs(dir) -> { docs: [{ path, date, slug, branch, head, title, mtimeMs }], skippedNames, skippedFiles }
//     Every handoff document of the folder (the `*.md` files whose first line starts with `# HANDOFF —`, no
//     recursion, no cap), newest first by `orderDocs` (paths.mjs). `date`, `branch`, `head` and `title` are what the
//     document's header records (parse.mjs; null when it records none — `head` is the sha without its subject, and a
//     recorded branch is read with one backtick pair removed); `slug` comes from the FILE NAME, a collision suffix
//     included. `path` is `dir` as the caller wrote it, with `/`, plus the file name. A folder that does not exist
//     holds no document; a path that is not a folder is an InputError. A file whose name is outside ledger.mjs's
//     SAFE_DOC_NAME is never listed or picked, only counted in `skippedNames` (a contract puts `path` into a quoted
//     shell argument); a handoff document over 4 MiB, or a file that cannot be read, likewise in `skippedFiles`
//     (each `{ count, reason }`, ledger.mjs).
//
//   latestDoc(dir, branch, cwd) -> { doc, candidates: [{ path, branch, head, title }], needsChoice, skippedNames,
//                                    skippedFiles }
//     H13. Take the newest DATE (the date of the file name — the date `orderDocs` ranks first) among the handoff
//     documents; `candidates` are that day's documents, newest first, unless said otherwise below, and
//       - no document at all  -> `doc` null, `candidates` [], `needsChoice` false;
//       - one document        -> that one;
//       - several: `onBranch` are those that record `branch` (the session's current branch) and a commit that exists
//         and is an ancestor of the session's HEAD or equal to it (the others — another branch, no commit, a commit
//         this clone does not have or that is not behind HEAD — are not considered). Among `onBranch` the LATEST is the
//         document whose commit every other one's commit is an ancestor of, or equal to; two documents that record the
//         same commit are told apart by `orderDocs` (a plain-name tie goes to the one it ranks first, so the suffix of
//         a re-run and then the later mtime decide). That one is chosen. If there is none (the commits diverged) or
//         `onBranch` is empty (no document records the branch, `cwd` is not in a repository, no commit can be
//         checked), `doc` is null and `needsChoice` true — the caller asks the person; `candidates` are then the
//         documents of `onBranch` when it is not empty, else all of the day's.
//     The modification time decides only inside `orderDocs`, as its last tie-break; it never decides between commits.
//     Everything here comes from the caller's `dir` and `cwd`. A document is DATA: no folder, program or branch is
//     ever taken from one. The only value of a document that reaches git is its recorded commit, and only after
//     parse.mjs read it as 7 to 40 hex digits (checked again below), as an argument of read-only `merge-base
//     --is-ancestor` runs in the top level of `cwd`'s own repository (`runGit`, the one place git is spawned).
//     A recorded branch of `n/a`, `(detached)` or none never counts as the current branch — and neither does a
//     current branch of `n/a` or `(detached)`, which is what git-state reports outside a repository or on a detached
//     HEAD, the very words a document records in those states. With a `cwd` that is not inside a git work tree there
//     is no ancestry to ask about, so `onBranch` is empty and several documents on the newest day are a choice.
import { parseHeader, stripEmphasis } from './parse.mjs'
import { newSkips, scanHandoffDocs, skippedOf } from './ledger.mjs'
import { gitTopLevel, splitDocName } from './paths.mjs'
import { runGit } from './git.mjs'

const shownDir = (dir) => String(dir).replace(/\\/g, '/').replace(/\/+$/, '')

// A recorded or given branch that names no branch.
const NO_BRANCH = new Set(['n/a', '(detached)'])

// The header only (parse.mjs `parseHeader`): `list` and `latest` read nothing below the first section.
function describe(d, dir) {
  const h = parseHeader(d.text)
  const branch = h.branch === null ? null : stripEmphasis(h.branch) || null
  return {
    path: `${shownDir(dir)}/${d.name}`,
    date: h.date,
    slug: splitDocName(d.name).slug,
    branch,
    head: h.head,
    title: h.title === '' ? null : h.title,
    mtimeMs: d.mtimeMs,
  }
}

export function listDocs(dir) {
  const skips = newSkips()
  const docs = [...scanHandoffDocs(dir, Infinity, skips)].map((d) => describe(d, dir))
  return { docs, ...skippedOf(skips) }
}

// The recorded commit of a document, usable as a git argument: 7 to 40 hex digits (parse.mjs read it so; checked again here
// because this is the one value of a document that is handed to git), else null.
const HEX_SHA = /^[0-9a-f]{7,40}$/
const usable = (sha) => (typeof sha === 'string' && HEX_SHA.test(sha) ? sha : null)

// Is `a` an ancestor of `b`, or the same commit? `git merge-base --is-ancestor A B` is true when A is an ancestor of B or A is B.
// Exit 1 is a plain "no"; any other failure (a commit this clone does not have, a repository without a commit) means it
// cannot be told, which is no.
function isAncestor(top, a, b) {
  const x = usable(a)
  const y = b === 'HEAD' ? b : usable(b)
  return x !== null && y !== null && runGit(top, ['merge-base', '--is-ancestor', x, y]).status === 0
}

// The document of `docs` (newest first) whose commit every other document's commit is behind or equal to; null when
// the commits diverged. One scan finds the candidate (it is never replaced once reached: nothing is ahead of it), one pass
// checks it. Of documents on one commit the first of `docs` is kept, so `orderDocs` decides between them.
function latestByCommit(top, docs) {
  let best = docs[0]
  for (const d of docs.slice(1)) if (!isAncestor(top, d.head, best.head)) best = d
  return docs.every((d) => d === best || isAncestor(top, d.head, best.head)) ? best : null
}

export function latestDoc(dir, branch, cwd) {
  const day = []
  let date = null
  const skips = newSkips()
  for (const d of scanHandoffDocs(dir, Infinity, skips)) {
    const name = splitDocName(d.name).date
    if (date === null) date = name
    else if (name !== date) break
    day.push(describe(d, dir))
  }
  const skipped = skippedOf(skips)
  const shown = (list) => list.map(({ path: p, branch: b, head, title }) => ({ path: p, branch: b, head, title }))
  const answer = (doc, candidates, needsChoice) => ({ doc, candidates: shown(candidates), needsChoice, ...skipped })
  if (day.length === 0) return answer(null, [], false)
  if (day.length === 1) return answer(day[0].path, day, false)
  const top = NO_BRANCH.has(branch) ? null : gitTopLevel(cwd)
  const onBranch = top === null ? [] : day.filter((x) => x.branch === branch && isAncestor(top, x.head, 'HEAD'))
  if (onBranch.length === 0) return answer(null, day, true)
  const latest = latestByCommit(top, onBranch)
  if (latest !== null) return answer(latest.path, day, false)
  return answer(null, onBranch, true)
}
