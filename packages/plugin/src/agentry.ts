import { tool } from "@opencode-ai/plugin"
import type { Hooks } from "@opencode-ai/plugin"
import { parse as parseYaml } from "yaml"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import * as http from "node:http"
import { randomUUID } from "node:crypto"
import { exec, spawn } from "node:child_process"
import {
  branchParents,
  CHECKPOINT_FILE,
  checkRunnable,
  extractJson,
  fromList,
  inputSources,
  joinMode,
  logFileName,
  matchesCondition,
  outputFileName,
  pickBranchRoute,
  RUN_DIR_ROOT,
  sliceUpstream,
  strictJsonNodes,
  stripJsonFences,
  validateWorkflow as lintWorkflow,
} from "@agentry/core"
import type { AgentDefinition, Checkpoint, NodeState, SelectFallback, Workflow, WorkflowEvent } from "@agentry/core"
import { THEMES } from "@agentry/design"
import { PANEL_TOKENS_CSS } from "./panelTokens"

const PANEL_FILE = ".agentry/panel.json" // App-side discovery file (docs/12 D1 phase 1)
const REPORT_FILE = "log.md" // whole-run report the documenter writes beside the node artifacts (D19)

// ── helpers ──
function extractText(parts: unknown[]): string {
  if (!Array.isArray(parts)) return ""
  return parts
    .filter((p): p is { type: string; text?: string; content?: string } =>
      typeof p === "object" && p !== null && "type" in p)
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? p.content ?? "")
    .join("\n").trim()
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

const ts = () => new Date().toISOString()
const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err))
const fmtMs = (ms: number) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`)
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text)

// The slice of the opencode SDK client the runner uses. Structural on purpose: the host
// passes its real client, and the runner stays independent of SDK type churn.
interface PromptResult { data?: { parts?: unknown[] }; parts?: unknown[] }
interface OpencodeClient {
  app: {
    agents(): Promise<{ data?: Array<{ name: string }> }>
    log?(options: { body: { service: string; level: LogLevel; message: string } }): Promise<unknown>
  }
  session: {
    create(options: { body: { title: string; parentID?: string } }): Promise<{ data: { id: string } }>
    prompt(options: { path: { id: string }; body: Record<string, unknown> }): Promise<PromptResult>
  }
}

type LogLevel = "debug" | "info" | "warn" | "error"

// Progress and errors go to opencode's own log, never to stdout/stderr: the TUI owns the
// terminal and plugin output there tears through its rendering. opencode.log (directory from
// `opencode debug paths`) does not print the service tag, hence the [agentry] prefix to grep for.
let host: OpencodeClient | null = null
function log(level: LogLevel, message: string) {
  void host?.app.log?.({ body: { service: "agentry", level, message: `[agentry] ${message}` } })?.catch(() => {})
}

// ── B2: DAG ──
interface DagNode {
  id: string
  def: AgentDefinition
  /** Execution deps — all must settle first (join: any relaxes only the data ones). */
  upstream: string[]
  /** Data deps: the upstreams whose output the prompt receives (input.from ∪ branch parents). */
  sources: string[]
  branchParents: string[]
}

function buildDag(wf: Workflow): { nodes: Map<string, DagNode>; order: string[] } {
  const parents = branchParents(wf)
  const nodes = new Map<string, DagNode>()
  for (const [id, def] of Object.entries(wf.agents)) {
    // branch→child edges live only in routes[], not the child's input.from — inputSources
    // folds them in, or children race their branch and run in the first wave (doc 10 §2.4 trap)
    const bp = parents.get(id) ?? []
    const sources = inputSources(def, bp)
    const upstream = [...sources]
    // condition source must be an execution dep, else the node races its own gate
    const gate = def.trigger?.when?.from
    if (gate && !upstream.includes(gate)) upstream.push(gate)
    nodes.set(id, { id, def, upstream, sources, branchParents: bp })
  }
  // a documenter reports on every other node at run end, so it must run strictly last
  for (const node of nodes.values()) {
    if (node.def.type !== "documenter") continue
    for (const other of nodes.keys()) if (other !== node.id && !node.upstream.includes(other)) node.upstream.push(other)
  }
  for (const [id, node] of nodes) {
    for (const dep of node.upstream) if (!nodes.has(dep)) throw new Error(`"${id}" depends on "${dep}" which doesn't exist`)
  }
  for (const id of wf.workflow) if (!nodes.has(id)) throw new Error(`workflow[] references unknown "${id}"`)
  return { nodes, order: wf.workflow }
}


// ── B3: agent resolver ──
let agentCache: Array<{ name: string }> | null = null

async function resolveAgent(client: OpencodeClient, target: string): Promise<string> {
  if (!agentCache) {
    try {
      const resp = await client.app.agents()
      agentCache = resp.data ?? []
    } catch {
      return target
    }
  }
  if (agentCache.some((a) => a.name === target)) return target
  const avail = agentCache.map((a) => a.name).join(", ")
  throw new Error(`Agent "${target}" not available. Available: [${avail}]`)
}

// ── B4: checkpoint ──
function loadCheckpoint(runDir: string): Checkpoint | null {
  const p = path.join(runDir, CHECKPOINT_FILE)
  if (!fs.existsSync(p)) return null
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(p, "utf-8"))
    return isObj(parsed) && Array.isArray(parsed.completed) ? (parsed as unknown as Checkpoint) : null
  } catch { return null }
}

function saveCheckpoint(runDir: string, cp: Checkpoint) {
  fs.writeFileSync(path.join(runDir, CHECKPOINT_FILE), JSON.stringify(cp, null, 2))
}

// ── B8: output schema validation ──
function validateOutput(nodeId: string, outputText: string, schema: Record<string, string> | undefined): string[] {
  if (!schema || Object.keys(schema).length === 0) return []
  const warnings: string[] = []
  try {
    const parsed: unknown = JSON.parse(stripJsonFences(outputText))
    if (!isObj(parsed)) { warnings.push(`${nodeId}: output is not a JSON object`); return warnings }
    for (const key of Object.keys(schema)) {
      if (!(key in parsed)) warnings.push(`${nodeId}: missing expected key "${key}"`)
    }
  } catch {
    warnings.push(`${nodeId}: output is not valid JSON (schema check skipped)`)
  }
  return warnings
}

// ── trigger.when gate ──
// A gate whose source was skipped has nothing to test, so it is unmet: the node sits in the
// skipped node's subtree (D16). A source that ran but printed nothing keeps the lenient v0
// behaviour (the node runs ungated).
function gateUnmet(def: AgentDefinition, outputs: Map<string, string>, skipped: ReadonlySet<string>): boolean {
  const when = def.trigger?.when
  if (!when?.from) return false
  if (skipped.has(when.from)) return true
  const upstreamOutput = outputs.get(when.from)
  if (!upstreamOutput) return false
  return !matchesCondition(upstreamOutput, when)
}

// D16: everything downstream of an unchosen port is marked skipped instead of sitting
// "pending" forever. A join: all node needs every input, so one skipped data source or a
// skipped gate starves it; a join: any node only starves once NO input can arrive (D4).
function branchSkipReason(node: DagNode, seed: ReadonlySet<string>, skipped: ReadonlySet<string>): string | null {
  if (seed.has(node.id)) return "branch route not chosen"
  const gate = node.def.trigger?.when?.from
  if (gate && seed.has(gate)) return `gate "${gate}" was skipped`
  if (joinMode(node.def) === "any") {
    const starved = node.sources.length > 0 && node.sources.every((s) => seed.has(s) || skipped.has(s))
    return starved ? "every upstream was skipped (join: any)" : null
  }
  if (fromList(node.def.input?.from).some((f) => seed.has(f))) return "an upstream was skipped by a branch"
  if (node.branchParents.length > 0 && node.branchParents.every((b) => seed.has(b))) return "branch route not chosen"
  return null
}

function findDownstream(nodeId: string, dag: { nodes: Map<string, DagNode> }): Set<string> {
  const result = new Set<string>()
  const queue = [nodeId]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const [id, node] of dag.nodes) {
      if (result.has(id)) continue
      if (node.upstream.includes(current)) {
        result.add(id)
        queue.push(id)
      }
    }
  }
  return result
}

// ── B6: SSE event bus + HTTP panel server ──
const sseClients = new Set<http.ServerResponse>()
const panelPageClients = new Set<http.ServerResponse>() // the panel window's own stream — open window = no new window
const sseReplayBuffer: WorkflowEvent[] = []
let panelServer: http.Server | null = null
let panelPort = 0
let runToken = "" // POST /api/run credential, published in panel.json only
let runHost: { client: OpencodeClient; directory: string } | null = null
let runInProgress = false
let abortFlag = false
let rerunNodeId: string | null = null
let lastClient: OpencodeClient | null = null
let lastDirectory = ""
let lastWorkflow: Workflow | null = null
let lastRunId = ""
let designTokensCss = ""
let panelFilePath = ""
let panelExitHooked = false

// D13: the panel carries every editor palette and follows the editor — the App pushes its
// theme here while observing (POST /api/theme); defaults match the editor's ('dark'/'light').
const PANEL_THEMES = THEMES.map((t) => ({ id: t.id, label: t.label, mode: t.mode }))
let panelTheme = "dark"
const panelLastByMode: Record<"dark" | "light", string> = { dark: "dark", light: "light" }

function setPanelTheme(id: string): boolean {
  const def = PANEL_THEMES.find((t) => t.id === id)
  if (!def) return false
  panelTheme = def.id
  panelLastByMode[def.mode] = def.id
  const data = `data: ${JSON.stringify({ type: "panel.theme", theme: def.id, lastByMode: panelLastByMode })}\n\n`
  for (const res of sseClients) {
    try { res.write(data) } catch { sseClients.delete(res) }
  }
  return true
}

// D1 (docs/12): the panel binds listen(0) → random port, so the App discovers it via
// <project>/.agentry/panel.json { port, runId, pid, startedAt }. `runId` must ALWAYS be a
// string — the App parser (packages/app/src/panelDiscovery.ts) rejects the whole file when
// `typeof runId !== 'string'`, and the server starts before any run exists, so we publish ""
// as a load-bearing placeholder and rewrite with the real id at run.started.
// Best-effort by design: a failed write must never crash or abort a run.
function writePanelFile(directory: string, runId: string) {
  if (!panelPort) return // panel never came up (listen failed) — publish nothing rather than advertise a dead port or clobber another live instance's file
  try {
    panelFilePath = path.join(directory, PANEL_FILE)
    fs.mkdirSync(path.dirname(panelFilePath), { recursive: true })
    // temp file + rename in the same dir: a concurrent App-side reader never observes
    // an empty/half-written file (bare writeFileSync truncates before it writes)
    const tmp = `${panelFilePath}.${process.pid}.tmp`
    fs.writeFileSync(tmp, JSON.stringify({ port: panelPort, runId, pid: process.pid, startedAt: ts(), token: runToken }, null, 2))
    fs.renameSync(tmp, panelFilePath)
  } catch (err) {
    log("warn", `failed to write ${PANEL_FILE}: ${errorMessage(err)}`)
  }
}

