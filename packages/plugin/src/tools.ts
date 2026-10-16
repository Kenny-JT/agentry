// Tool node executors (docs/09 "Tool nodes"): the I/O half of a deterministic step — an HTTP
// request, a file read/write or a script — fed by the pure template language in @agentry/core.
// Every path resolves against the project directory the plugin was loaded for and MUST stay
// inside it; a script's command string never has upstream text interpolated into it.
import * as fs from "node:fs"
import * as path from "node:path"
import { spawn } from "node:child_process"
import type { ChildProcess } from "node:child_process"
import { extractJson, HTTP_TIMEOUT_S, renderTemplate, renderUrl, SCRIPT_TIMEOUT_S } from "@agentry/core"
import type { HttpToolSpec, ReadFileToolSpec, ScriptToolSpec, TemplateScope, ToolSpec, WriteFileToolSpec } from "@agentry/core"

const READ_LIMIT = 2 * 1024 * 1024
const HTTP_BODY_LIMIT = 256 * 1024
const PIPE_LIMIT = 64 * 1024

export interface ToolRun {
  nodeId: string
  spec: ToolSpec
  /** The project directory every path is confined to. */
  projectDir: string
  /** This run's artifact directory (AGENTRY_RUN_DIR; the script's stdin JSON is kept here). */
  runDir: string
  scope: TemplateScope
}

export interface ToolResult {
  /** The node's output: always a JSON object as text. */
  output: string
  /** Resolved request / command, for the node's log.md. */
  resolved: string[]
  /** Template references in scope that had no value. */
  notices: string[]
}

export class ToolError extends Error {
  constructor(message: string, readonly resolved: string[] = [], readonly notices: string[] = []) {
    super(message)
    this.name = "ToolError"
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)
const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err))

/** `rel` resolved against `projectDir`, refusing `..` escapes, outside absolutes and symlink escapes. */
export function resolveInside(projectDir: string, rel: string, what: string): string {
  const root = fs.realpathSync.native(projectDir)
  const abs = path.resolve(root, rel)
  const escapes = (candidate: string) => {
    const between = path.relative(root, candidate)
    return between.startsWith("..") || path.isAbsolute(between)
  }
  if (escapes(abs)) throw new ToolError(`${what} "${rel}" escapes the project directory`)
  // symlinks: the real location of the nearest existing ancestor must also be inside
  let probe = abs
  while (!fs.existsSync(probe)) {
    const parent = path.dirname(probe)
    if (parent === probe) break
    probe = parent
  }
  if (escapes(fs.realpathSync.native(probe))) throw new ToolError(`${what} "${rel}" resolves outside the project directory (symlink)`)
  return abs
}

const clipPipe = (text: string, limit: number) =>
  text.length > limit ? `${text.slice(0, limit)}\n…[truncated: ${text.length - limit} more characters]` : text

function render(text: string, scope: TemplateScope, notices: string[]): string {
  const out = renderTemplate(text, scope)
  notices.push(...out.notices)
  return out.text
}

// ── http ──

