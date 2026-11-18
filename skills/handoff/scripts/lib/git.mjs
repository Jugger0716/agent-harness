// The live facts a resume checks a handoff document against: the state of a git work tree, the
// relation of a document's recorded commit to it, and whether the task state under `.harness/` is
// the current session's. Everything here only READS: git is run with `rev-parse`, `status`, `log`,
// `merge-base`, `cat-file` and `worktree list` and nothing else, through `child_process.spawnSync` with an
// argument list and an explicit working directory (never a shell string), and the one file this
// reads outside git is `.harness/state.json`, which is never written.
//
//   gitState(cwd) -> { isGit, toplevel, branch, head, subject, dirty: [{ status, path }],
//                      upstream: { ahead, behind } | null }
//     Not inside a git work tree -> isGit false and every other field null / []. A folder that git
//     cannot read although a `.git` entry sits at or above it (a damaged repository, a refused
//     owner) is an ERROR, never "not a repository" — that answer would be written into a handoff.
//     `branch` is "(detached)" for a detached HEAD; `head` and `subject` are null before the first
//     commit; `status` is the two-letter porcelain code ("??" untracked, " M" modified, "A " added);
//     `path` is relative to `toplevel` with forward slashes; EVERY changed path is listed, untracked
//     files one by one (never as their folder), a rename once under its new name.
//
//   harnessState(cwd, branch) -> { exists, relevant, reason, fields: { skill, task, phase, mode,
//                                  docs_path } | null }
//     relevant <=> `.harness/state.json` exists, its `branch` equals `branch` (the current branch of
//     the session's folder) and its `phase` is not "completed". `reason` says why in one line;
//     `fields` are the stored values whenever the file could be read, but only `relevant` licenses
//     writing them into a handoff. An unreadable file is a reason, never an error.
//
//   drift(parsed, cwd) -> { branch: { recorded, current, same, viaWorktree },
//                           head: { relation, ahead: [{ sha, subject }], more },
//                           dirty: { currentCount, lost[], committedSince[], stillDirty[] },
//                           skipped[] }
//     `parsed` is parseHandoff()'s result. The document is DATA: git is never run in a folder it
//     names unless (1) the path is absolute and not a UNC or device name (those are never opened),
//     (2) it is one of the work trees `git worktree list` gives for `cwd`'s own repository, matched by
//     real path, and (3) the folder still IS that work tree: `rev-parse` there (a command that runs no
//     filter, hook or fsmonitor) names the folder itself as its top level and the same common git
//     directory as `cwd`'s repository. Only then is the state read from it (`viaWorktree` is true when
//     that is another work tree than the one `cwd` is in); otherwise from `cwd`. A recorded Worktree
//     that fails any step, is gone, or cannot be checked because `cwd` is not a git work tree compares
//     nothing: `skipped` carries the reason (and how many recorded dirty paths could not be checked),
//     `same` is null and the relation "unknown". A document value named in a reason is stripped of
//     control characters and cut to 200 characters.
//     `deps.git` replaces the runner of drift's own `cat-file`/`rev-parse`/`log` calls (tests only).
//     relation: "same" | "forward" (HEAD is ahead of the recorded commit; `ahead` lists the commits
//     newest first, at most 20, `more` is how many were left out) | "backward" (HEAD is an ancestor
//     of the recorded commit) | "diverged" (neither) | "unknown" (no recorded commit, or one this
//     clone does not have; `skipped` says which).
//     dirty: each path the document recorded as dirty is `stillDirty` (it is dirty now; a recorded
//     folder counts when something below it is), else `committedSince` (a commit after the recorded
//     one touched it), else `lost` (clean now and no commit on THIS branch since the recorded commit
//     touched it — the work may sit in a stash or on another branch). A rename counts its original
//     path as dirty too. With relation "unknown" a clean path cannot be told from a committed one, so
//     it is neither; a path outside the repository (absolute, or with a `..` segment) or one git
//     cannot check is skipped, never `lost`.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { InputError } from './errors.mjs'
import { isParentSegment } from './segment.mjs'

const AHEAD_CAP = 20

// Variables that point git at a repository other than the one `cwd` is in; a helper run from a git hook
// or a wrapper inherits them. GIT_CEILING_DIRECTORIES stays: it can only make discovery stop earlier
// (never point git somewhere else) and a caller may set it on purpose. GIT_CONFIG_* stay for the same
// reason — they are the caller's own settings.
const REDIRECTING = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_NAMESPACE', 'GIT_PREFIX']

