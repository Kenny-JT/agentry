import { useState } from 'react';
import { WORKFLOW_INPUT_ID } from '@agentry/canvas';
import { HTTP_METHODS, HTTP_TIMEOUT_S, SCRIPT_TIMEOUT_S, TOOL_KINDS, TOOL_OUTPUT_SCHEMA } from '@agentry/core';
import type { HttpBody, HttpMethod, ToolKind, ToolSpec } from '@agentry/core';
import type { IncomingSource } from './Inspector';

const KIND_LABEL: Record<ToolKind, string> = {
  http: 'HTTP request',
  read_file: 'Read file',
  write_file: 'Write file',
  script: 'Run script',
};

/** Switching kind keeps nothing but the kind: every kind has its own fields. */
export function defaultToolSpec(kind: ToolKind): ToolSpec {
  switch (kind) {
    case 'http':
      return { kind, method: 'GET', url: '', timeout_s: HTTP_TIMEOUT_S };
    case 'read_file':
      return { kind, path: '' };
    case 'write_file':
      return { kind, path: '', mode: 'overwrite' };
    case 'script':
      return { kind, command: [], timeout_s: SCRIPT_TIMEOUT_S };
  }
}

/** The output schema a kind always produces — applied when the kind changes. */
export const toolSchemaFor = (kind: ToolKind): Record<string, string> => ({ ...TOOL_OUTPUT_SCHEMA[kind] });

const linesToList = (text: string): string[] => text.split('\n').map((line) => line.trim()).filter(Boolean);

const headersToText = (headers: Record<string, string> | undefined): string =>
  Object.entries(headers ?? {}).map(([k, v]) => `${k}: ${v}`).join('\n');

function textToHeaders(text: string): Record<string, string> | undefined {
  const headers: Record<string, string> = {};
  for (const line of linesToList(text)) {
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    headers[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return Object.keys(headers).length ? headers : undefined;
}

const bodyToText = (body: HttpBody | undefined): string =>
  body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body, null, 2);

/** A body that parses as a JSON object is kept as a mapping (sent as JSON); anything else is a raw string. */
function textToBody(text: string): HttpBody | undefined {
  if (!text.trim()) return undefined;
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    // not JSON: a templated raw string body
  }
  return text;
}

const numberOr = (raw: string, fallback: number): number => {
  const n = Number(raw);
  return raw.trim() !== '' && Number.isFinite(n) && n > 0 ? n : fallback;
};

/** A text field whose value is committed on blur, so typing never re-renders the whole graph per keystroke. */
function DeferredText({
  label,
  hint,
  value,
  rows,
  placeholder,
  mono = true,
  onCommit,
}: {
  label: string;
  hint?: string;
  value: string;
  rows?: number;
  placeholder?: string;
  mono?: boolean;
  onCommit: (text: string) => void;
}) {
  const [text, setText] = useState(value);
  const className = `${rows ? 'agentry-textarea' : 'agentry-input'}${mono ? ' agentry-input--mono' : ''}`;
  const commit = () => {
    if (text !== value) onCommit(text);
  };
  return (
    <label className="agentry-field">
      <span className="agentry-field__label">{label}</span>
      {rows ? (
        <textarea className={className} rows={rows} value={text} placeholder={placeholder} spellCheck={false} onChange={(e) => setText(e.target.value)} onBlur={commit} />
      ) : (
        <input className={className} value={text} placeholder={placeholder} spellCheck={false} onChange={(e) => setText(e.target.value)} onBlur={commit} />
      )}
      {hint ? <span className="agentry-field__hint">{hint}</span> : null}
    </label>
  );
}

function ReferenceHint({ incoming }: { incoming: IncomingSource[] }) {
  const refs = incoming.flatMap((source) =>
    source.id === WORKFLOW_INPUT_ID ? ['{input}'] : [`{${source.id}}`, ...source.fields.map((f) => `{${source.id}.${f.key}}`)],
  );
  if (!refs.includes('{input}')) refs.push('{input}');
  return (
    <div className="agentry-field">
      <span className="agentry-field__label">Available references</span>
      <div className="agentry-vars__list">
        {refs.map((ref) => (
          <code className="agentry-vars__key" key={ref}>
            {ref}
          </code>
        ))}
      </div>
      <span className="agentry-field__hint">
        {'{node}'} is that upstream&apos;s whole output, {'{node.field}'} a field of its JSON, {'{input}'} the run input.
        Other braces are left as written.
      </span>
    </div>
  );
}