function removePanelFile() {
  // Two opencode instances can share one project: unlink only if the file still records
  // OUR pid, else A's shutdown would tear down live instance B's discovery mid-run.
  // Best-effort throughout — this also runs from the process exit hook and must never throw.
  try {
    if (!panelFilePath) return
    const rec: unknown = JSON.parse(fs.readFileSync(panelFilePath, "utf-8"))
    if (isObj(rec) && rec.pid === process.pid) fs.unlinkSync(panelFilePath)
  } catch {}
}

// D12: opencode now gives plugins a real teardown (Hooks.dispose, run from the instance
// finalizer), which replaces the old SIGINT/SIGTERM handlers. The plain "exit" listener stays
// as a no-side-effect last resort for a host that exits without disposing its instances.
function hookPanelFileExit() {
  if (panelExitHooked) return
  panelExitHooked = true
  process.once("exit", removePanelFile)
}

async function shutdownPanel(): Promise<void> {
  abortFlag = true // a run still in flight stops at its next wave boundary
  if (panelStarting) await panelStarting // a server still binding must not outlive dispose
  removePanelFile()
  for (const res of sseClients) {
    try { res.end() } catch {}
  }
  sseClients.clear()
  panelPageClients.clear()
  const srv = panelServer
  panelServer = null
  panelPort = 0
  if (!srv) return
  srv.closeAllConnections()
  await new Promise<void>((resolve) => srv.close(() => resolve()))
}

function loadDesignTokens(directory: string): string {
  const candidates = [
    path.join(directory, "packages", "design", "src", "tokens.css"),
    path.join(directory, "..", "packages", "design", "src", "tokens.css"),
  ]
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return fs.readFileSync(p, "utf-8") } catch {}
  }
  return ""
}

const REPLAYED: ReadonlySet<WorkflowEvent["type"]> = new Set<WorkflowEvent["type"]>([
  "run.started", "node.state", "node.output", "run.finished", "checkpoint", "schema.warning", "select.fallback",
])

function emitPanel(event: WorkflowEvent) {
  if (event.type === "run.started") sseReplayBuffer.length = 0
  if (REPLAYED.has(event.type)) sseReplayBuffer.push(event)
  const data = `data: ${JSON.stringify(event)}\n\n`
  for (const res of sseClients) {
    try { res.write(data) } catch { sseClients.delete(res) }
  }
}

// the Agentry mark (design/logo/agentry-mark.svg), drawn in currentColor on a 48-unit grid
const AGENTRY_MARK = '<path fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" d="M2 24 13 4.95h22L46 24 35 43.05H13z"/><path fill="none" stroke="currentColor" stroke-width="2" d="M19 24h4.5v-8H28M23.5 24v8H28"/><g fill="currentColor"><rect x="9" y="19" width="10" height="10" rx="2.5"/><rect x="28" y="13" width="7" height="6" rx="1.5"/><rect x="28" y="29" width="7" height="6" rx="1.5"/></g>'
const PANEL_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#16191f"/><g transform="translate(5 5) scale(.7917)" color="#7aa2f7">${AGENTRY_MARK}</g></svg>`

