// Host adapters: the slice of the opencode SDK client the runner uses, satisfied by a
// headless CLI instead of a server. One `session.prompt` = one `claude -p` / `codex exec`
// process on the user's own account; the prompt travels on stdin (Windows caps the command
// line at 32 KB, and upstream context easily exceeds that).
import { spawn } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { randomUUID } from "node:crypto"
import type { RuntimeName } from "@agentry/core"

export type HostRuntime = Exclude<RuntimeName, "opencode">

export interface HostLog {
  (level: "debug" | "info" | "warn" | "error", message: string): void
}

export interface HostAdapterOptions {
  /** Project directory the CLI runs in — the agents' working directory. */
  directory: string
  log?: HostLog
  env?: NodeJS.ProcessEnv
}

/** What the runner hands a host per node call (the `body` of `session.prompt`). */
export interface HostPromptBody {
  agent?: string
  /** True for roles that only read (the `plan`/`explore` kind): the host runs them sandboxed. */
  readOnly?: boolean
  parts?: unknown[]
}

export interface HostInvocation {
  bin: string
  args: string[]
  stdin: string
  cwd: string
  env: NodeJS.ProcessEnv
}

export interface HostResult {
  text: string
  sessionId?: string
  costUsd?: number
}

interface SpawnOutcome {
  code: number | null
  stdout: string
  stderr: string
}

/** The opencode-shaped client the runner expects; `prompt` resolves to the host's reply parts. */
export interface HostClient {
  runtime: HostRuntime
  app: {
    agents(): Promise<{ data: Array<{ name: string }> }>
    log(options: { body: { service: string; level: "debug" | "info" | "warn" | "error"; message: string } }): Promise<void>
  }
  session: {
    create(options: { body: { title: string; parentID?: string } }): Promise<{ data: { id: string } }>
    prompt(options: { path: { id: string }; body: Record<string, unknown> }): Promise<{ data: { parts: Array<{ type: "text"; text: string }> } }>
  }
}

const promptText = (body: Record<string, unknown>): string => {
  const parts = Array.isArray(body.parts) ? body.parts : []
  return parts
    .filter((p): p is { type: string; text?: string } => typeof p === "object" && p !== null && "type" in p)
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text ?? "")
    .join("\n")
}

const clipForError = (text: string, max = 600): string => {
  const t = text.trim()
  return t.length > max ? `…${t.slice(-max)}` : t
}

// On Windows an npm-installed CLI is a `.cmd` shim, which only cmd.exe can start. Resolving
// it to the real file here keeps `shell: false` in spawn: the prompt never touches a command
// line, and the arguments are passed as-is.
function resolveExecutable(bin: string, env: NodeJS.ProcessEnv): { file: string; viaCmd: boolean } {
  if (process.platform !== "win32") return { file: bin, viaCmd: false }
  const hasDir = bin.includes("\\") || bin.includes("/")
  const ext = path.extname(bin).toLowerCase()
  if (hasDir) return { file: bin, viaCmd: ext === ".cmd" || ext === ".bat" }
  const dirs = (env.PATH ?? env.Path ?? "").split(path.delimiter).filter(Boolean)
  const exts = ext ? [""] : (env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";").map((e) => e.toLowerCase())
  const preferred = ext ? exts : [".exe", ...exts.filter((e) => e !== ".exe")]
  for (const dir of dirs) {
    for (const e of preferred) {
      const candidate = path.join(dir, bin + e)
      if (fs.existsSync(candidate)) return { file: candidate, viaCmd: e === ".cmd" || e === ".bat" }
    }
  }
  return { file: bin, viaCmd: false }
}

