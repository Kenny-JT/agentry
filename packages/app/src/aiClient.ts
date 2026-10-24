/**
 * The AI chat's HTTP client: a local opencode server, driven over its session
 * API from the browser or the Tauri webview. It speaks both server generations
 * and learns which one answers when it opens a session: opencode 2 keeps its API
 * under /api, admits a prompt and is then waited on; opencode 1 answers
 * /session, and a prompt blocks until the reply is done. One session per chat
 * thread.
 */
import type { AiSettings } from './aiSettings';

export const CHECK_SETTINGS_HINT = 'Is opencode running? Check the URL and password in Settings.';
const MODEL_HINT = 'Check the agent and model in Settings, and the provider login on the opencode server.';
const SESSION_TITLE = 'Agentry workflow edit';

/** A request that did not produce a reply, with a hint the chat can show as-is. */
export class AiRequestError extends Error {
  readonly status: number | undefined;
  readonly hint: string;

  constructor(message: string, hint: string, status?: number) {
    super(message);
    this.name = 'AiRequestError';
    this.hint = hint;
    this.status = status;
  }
}

export const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException ? error.name === 'AbortError' : error instanceof Error && error.name === 'AbortError';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** `provider/model` -> the pair the server expects; the first slash splits (a model id may contain more). */
export function parseModelRef(model: string): { providerID: string; modelID: string } | undefined {
  const trimmed = model.trim();
  if (!trimmed) return undefined;
  const slash = trimmed.indexOf('/');
  const providerID = slash > 0 ? trimmed.slice(0, slash).trim() : '';
  const modelID = slash > 0 ? trimmed.slice(slash + 1).trim() : '';
  if (!providerID || !modelID) {
    throw new AiRequestError(
      `Model "${trimmed}" is not in provider/model form`,
      'Write the model as provider/model (for example anthropic/claude-sonnet-4) or leave it empty in Settings.',
    );
  }
  return { providerID, modelID };
}

const toBase64 = (text: string): string =>
  btoa(Array.from(new TextEncoder().encode(text), (byte) => String.fromCharCode(byte)).join(''));

const editorOrigin = (): string => (typeof location === 'undefined' ? '<this editor>' : location.origin);

export interface ChatSession {
  id: string;
  opencode: 1 | 2;
}

interface Call {
  method?: 'GET' | 'POST';
  body?: unknown;
  query?: Record<string, string>;
  signal?: AbortSignal;
}

async function call(settings: AiSettings, path: string, { method = 'POST', body, query, signal }: Call = {}): Promise<Response> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (settings.password) headers.Authorization = `Basic ${toBase64(`opencode:${settings.password}`)}`;
  const base = settings.url.trim().replace(/\/+$/, '');
  const search = query ? `?${new URLSearchParams(query).toString()}` : '';
  try {
    return await fetch(`${base}${path}${search}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new AiRequestError(
      `Could not reach ${settings.url.trim() || 'the opencode server'}`,
      `${CHECK_SETTINGS_HINT} opencode 2 also has to let this editor in: start it with --cors ${editorOrigin()}.`,
    );
  }
}

async function readJson(settings: AiSettings, response: Response): Promise<unknown> {
  if (response.status === 401) {
    throw settings.password
      ? new AiRequestError('The server rejected the password', 'Check the password in Settings (the username is always opencode).', 401)
      : new AiRequestError(
          'The server wants a password',
          'Start opencode with OPENCODE_SERVER_PASSWORD set and enter the same password in Settings.',
          401,
        );
  }
  const text = await response.text().catch(() => '');
  if (!response.ok) {
    const detail = text.trim();
    throw new AiRequestError(
      `The server answered ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
      response.status === 404 ? 'The chat session is gone (was the server restarted?). Start a new chat.' : CHECK_SETTINGS_HINT,
      response.status,
    );
  }
  if (!text.trim()) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AiRequestError('The server sent a reply that is not JSON', CHECK_SETTINGS_HINT, response.status);
  }
}

const isJson = (response: Response): boolean => (response.headers.get('content-type') ?? '').includes('application/json');

function v1Query(settings: AiSettings): Record<string, string> | undefined {
  const directory = settings.directory.trim();
  return directory ? { directory } : undefined;
}

/**
 * Open a session. opencode 2 is asked first: its API lives under /api, where an
 * opencode 1 server answers 404 or its web page rather than JSON.
 */
export async function createSession(settings: AiSettings, signal?: AbortSignal): Promise<ChatSession> {
  const directory = settings.directory.trim();
  const v2 = await call(settings, '/api/session', {
    body: { title: SESSION_TITLE, ...(directory ? { location: { directory } } : {}) },
    signal,
  });
  if (v2.status === 401 || (v2.status !== 404 && isJson(v2))) {
    const reply = await readJson(settings, v2);
    const data = isRecord(reply) ? reply.data : undefined;
    if (isRecord(data) && typeof data.id === 'string' && data.id) return { id: data.id, opencode: 2 };
    throw new AiRequestError('The server did not return a session id', CHECK_SETTINGS_HINT);
  }
  const reply = await readJson(settings, await call(settings, '/session', { body: { title: SESSION_TITLE }, query: v1Query(settings), signal }));
  if (!isRecord(reply) || typeof reply.id !== 'string' || !reply.id) {
    throw new AiRequestError('The server did not return a session id', CHECK_SETTINGS_HINT);
  }
  return { id: reply.id, opencode: 1 };
}

