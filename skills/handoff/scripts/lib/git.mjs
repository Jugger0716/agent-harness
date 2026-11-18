// The live facts a resume checks a handoff document against: the state of a git work tree, the
// relation of a document's recorded commit to it, and whether the task state under `.harness/` is
// the current session's. Everything here only READS: git is run with `rev-parse`, `status`, `log`,
// `merge-base` and `cat-file` and nothing else, through `child_process.spawnSync` with an
// argument list and an explicit working directory (never a shell string), and the one file this
// reads outside git is `.harness/state.json`, which is never written.
//
//   gitState(cwd) -> { isGit, toplevel, branch, head, subject, dirty: [{ status, path }],
//                      upstream: { ahead, behind } | null }
//     Not inside a git work tree -> isGit false and every other field null / [] (exit 0 upstream).
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
//     `parsed` is parseHandoff()'s result. The state is read from the recorded Worktree when the
//     document names one that is still a git work tree (`viaWorktree` is true when that is another
//     work tree than the one `cwd` is in), else from `cwd`. A recorded Worktree that is gone, or a
//     `cwd` that is not a git work tree, compares nothing: `skipped` carries the reason, `same` is
//     null and the relation "unknown", so no alarm can come from it.
//     relation: "same" | "forward" (HEAD is ahead of the recorded commit; `ahead` lists the commits
//     newest first, at most 20, `more` is how many were left out) | "backward" (HEAD is an ancestor
//     of the recorded commit) | "diverged" (neither) | "unknown" (no recorded commit, or one this
//     clone does not have; `skipped` says which).
//     dirty: each path the document recorded as dirty is `stillDirty` (it is dirty now; a recorded
//     folder counts when something below it is), else `committedSince` (a commit after the recorded
//     one touched it), else `lost` (clean now and no commit touched it: the uncommitted work is gone).
//     With relation "unknown" a clean path cannot be told from a committed one, so it is neither.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { InputError } from './errors.mjs'

const AHEAD_CAP = 20

// One git call, read-only by construction (callers pass only the read-only subcommands above).
// `--literal-pathspecs` makes a path from a document a name, never a pathspec with magic or a glob;
// `GIT_OPTIONAL_LOCKS=0` keeps `status` from rewriting the index to refresh it; the fsmonitor setting
// is switched off because a repository's own configuration must not run a program on a read.
function git(cwd, args) {
  const r = spawnSync('git', ['--literal-pathspecs', '-c', 'core.fsmonitor=false', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
    maxBuffer: 256 * 1024 * 1024,
  })
  if (r.error) throw new Error(`cannot run git: ${r.error.code || r.error.message}`)
  return { ok: r.status === 0, status: r.status, out: r.stdout }
}

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
  const out = { oid: null, head: null, ab: null, dirty: [] }
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
      if (rec[0] === '2') i++ // the original name of a rename or copy
    }
  }
  return out
}

export function gitState(cwd) {
  const top = git(cwd, ['rev-parse', '--show-toplevel'])
  if (!top.ok || top.out.trim() === '') return NOT_GIT()
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
  return {
    isGit: true,
    toplevel,
    branch: s.head,
    head,
    subject,
    dirty: s.dirty,
    upstream: s.ab,
  }
}

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

// Is `dir` the same folder as `other`? (real paths, case-folded on Windows)
function sameFolder(dir, other) {
  const key = (p) => {
    let r
    try {
      r = fs.realpathSync.native(p)
    } catch {
      r = path.resolve(p)
    }
    return process.platform === 'win32' ? r.toLowerCase() : r
  }
  return key(dir) === key(other)
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

export function drift(parsed, cwd) {
  const h = parsed.header
  const skipped = []
  const recordedBranch = h.branch === null ? null : unwrap(h.branch) || null
  const result = {
    branch: { recorded: recordedBranch, current: null, same: null, viaWorktree: false },
    head: { relation: 'unknown', ahead: [], more: 0 },
    dirty: { currentCount: 0, lost: [], committedSince: [], stillDirty: [] },
    skipped,
  }

  // Where the state is read: the recorded worktree when the document names one that still exists.
  let state = gitState(cwd)
  if (h.worktree) {
    let there = null
    if (isFolder(h.worktree)) there = gitState(h.worktree)
    // The recorded folder must itself be the top of a work tree: an empty folder that now sits inside
    // some other repository is not the worktree the document was written in.
    if (!there || !there.isGit || !sameFolder(there.toplevel, h.worktree)) {
      skipped.push(`the worktree the document recorded (${h.worktree}) no longer exists or is not a git work tree — git state not compared`)
      return result
    }
    result.branch.viaWorktree = !(state.isGit && sameFolder(there.toplevel, state.toplevel))
    state = there
  }
  if (!state.isGit) {
    skipped.push('the current folder is not inside a git work tree — git state not compared')
    return result
  }
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
  const current = new Set(state.dirty.map((d) => d.path))
  result.dirty.currentCount = state.dirty.length
  let undecided = 0
  for (const raw of h.dirtyPaths) {
    const p = slash(raw)
    if (stillDirty(p, current)) {
      result.dirty.stillDirty.push(raw)
    } else if (relation === 'unknown') {
      undecided++
    } else {
      const touched = git(dir, ['log', '-1', '--format=%H', `${full}..${state.head}`, '--', p])
      if (touched.ok && touched.out.trim() !== '') result.dirty.committedSince.push(raw)
      else result.dirty.lost.push(raw)
    }
  }
  if (undecided > 0) {
    skipped.push(`${undecided} recorded dirty path(s) are clean now, and without the recorded commit "committed since" cannot be told from "lost" — not reported as lost`)
  }
  return result
}