function runProcess(inv: HostInvocation): Promise<SpawnOutcome> {
  const { file, viaCmd } = resolveExecutable(inv.bin, inv.env)
  const command = viaCmd ? (inv.env.ComSpec ?? "cmd.exe") : file
  // /s strips exactly one pair of outer quotes, so the whole line gets its own: a quoted path
  // (a space in it) and a quoted last argument both survive
  const args = viaCmd ? ["/d", "/s", "/c", `"${[file, ...inv.args].map(cmdQuote).join(" ")}"`] : inv.args
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: inv.cwd, env: inv.env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true, ...(viaCmd ? { windowsVerbatimArguments: true } : {}) })
    let stdout = ""
    let stderr = ""
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (chunk: string) => { stdout += chunk })
    child.stderr.on("data", (chunk: string) => { stderr += chunk })
    child.once("error", (err) => reject(new Error(`could not start ${inv.bin}: ${err.message}`)))
    child.once("close", (code) => resolve({ code, stdout, stderr }))
    child.stdin.once("error", () => {})
    child.stdin.end(inv.stdin)
  })
}

// cmd.exe quoting for the arguments the .cmd shim forwards: our own flags only (the prompt
// is on stdin), so double quotes around anything with spaces or cmd metacharacters suffice.
const cmdQuote = (arg: string): string => (/[\s&|<>^()"%!]/.test(arg) ? `"${arg.replace(/"/g, '""')}"` : arg)

interface HostSpec {
  runtime: HostRuntime
  defaultBin: string
  binEnv: string
  invocation(body: HostPromptBody, prompt: string, ctx: { directory: string; env: NodeJS.ProcessEnv; outFile: string }): { args: string[]; stdin: string }
  parse(outcome: SpawnOutcome, outFile: string): HostResult
}

const asRecord = (v: unknown): Record<string, unknown> | null => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null)

/** Claude Code's built-in tools that change nothing: all a read-only step gets. */
const CLAUDE_READ_TOOLS = "Read,Glob,Grep,WebFetch,WebSearch"

export const claudeSpec: HostSpec = {
  runtime: "claude_code",
  defaultBin: "claude",
  binEnv: "AGENTRY_CLAUDE_BIN",
  invocation(body, prompt, { env }) {
    // Read-only means only the read tools. Plan mode would not do: Claude writes a plan and ends on
    // ExitPlanMode instead of answering, and its command classifier can still let commands run.
    const mode = env.AGENTRY_CLAUDE_PERMISSION_MODE ?? (body.readOnly ? "dontAsk" : "acceptEdits")
    const args = ["-p", "--output-format", "json", "--permission-mode", mode, "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}']
    if (body.readOnly) args.push("--tools", CLAUDE_READ_TOOLS)
    if (env.AGENTRY_CLAUDE_MODEL) args.push("--model", env.AGENTRY_CLAUDE_MODEL)
    if (body.agent) args.push("--agent", body.agent)
    return { args, stdin: prompt }
  },
  parse(outcome) {
    let parsed: Record<string, unknown> | null = null
    try {
      parsed = asRecord(JSON.parse(outcome.stdout))
    } catch {
      parsed = null
    }
    if (outcome.code !== 0 && !parsed) {
      throw new Error(`claude exited with ${outcome.code ?? "signal"}: ${clipForError(outcome.stderr || outcome.stdout) || "(no output)"}`)
    }
    if (!parsed) throw new Error(`claude printed no JSON result: ${clipForError(outcome.stdout || outcome.stderr) || "(empty)"}`)
    const result = typeof parsed.result === "string" ? parsed.result : ""
    if (parsed.is_error === true || outcome.code !== 0) {
      // a refused request (usage limit, auth) comes back as is_error with subtype "success": only a real subtype says more
      const subtype = typeof parsed.subtype === "string" && parsed.subtype !== "success" ? ` (${parsed.subtype})` : ""
      throw new Error(`claude reported an error${subtype}: ${clipForError(result || outcome.stderr) || "(no detail)"}`)
    }
    return {
      text: result,
      ...(typeof parsed.session_id === "string" ? { sessionId: parsed.session_id } : {}),
      ...(typeof parsed.total_cost_usd === "number" ? { costUsd: parsed.total_cost_usd } : {}),
    }
  },
}

export const codexSpec: HostSpec = {
  runtime: "codex",
  defaultBin: "codex",
  binEnv: "AGENTRY_CODEX_BIN",
  invocation(body, prompt, { directory, env, outFile }) {
    const sandbox = env.AGENTRY_CODEX_SANDBOX ?? (body.readOnly ? "read-only" : "workspace-write")
    const args = ["exec", "--skip-git-repo-check", "--sandbox", sandbox, "--cd", directory, "--output-last-message", outFile, "--color", "never"]
    if (env.AGENTRY_CODEX_MODEL) args.push("--model", env.AGENTRY_CODEX_MODEL)
    if (body.agent) args.push("--profile", body.agent)
    args.push("-")
    return { args, stdin: prompt }
  },
  parse(outcome, outFile) {
    const last = fs.existsSync(outFile) ? fs.readFileSync(outFile, "utf8") : ""
    if (outcome.code !== 0) {
      throw new Error(`codex exited with ${outcome.code ?? "signal"}: ${clipForError(outcome.stderr || outcome.stdout) || "(no output)"}`)
    }
    if (!last.trim() && !fs.existsSync(outFile)) throw new Error(`codex wrote no final message: ${clipForError(outcome.stderr || outcome.stdout) || "(empty)"}`)
    return { text: last.trim() }
  },
}

export const HOST_SPECS: Readonly<Record<HostRuntime, HostSpec>> = { claude_code: claudeSpec, codex: codexSpec }

/** The CLI invocation for one prompt — exported so a test can pin the flags without a process. */
export function planInvocation(spec: HostSpec, body: HostPromptBody, prompt: string, opts: HostAdapterOptions, outFile: string): HostInvocation {
  const env = opts.env ?? process.env
  const { args, stdin } = spec.invocation(body, prompt, { directory: opts.directory, env, outFile })
  return { bin: env[spec.binEnv] ?? spec.defaultBin, args, stdin, cwd: opts.directory, env }
}

export async function callHost(spec: HostSpec, body: HostPromptBody, prompt: string, opts: HostAdapterOptions): Promise<HostResult> {
  const outFile = path.join(os.tmpdir(), `agentry-${spec.runtime}-${randomUUID()}.txt`)
  try {
    const inv = planInvocation(spec, body, prompt, opts, outFile)
    opts.log?.("debug", `${spec.runtime}: ${inv.bin} ${inv.args.join(" ")} (${prompt.length} chars on stdin)`)
    let outcome: SpawnOutcome
    try {
      outcome = await runProcess(inv)
    } catch (err) {
      throw new Error(`${err instanceof Error ? err.message : String(err)} (install the ${spec.defaultBin} CLI, or point ${spec.binEnv} at it)`)
    }
    return spec.parse(outcome, outFile)
  } finally {
    fs.rmSync(outFile, { force: true })
  }
}

export function createHostClient(runtime: HostRuntime, opts: HostAdapterOptions): HostClient {
  const spec = HOST_SPECS[runtime]
  let sessions = 0
  return {
    runtime,
    app: {
      // the host has no agent registry to ask; whatever a node names is passed through as-is
      agents: async () => ({ data: [] }),
      log: async ({ body }) => { opts.log?.(body.level, body.message) },
    },
    session: {
      create: async () => ({ data: { id: `${runtime}_${++sessions}` } }),
      prompt: async ({ body }) => {
        const promptBody: HostPromptBody = {
          ...(typeof body.agent === "string" && body.agent ? { agent: body.agent } : {}),
          ...(body.readOnly === true ? { readOnly: true } : {}),
        }
        const result = await callHost(spec, promptBody, promptText(body), opts)
        if (result.costUsd !== undefined) opts.log?.("info", `${runtime}: $${result.costUsd.toFixed(4)}${result.sessionId ? ` session ${result.sessionId}` : ""}`)
        return { data: { parts: [{ type: "text", text: result.text }] } }
      },
    },
  }
}
