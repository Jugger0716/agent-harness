// Which handoff documents a folder holds and which one a resume starts from.
//
//   listDocs(dir) -> { docs: [{ path, date, slug, branch, head, title, mtimeMs }] }
//     Every handoff document of the folder (the `*.md` files whose first line starts with `# HANDOFF —`, no
//     recursion, no cap), newest first by `orderDocs` (paths.mjs). `date`, `branch`, `head` and `title` are what the
//     document's header records (parse.mjs; null when it records none — `head` is the sha without its subject, and a
//     recorded branch is read with one backtick pair removed); `slug` comes from the FILE NAME, a collision suffix
//     included. `path` is `dir` as the caller wrote it, with `/`, plus the file name. A folder that does not exist
//     holds no document; a path that is not a folder is an InputError.
//
//   latestDoc(dir, branch, cwd) -> { doc, candidates: [{ path, branch, head, title }], needsChoice }
//     H13. Take the newest DATE (the date of the file name — the date `orderDocs` ranks first) among the handoff
//     documents; `candidates` are that day's documents, newest first, and
//       - no document at all  -> `doc` null, `candidates` [], `needsChoice` false;
//       - one document        -> that one;
//       - several: if EXACTLY ONE of them records `branch` (the session's current branch) and the commit it recorded
//         is an ancestor of the session's HEAD or equal to it, that one; otherwise `doc` is null and `needsChoice`
//         true — the caller asks the person.
//     The modification time decides only inside `orderDocs`, as its last tie-break, so it only orders `candidates`.
//     Everything here comes from the caller's `dir` and `cwd`. A document is DATA: no folder, program or branch is
//     ever taken from one. The only value of a document that reaches git is its recorded commit, and only after
//     parse.mjs read it as 7 to 40 hex digits (checked again below), as an argument of one read-only command run
//     in the top level of `cwd`'s own repository.
//     A recorded branch of `n/a`, `(detached)` or none never counts as the current branch — and neither does a
//     current branch of `n/a` or `(detached)`, which is what git-state reports outside a repository or on a detached
//     HEAD, the very words a document records in those states. With a `cwd` that is not inside a git work tree there
//     is no ancestry to ask about, so several documents on the newest day are always a choice.
import { parseHandoff, stripEmphasis } from './parse.mjs'
import { scanHandoffDocs } from './ledger.mjs'
import { gitTopLevel, splitDocName } from './paths.mjs'
import { runGit } from './git.mjs'

const shownDir = (dir) => String(dir).replace(/\\/g, '/').replace(/\/+$/, '')

// A recorded or given branch that names no branch.
const NO_BRANCH = new Set(['n/a', '(detached)'])

function describe(d, dir) {
  const h = parseHandoff(d.text).header
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
  return { docs: [...scanHandoffDocs(dir, Infinity)].map((d) => describe(d, dir)) }
}

// Is `sha` (a document's recorded commit) the current HEAD of the repository `cwd` is in, or one of its ancestors?
// `git merge-base --is-ancestor A B` is true when A is an ancestor of B or A is B. Exit 1 is a plain "no"; any other
// failure (a commit this clone does not have, a repository without a commit) means it cannot be told, which is no.
function isBehindHead(sha, cwd) {
  if (typeof sha !== 'string' || !/^[0-9a-f]{7,40}$/.test(sha)) return false
  const top = gitTopLevel(cwd)
  if (top === null) return false
  return runGit(top, ['merge-base', '--is-ancestor', sha, 'HEAD']).status === 0
}

export function latestDoc(dir, branch, cwd) {
  const day = []
  let date = null
  for (const d of scanHandoffDocs(dir, Infinity)) {
    const name = splitDocName(d.name).date
    if (date === null) date = name
    else if (name !== date) break
    day.push(describe(d, dir))
  }
  const candidates = day.map(({ path: p, branch: b, head, title }) => ({ path: p, branch: b, head, title }))
  if (day.length === 0) return { doc: null, candidates, needsChoice: false }
  if (day.length === 1) return { doc: day[0].path, candidates, needsChoice: false }
  const onBranch = NO_BRANCH.has(branch) ? [] : day.filter((x) => x.branch !== null && x.branch === branch)
  if (onBranch.length === 1 && isBehindHead(onBranch[0].head, cwd)) return { doc: onBranch[0].path, candidates, needsChoice: false }
  return { doc: null, candidates, needsChoice: true }
}