async function runHttp(spec: HttpToolSpec, scope: TemplateScope): Promise<ToolResult> {
  const notices: string[] = []
  const url = renderUrl(spec.url, scope)
  notices.push(...url.notices)
  const method = spec.method ?? "GET"
  const headers: Record<string, string> = {}
  for (const [key, value] of Object.entries(spec.headers ?? {})) headers[key] = render(value, scope, notices)
  let body: string | undefined
  if (typeof spec.body === "string") body = render(spec.body, scope, notices)
  else if (spec.body) {
    const mapped: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(spec.body)) mapped[key] = typeof value === "string" ? render(value, scope, notices) : value
    body = JSON.stringify(mapped)
    if (!Object.keys(headers).some((h) => h.toLowerCase() === "content-type")) headers["Content-Type"] = "application/json"
  }
  const resolved = [`${method} ${url.text}`, ...Object.entries(headers).map(([k, v]) => `${k}: ${v}`), ...(body !== undefined ? ["", body] : [])]
  const timeoutMs = (spec.timeout_s ?? HTTP_TIMEOUT_S) * 1000

  let response: Response
  try {
    response = await fetch(url.text, { method, headers, body, signal: AbortSignal.timeout(timeoutMs), redirect: "follow" })
  } catch (err) {
    const reason = err instanceof Error && err.name === "TimeoutError" ? `timed out after ${timeoutMs / 1000} s` : errorMessage(err)
    throw new ToolError(`${method} ${url.text} failed: ${reason}`, resolved, notices)
  }
  const contentType = response.headers.get("content-type") ?? ""
  const text = await response.text()
  let parsed: unknown = text
  if (/json/i.test(contentType)) {
    try { parsed = JSON.parse(text) } catch { parsed = text }
  }
  if (typeof parsed === "string") parsed = clipPipe(parsed, HTTP_BODY_LIMIT)
  const output = JSON.stringify({ status: response.status, ok: response.ok, content_type: contentType, body: parsed })
  if (!response.ok && !spec.allow_failure) throw new ToolError(`${method} ${url.text} answered ${response.status} ${response.statusText}`.trim(), [...resolved, "", `→ ${response.status}`], notices)
  return { output, resolved: [...resolved, "", `→ ${response.status} ${contentType}`.trim()], notices }
}

// ── files ──

function runReadFile(spec: ReadFileToolSpec, scope: TemplateScope, projectDir: string): ToolResult {
  const notices: string[] = []
  const rel = render(spec.path, scope, notices)
  const abs = resolveInside(projectDir, rel, "path")
  const resolved = [`read ${abs}`]
  let stat: fs.Stats
  try { stat = fs.statSync(abs) } catch { throw new ToolError(`path "${rel}" does not exist`, resolved, notices) }
  if (!stat.isFile()) throw new ToolError(`path "${rel}" is not a file`, resolved, notices)
  if (stat.size > READ_LIMIT) throw new ToolError(`path "${rel}" is ${stat.size} bytes; read_file reads at most ${READ_LIMIT}`, resolved, notices)
  const content = fs.readFileSync(abs, "utf-8")
  const record: Record<string, unknown> = { path: path.relative(projectDir, abs).split(path.sep).join("/"), bytes: stat.size, content }
  try { record.json = JSON.parse(content) } catch { /* not JSON: no `json` key */ }
  return { output: JSON.stringify(record), resolved, notices }
}

function runWriteFile(spec: WriteFileToolSpec, scope: TemplateScope, projectDir: string): ToolResult {
  const notices: string[] = []
  const rel = render(spec.path, scope, notices)
  const abs = resolveInside(projectDir, rel, "path")
  const first = scope.sources[0]
  const content = spec.content !== undefined ? render(spec.content, scope, notices) : (first !== undefined ? scope.outputs.get(first) : undefined) ?? scope.input ?? ""
  const mode = spec.mode ?? "overwrite"
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  if (mode === "append") fs.appendFileSync(abs, content)
  else fs.writeFileSync(abs, content)
  const bytes = Buffer.byteLength(content)
  return {
    output: JSON.stringify({ path: path.relative(projectDir, abs).split(path.sep).join("/"), bytes, mode }),
    resolved: [`${mode} ${abs} (${bytes} bytes)`],
    notices,
  }
}

// ── script ──

function killTree(child: ChildProcess) {
  if (child.pid === undefined) return
  if (process.platform === "win32") {
    spawn("taskkill", ["/T", "/F", "/PID", String(child.pid)], { stdio: "ignore", windowsHide: true }).on("error", () => child.kill())
    return
  }
  try { process.kill(-child.pid, "SIGKILL") } catch { child.kill("SIGKILL") }
}

function collect(stream: NodeJS.ReadableStream | null, sink: { text: string }) {
  stream?.setEncoding("utf-8")
  stream?.on("data", (chunk: string) => {
    // keep a little past the cap so the truncation marker can report how much was dropped
    if (sink.text.length <= PIPE_LIMIT * 2) sink.text += chunk
  })
}