function getPanelHtml(): string {
  const theme = PANEL_THEMES.find((t) => t.id === panelTheme)
  const themeState = JSON.stringify({ theme: panelTheme, lastByMode: panelLastByMode })
  return `<!DOCTYPE html><html data-theme="${theme?.id ?? "dark"}" data-mode="${theme?.mode ?? "dark"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Agentry — Live Run</title>
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(PANEL_ICON_SVG)}">
<style>
${PANEL_TOKENS_CSS}
${designTokensCss}
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%}
body{display:flex;flex-direction:column;background:var(--agentry-color-bg-app);color:var(--agentry-color-text-primary);font-family:var(--agentry-font-sans);font-size:var(--agentry-fs-base);-webkit-font-smoothing:antialiased;overflow:hidden}
.agentry-toolbar{flex:none;display:flex;align-items:center;justify-content:space-between;gap:var(--agentry-space-lg);height:46px;padding:0 var(--agentry-space-xl);background:var(--agentry-color-bg-surface);border-bottom:1px solid var(--agentry-color-border-subtle)}
.agentry-toolbar__brand{display:flex;align-items:center;gap:var(--agentry-space-base);font-size:var(--agentry-fs-md);font-weight:var(--agentry-fw-semibold);color:var(--agentry-color-text-primary)}
.agentry-toolbar__brand svg{display:block;color:var(--agentry-color-accent)}
.agentry-toolbar__scope{margin-left:var(--agentry-space-sm);padding:2px var(--agentry-space-base);border:1px solid var(--agentry-color-border-default);border-radius:var(--agentry-radius-pill);font-family:var(--agentry-font-mono);font-size:var(--agentry-fs-xs);font-weight:var(--agentry-fw-medium);letter-spacing:.04em;text-transform:uppercase;color:var(--agentry-color-text-muted);line-height:1.4}
.agentry-toolbar__actions{display:flex;align-items:center;gap:var(--agentry-space-base)}
.agentry-select{height:30px;max-width:180px;padding:0 var(--agentry-space-base);background:var(--agentry-color-bg-inset);border:1px solid var(--agentry-color-border-default);border-radius:var(--agentry-radius-md);color:var(--agentry-color-text-secondary);font-family:var(--agentry-font-sans);font-size:var(--agentry-fs-sm);cursor:pointer;outline:none;transition:border-color .12s ease,box-shadow .12s ease}
.agentry-select:hover{border-color:var(--agentry-color-border-strong);color:var(--agentry-color-text-primary)}
.agentry-select:focus{border-color:var(--agentry-color-accent);box-shadow:0 0 0 2px var(--agentry-color-accent-muted)}
.agentry-btn{display:inline-flex;align-items:center;justify-content:center;gap:var(--agentry-space-md);height:30px;padding:0 var(--agentry-space-lg);background:transparent;border:1px solid var(--agentry-color-border-default);border-radius:var(--agentry-radius-md);color:var(--agentry-color-text-secondary);font-family:var(--agentry-font-sans);font-size:var(--agentry-fs-sm);font-weight:var(--agentry-fw-medium);cursor:pointer;transition:background .12s ease,border-color .12s ease,color .12s ease}
.agentry-btn:hover{background:var(--agentry-color-bg-elevated);border-color:var(--agentry-color-border-strong);color:var(--agentry-color-text-primary)}
.agentry-btn:active{transform:translateY(1px)}
.agentry-btn--primary{background:var(--agentry-color-accent);border-color:var(--agentry-color-accent);color:var(--agentry-color-accent-ink);font-weight:var(--agentry-fw-semibold)}
.agentry-btn--primary:hover{background:var(--agentry-color-accent-hover);border-color:var(--agentry-color-accent-hover);color:var(--agentry-color-accent-ink)}
.agentry-btn--danger{color:var(--agentry-state-failed);border-color:color-mix(in srgb,var(--agentry-state-failed) 45%,transparent)}
.agentry-btn--danger:hover{background:var(--agentry-state-failed-soft);border-color:var(--agentry-state-failed);color:var(--agentry-state-failed)}
.agentry-btn--sm{height:22px;padding:0 var(--agentry-space-base);font-size:var(--agentry-fs-xs);border-radius:var(--agentry-radius-sm)}
.agentry-btn--icon{width:30px;padding:0;border-color:transparent;color:var(--agentry-color-text-muted)}
.agentry-btn--icon:hover{background:var(--agentry-color-bg-elevated);border-color:transparent;color:var(--agentry-color-text-primary)}
.agentry-main{flex:1;overflow:auto;padding:var(--agentry-space-huge) var(--agentry-space-xxl);background-image:radial-gradient(color-mix(in srgb,var(--agentry-color-text-primary) 7%,transparent) 1.4px,transparent 1.4px);background-size:22px 22px}
#canvas{position:relative;margin:0 auto}
#canvas.is-static{max-width:640px}
#canvas.is-static .agentry-node{margin:0 0 var(--agentry-space-lg)}
#edges{position:absolute;top:0;left:0;pointer-events:none}
.agentry-node{display:flex;flex-direction:column;gap:var(--agentry-space-md);background:linear-gradient(180deg,var(--agentry-color-bg-elevated),var(--agentry-color-bg-surface));border:1px solid var(--agentry-color-border-default);border-radius:var(--agentry-radius-lg);padding:var(--agentry-space-base) var(--agentry-space-lg) var(--agentry-space-lg);box-shadow:var(--agentry-shadow-md);transition:border-color .25s ease,box-shadow .25s ease,opacity .25s ease}
.agentry-node.is-running{border-color:var(--agentry-state-running);box-shadow:0 0 0 1px var(--agentry-state-running-soft),var(--agentry-shadow-md)}
.agentry-node.is-done{border-color:var(--agentry-state-done);box-shadow:0 0 0 1px var(--agentry-state-done-soft),var(--agentry-shadow-md)}
.agentry-node.is-failed{border-color:var(--agentry-state-failed);box-shadow:0 0 0 1px var(--agentry-state-failed-soft),var(--agentry-shadow-md)}
.agentry-node.is-skipped{opacity:.65}
.agentry-node__hdr{display:flex;align-items:center;justify-content:space-between;gap:var(--agentry-space-base)}
.agentry-node__name{font-weight:var(--agentry-fw-semibold);font-size:var(--agentry-fs-md);color:var(--agentry-color-text-primary);min-width:0;overflow-wrap:anywhere}
.agentry-node__state{flex:none;display:inline-flex;align-items:center;gap:var(--agentry-space-md);font-size:var(--agentry-fs-xs);font-weight:var(--agentry-fw-medium);color:var(--agentry-color-text-secondary);white-space:nowrap}
.agentry-node__dot{flex:none;width:7px;height:7px;border-radius:50%;background:var(--agentry-state-pending)}
.agentry-node__state[data-state='running'] .agentry-node__dot{background:var(--agentry-state-running);animation:agentry-pulse 1.5s ease-in-out infinite}
.agentry-node__state[data-state='done'] .agentry-node__dot{background:var(--agentry-state-done)}
.agentry-node__state[data-state='failed'] .agentry-node__dot{background:var(--agentry-state-failed)}
.agentry-node__state[data-state='skipped'] .agentry-node__dot{background:var(--agentry-state-skipped)}
@keyframes agentry-pulse{0%,100%{opacity:1}50%{opacity:.45}}
.agentry-node__agent{font-family:var(--agentry-font-mono);font-size:var(--agentry-fs-xs);letter-spacing:.04em;text-transform:uppercase;color:var(--agentry-color-text-muted)}
.agentry-node__iter{display:none;font-size:var(--agentry-fs-xs);color:var(--agentry-color-accent)}
.agentry-node__output{display:none;font-family:var(--agentry-font-mono);font-size:var(--agentry-fs-sm);line-height:1.55;color:var(--agentry-color-text-secondary);background:var(--agentry-color-bg-inset);border:1px solid var(--agentry-color-border-subtle);border-radius:var(--agentry-radius-md);padding:var(--agentry-space-base) var(--agentry-space-lg);max-height:200px;overflow-y:auto;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word}
.agentry-node__warn{display:none;font-size:var(--agentry-fs-xs);line-height:1.45;color:var(--agentry-state-running);overflow-wrap:anywhere}
.agentry-node__foot{display:flex;align-items:center;justify-content:space-between;gap:var(--agentry-space-base);margin-top:var(--agentry-space-xs)}
.agentry-node__timing{font-family:var(--agentry-font-mono);font-size:var(--agentry-fs-xs);color:var(--agentry-color-text-muted)}
.agentry-statusbar{flex:none;display:flex;align-items:center;justify-content:space-between;gap:var(--agentry-space-lg);height:28px;padding:0 var(--agentry-space-xl);background:var(--agentry-color-bg-surface);border-top:1px solid var(--agentry-color-border-subtle);font-size:var(--agentry-fs-xs);color:var(--agentry-color-text-muted)}
#status{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.agentry-statusbar__host{flex:none;font-family:var(--agentry-font-mono)}
.agentry-edge-path{stroke:var(--agentry-color-border-strong);stroke-width:1.5;fill:none;transition:stroke .3s}
.agentry-edge-path.active{stroke:var(--agentry-state-running);stroke-dasharray:6 4;animation:agentry-dash .8s linear infinite}
@keyframes agentry-dash{to{stroke-dashoffset:-10}}
.compact .agentry-node__output,.compact .agentry-node__foot{display:none!important}
.compact .agentry-node{gap:var(--agentry-space-sm);padding-bottom:var(--agentry-space-base)}
.compact .agentry-main{padding-top:var(--agentry-space-xl)}
@media (prefers-reduced-motion:reduce){.agentry-edge-path.active,.agentry-node__state[data-state='running'] .agentry-node__dot{animation:none}}
</style></head>
<body>
<header class="agentry-toolbar">
  <div class="agentry-toolbar__brand"><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">${AGENTRY_MARK}</svg><span>Agentry</span><span class="agentry-toolbar__scope">live run</span></div>
  <div class="agentry-toolbar__actions">
    <select class="agentry-select" id="themeSel" title="Color theme" aria-label="Color theme"></select>
    <button class="agentry-btn agentry-btn--icon" id="themeBtn" type="button" aria-label="Toggle light / dark"></button>
    <button class="agentry-btn agentry-btn--primary" id="resumeBtn" type="button" style="display:none">Resume</button>
    <button class="agentry-btn agentry-btn--danger" id="stopBtn" type="button">Stop</button>
  </div>
</header>
<main class="agentry-main" id="main"><div id="canvas" class="is-static"><svg id="edges"></svg></div></main>
<footer class="agentry-statusbar"><span id="status">Waiting for run to start&hellip;</span><span class="agentry-statusbar__host" id="host"></span></footer>
<script>
var THEMES=${JSON.stringify(PANEL_THEMES)},themeState=${themeState};
var canvas=document.getElementById('canvas'),svgEl=document.getElementById('edges'),statusEl=document.getElementById('status'),resumeBtn=document.getElementById('resumeBtn'),themeSel=document.getElementById('themeSel'),themeBtn=document.getElementById('themeBtn');
// ?compact (screen recordings): nodes without output previews and buttons, layers closer together
var COMPACT=new URLSearchParams(location.search).has('compact');if(COMPACT)document.documentElement.classList.add('compact');
var nodeMap={},warnMap={},heights={},dirty={},layout=null,structureDirty=true,lastNW=-1,NW=280,GX=32,GY=COMPACT?30:48;
var STATE_LABEL={pending:'Pending',running:'Running',done:'Done',failed:'Failed',skipped:'Skipped'};
var ICON_SUN='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
var ICON_MOON='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
function themeDef(id){for(var i=0;i<THEMES.length;i++)if(THEMES[i].id===id)return THEMES[i];return THEMES[0]}
function applyTheme(id){var t=themeDef(id);themeState.theme=t.id;themeState.lastByMode[t.mode]=t.id;document.documentElement.setAttribute('data-theme',t.id);document.documentElement.setAttribute('data-mode',t.mode);themeSel.value=t.id;themeBtn.innerHTML=t.mode==='dark'?ICON_SUN:ICON_MOON;themeBtn.title=t.mode==='dark'?'Switch to light':'Switch to dark'}
function setTheme(id){applyTheme(id);fetch('/api/theme',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({theme:id})})}
(function(){var groups={dark:document.createElement('optgroup'),light:document.createElement('optgroup')};groups.dark.label='Dark';groups.light.label='Light';for(var i=0;i<THEMES.length;i++){var o=document.createElement('option');o.value=THEMES[i].id;o.textContent=THEMES[i].label;groups[THEMES[i].mode].appendChild(o)}themeSel.appendChild(groups.dark);themeSel.appendChild(groups.light)})();
applyTheme(themeState.theme);
themeSel.addEventListener('change',function(){setTheme(themeSel.value)});
themeBtn.addEventListener('click',function(){var target=themeDef(themeState.theme).mode==='dark'?'light':'dark';setTheme(themeState.lastByMode[target]||target)});
document.getElementById('host').textContent=location.host;
document.getElementById('stopBtn').addEventListener('click',function(){fetch('/api/stop',{method:'POST'});statusEl.textContent='Stopping\\u2026'});
resumeBtn.addEventListener('click',function(){fetch('/api/resume',{method:'POST'});resumeBtn.style.display='none';statusEl.textContent='Resuming\\u2026'});
canvas.addEventListener('click',function(e){var b=e.target.closest('[data-rerun]');if(!b)return;var id=b.getAttribute('data-rerun');fetch('/api/rerun/'+encodeURIComponent(id),{method:'POST'});updateNode(id,'pending',{})});
function computeLayers(ids,deps){
  var layers=[],layerOf={},rem=ids.slice();
  while(rem.length>0){var layer=[];for(var i=0;i<rem.length;i++){var id=rem[i],d=deps[id]||[];if(d.every(function(u){return layerOf[u]!==undefined}))layer.push(id)}
  if(!layer.length)break;for(var j=0;j<layer.length;j++)layerOf[layer[j]]=layers.length;
  rem=rem.filter(function(x){return layer.indexOf(x)<0});layers.push(layer)}
  return layers}
// D13 incremental relayout: a run event touches one node, so only that node is re-measured.
// A width change or new nodes force a full pass. Every read happens before any position
// write (one reflow per pass, not one per node), and positions + edges are rebuilt only when
// a measured height actually changed — otherwise just the edge states are repainted.
function sizeNodes(){
  var main=document.getElementById('main'),avail=Math.max(260,main.clientWidth-2*32),maxN=1;
  for(var i=0;i<layout.layers.length;i++)if(layout.layers[i].length>maxN)maxN=layout.layers[i].length;
  NW=Math.floor((avail-(maxN-1)*GX)/maxN);if(NW>380)NW=380;if(NW<200)NW=200;
  if(NW===lastNW&&!structureDirty)return false;
  lastNW=NW;
  for(var j=0;j<layout.ids.length;j++){var el=nodeMap[layout.ids[j]];if(!el)continue;el.style.position='absolute';el.style.width=NW+'px'}
  return true}
function applyLayout(){
  if(!layout){canvas.classList.add('is-static');dirty={};return}
  canvas.classList.remove('is-static');
  var full=sizeNodes(),ids=full?layout.ids:Object.keys(dirty),moved=full;
  for(var i=0;i<ids.length;i++){var el=nodeMap[ids[i]];if(!el)continue;var h=el.offsetHeight;if(heights[ids[i]]!==h){heights[ids[i]]=h;moved=true}}
  dirty={};structureDirty=false;
  if(!moved){paintEdges();return}
  var tw=0;for(var a=0;a<layout.layers.length;a++){var lw=layout.layers[a].length*NW+(layout.layers[a].length-1)*GX;if(lw>tw)tw=lw}
  var pos={},bottoms={},y=0;
  for(var b=0;b<layout.layers.length;b++){var L=layout.layers[b],lw2=L.length*NW+(L.length-1)*GX,ox=(tw-lw2)/2,rowH=0;
    for(var c=0;c<L.length;c++){var id=L[c],node=nodeMap[id];if(!node)continue;var x=ox+c*(NW+GX),hh=heights[id]||0;
      node.style.left=x+'px';node.style.top=y+'px';pos[id]={x:x,y:y};bottoms[id]=y+hh;if(hh>rowH)rowH=hh}
    y+=rowH+GY}
  layout.pos=pos;layout.bottoms=bottoms;
  var th=Math.max(40,y-GY);
  canvas.style.width=tw+'px';canvas.style.height=th+'px';
  svgEl.setAttribute('width',tw);svgEl.setAttribute('height',th);
  drawEdges()}
function drawEdges(){
  svgEl.innerHTML='';
  for(var i=0;i<layout.ids.length;i++){var id=layout.ids[i],d=layout.deps[id]||[];
    for(var j=0;j<d.length;j++){var f=layout.pos[d[j]],t=layout.pos[id];if(!f||!t)continue;
      var x1=f.x+NW/2,y1=layout.bottoms[d[j]]||f.y,x2=t.x+NW/2,y2=t.y,cy=(y1+y2)/2;
      var p=document.createElementNS('http://www.w3.org/2000/svg','path');
      p.setAttribute('d','M'+x1+','+y1+' C'+x1+','+cy+' '+x2+','+cy+' '+x2+','+y2);
      p.setAttribute('data-to',id);svgEl.appendChild(p)}}
  paintEdges()}
function paintEdges(){
  var ps=svgEl.querySelectorAll('path');
  for(var i=0;i<ps.length;i++){var t=nodeMap[ps[i].getAttribute('data-to')];ps[i].setAttribute('class','agentry-edge-path'+(t&&t.classList.contains('is-running')?' active':''))}}
var relayoutQueued=false;
function queueRelayout(){if(relayoutQueued)return;relayoutQueued=true;requestAnimationFrame(function(){relayoutQueued=false;applyLayout()})}
window.addEventListener('resize',queueRelayout);
function ensureNode(id){
  if(nodeMap[id])return nodeMap[id];
  var el=document.createElement('div');el.className='agentry-node is-pending';el.dataset.id=id;
  el.innerHTML='<div class="agentry-node__hdr"><span class="agentry-node__agent"></span><span class="agentry-node__state" data-state="pending"><span class="agentry-node__dot"></span><span class="agentry-node__statelabel">Pending</span></span></div><div class="agentry-node__name"></div><div class="agentry-node__iter"></div><div class="agentry-node__output"></div><div class="agentry-node__warn"></div><div class="agentry-node__foot"><span class="agentry-node__timing"></span><button class="agentry-btn agentry-btn--sm" type="button">Rerun</button></div>';
  el.querySelector('.agentry-node__name').textContent=id;
  el.querySelector('[type="button"]').setAttribute('data-rerun',id);
  canvas.appendChild(el);nodeMap[id]=el;structureDirty=true;queueRelayout();return el}
function markDirty(id){dirty[id]=1;queueRelayout()}
function updateNode(id,state,extra){
  var el=ensureNode(id);
  el.className='agentry-node is-'+state;
  var st=el.querySelector('.agentry-node__state'),lbl=el.querySelector('.agentry-node__statelabel');
  if(extra&&extra.looping){st.setAttribute('data-state','running');lbl.textContent='Looping\\u2026'}
  else{st.setAttribute('data-state',state);lbl.textContent=STATE_LABEL[state]||state}
  if(extra&&extra.agent)el.querySelector('.agentry-node__agent').textContent=extra.agent;
  if(extra&&extra.output){var o=el.querySelector('.agentry-node__output');o.textContent=extra.output;o.style.display='block'}
  if(extra&&extra.ms!==undefined)el.querySelector('.agentry-node__timing').textContent=extra.ms+' ms';
  if(extra&&extra.iteration&&extra.iteration>1){var it=el.querySelector('.agentry-node__iter');it.textContent='Iteration '+extra.iteration;it.style.display='block'}
  markDirty(id)}
function addWarn(id,text){
  var el=ensureNode(id),list=warnMap[id]||(warnMap[id]=[]);
  if(list.indexOf(text)<0)list.push(text);
  var w=el.querySelector('.agentry-node__warn');w.textContent='\\u26a0 '+list.join(' \\u00b7 ');w.style.display='block';
  markDirty(id)}
function resetCanvas(){for(var id in nodeMap)nodeMap[id].remove();nodeMap={};warnMap={};heights={};dirty={};structureDirty=true}
var es=new EventSource('/events?view=panel');
es.onmessage=function(e){
  var d=JSON.parse(e.data);
  if(d.type==='panel.theme'){if(d.lastByMode)themeState.lastByMode=d.lastByMode;applyTheme(d.theme);return}
  if(d.type==='run.started'){
    statusEl.textContent='Running: '+d.workflow+' ('+d.runId+')';document.title=d.workflow+' \\u2014 Agentry';resumeBtn.style.display='none';resetCanvas();
    layout=d.deps?{ids:d.nodeIds,deps:d.deps,layers:computeLayers(d.nodeIds,d.deps)}:null;
    (d.nodeIds||[]).forEach(function(id){ensureNode(id)});queueRelayout()}
  if(d.type==='node.state')updateNode(d.nodeId,d.state,d);
  if(d.type==='node.output')updateNode(d.nodeId,'done',{output:d.chunk});
  if(d.type==='run.finished'){statusEl.textContent='Finished: '+d.status;if(d.status!=='ok')resumeBtn.style.display='inline-flex'}
  if(d.type==='schema.warning')(d.warnings||[]).forEach(function(w){addWarn(d.nodeId,w)});
  if(d.type==='select.fallback')addWarn(d.nodeId,d.reason==='unparseable'?'filter on '+d.from+' bypassed: output was not JSON, passed whole':'filter on '+d.from+': '+(d.missing||[]).join(', ')+' missing')};
</script></body></html>`
}