function gitEnv() {
  const env = {}
  for (const [k, v] of Object.entries(process.env)) if (!REDIRECTING.includes(k.toUpperCase())) env[k] = v
  env.GIT_OPTIONAL_LOCKS = '0'
  return env
}

// One git call, read-only by construction (callers pass only the subcommands the header lists).
// `--literal-pathspecs` makes a path from a document a name, never a pathspec with magic or a glob;
// `GIT_OPTIONAL_LOCKS=0` keeps `status` from rewriting the index to refresh it; the fsmonitor setting
// is switched off because a repository's own configuration must not run a program on a read. None of
// that makes an arbitrary repository safe to run `status` in — which is why drift never runs git in a
// folder a document names unless the session's own repository lists it as one of its work trees.
export function runGit(cwd, args) {
  const r = spawnSync('git', ['--literal-pathspecs', '-c', 'core.fsmonitor=false', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: gitEnv(),
    maxBuffer: 256 * 1024 * 1024,
  })
  if (r.error) throw new Error(`cannot run git: ${r.error.code || r.error.message}`)
  return { ok: r.status === 0, status: r.status, out: r.stdout, err: r.stderr }
}
const git = runGit

export function requireFolder(dir, what) {
  let st
  try {
    st = fs.statSync(dir)
  } catch (e) {
    throw new InputError(`${what} ${dir} is not a folder that can be read: ${e.code || e.message}`)
  }
  if (!st.isDirectory()) throw new InputError(`${what} ${dir} is not a folder`)
}

// Is `a` an ancestor of `b`? Exit 1 is a plain "no"; anything else non-zero is a git failure.
function isAncestor(cwd, a, b) {
  const r = git(cwd, ['merge-base', '--is-ancestor', a, b])
  if (r.status === 0) return true
  if (r.status === 1) return false
  throw new Error(`git merge-base failed (exit ${r.status})`)
}

// ---- git-state --------------------------------------------------------------------------------

const NOT_GIT = () => ({ isGit: false, toplevel: null, branch: null, head: null, subject: null, dirty: [], upstream: null })

// `git status --porcelain=v2 -z --branch --untracked-files=all`, the one call that carries the branch,
// the commit, the upstream distance and every changed path. Records are NUL-separated: `# branch.*`
// headers, `1` ordinary and `u` unmerged entries, `2` renames (the old name is the NEXT record), and
// `?` untracked. The path is the rest of the record after its fixed fields, so it may hold spaces.
function readStatus(text) {
  const out = { oid: null, head: null, ab: null, dirty: [], renamedFrom: [] }
  const recs = text.split('\0')
  const fieldsBefore = { 1: 8, 2: 9, u: 10 }
  for (let i = 0; i < recs.length; i++) {
    const rec = recs[i]
    if (rec === '') continue
    if (rec.startsWith('# ')) {
      const m = /^# branch\.(oid|head|ab) (.*)$/.exec(rec)
      if (!m) continue
      if (m[1] === 'oid') out.oid = m[2]
      else if (m[1] === 'head') out.head = m[2]
      else {
        const ab = /^\+(\d+) -(\d+)$/.exec(m[2])
        if (ab) out.ab = { ahead: Number(ab[1]), behind: Number(ab[2]) }
      }
    } else if (rec[0] === '?') {
      out.dirty.push({ status: '??', path: rec.slice(2) })
    } else if (Object.hasOwn(fieldsBefore, rec[0])) {
      const parts = rec.split(' ')
      const n = fieldsBefore[rec[0]]
      const xy = parts[1].replace(/\./g, ' ')
      out.dirty.push({ status: xy, path: parts.slice(n).join(' ') })
      if (rec[0] === '2') out.renamedFrom.push(recs[++i]) // the original name of a rename or copy
    }
  }
  return out
}

// The key two folders are compared by: real path, case-folded on Windows.
function folderKey(p) {
  let r
  try {
    r = fs.realpathSync.native(p)
  } catch {
    r = path.resolve(p)
  }
  return process.platform === 'win32' ? r.toLowerCase() : r
}

// Does `.git` in `d` look like a repository that git failed to read: a gitfile (a linked worktree or a
// submodule), or a folder that holds a HEAD? An empty or stray `.git` folder is not one — git itself
// walks past it.
function hasGitEntry(d) {
  const entry = path.join(d, '.git')
  try {
    return fs.statSync(entry).isFile() || fs.existsSync(path.join(entry, 'HEAD'))
  } catch {
    return false
  }
}