export function ToolSection({
  spec,
  incoming,
  onChange,
}: {
  spec: ToolSpec;
  incoming: IncomingSource[];
  onChange: (next: ToolSpec) => void;
}) {
  const patch = <S extends ToolSpec>(current: S, partial: Partial<S>) => onChange({ ...current, ...partial });

  return (
    <section className="agentry-section">
      <span className="agentry-section__title">Tool</span>

      <label className="agentry-field">
        <span className="agentry-field__label">Kind</span>
        <select className="agentry-select" value={spec.kind} onChange={(event) => onChange(defaultToolSpec(event.target.value as ToolKind))}>
          {TOOL_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {KIND_LABEL[kind]}
            </option>
          ))}
        </select>
        <span className="agentry-field__hint">Runs without a model; its output is always JSON.</span>
      </label>

      {spec.kind === 'http' && (
        <>
          <label className="agentry-field">
            <span className="agentry-field__label">Method</span>
            <select className="agentry-select" value={spec.method ?? 'GET'} onChange={(event) => patch(spec, { method: event.target.value as HttpMethod })}>
              {HTTP_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <DeferredText key={`url-${spec.url}`} label="URL" value={spec.url} placeholder="https://…/{find.url}" hint="A URL that is exactly one reference is used as is; otherwise values are URL-encoded." onCommit={(url) => patch(spec, { url })} />
          <DeferredText key={`h-${headersToText(spec.headers)}`} label="Headers" rows={2} value={headersToText(spec.headers)} placeholder={'Accept: application/json'} hint="One per line, Name: value." onCommit={(text) => patch(spec, { headers: textToHeaders(text) })} />
          <DeferredText key={`b-${bodyToText(spec.body)}`} label="Body" rows={3} value={bodyToText(spec.body)} placeholder={'{"q": "{input}"}'} hint="A JSON object is sent as JSON (string values templated); anything else is sent as text." onCommit={(text) => patch(spec, { body: textToBody(text) })} />
          <DeferredText key={`t-${spec.timeout_s}`} label="Timeout (s)" value={String(spec.timeout_s ?? HTTP_TIMEOUT_S)} onCommit={(raw) => patch(spec, { timeout_s: numberOr(raw, HTTP_TIMEOUT_S) })} />
          <label className="agentry-checkbox">
            <input type="checkbox" checked={Boolean(spec.allow_failure)} onChange={(event) => patch(spec, { allow_failure: event.target.checked || undefined })} />
            <span>Continue on a non-2xx status</span>
          </label>
        </>
      )}

      {spec.kind === 'read_file' && (
        <DeferredText key={`p-${spec.path}`} label="Path" value={spec.path} placeholder="data/{input}.json" hint="Relative to the project directory; cannot leave it. Up to 2 MB." onCommit={(path) => patch(spec, { path })} />
      )}

      {spec.kind === 'write_file' && (
        <>
          <DeferredText key={`p-${spec.path}`} label="Path" value={spec.path} placeholder="out/{find.name}.md" hint="Relative to the project directory; cannot leave it. Parent folders are created." onCommit={(path) => patch(spec, { path })} />
          <DeferredText key={`c-${spec.content ?? ''}`} label="Content" rows={3} value={spec.content ?? ''} placeholder="empty = the first upstream's whole output" onCommit={(content) => patch(spec, { content: content || undefined })} />
          <label className="agentry-field">
            <span className="agentry-field__label">Mode</span>
            <select className="agentry-select" value={spec.mode ?? 'overwrite'} onChange={(event) => patch(spec, { mode: event.target.value === 'append' ? 'append' : 'overwrite' })}>
              <option value="overwrite">overwrite</option>
              <option value="append">append</option>
            </select>
          </label>
        </>
      )}

      {spec.kind === 'script' && (
        <>
          <DeferredText
            key={`cmd-${Array.isArray(spec.command) ? spec.command.join('\n') : spec.command}`}
            label="Command"
            rows={3}
            value={Array.isArray(spec.command) ? spec.command.join('\n') : spec.command}
            placeholder={'python3\nscripts/process.py\n{find.file}'}
            hint="One argument per line = run directly, arguments templated. A single line with spaces = a shell command, NOT templated."
            onCommit={(text) => {
              const lines = linesToList(text);
              patch(spec, { command: lines.length === 1 && /\s/.test(lines[0] ?? '') ? (lines[0] ?? '') : lines });
            }}
          />
          <DeferredText key={`cwd-${spec.cwd ?? ''}`} label="Working directory" value={spec.cwd ?? ''} placeholder="(project directory)" onCommit={(cwd) => patch(spec, { cwd: cwd || undefined })} />
          <DeferredText key={`t-${spec.timeout_s}`} label="Timeout (s)" value={String(spec.timeout_s ?? SCRIPT_TIMEOUT_S)} hint="On timeout the whole process tree is killed and the node fails." onCommit={(raw) => patch(spec, { timeout_s: numberOr(raw, SCRIPT_TIMEOUT_S) })} />
          <label className="agentry-checkbox">
            <input type="checkbox" checked={Boolean(spec.allow_failure)} onChange={(event) => patch(spec, { allow_failure: event.target.checked || undefined })} />
            <span>Continue on a non-zero exit</span>
          </label>
          <p className="agentry-field__hint">
            Runs on the machine where the workflow runs. The script gets {'{ input, upstream }'} as JSON on stdin and in <code>AGENTRY_INPUT_FILE</code>; JSON printed to stdout becomes <code>result</code>.
          </p>
        </>
      )}

      <ReferenceHint incoming={incoming} />
    </section>
  );
}
