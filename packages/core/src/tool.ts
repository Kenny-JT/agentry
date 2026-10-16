/**
 * Tool nodes (PROVISIONAL, README "Tool steps"): deterministic workflow steps
 * that run WITHOUT a model — an HTTP request, a file read or write, a script.
 * The node's `tool` block is the whole contract; `prompt` / `agent_mapping` are
 * absent. This file is the pure half (types, the `{ref}` template language,
 * the shape check); the I/O lives in the plugin (packages/plugin/src/tools.ts).
 */

import { extractJson } from './runtime';

export const TOOL_KINDS = ['http', 'read_file', 'write_file', 'script'] as const;
export type ToolKind = (typeof TOOL_KINDS)[number];

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export const HTTP_TIMEOUT_S = 30;
export const SCRIPT_TIMEOUT_S = 120;

/** Request body: a templated string, or a mapping sent as JSON (string leaves templated). */
export type HttpBody = string | Record<string, unknown>;

export interface HttpToolSpec {
  kind: 'http';
  /** Default GET. */
  method?: HttpMethod;
  /** Templated. One whole-url reference is substituted raw; anything else is URL-encoded. */
  url: string;
  /** Header values are templated. */
  headers?: Record<string, string>;
  body?: HttpBody;
  /** Default 30. */
  timeout_s?: number;
  /** A non-2xx status fails the node unless true. */
  allow_failure?: boolean;
}

export interface ReadFileToolSpec {
  kind: 'read_file';
  /** Templated; must stay inside the project directory. Max 2 MB. */
  path: string;
}

export interface WriteFileToolSpec {
  kind: 'write_file';
  /** Templated; must stay inside the project directory. Parent dirs are created. */
  path: string;
  /** Templated. Omitted = the whole output text of the first upstream. */
  content?: string;
  /** Default overwrite. */
  mode?: 'overwrite' | 'append';
}

export interface ScriptToolSpec {
  kind: 'script';
  /** An argv list is spawned WITHOUT a shell, each argument templated (a bare number like `-3` is stringified). A string runs through the platform shell and is NOT templated. */
  command: string | string[];
  /** Working directory, relative to the project directory (must stay inside it). */
  cwd?: string;
  /** Default 120. On timeout the whole process tree is killed and the node fails. */
  timeout_s?: number;
  /** A non-zero exit fails the node unless true. */
  allow_failure?: boolean;
}

export type ToolSpec = HttpToolSpec | ReadFileToolSpec | WriteFileToolSpec | ScriptToolSpec;

/** Default output schema per kind — what the runner always produces. */
export const TOOL_OUTPUT_SCHEMA: Record<ToolKind, Record<string, string>> = {
  http: { status: 'number', ok: 'boolean', content_type: 'string', body: 'any' },
  read_file: { path: 'string', bytes: 'number', content: 'string', json: 'any' },
  write_file: { path: 'string', bytes: 'number', mode: 'string' },
  script: { exit_code: 'number', stdout: 'string', stderr: 'string', result: 'any' },
};

/** Short badge for the node card / sidebar: `GET`, `read`, `write`, `script`. */
export function toolLabel(spec: ToolSpec | undefined): string {
  switch (spec?.kind) {
    case 'http':
      return spec.method ?? 'GET';
    case 'read_file':
      return 'read';
    case 'write_file':
      return 'write';
    case 'script':
      return 'script';
    case undefined:
      return 'tool';
  }
}