// The nearest folder at or above `dir` that holds such a `.git` entry, stopping where git itself would (it
// does not climb into a GIT_CEILING_DIRECTORIES folder); null when there is none.
function gitEntryAt(dir) {
  const ceilings = (process.env.GIT_CEILING_DIRECTORIES || '').split(path.delimiter).filter(Boolean).map(folderKey)
  let d = path.resolve(dir)
  for (;;) {
    if (hasGitEntry(d)) return d
    const up = path.dirname(d)
    if (up === d || ceilings.includes(folderKey(up))) return null
    d = up
  }
}

// -> { state, renamedFrom }: `state` is what git-state prints; `renamedFrom` are the original names of the
// renames in it, which drift counts as dirty without listing them (a rename is ONE entry of the output).
function readGitState(cwd) {
  const top = git(cwd, ['rev-parse', '--show-toplevel'])
  if (!top.ok || top.out.trim() === '') {
    const holder = gitEntryAt(cwd)
    if (holder) {
      const why = top.err.split('\n').find((l) => l.trim() !== '') || 'no reason given'
      throw new Error(`git cannot read the repository at ${holder}: ${why.trim()}`)
    }
    return { state: NOT_GIT(), renamedFrom: [] }
  }
  const toplevel = path.resolve(top.out.trim())
  // Every later call runs at the top: porcelain paths are relative to it, and so must be the paths
  // handed to `git log -- <path>`.
  const st = git(toplevel, ['status', '--porcelain=v2', '-z', '--branch', '--untracked-files=all'])
  if (!st.ok) throw new Error(`git status failed (exit ${st.status})`)
  const s = readStatus(st.out)
  const head = s.oid && s.oid !== '(initial)' && /^[0-9a-f]{40}$/.test(s.oid) ? s.oid : null
  let subject = null
  if (head) {
    const log = git(toplevel, ['log', '-1', '--format=%s', head])
    subject = log.ok ? log.out.replace(/\r?\n$/, '') : null
  }
  const state = { isGit: true, toplevel, branch: s.head, head, subject, dirty: s.dirty, upstream: s.ab }
  return { state, renamedFrom: s.renamedFrom }
}

export const gitState = (cwd) => readGitState(cwd).state

// ---- harness-state ----------------------------------------------------------------------------------

const FIELDS = ['skill', 'task', 'phase', 'mode', 'docs_path']

export function harnessState(cwd, branch) {
  const file = path.join(cwd, '.harness', 'state.json')
  let text
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'ENOTDIR') {
      return { exists: false, relevant: false, reason: 'no .harness/state.json in this folder', fields: null }
    }
    return { exists: true, relevant: false, reason: `.harness/state.json cannot be read (${e.code || e.message})`, fields: null }
  }
  let state = null
  try {
    state = JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch {
    // reported below
  }
  if (state === null || typeof state !== 'object' || Array.isArray(state)) {
    return { exists: true, relevant: false, reason: '.harness/state.json is not a JSON object', fields: null }
  }
  const fields = Object.fromEntries(FIELDS.map((k) => [k, state[k] === undefined ? null : state[k]]))
  const recorded = typeof state.branch === 'string' && state.branch.trim() !== '' ? state.branch.trim() : null
  const make = (relevant, reason) => ({ exists: true, relevant, reason, fields })
  if (recorded === null) return make(false, 'state.json records no branch to compare with the current one')
  if (recorded !== branch) return make(false, `state.json is for branch ${recorded}, the current branch is ${branch}`)
  if (state.phase === 'completed') return make(false, 'state.json phase is completed')
  return make(true, `state.json is for the current branch ${branch}, phase ${state.phase === undefined ? 'not recorded' : state.phase}`)
}

// ---- drift ------------------------------------------------------------------------------------------------------

const slash = (p) => String(p).replace(/\\/g, '/')

const sameFolder = (dir, other) => folderKey(dir) === folderKey(other)

// An absolute path in the document's own spelling: a drive letter, or (off Windows) a leading slash. A
// drive-relative or rooted-without-drive path on Windows is not: it depends on where the helper runs.
const isAbsolutePath = (p) => /^[A-Za-z]:[\\/]/.test(p) || (process.platform !== 'win32' && p.startsWith('/'))

// A UNC name (`\\host\share`), a device path (`\\.\pipe\x`, `\\?\C:\x`) or a `//` spelling of one. Resolving
// one opens it: a connection to a host the document chose. Never done, whatever the platform.
const isUncOrDevice = (p) => /^[\\/]{2}/.test(p)

