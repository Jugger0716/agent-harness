// Throw-away git repositories for the handoff script tests. Everything lives under one folder of the
// OS temp directory (never inside this repository); `cleanup()` removes it, the linked worktree
// included, and every case calls it in a `finally`.
//
//   makeRepo({ commits, dirty, detached, worktree }) -> {
//     root, dir, env, shas, worktreeDir, git(...args), gitIn(cwd, ...args), write(rel, text), cleanup()
//   }
//   commits   [{ message?, files? }] — one commit each, `files` is { relative path: text }; an entry
//             without files is an empty commit. Default: one commit that adds a.txt.
//   dirty     { relative path: text | null } written after the commits; null deletes the file.
//   detached  true -> the last step is a detached HEAD at the last commit.
//   worktree  true or { branch } -> a linked worktree on a new branch, next to the repository
//             (`worktreeDir`).
//   `dir` is the repository, `root` the folder that holds it (a handoff document written into
//   `root` never makes the repository dirty), `env` the environment every git call and every helper
//   run in the repository must use, `shas` the commit shas in creation order.
//   makePlainDir() -> { root, dir, env, cleanup() } — a folder that is not inside any repository.
//
// The machine's git configuration must not matter: the global and system files are replaced (an
// empty file, GIT_CONFIG_NOSYSTEM), discovery never climbs above `root` (GIT_CEILING_DIRECTORIES), the
// identity and line-ending settings are local to the repository, and the first branch is `main`.
// A test side may use any git command (the lint on destructive git text scans the contracts only).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const STRIP = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_COMMON_DIR', 'GIT_PREFIX']

function isolatedEnv(root) {
  const empty = path.join(root, 'empty.gitconfig')
  fs.writeFileSync(empty, '')
  const env = { ...process.env }
  for (const k of STRIP) delete env[k]
  return { ...env, GIT_CONFIG_GLOBAL: empty, GIT_CONFIG_NOSYSTEM: '1', GIT_CEILING_DIRECTORIES: root, GIT_TERMINAL_PROMPT: '0' }
}

function newRoot() {
  // the real path: git prints the long form, and the OS temp folder may be spelled with a short name
  return fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-repo-')))
}

const remove = (root) => fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })

export function makePlainDir() {
  const root = newRoot()
  try {
    const dir = path.join(root, 'plain')
    fs.mkdirSync(dir)
    return { root, dir, env: isolatedEnv(root), cleanup: () => remove(root) }
  } catch (e) {
    remove(root)
    throw e
  }
}

export function makeRepo({ commits = [{ files: { 'a.txt': 'one\n' } }], dirty = {}, detached = false, worktree = null } = {}) {
  const root = newRoot()
  try {
    const dir = path.join(root, 'repo')
    fs.mkdirSync(dir)
    const env = isolatedEnv(root)
    const gitIn = (cwd, ...args) => execFileSync('git', args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
    const git = (...args) => gitIn(dir, ...args)
    const write = (rel, text) => {
      const abs = path.join(dir, ...rel.split('/'))
      if (text === null) {
        fs.rmSync(abs, { force: true })
        return
      }
      fs.mkdirSync(path.dirname(abs), { recursive: true })
      fs.writeFileSync(abs, text)
    }
    git('init', '-q', '-b', 'main')
    git('config', 'user.name', 'Sample Tester')
    git('config', 'user.email', 'tester@example.invalid')
    git('config', 'core.autocrlf', 'false')
    git('config', 'commit.gpgsign', 'false')
    const shas = []
    commits.forEach((c, i) => {
      for (const [rel, text] of Object.entries(c.files || {})) write(rel, text)
      git('add', '-A')
      git('commit', '-q', '--allow-empty', '-m', c.message || `commit ${i + 1}`)
      shas.push(git('rev-parse', 'HEAD'))
    })
    let worktreeDir = null
    if (worktree) {
      worktreeDir = path.join(root, 'wt')
      git('worktree', 'add', '-q', '-b', (worktree === true ? null : worktree.branch) || 'feature', worktreeDir)
    }
    for (const [rel, text] of Object.entries(dirty)) write(rel, text)
    if (detached) git('checkout', '-q', '--detach')
    return { root, dir, env, shas, worktreeDir, git, gitIn, write, cleanup: () => remove(root) }
  } catch (e) {
    remove(root)
    throw e
  }
}