// D15: the panel serves this machine only. Browsers may call it from the editor — the Tauri
// webview (tauri://localhost on macOS/Linux; http://tauri.localhost on Windows, https:// with
// useHttpsScheme) or a local dev server — and from the panel page itself; every other Origin
// is refused, and so is a non-loopback Host header (DNS rebinding onto 127.0.0.1).
const TAURI_ORIGINS = new Set(["tauri://localhost", "http://tauri.localhost", "https://tauri.localhost"])
const LOOPBACK_ORIGIN = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i
const LOOPBACK_HOST = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i

const isAllowedOrigin = (origin: string) => TAURI_ORIGINS.has(origin.toLowerCase()) || LOOPBACK_ORIGIN.test(origin)

function readBody(req: http.IncomingMessage, limit = 4096): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ""
    req.setEncoding("utf8")
    req.on("data", (chunk: string) => {
      body += chunk
      if (body.length > limit) {
        reject(new Error("body too large"))
        req.destroy()
      }
    })
    req.on("end", () => resolve(body))
    req.on("error", reject)
  })
}

function sendJson(res: http.ServerResponse, status: number, headers: Record<string, string>, payload: unknown) {
  res.writeHead(status, { ...headers, "Content-Type": "application/json" })
  res.end(JSON.stringify(payload))
}

const RUN_BODY_LIMIT = 1024 * 1024 // a trigger event can carry several mail bodies

// POST /api/run {workflow, input?} — how agentry-watch (or the editor) starts a run without a
// model in the loop. Answers 202 + runId at once; progress streams on /events as usual.
// Needs the per-server token from panel.json: the Origin/Host gate above still lets any page
// served from localhost through, and a run can drive agents that edit files and run commands.
async function handleRunRequest(req: http.IncomingMessage, res: http.ServerResponse, cors: Record<string, string>): Promise<void> {
  if (!runToken || req.headers["x-agentry-token"] !== runToken) {
    sendJson(res, 401, cors, { ok: false, error: "missing or wrong X-Agentry-Token (it is in .agentry/panel.json)" })
    return
  }
  if (!runHost) {
    sendJson(res, 503, cors, { ok: false, error: "plugin not initialised" })
    return
  }
  let body: { workflow?: unknown; input?: unknown }
  try {
    body = JSON.parse(await readBody(req, RUN_BODY_LIMIT)) as typeof body
  } catch {
    sendJson(res, 400, cors, { ok: false, error: "body must be JSON {workflow, input?}" })
    return
  }
  if (typeof body.workflow !== "string" || (body.input !== undefined && typeof body.input !== "string")) {
    sendJson(res, 400, cors, { ok: false, error: "workflow (path) must be a string, input (if any) a string" })
    return
  }
  if (runInProgress) {
    sendJson(res, 409, cors, { ok: false, error: "busy", runId: lastRunId })
    return
  }
  const loaded = loadWorkflowFile(runHost.directory, body.workflow)
  if (!loaded.ok) {
    sendJson(res, 400, cors, { ok: false, error: loaded.error })
    return
  }
  const runId = `run_${Date.now()}`
  runWorkflow(runHost.client, runHost.directory, loaded.workflow, { runId, input: body.input }).then(
    (summary) => log("info", `api run ${runId} done\n${summary}`),
    (err: unknown) => {
      log("error", `api run ${runId} failed: ${errorMessage(err)}`)
      emitPanel({ type: "run.finished", runId, status: "error", at: ts() })
    },
  )
  sendJson(res, 202, cors, { ok: true, runId })
}

async function handlePanelRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const host = req.headers.host
  const origin = req.headers.origin
  if (!host || !LOOPBACK_HOST.test(host) || (origin !== undefined && !isAllowedOrigin(origin))) {
    res.writeHead(403, { "Content-Type": "text/plain" })
    res.end("forbidden")
    return
  }
  const cors: Record<string, string> = origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}
  if (req.method === "OPTIONS") {
    res.writeHead(204, { ...cors, "Access-Control-Allow-Methods": "GET, POST", "Access-Control-Allow-Headers": "Content-Type, X-Agentry-Token", "Access-Control-Max-Age": "600" })
    res.end()
    return
  }
  const { pathname: url, searchParams } = new URL(req.url ?? "/", "http://127.0.0.1")
  if (url === "/events") {
    res.writeHead(200, { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" })
    for (const event of sseReplayBuffer) {
      try { res.write(`data: ${JSON.stringify(event)}\n\n`) } catch {}
    }
    sseClients.add(res)
    const isPanelPage = searchParams.get("view") === "panel"
    if (isPanelPage) panelPageClients.add(res)
    req.on("close", () => {
      sseClients.delete(res)
      panelPageClients.delete(res)
    })
    return
  }
  if (url === "/health") {
    // Identity probe for the App's liveness check: lets a browser client tell this panel
    // apart from a foreign process squatting a reused port after a stale panel.json.
    // Side-effect free; runId is "" before any run exists (same placeholder as panel.json).
    sendJson(res, 200, cors, { app: "agentry", port: panelPort, runId: lastRunId, pid: process.pid, busy: runInProgress })
    return
  }
  if (url === "/api/run" && req.method === "POST") {
    await handleRunRequest(req, res, cors)
    return
  }
  if (url === "/api/theme" && req.method === "POST") {
    let theme: unknown
    try { theme = (JSON.parse(await readBody(req)) as { theme?: unknown }).theme } catch {}
    const ok = typeof theme === "string" && setPanelTheme(theme)
    sendJson(res, ok ? 200 : 400, cors, ok ? { ok: true, theme: panelTheme } : { ok: false, error: "unknown theme" })
    return
  }
  if (url === "/api/stop" && req.method === "POST") {
    abortFlag = true
    sendJson(res, 200, cors, { ok: true })
    return
  }
  if (url.startsWith("/api/rerun/") && req.method === "POST") {
    rerunNodeId = decodeURIComponent(url.slice("/api/rerun/".length))
    sendJson(res, 200, cors, { ok: true, rerun: rerunNodeId })
    return
  }
  if (url === "/api/resume" && req.method === "POST") {
    if (runInProgress) {
      sendJson(res, 409, cors, { ok: false, error: "Run already in progress" })
      return
    }
    if (lastClient && lastWorkflow && lastRunId) {
      runWorkflow(lastClient, lastDirectory, lastWorkflow, { resumeRunId: lastRunId }).catch((err: unknown) => {
        log("error", `resume failed: ${errorMessage(err)}`)
        emitPanel({ type: "run.finished", runId: lastRunId, status: "error", at: ts() })
      })
      sendJson(res, 200, cors, { ok: true, resuming: lastRunId })
    } else {
      sendJson(res, 400, cors, { ok: false, error: "No previous run to resume" })
    }
    return
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
  res.end(getPanelHtml())
}

let panelStarting: Promise<number> | null = null

function startPanelServer(directory: string): Promise<number> {
  if (panelServer) {
    // reused for another run: republish the coordinates right away so discovery never
    // depends on the run.started rewrite (D12)
    writePanelFile(directory, lastRunId)
    return Promise.resolve(panelPort)
  }
  // init starts the server and a run may ask again before listen() has called back:
  // share the pending start, or the second call binds a second, orphaned server
  if (panelStarting) return panelStarting
  panelStarting = bindPanelServer(directory).finally(() => { panelStarting = null })
  return panelStarting
}

function bindPanelServer(directory: string): Promise<number> {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      handlePanelRequest(req, res).catch((err: unknown) => {
        log("error", `panel request failed: ${errorMessage(err)}`)
        if (!res.headersSent) res.writeHead(500)
        res.end()
      })
    })
    srv.on("error", (err: unknown) => {
      // listen() can fail (EMFILE, exhausted ephemeral ports, local policy). The panel is
      // best-effort by design (docs/12 D1): degrade to running WITHOUT a panel instead of
      // rejecting — an unsettled promise would wedge runInProgress=true for every future run.
      // resolve(0) = "no panel"; post-listen errors only log (the promise already settled).
      log("warn", `panel server failed: ${errorMessage(err)} — continuing without panel`)
      resolve(0)
    })
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address()
      panelPort = typeof addr === "object" && addr ? addr.port : 0
      panelServer = srv
      runToken = randomUUID()
      writePanelFile(directory, "")
      hookPanelFileExit()
      log("info", `panel server on http://127.0.0.1:${panelPort}`)
      resolve(panelPort)
    })
  })
}