// A recorded dirty path git cannot be asked about: it leaves the repository (absolute, or a parent segment —
// the same test the reading path rule uses, `..` with trailing spaces included).
const leavesRepository = (p) => p.includes('\0') || p.startsWith('/') || /^[A-Za-z]:/.test(p) || p.split('/').some(isParentSegment)

// A document value named in a reason is printed as it is by resume: no control characters, at most 200.
const CONTROL = /[\x00-\x1f\x7f-\x9f]/g
function shown(value) {
  const chars = Array.from(String(value).replace(CONTROL, ''))
  return chars.length > 200 ? `${chars.slice(0, 200).join('')}…` : chars.join('')
}

// -> { top, common } (absolute real folders as git names them) | null. `rev-parse --show-toplevel
// --git-common-dir` is the one command run in a folder that has not been vouched for yet: it reads the
// repository's layout and configuration and runs no filter driver, hook or fsmonitor.
function repoIdentity(dir) {
  let r = git(dir, ['rev-parse', '--path-format=absolute', '--show-toplevel', '--git-common-dir'])
  if (!r.ok) r = git(dir, ['rev-parse', '--show-toplevel', '--git-common-dir']) // a git without --path-format
  if (!r.ok) return null
  // an old git echoes the unknown option it was given; what is left must be exactly the two answers
  const lines = r.out.split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l !== '' && !l.startsWith('--path-format'))
  if (lines.length !== 2) return null
  return { top: path.resolve(dir, lines[0]), common: path.resolve(dir, lines[1]) }
}

// The work trees of the repository `top` belongs to, as git lists them (the main tree included).
// [] when git cannot say, so nothing counts as verified.
function listWorktrees(top) {
  let r = git(top, ['worktree', 'list', '--porcelain', '-z'])
  let recs
  if (r.ok) {
    recs = r.out.split('\0')
  } else {
    r = git(top, ['worktree', 'list', '--porcelain']) // a git without -z
    if (!r.ok) return []
    recs = r.out.split('\n')
  }
  return recs.filter((x) => x.startsWith('worktree ')).map((x) => x.slice('worktree '.length).replace(/\r$/, ''))
}

function isFolder(p) {
  try {
    return fs.statSync(p).isDirectory()
  } catch {
    return false
  }
}

const unwrap = (v) => (typeof v === 'string' ? v.replace(/^`(.*)`$/, '$1').trim() : v)

// A document's recorded dirty path is still dirty when it is in the current list, or when it names a
// folder (a legacy document may list an untracked folder as `dir/`) with something dirty below it.
function stillDirty(recorded, current) {
  const p = slash(recorded)
  if (current.has(p)) return true
  const prefix = p.endsWith('/') ? p : `${p}/`
  for (const c of current) if (c.startsWith(prefix)) return true
  return false
}

