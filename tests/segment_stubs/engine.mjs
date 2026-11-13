// Stub engine for the Workflow segment scripts under workflows/.
//
// It runs a script's body with stand-ins for the globals the real Workflow engine provides, so a
// test can decide what every agent returns and inspect every prompt the script built. No model
// is called and nothing is written.
//
// Engine assumptions this stub encodes (source: the Claude Code workflow-authoring reference,
// checked 2026-11-13) — if the real engine changes, change them HERE, not in the cases:
//   - agent(prompt, opts) resolves to the agent's structured result, or to null when the user
//     skips the agent or it ends in a terminal API error. It does not reject for those.
//   - parallel(thunks) never rejects: a thunk that throws contributes null to the result array.
//   - pipeline(items, ...stages) threads each item through the stages; a stage that throws
//     makes that item's result null.
//   - `export const meta = {...}` is the only module syntax a script carries; the body may use a
//     top-level `return`.
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const WORKFLOWS = fileURLToPath(new URL('../../workflows/', import.meta.url))
const SUFFIX = '.workflow.js'
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

// Names of the segment scripts, without the `.workflow.js` suffix.
export function listScripts() {
  return fs
    .readdirSync(WORKFLOWS)
    .filter((f) => f.endsWith(SUFFIX))
    .map((f) => f.slice(0, -SUFFIX.length))
    .sort()
}

function load(name) {
  const src = fs.readFileSync(WORKFLOWS + name + SUFFIX, 'utf8')
  return src.replace(/^export const meta =/m, 'const meta =')
}

// The smallest value that conforms to a JSON schema: required fields only, first enum value.
export function minimal(schema) {
  if (!schema) return 'text'
  if (schema.enum) return schema.enum[0]
  switch (schema.type) {
    case 'object': {
      const o = {}
      for (const k of schema.required || []) o[k] = minimal((schema.properties || {})[k])
      return o
    }
    case 'array':
      return []
    case 'string':
      return 's'
    case 'integer':
    case 'number':
      return 0
    case 'boolean':
      return false
    default:
      return null
  }
}

// `{snake_case}` placeholders still present in a rendered prompt.
export function residual(prompt) {
  return [...new Set(String(prompt).match(/\{[a-z][a-z0-9_]*\}/g) || [])]
}

// Run one segment script. `agentImpl(prompt, opts, index)` supplies each agent's result.
// Resolves to { result | error, calls, logs, phases }; a script that throws yields `error`
// ("<ErrorName>: <message>") instead of rejecting.
export async function run(name, args, agentImpl) {
  const calls = []
  const logs = []
  const phases = []
  const agent = async (prompt, opts = {}) => {
    calls.push({ prompt, opts, label: opts.label })
    return agentImpl(prompt, opts, calls.length - 1)
  }
  const settle = async (fn) => {
    try {
      return await fn()
    } catch {
      return null
    }
  }
  const parallel = (thunks) => Promise.all(thunks.map((t) => settle(t)))
  const pipeline = (items, ...stages) =>
    Promise.all(
      items.map((item, i) =>
        settle(async () => {
          let r = item
          for (const stage of stages) r = await stage(r, item, i)
          return r
        }),
      ),
    )
  const phase = (title) => phases.push(title)
  const log = (message) => logs.push(message)
  try {
    const body = new AsyncFunction('args', 'agent', 'parallel', 'pipeline', 'phase', 'log', load(name))
    const result = await body(args, agent, parallel, pipeline, phase, log)
    return { result, calls, logs, phases }
  } catch (e) {
    const kind = (e && e.constructor && e.constructor.name) || 'Error'
    return { error: `${kind}: ${e && e.message}`, calls, logs, phases }
  }
}