function openBrowser(url: string) {
  const cmd = process.platform === "win32" ? `start "" "${url}"` : process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`
  exec(cmd, () => {})
}

function chromiumCandidates(): string[] {
  const env = process.env
  if (process.platform === "win32") {
    return [
      env["ProgramFiles(x86)"] && path.join(env["ProgramFiles(x86)"], "Microsoft", "Edge", "Application", "msedge.exe"),
      env.ProgramFiles && path.join(env.ProgramFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
      env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
      env.ProgramFiles && path.join(env.ProgramFiles, "Google", "Chrome", "Application", "chrome.exe"),
    ].filter((p): p is string => Boolean(p))
  }
  if (process.platform === "darwin") {
    return ["Google Chrome", "Microsoft Edge", "Chromium"].map((app) => `/Applications/${app}.app/Contents/MacOS/${app}`)
  }
  const bins = ["google-chrome", "chromium", "chromium-browser", "microsoft-edge"]
  return (env.PATH ?? "").split(path.delimiter).filter(Boolean).flatMap((dir) => bins.map((bin) => path.join(dir, bin)))
}

function panelProfileDir(): string {
  const home = os.homedir()
  if (process.platform === "win32") return path.join(process.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local"), "Agentry", "panel-window")
  if (process.platform === "darwin") return path.join(home, "Library", "Application Support", "Agentry", "panel-window")
  return path.join(process.env.XDG_DATA_HOME ?? path.join(home, ".local", "share"), "agentry", "panel-window")
}

// The panel opens as its own app window (Chromium --app: no tabs, no address bar, own taskbar
// entry) instead of a browser tab. Its own profile keeps it out of the user's browser session.
// AGENTRY_PANEL_WINDOW="x,y,width,height" pins the geometry for screen recording, and then also
// keeps the window painting while other windows cover it (Chromium otherwise stops rendering
// occluded windows, and a window capture of it freezes).
function openAppWindow(url: string): boolean {
  const exe = chromiumCandidates().find((p) => fs.existsSync(p))
  if (!exe) return false
  const geometry = /^(-?\d+),(-?\d+),(\d+),(\d+)$/.exec(process.env.AGENTRY_PANEL_WINDOW ?? "")
  const args = [
    `--app=${url}`, `--user-data-dir=${panelProfileDir()}`, "--no-first-run", "--no-default-browser-check",
    ...(geometry
      ? [`--window-position=${geometry[1]},${geometry[2]}`, `--window-size=${geometry[3]},${geometry[4]}`,
         "--disable-features=CalculateNativeWinOcclusion", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding"]
      : ["--window-size=1180,820"]),
  ]
  try {
    const child = spawn(exe, args, { detached: true, stdio: "ignore" })
    child.on("error", (err) => log("warn", `panel window failed: ${errorMessage(err)}`))
    child.unref()
    return true
  } catch (err) {
    log("warn", `panel window failed: ${errorMessage(err)}`)
    return false
  }
}

function showPanelWindow(url: string) {
  if (process.env.AGENTRY_NO_BROWSER || panelPageClients.size > 0) return
  if (!openAppWindow(url)) openBrowser(url)
}

// ── circuit runner ──
interface SelectNotice { consumer: string; from: string; fallback: SelectFallback }

interface NodeResult {
  nodeId: string
  agent: string
  output: string
  ms: number
  schemaWarnings: string[]
  /** `input.select` filters that degraded while this node's prompt was built (D18). */
  notices: SelectNotice[]
  iteration?: number
  error?: string
}

/** One settled node, in completion order — the documenter's raw material (D19). */
interface RunRecord {
  nodeId: string
  state: "done" | "skipped"
  agent?: string
  ms?: number
  iteration?: number
  reason?: string
  warnings?: string[]
}

interface RunCtx {
  client: OpencodeClient
  sessionId: string
  runId: string
  runDir: string
  workflow: Workflow
  outputs: Map<string, string>
  strict: ReadonlySet<string>
  history: RunRecord[]
  /** Log prefix: "" at the top level, "<sub>/" inside a sub-workflow. */
  scope: string
  /** Handed to the entry nodes: the run's input (a trigger event) or, inside a sub-workflow, the sub node's own inputs. */
  inbound?: string
  inboundLabel?: string
  /** Entry nodes wired from the IN port (`input.to`); absent = every node without upstreams. */
  inboundTo?: ReadonlySet<string>
}

const entrySet = (wf: Workflow): ReadonlySet<string> | undefined =>
  wf.input?.to?.length ? new Set(wf.input.to) : undefined

function inboundFor(ctx: RunCtx, nodeId: string, def: AgentDefinition, parents: readonly string[]) {
  if (!ctx.inbound || def.type === "documenter") return undefined
  const isEntry = ctx.inboundTo ? ctx.inboundTo.has(nodeId) : inputSources(def, parents).length === 0
  return isEntry ? { label: ctx.inboundLabel ?? "Workflow input", text: ctx.inbound } : undefined
}

const describeFallback = (f: SelectFallback) =>
  f.reason === "unparseable" ? "output is not JSON — passed WHOLE, unfiltered" : `kept field(s) ${f.missing.join(", ")} missing — passed the rest`

function upstreamContext(def: AgentDefinition, outputs: Map<string, string>, parents: readonly string[]) {
  const notices: Array<{ from: string; fallback: SelectFallback }> = []
  const parts: Array<{ from: string; text: string }> = []
  for (const fromId of inputSources(def, parents)) {
    const upstream = outputs.get(fromId)
    if (!upstream) continue
    const slice = sliceUpstream(upstream, def.input?.select?.[fromId])
    if (slice.fallback) notices.push({ from: fromId, fallback: slice.fallback })
    parts.push({ from: fromId, text: `[${fromId}]:\n${slice.text}` })
  }
  return { parts, notices }
}

function buildPrompt(
  def: AgentDefinition, outputs: Map<string, string>, previousOutput: string | undefined,
  parents: readonly string[], runRecords?: string, inbound?: { label: string; text: string },
): { prompt: string; notices: Array<{ from: string; fallback: SelectFallback }> } {
  let prompt = def.prompt ?? ""
  if (inbound) prompt = `${inbound.label}:\n\n${inbound.text}\n\n---\n\n${prompt}`
  const { parts, notices } = upstreamContext(def, outputs, parents)
  // label the context with the upstream that actually delivered it — after a branch merge
  // (join: any) the first declared source is often the one that was skipped
  const only = parts.length === 1 ? parts[0] : undefined
  if (only) prompt = `Context from "${only.from}":\n\n${only.text}\n\n---\n\n${prompt}`
  else if (parts.length > 1) prompt = `Context from upstream nodes:\n\n${parts.map((p) => p.text).join("\n\n---\n\n")}\n\n===\n\n${prompt}`

  if (previousOutput) prompt = `Your previous attempt (refine based on this):\n\n${previousOutput}\n\n---\n\n${prompt}`
  if (def.input?.extra_info) prompt += `\n\nAdditional context: ${def.input.extra_info}`
  if (runRecords) prompt += `\n\nRun records — every other node of this run, in the order it finished (each node's full record is its <id>.log.md beside the report):\n\n${runRecords}`

  const schema = def.output?.schema ?? {}
  if (Object.keys(schema).length > 0) {
    prompt += `\n\nYou MUST respond with a valid JSON object matching this schema: ${JSON.stringify(schema)}. Return ONLY the raw JSON object — no markdown fences, no extra text.`
  }
  return { prompt, notices }
}

// D19: the documenter reads one compact record per node — instruction, result, output — in
// the order the run settled. Not the raw log.md files: each embeds its full prompt (upstream
// context included), so concatenating them repeats every output once per downstream hop.
function documenterRecords(ctx: RunCtx, selfId: string): string {
  return ctx.history
    .filter((r) => r.nodeId !== selfId)
    .map((r, i) => {
      const def = ctx.workflow.agents[r.nodeId]
      const lines = [`### ${i + 1}. ${r.nodeId}${def?.introduction ? ` — ${def.introduction}` : ""}`]
      if (r.state === "skipped") {
        lines.push(`- Result: skipped (${r.reason ?? "not run"})`)
        return lines.join("\n")
      }
      lines.push(`- Result: done · agent ${r.agent ?? "?"} · ${fmtMs(r.ms ?? 0)}${(r.iteration ?? 1) > 1 ? ` · ${r.iteration} iterations` : ""}`)
      if (r.warnings?.length) lines.push(`- Warnings: ${r.warnings.join("; ")}`)
      if (def?.prompt) lines.push(`- Instruction: ${clip(def.prompt.trim(), 600)}`)
      const output = ctx.outputs.get(r.nodeId)
      if (output) lines.push("- Output:", "```", clip(output.trim(), 3000), "```")
      return lines.join("\n")
    })
    .join("\n\n")
}

const titleCase = (key: string) => key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

/** The whole-run report: a deterministic step table + the documenter's narrative (D19). */
function renderRunReport(ctx: RunCtx, docId: string, docOutput: string, schema: Record<string, string>): string {
  const lines = [
    `# Run report — ${ctx.workflow.introduction}`, "",
    `- **Run**: \`${ctx.runId}\``,
    `- **Written**: ${ts()} by \`${docId}\``, "",
    "## Steps", "",
    "| # | Node | Agent | Result | Time |",
    "|---|---|---|---|---|",
  ]
  ctx.history.filter((r) => r.nodeId !== docId).forEach((r, i) => {
    const result = r.state === "skipped" ? `skipped — ${r.reason ?? "not run"}` : (r.iteration ?? 1) > 1 ? `done (${r.iteration} iterations)` : "done"
    lines.push(`| ${i + 1} | \`${r.nodeId}\` | ${r.agent ?? "—"} | ${result} | ${r.ms !== undefined ? fmtMs(r.ms) : "—"} |`)
  })
  lines.push("")
  const parsed = extractJson(docOutput)
  if (!parsed) {
    lines.push("## Report", "", docOutput.trim(), "")
    return lines.join("\n")
  }
  const keys = [...Object.keys(schema).filter((k) => k in parsed), ...Object.keys(parsed).filter((k) => !(k in schema))]
  for (const key of keys) {
    const value = parsed[key]
    lines.push(`## ${titleCase(key)}`, "")
    if (Array.isArray(value)) lines.push(...(value.length ? value.map((v) => `- ${typeof v === "string" ? v : JSON.stringify(v)}`) : ["_None._"]))
    else if (typeof value === "string") lines.push(value.trim())
    else lines.push("```json", JSON.stringify(value, null, 2), "```")
    lines.push("")
  }
  return lines.join("\n")
}

function runSubWorkflowBlackBox(nodeId: string, def: AgentDefinition, runDir: string, iter: number): NodeResult {
  const inner = def.tech_stack?.workflow?.introduction ?? "(inlined workflow)"
  const output = JSON.stringify({ sub_workflow: inner, expanded: false })
  fs.writeFileSync(path.join(runDir, outputFileName(nodeId)),
    JSON.stringify({ nodeId, agent: "sub-workflow", result: output, elapsed_ms: 0, iteration: iter, schemaWarnings: [] }, null, 2))
  fs.writeFileSync(path.join(runDir, logFileName(nodeId)),
    [`# ${nodeId}`, `- **Type**: sub-workflow (black box — inner workflow missing/invalid)`, `- **Inlined**: ${inner}`, "", "## Output", output].join("\n"))
  return { nodeId, agent: "sub-workflow", output, ms: 0, schemaWarnings: [], notices: [], iteration: iter }
}

// Run a sub-workflow node by recursing its inlined `tech_stack.workflow` (doc 10 §6.2) through
// the SAME scheduler as the top level (D8), so inner branch routing, trigger.when, loops and
// join all apply. Scoped like its own workflow: nested run dir, its own strict-JSON set and
// documenter; inner nodes stay off the parent canvas (the sub node is one hexagon there), so
// their events are dropped except degraded filters and schema warnings, which surface on the
// sub node. A loop or gate on the sub node itself still re-runs / skips the inner graph whole.
async function runSubWorkflow(ctx: RunCtx, dagNode: DagNode, iter: number): Promise<NodeResult> {
  const { id: nodeId, def } = dagNode
  const inner: unknown = def.tech_stack?.workflow
  if (!isObj(inner)) return runSubWorkflowBlackBox(nodeId, def, ctx.runDir, iter)
  const check = checkRunnable(inner)
  if (!check.ok) return { nodeId, agent: "sub-workflow", output: "", ms: 0, schemaWarnings: [], notices: [], iteration: iter, error: `sub-workflow invalid: ${check.errors.join("; ")}` }
  const innerWf = check.workflow

  const subDir = path.join(ctx.runDir, nodeId)
  fs.mkdirSync(subDir, { recursive: true })
  const dag = buildDag(innerWf)
  const own = upstreamContext(def, ctx.outputs, dagNode.branchParents)
  const inbound = [...own.parts.map((p) => p.text), ...(def.input?.extra_info ? [`Additional context: ${def.input.extra_info}`] : [])].join("\n\n---\n\n")
  const innerCtx: RunCtx = {
    ...ctx, runDir: subDir, workflow: innerWf, outputs: new Map(), strict: strictJsonNodes(innerWf), history: [],
    scope: `${ctx.scope}${nodeId}/`, inbound: inbound || undefined, inboundLabel: "Context from the parent workflow", inboundTo: entrySet(innerWf),
  }
  const st = newGraphState(dag.order)
  const notices: SelectNotice[] = own.notices.map((n) => ({ consumer: nodeId, ...n }))
  const t0 = Date.now()
  const outcome = await runGraph(innerCtx, dag, st, {
    emit: (event) => {
      if (event.type !== "select.fallback") return
      const fallback: SelectFallback = event.reason === "missing-fields" ? { reason: "missing-fields", missing: event.missing ?? [] } : { reason: "unparseable" }
      notices.push({ consumer: nodeId, from: `${event.from} → ${event.nodeId}`, fallback })
    },
    persist: () => {},
    takeRerun: () => null,
  })
  const schemaWarnings = st.schemaWarnings.map((w) => `${nodeId}/${w}`)
  const ms = Date.now() - t0
  if (outcome.status !== "ok") {
    const error = outcome.status === "failed" ? `sub-workflow "${nodeId}" failed at ${outcome.first.nodeId}: ${outcome.first.error}`
      : outcome.status === "deadlock" ? `sub-workflow "${nodeId}" deadlock (${outcome.stuck} node(s) stuck)`
      : `sub-workflow "${nodeId}" stopped by user`
    return { nodeId, agent: "sub-workflow", output: "", ms, schemaWarnings, notices, iteration: iter, error }
  }

  const lastId = dag.order[dag.order.length - 1]
  const froms: string[] = innerWf.output.from ?? (lastId ? [lastId] : [])
  const merged: Record<string, unknown> = {}
  for (const f of froms) {
    const out = innerCtx.outputs.get(f)
    if (out === undefined) continue // skipped inside (e.g. an untaken branch port) — contributes nothing
    const parsed = extractJson(out)
    if (parsed) Object.assign(merged, parsed); else merged[f] = out
  }
  const output = JSON.stringify(merged)
  const innerRun = innerCtx.history.map((r) => `- \`${r.nodeId}\`: ${r.state === "skipped" ? `skipped — ${r.reason ?? "not run"}` : `done${(r.iteration ?? 1) > 1 ? ` (${r.iteration} iterations)` : ""}`}`)
  fs.writeFileSync(path.join(ctx.runDir, outputFileName(nodeId)),
    JSON.stringify({ nodeId, agent: "sub-workflow", result: output, elapsed_ms: ms, iteration: iter, schemaWarnings }, null, 2))
  fs.writeFileSync(path.join(ctx.runDir, logFileName(nodeId)),
    [`# ${nodeId}`, `- **Type**: sub-workflow`, `- **Inner**: ${innerWf.introduction || "(inlined)"}`, `- **Artifacts**: ${nodeId}/`, "", "## Inner run", ...innerRun, "", "## Output", output].join("\n"))
  return { nodeId, agent: "sub-workflow", output, ms, schemaWarnings, notices, iteration: iter }
}

async function callAgent(client: OpencodeClient, sessionId: string, agent: string, text: string): Promise<string> {
  const result = await client.session.prompt({ path: { id: sessionId }, body: { agent, parts: [{ type: "text", text }] } })
  return extractText(result.data?.parts ?? result.parts ?? [])
}

async function runSingleNode(ctx: RunCtx, dagNode: DagNode, iter: number, previousOutput?: string): Promise<NodeResult> {
  const { id: nodeId, def } = dagNode
  if (def.type === "sub-workflow") return runSubWorkflow(ctx, dagNode, iter)

  const mapped = def.agent_mapping?.opencode ?? ""
  let agent: string
  try {
    agent = await resolveAgent(ctx.client, mapped)
  } catch (err) {
    return { nodeId, agent: mapped || "unknown", output: "", ms: 0, schemaWarnings: [], notices: [], iteration: iter, error: errorMessage(err) }
  }

  const records = def.type === "documenter" ? documenterRecords(ctx, nodeId) : undefined
  const built = buildPrompt(def, ctx.outputs, previousOutput, dagNode.branchParents, records, inboundFor(ctx, nodeId, def, dagNode.branchParents))
  const prompt = built.prompt
  const notices = built.notices.map((n) => ({ consumer: nodeId, ...n }))
  for (const n of notices) log("warn", `select ${n.from} → ${nodeId}: ${describeFallback(n.fallback)}`)

  const schema = def.output?.schema ?? {}
  const strictJson = ctx.strict.has(nodeId) && Object.keys(schema).length > 0
  const t0 = Date.now()

  try {
    // One child session per node call: nodes of a wave prompt concurrently, and on a shared
    // session they read back each other's (or empty) replies. Upstream context travels in the
    // prompt, so nothing relies on session memory; the parent keeps them grouped per run.
    const session = await ctx.client.session.create({
      body: { title: `${ctx.scope}${nodeId}${iter > 1 ? ` (iter ${iter})` : ""}`, parentID: ctx.sessionId },
    })
    const nodeSession = session.data.id
    let outputText = await callAgent(ctx.client, nodeSession, agent, prompt)
    // Strict nodes gate control flow (branch_on / input.select): one same-session repair pass if
    // the reply holds no JSON object. JSON is asked for in the prompt, never via opencode's
    // `format`: that forces tool_choice "required", which models such as Claude Opus 5.5 reject —
    // every strict call failed with an API error the TUI shows, before this retry answered it.
    if (strictJson && !extractJson(outputText)) {
      try {
        outputText = await callAgent(ctx.client, nodeSession, agent,
          `Return ONLY a raw JSON object matching this schema: ${JSON.stringify(schema)}. No prose, no code fences. Your prior output was:\n${outputText}`)
      } catch {}
    }
    const ms = Date.now() - t0
    const schemaWarnings = validateOutput(nodeId, outputText, schema)
    if (def.type === "documenter") fs.writeFileSync(path.join(ctx.runDir, REPORT_FILE), renderRunReport(ctx, nodeId, outputText, schema))

    const iterLabel = iter > 1 ? ` (iter ${iter})` : ""
    fs.writeFileSync(path.join(ctx.runDir, outputFileName(nodeId)),
      JSON.stringify({ nodeId, agent, result: outputText, elapsed_ms: ms, iteration: iter, schemaWarnings }, null, 2))
    fs.writeFileSync(path.join(ctx.runDir, logFileName(nodeId)),
      [`# ${nodeId}${iterLabel}`, `- **Agent**: ${agent}`, `- **Elapsed**: ${ms} ms`, `- **Iteration**: ${iter}`,
       ...(schemaWarnings.length > 0 ? [`- **Schema warnings**: ${schemaWarnings.join("; ")}`] : []),
       ...(notices.length > 0 ? ["", "## Filter notices", ...notices.map((n) => `- \`${n.from}\` → \`${nodeId}\`: ${describeFallback(n.fallback)}`)] : []),
       "", "## Prompt", "```", prompt, "```", "", "## Output", outputText].join("\n"))

    return { nodeId, agent, output: outputText, ms, schemaWarnings, notices, iteration: iter }
  } catch (err) {
    return { nodeId, agent, output: "", ms: Date.now() - t0, schemaWarnings: [], notices, iteration: iter, error: errorMessage(err) }
  }
}

function selectFallbackEvent(runId: string, nodeId: string, notice: SelectNotice): WorkflowEvent {
  const { fallback } = notice
  return {
    type: "select.fallback", runId, nodeId, from: notice.from, reason: fallback.reason,
    ...(fallback.reason === "missing-fields" ? { missing: fallback.missing } : {}),
    at: ts(),
  }
}

// Lint codes that change what a run does; the rest are editor-side hygiene.
const RUNTIME_LINT = new Set([
  "join-all-over-branch", "branch-extra-default", "branch-field-missing", "branch-on-missing",
  "select-unknown-source", "select-field-unknown",
])

type Dag = ReturnType<typeof buildDag>

interface GraphState {
  nodeStates: Record<string, NodeState>
  completedOrder: string[]
  skippedOrder: string[]
  iterations: Record<string, number>
  timings: Array<{ nodeId: string; agent: string; ms: number; iteration?: number }>
  schemaWarnings: string[]
}

const newGraphState = (order: readonly string[]): GraphState => ({
  nodeStates: Object.fromEntries(order.map((id) => [id, "pending" as NodeState])),
  completedOrder: [], skippedOrder: [], iterations: {}, timings: [], schemaWarnings: [],
})

// The only differences between the top-level run and a nested sub-workflow run: the top level
// talks to the panel, writes the checkpoint and takes the panel's "Rerun" requests.
interface GraphHooks {
  emit(event: WorkflowEvent): void
  persist(): void
  takeRerun(): string | null
}

type GraphOutcome =
  | { status: "ok" }
  | { status: "cancelled" }
  | { status: "deadlock"; stuck: number }
  | { status: "failed"; first: NodeResult }

// The scheduler, shared by the top level and every sub-workflow (D8): waves of ready nodes run in
// parallel; join, trigger gates, loops and branch routing with skip propagation all apply here.
async function runGraph(ctx: RunCtx, dag: Dag, st: GraphState, hooks: GraphHooks): Promise<GraphOutcome> {
  const { runId } = ctx
  const emit = hooks.emit
  const completed = new Set(st.completedOrder)
  const skipped = new Set(st.skippedOrder)
  const settled = new Set([...completed, ...skipped])
  const pending = new Set(dag.order.filter((id) => !settled.has(id)))

  const markSkipped = (id: string, reason: string) => {
    skipped.add(id); settled.add(id); pending.delete(id)
    st.nodeStates[id] = "skipped"; st.skippedOrder.push(id)
    ctx.history.push({ nodeId: id, state: "skipped", reason })
    emit({ type: "node.state", runId, nodeId: id, state: "skipped", at: ts() })
    log("info", `node.state ${ctx.scope}${id} skipped (${reason})`)
  }

  const isReady = (id: string): boolean => {
    const node = dag.nodes.get(id)!
    if (joinMode(node.def) === "all") return node.upstream.every((d) => settled.has(d))
    // join: any (D4) — ordering deps (trigger gate, documenter) still settle first; the data
    // deps fire the node on the first one that is DONE. A skipped upstream is settled but
    // delivered nothing, so it must not fire it (it used to: some(settled)).
    const ordering = node.upstream.filter((d) => !node.sources.includes(d))
    return ordering.every((d) => settled.has(d)) && (node.sources.length === 0 || node.sources.some((s) => completed.has(s)))
  }

  while (pending.size > 0) {
    if (abortFlag) {
      hooks.persist()
      return { status: "cancelled" }
    }

    const target = hooks.takeRerun()
    if (target && dag.nodes.has(target)) {
      const toReset = new Set([target, ...findDownstream(target, dag)])
      for (const id of toReset) {
        completed.delete(id); skipped.delete(id); settled.delete(id)
        pending.add(id); ctx.outputs.delete(id)
        st.nodeStates[id] = "pending"
        delete st.iterations[id]
        emit({ type: "node.state", runId, nodeId: id, state: "pending", at: ts() })
      }
      const kept = (list: string[]) => list.filter((c) => !toReset.has(c))
      st.completedOrder.splice(0, st.completedOrder.length, ...kept(st.completedOrder))
      st.skippedOrder.splice(0, st.skippedOrder.length, ...kept(st.skippedOrder))
      ctx.history.splice(0, ctx.history.length, ...ctx.history.filter((r) => !toReset.has(r.nodeId)))
      hooks.persist()
      log("info", `rerun: reset ${[...toReset].join(", ")}`)
      continue
    }

    // a join: any node whose every input ended up skipped can never fire — skip it, don't deadlock
    for (const id of [...pending]) {
      const node = dag.nodes.get(id)!
      if (joinMode(node.def) === "any" && node.sources.length > 0 && node.sources.every((s) => skipped.has(s))) {
        markSkipped(id, "every upstream was skipped (join: any)")
      }
    }
    if (pending.size === 0) break

    const ready = [...pending].filter(isReady)
    if (ready.length === 0) return { status: "deadlock", stuck: pending.size }

    const toRun: string[] = []
    for (const id of ready) {
      if (gateUnmet(dag.nodes.get(id)!.def, ctx.outputs, skipped)) markSkipped(id, "trigger.when not met")
      else toRun.push(id)
    }

    if (toRun.length === 0) {
      hooks.persist()
      continue
    }

    for (const id of toRun) {
      const a = dag.nodes.get(id)!.def.agent_mapping?.opencode ?? "sub-workflow"
      const iter = (st.iterations[id] ?? 0) + 1
      st.nodeStates[id] = "running"
      emit({ type: "node.state", runId, nodeId: id, state: "running", agent: a, iteration: iter, at: ts() })
      log("info", `node.state ${ctx.scope}${id} running (${a}, iter ${iter})`)
    }
    hooks.persist()

    const branchSkipSeed = new Set<string>()
    const doneThisWave: string[] = []
    const failedThisWave: NodeResult[] = []
    const wave = await Promise.allSettled(
      toRun.map((id) => {
        const iter = (st.iterations[id] ?? 0) + 1
        const prevOut = st.iterations[id] ? ctx.outputs.get(id) : undefined
        return runSingleNode(ctx, dag.nodes.get(id)!, iter, prevOut)
      })
    )

    for (const s of wave) {
      const r: NodeResult = s.status === "fulfilled"
        ? s.value
        : { nodeId: "unknown", agent: "unknown", output: "", ms: 0, schemaWarnings: [], notices: [], error: errorMessage(s.reason) }

      const iter = r.iteration ?? 1
      st.timings.push({ nodeId: `${ctx.scope}${r.nodeId}`, agent: r.agent, ms: r.ms, iteration: iter })
      st.iterations[r.nodeId] = iter
      // D18: a degraded select filter is reported, never silent — even if the node then failed
      for (const notice of r.notices) emit(selectFallbackEvent(runId, r.nodeId, notice))

      if (r.error) {
        // don't return mid-wave: sibling results after this one genuinely finished (their
        // outputs are already on disk) — bailing here would leave them shown as "running"
        // forever and make resume re-run them. Record the failure, keep processing the
        // rest of the wave, fail after the loop (first error still decides the outcome).
        st.nodeStates[r.nodeId] = "failed"
        failedThisWave.push(r)
        continue
      }

      ctx.outputs.set(r.nodeId, r.output)

      const def = dag.nodes.get(r.nodeId)!.def
      const loop = def.trigger?.loop
      const loopContinue = loop
        && iter < (loop.max ?? 3)
        && loop.exit_when && !matchesCondition(r.output, loop.exit_when)

      if (loopContinue) {
        st.nodeStates[r.nodeId] = "pending"
        emit({ type: "node.state", runId, nodeId: r.nodeId, state: "done", ms: r.ms, iteration: iter, looping: true, at: ts() })
        log("info", `node ${ctx.scope}${r.nodeId} loop iter ${iter} — re-queuing`)
      } else {
        completed.add(r.nodeId); settled.add(r.nodeId); pending.delete(r.nodeId)
        st.nodeStates[r.nodeId] = "done"; st.completedOrder.push(r.nodeId); doneThisWave.push(r.nodeId)
        ctx.history.push({ nodeId: r.nodeId, state: "done", agent: r.agent, ms: r.ms, iteration: iter, warnings: r.schemaWarnings })
        const chunk = r.output.length > 300 ? r.output.slice(0, 300) + "…" : r.output
        emit({ type: "node.output", runId, nodeId: r.nodeId, chunk, at: ts() })
        emit({ type: "node.state", runId, nodeId: r.nodeId, state: "done", ms: r.ms, iteration: iter, at: ts() })
        log("info", `node.state ${ctx.scope}${r.nodeId} done (${r.ms}ms, iter ${iter})`)

        if (def.type === "branch" && def.branch_on) {
          // D16: exactly one port — the first matching route in routes[] order, else the default
          const value = extractJson(r.output)?.[def.branch_on]
          const routes = def.routes ?? []
          const taken = pickBranchRoute(routes, value)
          for (const rt of routes) if (rt.to !== taken?.to) branchSkipSeed.add(rt.to)
          emit({ type: "node.output", runId, nodeId: r.nodeId, chunk: `↳ routed on ${def.branch_on}=${JSON.stringify(value)} → ${taken ? taken.to : "(no port matched)"}`, at: ts() })
          log("info", `branch ${ctx.scope}${r.nodeId} on ${def.branch_on}=${JSON.stringify(value)} → ${taken ? taken.to : "none"}`)
        }
      }

      st.schemaWarnings.push(...r.schemaWarnings)
      if (r.schemaWarnings.length > 0) {
        emit({ type: "schema.warning", runId, nodeId: r.nodeId, warnings: r.schemaWarnings, at: ts() })
      }
    }

    if (failedThisWave.length > 0) {
      if (abortFlag) {
        // stopped mid-wave (e.g. a sub-workflow aborted): not a failure — leave those nodes for resume
        for (const f of failedThisWave) {
          st.nodeStates[f.nodeId] = "pending"
          emit({ type: "node.state", runId, nodeId: f.nodeId, state: "pending", at: ts() })
        }
        hooks.persist()
        return { status: "cancelled" }
      }
      hooks.persist()
      // checkpoint (docs/12 D3): nodes completed this wave are in the save above,
      // durably resumable-past — announce them even though the run is about to fail
      for (const id of doneThisWave) emit({ type: "checkpoint", runId, nodeId: id, at: ts() })
      for (const f of failedThisWave) emit({ type: "node.state", runId, nodeId: f.nodeId, state: "failed", at: ts() })
      return { status: "failed", first: failedThisWave[0]! }
    }

    if (branchSkipSeed.size > 0) {
      let changed = true
      while (changed) {
        changed = false
        for (const id of [...pending]) {
          const reason = branchSkipReason(dag.nodes.get(id)!, branchSkipSeed, skipped)
          if (!reason) continue
          branchSkipSeed.add(id)
          markSkipped(id, reason)
          changed = true
        }
      }
    }

    hooks.persist()
    // checkpoint (docs/12 D3): emitted only after the durable write above, one per node that
    // reached "done" this wave — so "resumable position" is never announced before it exists
    for (const id of doneThisWave) emit({ type: "checkpoint", runId, nodeId: id, at: ts() })

    // handoff (docs/12 D3): one per delivered input of each node about to run — the edge-flow data
    for (const id of [...pending].filter(isReady)) {
      for (const src of dag.nodes.get(id)!.sources) if (completed.has(src)) emit({ type: "handoff", runId, from: src, to: id, at: ts() })
    }
  }
  return { status: "ok" }
}

interface RunOptions {
  resumeRunId?: string
  /** Pre-assigned id, so a caller that gets the reply before the run ends can name it (POST /api/run). */
  runId?: string
  /** Handed to the entry nodes — what started the run (a trigger event). Kept as input.txt so a resume sees it too. */
  input?: string
}

const INPUT_FILE = "input.txt"

async function runWorkflow(client: OpencodeClient, directory: string, wf: Workflow, opts: RunOptions = {}): Promise<string> {
  if (runInProgress) throw new Error("A run is already in progress - stop it first")
  runInProgress = true
  try {
  const { resumeRunId } = opts
  agentCache = null
  abortFlag = false
  rerunNodeId = null
  lastClient = client; lastDirectory = directory; lastWorkflow = wf
  designTokensCss = loadDesignTokens(directory)
  const dag = buildDag(wf)
  const runId = resumeRunId ?? opts.runId ?? `run_${Date.now()}`
  const runDir = path.join(directory, RUN_DIR_ROOT, runId)
  fs.mkdirSync(runDir, { recursive: true })
  const inputPath = path.join(runDir, INPUT_FILE)
  let input = opts.input
  if (input !== undefined) fs.writeFileSync(inputPath, input)
  else if (resumeRunId && fs.existsSync(inputPath)) input = fs.readFileSync(inputPath, "utf-8")

  const prior = resumeRunId ? loadCheckpoint(runDir) : null
  const st: GraphState = prior
    ? { ...newGraphState(dag.order), nodeStates: prior.nodes, completedOrder: [...prior.completed], skippedOrder: [...(prior.skipped ?? [])], iterations: { ...(prior.iterations ?? {}) } }
    : newGraphState(dag.order)
  const persist = () => saveCheckpoint(runDir, {
    runId, workflow: wf.introduction, nodes: st.nodeStates, completed: st.completedOrder, skipped: st.skippedOrder, iterations: st.iterations, updatedAt: ts(),
  })
  if (!prior) persist()

  const settledBefore = new Set([...st.completedOrder, ...st.skippedOrder])
  if (dag.order.every((id) => settledBefore.has(id))) return `Run ${runId}: all nodes already completed.`

  const port = await startPanelServer(directory)
  // port 0 = panel couldn't start (best-effort, see startPanelServer): run headless —
  // skip the browser, and writePanelFile publishes nothing so no dead port is advertised.
  // AGENTRY_NO_BROWSER keeps the panel up but unopened (CI, tests, headless hosts).
  const panelUrl = port ? `http://127.0.0.1:${port}` : "(panel unavailable)"
  if (port) showPanelWindow(panelUrl)

  // A documenter waits for every node, but drawing that as N edges buries the canvas. For
  // display its ordering deps shrink to the sinks (nodes nothing else waits on) — the same
  // order transitively, one edge per terminal path.
  const waitedOn = new Set([...dag.nodes.values()].filter((n) => n.def.type !== "documenter").flatMap((n) => n.upstream))
  const deps: Record<string, string[]> = {}
  for (const [id, node] of dag.nodes) {
    deps[id] = node.def.type === "documenter"
      ? node.upstream.filter((d) => node.sources.includes(d) || !waitedOn.has(d))
      : [...node.upstream]
  }
  lastRunId = runId
  writePanelFile(directory, runId) // refresh discovery file with the real runId (docs/12 D1)
  emitPanel({ type: "run.started", runId, workflow: wf.introduction, nodeIds: dag.order, deps, at: ts() })
  log("info", `run.started ${runId} | panel: ${panelUrl}`)

  const sess = await client.session.create({ body: { title: `Agentry: ${wf.introduction} (${runId})` } })
  const ctx: RunCtx = {
    client, sessionId: sess.data.id, runId, runDir, workflow: wf,
    outputs: new Map(), strict: strictJsonNodes(wf), history: [], scope: "",
    inbound: input || undefined, inboundLabel: "Workflow input", inboundTo: entrySet(wf),
  }

  // resume: rebuild outputs + the documenter's record of nodes settled in an earlier session
  for (const doneId of st.completedOrder) {
    try {
      const d: unknown = JSON.parse(fs.readFileSync(path.join(runDir, outputFileName(doneId)), "utf-8"))
      if (!isObj(d)) continue
      if (typeof d.result === "string" && d.result) ctx.outputs.set(doneId, d.result)
      ctx.history.push({
        nodeId: doneId, state: "done",
        agent: typeof d.agent === "string" ? d.agent : undefined,
        ms: typeof d.elapsed_ms === "number" ? d.elapsed_ms : undefined,
        iteration: typeof d.iteration === "number" ? d.iteration : undefined,
      })
    } catch {}
  }
  for (const id of st.skippedOrder) ctx.history.push({ nodeId: id, state: "skipped", reason: "skipped earlier in this run" })

  const outcome = await runGraph(ctx, dag, st, {
    emit: emitPanel,
    persist,
    takeRerun: () => {
      const target = rerunNodeId
      rerunNodeId = null
      return target
    },
  })
  if (outcome.status === "cancelled") {
    emitPanel({ type: "run.finished", runId, status: "cancelled", at: ts() })
    return `Run ${runId} STOPPED by user. Resume: ${runId}`
  }
  if (outcome.status === "deadlock") {
    emitPanel({ type: "run.finished", runId, status: "error", at: ts() })
    return `Run ${runId} DEADLOCK: ${outcome.stuck} node(s) stuck — check for circular dependencies.`
  }
  if (outcome.status === "failed") {
    emitPanel({ type: "run.finished", runId, status: "error", at: ts() })
    return `Run ${runId} FAILED at "${outcome.first.nodeId}" (${outcome.first.agent}): ${outcome.first.error}`
  }

  emitPanel({ type: "run.finished", runId, status: "ok", at: ts() })
  log("info", `run.finished ${runId} ok | panel: ${panelUrl}`)

  const completed = new Set(st.completedOrder)

  const documenter = dag.order.find((id) => dag.nodes.get(id)!.def.type === "documenter" && completed.has(id))
  const lint = lintWorkflow(wf).filter((issue) => RUNTIME_LINT.has(issue.code))
  return [
    "=== WORKFLOW RUN COMPLETE ===", "",
    `Workflow : ${wf.introduction}`,
    `Run ID   : ${runId}`,
    `Artifacts: ${runDir}`,
    ...(documenter ? [`Report   : ${path.join(runDir, REPORT_FILE)}`] : []),
    `Session  : ${ctx.sessionId}`,
    `Panel    : ${panelUrl}`,
    `Resumed  : ${resumeRunId ? "yes" : "no"}`,
    ...(input ? [`Input    : ${inputPath}`] : []), "",
    "-- Node timings --",
    ...st.timings.map((t) => `  ${t.nodeId} (${t.agent}): ${t.ms} ms${(t.iteration ?? 1) > 1 ? ` [iter ${t.iteration}]` : ""}`),
    ...(st.skippedOrder.length > 0 ? ["", "-- Skipped --", ...ctx.history.filter((r) => r.state === "skipped").map((r) => `  ${r.nodeId}: ${r.reason ?? "skipped"}`)] : []),
    ...(st.schemaWarnings.length > 0 ? ["", "-- Schema warnings --", ...st.schemaWarnings.map((w) => `  ⚠ ${w}`)] : []),
    ...(lint.length > 0 ? ["", "-- Workflow lint --", ...lint.map((issue) => `  ${issue.severity === "error" ? "✖" : "⚠"} ${issue.message}`)] : []),
    ...(Object.values(st.iterations).some((v) => v > 1) ? ["", "-- Loop iterations --", ...Object.entries(st.iterations).filter(([, v]) => v > 1).map(([k, v]) => `  ${k}: ${v} iterations`)] : []),
    "", "-- Artifacts --",
    ...dag.order.filter((id) => completed.has(id)).map((id) => `  ${outputFileName(id)}  ${logFileName(id)}`),
    ...(documenter ? [`  ${REPORT_FILE}`] : []),
    `  ${CHECKPOINT_FILE}`,
  ].join("\n")
  } finally {
    runInProgress = false
  }
}

type LoadedWorkflow = { ok: true; workflow: Workflow } | { ok: false; error: string }

function loadWorkflowFile(directory: string, file: string): LoadedWorkflow {
  const candidates = [path.resolve(directory, file), path.resolve(directory, "..", file), path.resolve(file)]
  const yamlPath = candidates.find((p) => fs.existsSync(p))
  if (!yamlPath) return { ok: false, error: `Error: file not found. Tried:\n${candidates.map((c) => "  " + c).join("\n")}` }
  let raw: unknown
  try {
    raw = parseYaml(fs.readFileSync(yamlPath, "utf-8"))
  } catch (err) {
    return { ok: false, error: `YAML parse error: ${errorMessage(err)}` }
  }
  const check = checkRunnable(raw)
  if (!check.ok) return { ok: false, error: ["Workflow validation failed:", ...check.errors.map((e) => `  • ${e}`)].join("\n") }
  return { ok: true, workflow: check.workflow }
}

// ── plugin entry ──
export default {
  id: "agentry",

  server: async (input: { client: OpencodeClient; directory: string }): Promise<Hooks> => {
    const { client, directory } = input
    host = client
    runHost = { client, directory }
    // The panel — and POST /api/run with it — comes up with the instance, so agentry-watch can
    // start a run in a project nobody has run anything in yet. A window still opens only per run.
    void startPanelServer(directory)

    return {
      tool: {
        agentry_run: tool({
          description:
            "Run an Agentry workflow from a YAML file. " +
            "Pass `workflow` with a path to run it. Omit for the built-in 2-node demo. " +
            "Pass `resume` with a run ID to continue an interrupted run. " +
            "Pass `input` to hand the workflow's entry nodes some context (what started the run).",
          args: {
            workflow: tool.schema.string().optional()
              .describe("Path to workflow.yaml relative to project root"),
            resume: tool.schema.string().optional()
              .describe("Run ID to resume, e.g. run_1719200000000"),
            input: tool.schema.string().optional()
              .describe("Context for the entry nodes (the nodes wired from IN), e.g. a trigger event"),
          },
          async execute(args: { workflow?: string; resume?: string; input?: string }) {
            // no workflow arg → B0 spike demo
            if (!args.workflow) {
              return await runWorkflow(client, directory, {
                introduction: "B0 Spike (hardcoded 2-node demo)",
                type: "pipeline",
                input: { description: "project directory" },
                output: { description: "project summary" },
                agents: {
                  explore_code: {
                    prompt: "List the top-level files and directories in this project. Return a brief summary. Be concise — no more than 15 lines.",
                    agent_mapping: { opencode: "explore" },
                    output: { schema: {} },
                  },
                  write_summary: {
                    prompt: "Write a one-paragraph project summary (≤100 words). Return only the summary text.",
                    input: { from: "explore_code" },
                    agent_mapping: { opencode: "build" },
                    output: { schema: {} },
                  },
                },
                workflow: ["explore_code", "write_summary"],
              })
            }

            const loaded = loadWorkflowFile(directory, args.workflow)
            if (!loaded.ok) return loaded.error
            return await runWorkflow(client, directory, loaded.workflow, { resumeRunId: args.resume, input: args.input })
          },
        }),
      },
      // D12: opencode's instance finalizer — close the panel and withdraw panel.json
      dispose: shutdownPanel,
    }
  },
}