export interface PromptReply {
  /** The reply's text joined; empty when the model produced none. */
  text: string;
}

export function sendPrompt(settings: AiSettings, session: ChatSession, text: string, signal?: AbortSignal): Promise<PromptReply> {
  return session.opencode === 2 ? promptV2(settings, session.id, text, signal) : promptV1(settings, session.id, text, signal);
}

/** opencode 1: `POST /session/{id}/message` blocks until the assistant's turn is complete. */
async function promptV1(settings: AiSettings, sessionId: string, text: string, signal?: AbortSignal): Promise<PromptReply> {
  const model = parseModelRef(settings.model);
  const agent = settings.agent.trim();
  const body = {
    ...(agent ? { agent } : {}),
    ...(model ? { model } : {}),
    parts: [{ type: 'text', text }],
  };
  const reply = await readJson(
    settings,
    await call(settings, `/session/${encodeURIComponent(sessionId)}/message`, { body, query: v1Query(settings), signal }),
  );
  if (!isRecord(reply)) throw new AiRequestError('The server sent an unexpected reply', CHECK_SETTINGS_HINT);
  const info = isRecord(reply.info) ? reply.info : {};
  if (isRecord(info.error)) {
    const data = isRecord(info.error.data) ? info.error.data : {};
    const message = typeof data.message === 'string' ? data.message : typeof info.error.name === 'string' ? info.error.name : 'unknown error';
    throw new AiRequestError(`The model did not answer: ${message}`, MODEL_HINT);
  }
  const parts = Array.isArray(reply.parts) ? reply.parts : [];
  const texts = parts.flatMap((part) => (isRecord(part) && part.type === 'text' && typeof part.text === 'string' ? [part.text] : []));
  return { text: texts.join('\n').trim() };
}

/**
 * opencode 2: the prompt is only admitted; `wait` returns once the agent loop is
 * idle again, and the loop closes every turn with an `idle` record carrying its
 * outcome. The reply is the assistant text between our message and that record.
 */
async function promptV2(settings: AiSettings, sessionId: string, text: string, signal?: AbortSignal): Promise<PromptReply> {
  const session = `/api/session/${encodeURIComponent(sessionId)}`;
  const model = parseModelRef(settings.model);
  const agent = settings.agent.trim();
  if (agent) await readJson(settings, await call(settings, `${session}/agent`, { body: { agent }, signal }));
  if (model) {
    await readJson(settings, await call(settings, `${session}/model`, { body: { model: { id: model.modelID, providerID: model.providerID } }, signal }));
  }
  const sent = await readJson(settings, await call(settings, `${session}/prompt`, { body: { text }, signal }));
  const sentId = isRecord(sent) && isRecord(sent.data) ? sent.data.id : undefined;
  await readJson(settings, await call(settings, `/api/experimental/session/${encodeURIComponent(sessionId)}/wait`, { signal }));
  const context = await readJson(settings, await call(settings, `${session}/context`, { method: 'GET', signal }));
  const messages = isRecord(context) && Array.isArray(context.data) ? context.data.filter(isRecord) : [];
  const turn = messages.slice(messages.findIndex((message) => message.id === sentId) + 1);
  const idle = turn.findIndex((message) => message.type === 'idle');
  const outcome = turn[idle];
  if (!outcome) throw new AiRequestError('opencode went idle before the model answered', CHECK_SETTINGS_HINT);
  if (outcome.outcome !== 'succeeded') {
    const reason = isRecord(outcome.error) && typeof outcome.error.message === 'string' ? outcome.error.message : `the turn ended ${String(outcome.outcome)}`;
    throw new AiRequestError(`The model did not answer: ${reason}`, MODEL_HINT);
  }
  const texts = turn
    .slice(0, idle)
    .filter((message) => message.type === 'assistant')
    .flatMap((message) => (Array.isArray(message.content) ? message.content : []))
    .flatMap((part) => (isRecord(part) && part.type === 'text' && typeof part.text === 'string' ? [part.text] : []));
  return { text: texts.join('\n\n').trim() };
}

/** Stop the turn in progress; failures are not worth reporting. */
export async function abortSession(settings: AiSettings, session: ChatSession): Promise<void> {
  const id = encodeURIComponent(session.id);
  try {
    const response =
      session.opencode === 2
        ? await call(settings, `/api/session/${id}/interrupt`)
        : await call(settings, `/session/${id}/abort`, { query: v1Query(settings) });
    await readJson(settings, response);
  } catch (error) {
    console.warn('agentry: abort request failed', error);
  }
}