function scriptStdin(scope: TemplateScope): string {
  const upstream: Record<string, unknown> = {}
  for (const id of scope.sources) {
    const text = scope.outputs.get(id)
    if (text === undefined) continue
    upstream[id] = extractJson(text) ?? text
  }
  return JSON.stringify({ input: scope.input ?? null, upstream })
}

function runScript(run: ToolRun, spec: ScriptToolSpec): Promise<ToolResult> {
  const { scope, projectDir, runDir, nodeId } = run
  const notices: string[] = []
  const cwd = spec.cwd ? resolveInside(projectDir, render(spec.cwd, scope, notices), "cwd") : projectDir
  const stdin = scriptStdin(scope)
  const inputFile = path.join(runDir, `${nodeId}.input.json`)
  fs.writeFileSync(inputFile, stdin)
  const env = { ...process.env, AGENTRY_INPUT_FILE: inputFile, AGENTRY_RUN_DIR: runDir }
  const timeoutMs = (spec.timeout_s ?? SCRIPT_TIMEOUT_S) * 1000
  const common = { cwd, env, stdio: "pipe" as const, windowsHide: true, detached: process.platform !== "win32" }

  let child: ChildProcess
  let resolved: string[]
  if (Array.isArray(spec.command)) {
    const argv = spec.command.map((arg) => render(String(arg), scope, notices))
    const [exe, ...args] = argv
    if (exe === undefined) throw new ToolError("script.command is empty", [], notices)
    resolved = [`$ ${argv.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" ")}`, `cwd: ${cwd}`]
    child = spawn(exe, args, common)
  } else {
    resolved = [`$ ${spec.command}`, `cwd: ${cwd}`, "(shell command — not templated)"]
    child = spawn(spec.command, { ...common, shell: true })
  }

  return new Promise<ToolResult>((resolve, reject) => {
    const out = { text: "" }
    const err = { text: "" }
    collect(child.stdout, out)
    collect(child.stderr, err)
    let timedOut = false
    const timer = setTimeout(() => { timedOut = true; killTree(child) }, timeoutMs)
    child.on("error", (spawnErr) => {
      clearTimeout(timer)
      reject(new ToolError(`script failed to start: ${spawnErr.message}`, resolved, notices))
    })
    child.on("close", (code, signal) => {
      clearTimeout(timer)
      const stdout = clipPipe(out.text, PIPE_LIMIT)
      const stderr = clipPipe(err.text, PIPE_LIMIT)
      if (timedOut) {
        reject(new ToolError(`script timed out after ${timeoutMs / 1000} s (process tree killed)`, [...resolved, "", `stderr: ${stderr}`], notices))
        return
      }
      const exitCode = code ?? -1
      const record: Record<string, unknown> = { exit_code: exitCode, stdout, stderr }
      let parsed: unknown
      try { parsed = JSON.parse(out.text.trim()) } catch { parsed = undefined }
      if (isObj(parsed)) record.result = parsed
      const output = JSON.stringify(record)
      const summary = [...resolved, "", `→ exit ${exitCode}${signal ? ` (${signal})` : ""}`]
      if (exitCode !== 0 && !spec.allow_failure) {
        reject(new ToolError(`script exited with ${exitCode}${signal ? ` (${signal})` : ""}${stderr ? `: ${stderr.trim().split("\n").slice(-3).join(" | ")}` : ""}`, summary, notices))
        return
      }
      resolve({ output, resolved: summary, notices })
    })
    child.stdin?.on("error", () => { /* the script may exit without reading stdin */ })
    child.stdin?.end(stdin)
  })
}

export async function runTool(run: ToolRun): Promise<ToolResult> {
  const { spec, scope, projectDir } = run
  switch (spec.kind) {
    case "http":
      return runHttp(spec, scope)
    case "read_file":
      return runReadFile(spec, scope, projectDir)
    case "write_file":
      return runWriteFile(spec, scope, projectDir)
    case "script":
      return runScript(run, spec)
  }
}