/** Runner-side agent label, e.g. `tool:http`. */
export const toolAgentLabel = (spec: ToolSpec | undefined): string => `tool:${spec?.kind ?? 'unknown'}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPositive = (value: unknown): boolean => typeof value === 'number' && Number.isFinite(value) && value > 0;

/**
 * Shape check of one node's `tool` block — the errors `checkRunnable` (runner)
 * and `validateWorkflow` (editor) both report. `raw` is the untrusted value.
 */
export function checkToolSpec(id: string, raw: unknown): string[] {
  const at = `agents.${id}.tool`;
  if (!isRecord(raw)) return [`${at}: required object for a tool node`];
  const errors: string[] = [];
  const kind = raw.kind;
  if (typeof kind !== 'string' || !(TOOL_KINDS as readonly string[]).includes(kind)) {
    return [`${at}.kind: expected one of ${TOOL_KINDS.join(', ')}, got ${JSON.stringify(kind)}`];
  }
  const needString = (field: string) => {
    if (typeof raw[field] !== 'string' || !(raw[field] as string).trim()) errors.push(`${at}.${field}: required string`);
  };
  const checkTimeout = () => {
    if (raw.timeout_s !== undefined && !isPositive(raw.timeout_s)) errors.push(`${at}.timeout_s: expected a positive number`);
  };
  switch (kind as ToolKind) {
    case 'http':
      needString('url');
      if (raw.method !== undefined && !(HTTP_METHODS as readonly string[]).includes(String(raw.method))) {
        errors.push(`${at}.method: expected one of ${HTTP_METHODS.join(', ')}, got ${JSON.stringify(raw.method)}`);
      }
      if (raw.headers !== undefined && (!isRecord(raw.headers) || Object.values(raw.headers).some((v) => typeof v !== 'string'))) {
        errors.push(`${at}.headers: expected an object of string values`);
      }
      if (raw.body !== undefined && typeof raw.body !== 'string' && !isRecord(raw.body)) errors.push(`${at}.body: expected a string or an object`);
      checkTimeout();
      break;
    case 'read_file':
      needString('path');
      break;
    case 'write_file':
      needString('path');
      if (raw.content !== undefined && typeof raw.content !== 'string') errors.push(`${at}.content: expected a string`);
      if (raw.mode !== undefined && raw.mode !== 'overwrite' && raw.mode !== 'append') errors.push(`${at}.mode: expected "overwrite" or "append"`);
      break;
    case 'script': {
      const cmd = raw.command;
      // YAML reads an unquoted `-3` (as in `[py, -3, x.py]`) as a number — accepted, the runner stringifies it
      const okList = Array.isArray(cmd) && cmd.length > 0 && cmd.every((a) => typeof a === 'string' || typeof a === 'number');
      if (!okList && (typeof cmd !== 'string' || !cmd.trim())) errors.push(`${at}.command: required string or non-empty string[]`);
      if (raw.cwd !== undefined && typeof raw.cwd !== 'string') errors.push(`${at}.cwd: expected a string`);
      checkTimeout();
      break;
    }
  }
  return errors;
}

// ── template language ──

/** One `{root.a.b}` reference found in a template string. */
export interface TemplateRef {
  /** The whole brace token as written. */
  raw: string;
  /** First segment: an upstream node id or `input`. */
  root: string;
  /** Remaining segments (a path into the upstream's parsed JSON). */
  path: string[];
}

const REF_RE = /\{([A-Za-z_][\w-]*)((?:\.[\w-]+)*)\}/g;

/** Every brace reference in a template, as written (no filtering by scope). */
export function templateRefs(template: string): TemplateRef[] {
  const refs: TemplateRef[] = [];
  for (const m of template.matchAll(REF_RE)) {
    const root = m[1] ?? '';
    const path = (m[2] ?? '').split('.').filter(Boolean);
    refs.push({ raw: m[0], root, path });
  }
  return refs;
}

export interface TemplateScope {
  /** Upstream ids whose references resolve (anything else is left untouched). */
  sources: readonly string[];
  /** Upstream id -> its whole output text. */
  outputs: ReadonlyMap<string, string>;
  /** The run input, for `{input}` / `{input.x}`. */
  input?: string;
}

export interface Rendered {
  text: string;
  /** References that were in scope but resolved to nothing (rendered as ""). */
  notices: string[];
}

const scalarText = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
};

/** Walk `path` into a value parsed from text; `undefined` when the path misses or the text is not JSON. */
function lookupPath(text: string, path: readonly string[]): unknown {
  let current: unknown = extractJson(text);
  if (current === null) {
    try {
      current = JSON.parse(text);
    } catch {
      return undefined;
    }
  }
  for (const key of path) {
    if (Array.isArray(current)) current = current[Number(key)];
    else if (isRecord(current)) current = current[key];
    else return undefined;
  }
  return current;
}

/**
 * Resolve the `{ref}`s of one template string. `{id}` = that upstream's whole
 * output text; `{id.a.b}` = a path into its parsed JSON (objects/arrays are
 * JSON-stringified); `{input}` = the run input. ONLY references whose root is
 * one of `scope.sources` or `input` are replaced — every other brace survives
 * untouched, so literal JSON in a body is safe. A reference in scope that has
 * no value renders as "" and is reported in `notices`.
 *
 * `encode`: URL-encode each substituted value (the url rule when the url is
 * not exactly one reference).
 */
export function renderTemplate(template: string, scope: TemplateScope, encode = false): Rendered {
  const notices: string[] = [];
  const resolve = (ref: TemplateRef): string | undefined => {
    const inScope = ref.root === 'input' || scope.sources.includes(ref.root);
    if (!inScope) return undefined;
    const source = ref.root === 'input' ? scope.input : scope.outputs.get(ref.root);
    const value = source === undefined ? undefined : ref.path.length === 0 ? source : scalarText(lookupPath(source, ref.path));
    if (value === undefined) {
      notices.push(`${ref.raw} has no value — rendered as ""`);
      return '';
    }
    return value;
  };
  const text = template.replace(REF_RE, (raw, root: string, rest: string) => {
    const value = resolve({ raw, root, path: rest.split('.').filter(Boolean) });
    if (value === undefined) return raw;
    return encode ? encodeURIComponent(value) : value;
  });
  return { text, notices };
}

/** `url` rule: a url that IS exactly one reference substitutes raw; otherwise every value is URL-encoded. */
export function renderUrl(url: string, scope: TemplateScope): Rendered {
  const trimmed = url.trim();
  const refs = templateRefs(trimmed);
  const whole = refs.length === 1 && refs[0]?.raw === trimmed;
  return renderTemplate(trimmed, scope, !whole);
}

/** Rewrite `{oldId...}` references to `{nextId...}` (node rename support). */
export function renameTemplateRefs(template: string, oldId: string, nextId: string): string {
  return template.replace(REF_RE, (raw, root: string, rest: string) => (root === oldId ? `{${nextId}${rest}}` : raw));
}

/** Every templated string field of a spec, for validation and rename. */
export function toolTemplateFields(spec: ToolSpec): Array<{ field: string; text: string }> {
  const fields: Array<{ field: string; text: string }> = [];
  switch (spec.kind) {
    case 'http':
      fields.push({ field: 'url', text: spec.url });
      for (const [key, value] of Object.entries(spec.headers ?? {})) fields.push({ field: `headers.${key}`, text: value });
      if (typeof spec.body === 'string') fields.push({ field: 'body', text: spec.body });
      else if (spec.body) for (const [key, value] of Object.entries(spec.body)) if (typeof value === 'string') fields.push({ field: `body.${key}`, text: value });
      break;
    case 'read_file':
      fields.push({ field: 'path', text: spec.path });
      break;
    case 'write_file':
      fields.push({ field: 'path', text: spec.path });
      if (spec.content !== undefined) fields.push({ field: 'content', text: spec.content });
      break;
    case 'script':
      if (Array.isArray(spec.command)) spec.command.forEach((arg, i) => fields.push({ field: `command[${i}]`, text: String(arg) }));
      if (spec.cwd !== undefined) fields.push({ field: 'cwd', text: spec.cwd });
      break;
  }
  return fields;
}

/** Apply `rename` to every templated field; returns the SAME spec when nothing referenced `oldId`. */
export function renameToolRefs(spec: ToolSpec, oldId: string, nextId: string): ToolSpec {
  const touched = toolTemplateFields(spec).some(({ text }) => templateRefs(text).some((ref) => ref.root === oldId));
  if (!touched) return spec;
  const ren = (text: string) => renameTemplateRefs(text, oldId, nextId);
  switch (spec.kind) {
    case 'http': {
      const next: HttpToolSpec = { ...spec, url: ren(spec.url) };
      if (spec.headers) next.headers = Object.fromEntries(Object.entries(spec.headers).map(([k, v]) => [k, ren(v)]));
      if (typeof spec.body === 'string') next.body = ren(spec.body);
      else if (spec.body) next.body = Object.fromEntries(Object.entries(spec.body).map(([k, v]) => [k, typeof v === 'string' ? ren(v) : v]));
      return next;
    }
    case 'read_file':
      return { ...spec, path: ren(spec.path) };
    case 'write_file':
      return { ...spec, path: ren(spec.path), ...(spec.content !== undefined ? { content: ren(spec.content) } : {}) };
    case 'script':
      return {
        ...spec,
        command: Array.isArray(spec.command) ? spec.command.map((arg) => ren(String(arg))) : spec.command,
        ...(spec.cwd !== undefined ? { cwd: ren(spec.cwd) } : {}),
      };
  }
}