export function drift(parsed, cwd, { git = runGit } = {}) {
  const h = parsed.header
  const skipped = []
  const recordedBranch = h.branch === null ? null : unwrap(h.branch) || null
  const result = {
    branch: { recorded: recordedBranch, current: null, same: null, viaWorktree: false },
    head: { relation: 'unknown', ahead: [], more: 0 },
    dirty: { currentCount: 0, lost: [], committedSince: [], stillDirty: [] },
    skipped,
  }

  // A comparison that cannot be made: say why, and say what it leaves unchecked. Nothing here is an alarm.
  const skip = (reason) => {
    skipped.push(reason)
    if (h.dirtyPaths.length > 0) skipped.push(`${h.dirtyPaths.length} recorded dirty path(s) cannot be checked — not reported as lost`)
    return result
  }

  // Where the state is read: the session's own folder, unless the document names a work tree of THIS
  // repository. The recorded path is data, and git runs in it only after the repository's own list of work
  // trees has vouched for it (a folder of another repository can carry a configuration that runs a program
  // on a plain `status`, and would answer the comparison with someone else's branch).
  const here = readGitState(cwd)
  let state = here.state
  let renamedFrom = here.renamedFrom
  if (h.worktree) {
    const named = shown(h.worktree)
    if (isUncOrDevice(h.worktree)) {
      return skip(`the worktree the document recorded (${named}) is a UNC or device path — UNC and device paths are not evaluated, git state not compared`)
    }
    if (!isAbsolutePath(h.worktree)) {
      return skip(`the worktree the document recorded (${named}) is not an absolute path — not opened, git state not compared`)
    }
    if (!state.isGit) {
      return skip(`the current folder is not inside a git work tree, so the worktree the document recorded (${named}) cannot be checked against it — not opened, git state not compared`)
    }
    const listed = listWorktrees(state.toplevel).find((w) => sameFolder(w, h.worktree))
    if (listed === undefined) {
      return skip(`the worktree the document recorded (${named}) is not one of this repository's work trees, or it no longer exists — not opened, git state not compared`)
    }
    if (!isFolder(listed)) {
      return skip(`the worktree the document recorded (${named}) no longer exists — git state not compared`)
    }
    // The list vouches for a PATH. What stands there now may be another repository, an empty folder inside
    // one, or a work tree whose `.git` file was changed: it must still be this repository's work tree before
    // any command that can run a program (`status`) is given to it.
    const mine = repoIdentity(state.toplevel)
    const found = repoIdentity(listed)
    if (!mine || !found || !sameFolder(found.top, listed) || !sameFolder(found.common, mine.common)) {
      return skip(`the folder registered as the worktree the document recorded (${named}) does not belong to this repository — it is no longer its work tree, not opened further, git state not compared`)
    }
    const there = readGitState(listed)
    if (!there.state.isGit) {
      return skip(`the worktree the document recorded (${named}) is no longer a git work tree — git state not compared`)
    }
    result.branch.viaWorktree = !sameFolder(there.state.toplevel, state.toplevel)
    state = there.state
    renamedFrom = there.renamedFrom
  }
  if (!state.isGit) return skip('the current folder is not inside a git work tree — git state not compared')
  const dir = state.toplevel
  result.branch.current = state.branch

  // branch
  if (recordedBranch === null || recordedBranch === 'n/a') {
    skipped.push('the document records no branch (it was written outside a git work tree) — branch not compared')
  } else {
    result.branch.same = recordedBranch === state.branch
  }

  // the recorded commit against HEAD
  const recorded = h.head
  let relation = 'unknown'
  let full = null
  if (!recorded) {
    skipped.push('the document records no commit — HEAD not compared')
  } else if (!state.head) {
    skipped.push('the repository has no commit yet — HEAD not compared')
  } else if (!git(dir, ['cat-file', '-e', `${recorded}^{commit}`]).ok) {
    skipped.push(`the recorded commit ${recorded.slice(0, 7)} is not found in this clone — cannot verify`)
  } else {
    full = git(dir, ['rev-parse', '--verify', '--quiet', `${recorded}^{commit}`]).out.trim()
    if (full === state.head) relation = 'same'
    else if (isAncestor(dir, full, state.head)) relation = 'forward'
    else if (isAncestor(dir, state.head, full)) relation = 'backward'
    else relation = 'diverged'
  }
  result.head.relation = relation
  if (relation === 'forward') {
    const log = git(dir, ['log', '--format=%H%x00%s', `${full}..${state.head}`])
    const all = log.out.split('\n').filter((l) => l !== '')
    result.head.ahead = all.slice(0, AHEAD_CAP).map((l) => {
      const [sha, subject] = l.split('\0')
      return { sha, subject: subject === undefined ? '' : subject.replace(/\r$/, '') }
    })
    result.head.more = all.length - result.head.ahead.length
  }

  // the work that was uncommitted when the document was written
  // (A rename's original name is dirty too: its edit is staged under the new name.)
  const current = new Set([...state.dirty.map((d) => d.path), ...renamedFrom])
  result.dirty.currentCount = state.dirty.length
  let undecided = 0
  let outside = 0
  let unchecked = 0
  for (const raw of h.dirtyPaths) {
    const p = slash(raw)
    if (leavesRepository(p)) {
      outside++
    } else if (stillDirty(p, current)) {
      result.dirty.stillDirty.push(raw)
    } else if (relation === 'unknown') {
      undecided++
    } else {
      const touched = git(dir, ['log', '-1', '--format=%H', `${full}..${state.head}`, '--', p])
      if (!touched.ok) unchecked++
      else if (touched.out.trim() !== '') result.dirty.committedSince.push(raw)
      else result.dirty.lost.push(raw)
    }
  }
  if (undecided > 0) {
    skipped.push(`${undecided} recorded dirty path(s) are clean now, and without the recorded commit "committed since" cannot be told from "lost" — not reported as lost`)
  }
  if (outside > 0) {
    skipped.push(`${outside} recorded dirty path(s) are outside the repository (an absolute path or a ".." segment) — not checked`)
  }
  if (unchecked > 0) {
    skipped.push(`git could not check ${unchecked} recorded dirty path(s) — not reported as lost`)
  }
  return result
}
