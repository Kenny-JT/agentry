// Decision node backends (README "Decision steps"): the I/O half of a typed decision — one
// System One request per state against TypeSafe's API when a key is configured, else one
// strict-JSON prompt per state to the fallback agent. Both yield the same normalized answers;
// the record the node emits is built in @agentry/core.
import { DECISION_DEFAULT_MODEL, decisionPrompt, fromJevAnswers, parseLlmAnswers, toJevQuestions } from "@agentry/core"
import type { DecisionAnswers, DecisionBackend, DecisionSpec } from "@agentry/core"

export const TYPESAFE_DEFAULT_URL = "https://api.typesafe.ai"
const JEV_TIMEOUT_MS = 60_000
const JEV_ATTEMPTS = 3
const JEV_BACKOFF_MS = 500
const RETRY_STATUSES = new Set([429, 529])
export const JEV_CONCURRENCY = 4
export const LLM_CONCURRENCY = 2

export interface DecisionEnv {
  TYPESAFE_API_KEY?: string
  TYPESAFE_BASE_URL?: string
  AGENTRY_DECISION_BACKEND?: string
}

/** `jev` when a key is set (or forced), `llm` otherwise (or forced). */
export function pickBackend(env: DecisionEnv): DecisionBackend {
  const forced = env.AGENTRY_DECISION_BACKEND?.trim().toLowerCase()
  if (forced === "llm") return "llm"
  if (forced === "jev") return "jev"
  return env.TYPESAFE_API_KEY?.trim() ? "jev" : "llm"
}

export class DecisionError extends Error {
  constructor(message: string, readonly resolved: string[] = []) {
    super(message)
    this.name = "DecisionError"
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Run `work` over every item with at most `limit` in flight; results keep item order. */
export async function mapLimited<T, R>(items: readonly T[], limit: number, work: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await work(items[index] as T, index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

export interface JevRequest {
  spec: DecisionSpec
  state: unknown
  env: DecisionEnv
  fetchImpl?: typeof fetch
  /** Backoff base, overridable by tests. */
  backoffMs?: number
}

interface JevCall { url: string; model: string; body: string }

function buildJevCall(req: JevRequest): JevCall {
  const base = (req.env.TYPESAFE_BASE_URL?.trim() || TYPESAFE_DEFAULT_URL).replace(/\/+$/, "")
  const model = req.spec.model?.trim() || DECISION_DEFAULT_MODEL
  const body = JSON.stringify({ state: req.state, model, questions: toJevQuestions(req.spec) })
  return { url: `${base}/v1/systemone`, model, body }
}

/** POST /v1/systemone for one state; 429 / 529 are retried with exponential backoff, anything else fails with status + body. */
export async function askJev(req: JevRequest): Promise<{ answers: DecisionAnswers; model: string; resolved: string[] }> {
  const key = req.env.TYPESAFE_API_KEY?.trim()
  if (!key) throw new DecisionError("TYPESAFE_API_KEY is not set (AGENTRY_DECISION_BACKEND=jev needs a key)")
  const call = buildJevCall(req)
  const resolved = [`POST ${call.url}`, `model: ${call.model}`, "", call.body]
  const doFetch = req.fetchImpl ?? fetch
  const backoff = req.backoffMs ?? JEV_BACKOFF_MS
  for (let attempt = 1; ; attempt += 1) {
    let response: Response
    try {
      response = await doFetch(call.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: call.body,
        signal: AbortSignal.timeout(JEV_TIMEOUT_MS),
      })
    } catch (err) {
      const reason = err instanceof Error && err.name === "TimeoutError" ? `timed out after ${JEV_TIMEOUT_MS / 1000} s` : err instanceof Error ? err.message : String(err)
      throw new DecisionError(`POST ${call.url} failed: ${reason}`, resolved)
    }
    const text = await response.text()
    if (RETRY_STATUSES.has(response.status) && attempt < JEV_ATTEMPTS) {
      resolved.push(`→ ${response.status} (retry ${attempt}/${JEV_ATTEMPTS - 1})`)
      await sleep(backoff * 2 ** (attempt - 1))
      continue
    }
    if (!response.ok) throw new DecisionError(`POST ${call.url} answered ${response.status}: ${text.slice(0, 500)}`, [...resolved, "", `→ ${response.status}`])
    let parsed: unknown
    try { parsed = JSON.parse(text) } catch { throw new DecisionError(`POST ${call.url} answered non-JSON: ${text.slice(0, 200)}`, resolved) }
    const record = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {}
    try {
      const answers = fromJevAnswers(req.spec, record.answers)
      const model = typeof record.model === "string" ? record.model : call.model
      return { answers, model, resolved: [...resolved, "", `→ ${response.status} ${model}`] }
    } catch (err) {
      throw new DecisionError(err instanceof Error ? err.message : String(err), [...resolved, "", text.slice(0, 2000)])
    }
  }
}

/** One strict-JSON prompt per state through `ask` (the plugin's agent call path); one repair pass when the reply holds no usable JSON. */
export async function askLlm(spec: DecisionSpec, state: unknown, ask: (prompt: string) => Promise<string>): Promise<{ answers: DecisionAnswers; resolved: string[] }> {
  const prompt = decisionPrompt(spec, state)
  const first = await ask(prompt)
  try {
    return { answers: parseLlmAnswers(spec, first), resolved: ["## Prompt", prompt, "", "## Reply", first] }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    const second = await ask(`Your previous reply was not usable (${reason}). ${prompt.slice(prompt.lastIndexOf("Respond with ONLY"))}\nYour prior reply was:\n${first}`)
    try {
      return { answers: parseLlmAnswers(spec, second), resolved: ["## Prompt", prompt, "", "## Reply (first, unusable)", first, "", "## Reply", second] }
    } catch (retryErr) {
      throw new DecisionError(retryErr instanceof Error ? retryErr.message : String(retryErr), ["## Prompt", prompt, "", "## Reply", first, "", "## Reply (repair)", second])
    }
  }
}
