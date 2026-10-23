import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import type { ValidationIssue } from '@agentry/core';
import { isEmptyChange } from '../aiProposal';
import type { ChangeSummary } from '../aiProposal';
import type { AiSettings } from '../aiSettings';
import type { AiChat, AiChatMessage, AiProposal } from '../useAiChat';
import { ChatIcon, PanelRightCloseIcon, PlusIcon, SendIcon, SettingsIcon, StopIcon, UndoIcon } from './icons';

export interface AiChatPanelProps {
  chat: AiChat;
  settings: AiSettings;
  onChangeSettings: (next: AiSettings) => void;
  onClose: () => void;
}

const EXAMPLE_REQUEST = 'Add a step that summarizes the final output in three bullet points';

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

function hostOf(url: string): string {
  try {
    return new URL(url.trim()).host;
  } catch {
    return url.trim() || 'no server set';
  }
}

function summaryLine(summary: ChangeSummary): string {
  if (isEmptyChange(summary)) return 'No change to the workflow';
  const parts: string[] = [];
  if (summary.nodesAdded.length) parts.push(`+${plural(summary.nodesAdded.length, 'step')}`);
  if (summary.nodesRemoved.length) parts.push(`\u2212${plural(summary.nodesRemoved.length, 'step')}`);
  if (summary.nodesChanged.length) parts.push(`${plural(summary.nodesChanged.length, 'step')} changed`);
  const rewired = summary.edgesAdded.length + summary.edgesRemoved.length;
  if (rewired) parts.push(`${plural(rewired, 'connection')} changed`);
  if (summary.metaChanged) parts.push('workflow details changed');
  return parts.join(' \u00b7 ');
}

function Issues({ issues, severity }: { issues: ValidationIssue[]; severity: 'error' | 'warning' }) {
  const matching = issues.filter((issue) => issue.severity === severity);
  if (!matching.length) return null;
  return (
    <div className={`agentry-chat__issues is-${severity}`}>
      <strong>{plural(matching.length, severity)}</strong>
      <ul>
        {matching.slice(0, 3).map((issue, index) => (
          <li key={index}>{issue.message}</li>
        ))}
        {matching.length > 3 && <li>and {matching.length - 3} more</li>}
      </ul>
    </div>
  );
}

function Proposal({ messageId, proposal, chat }: { messageId: number; proposal: AiProposal; chat: AiChat }) {
  const { summary } = proposal;
  return (
    <div className={`agentry-chat__proposal is-${proposal.status}`}>
      <span className="agentry-chat__summary">{summaryLine(summary)}</span>
      <ul className="agentry-chat__changes">
        {summary.nodesAdded.map((id) => (
          <li key={`+${id}`} className="is-added">+ {id}</li>
        ))}
        {summary.nodesRemoved.map((id) => (
          <li key={`-${id}`} className="is-removed">{'\u2212'} {id}</li>
        ))}
        {summary.nodesChanged.map((id) => (
          <li key={`~${id}`} className="is-changed">~ {id}</li>
        ))}
        {summary.edgesAdded.map((edge) => (
          <li key={`+${edge.from}>${edge.to}`} className="is-added">+ {edge.from} {'\u2192'} {edge.to}</li>
        ))}
        {summary.edgesRemoved.map((edge) => (
          <li key={`-${edge.from}>${edge.to}`} className="is-removed">{'\u2212'} {edge.from} {'\u2192'} {edge.to}</li>
        ))}
      </ul>
      <Issues issues={proposal.issues} severity="error" />
      <Issues issues={proposal.issues} severity="warning" />
      <details className="agentry-chat__yaml">
        <summary>YAML</summary>
        <pre>{proposal.yaml}</pre>
      </details>
      <div className="agentry-chat__decide">
        {proposal.status === 'pending' && (
          <>
            <button type="button" className="agentry-btn agentry-btn--primary" onClick={() => chat.apply(messageId)}>
              Apply
            </button>
            <button type="button" className="agentry-btn agentry-btn--ghost" onClick={() => chat.discard(messageId)}>
              Discard
            </button>
          </>
        )}
        {proposal.status === 'applied' && (
          <>
            <span className="agentry-chat__status is-applied">Applied</span>
            {chat.undoableId === messageId && (
              <button
                type="button"
                className="agentry-btn agentry-btn--ghost"
                title="Put the workflow back as it was before this change"
                onClick={() => chat.undo(messageId)}
              >
                <UndoIcon size={14} />
                Undo
              </button>
            )}
          </>
        )}
        {proposal.status === 'discarded' && <span className="agentry-chat__status">Discarded</span>}
        {proposal.status === 'undone' && <span className="agentry-chat__status">Undone</span>}
      </div>
    </div>
  );
}

function Message({ message, chat }: { message: AiChatMessage; chat: AiChat }) {
  if (message.role === 'user') return <div className="agentry-chat__msg is-user">{message.text}</div>;
  return (
    <div className={`agentry-chat__msg is-${message.role}`}>
      {message.text && <p className="agentry-chat__text">{message.text}</p>}
      {message.error && <p className="agentry-chat__error">{message.error}</p>}
      {message.hint && <p className="agentry-chat__hint">{message.hint}</p>}
      {message.proposal && <Proposal messageId={message.id} proposal={message.proposal} chat={chat} />}
    </div>
  );
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return <>{Math.max(0, Math.round((now - since) / 1000))} s</>;
}

function ConnectionSettings({ settings, onChange }: { settings: AiSettings; onChange: (next: AiSettings) => void }) {
  const set = (patch: Partial<AiSettings>) => onChange({ ...settings, ...patch });
  return (
    <div className="agentry-chat__settings">
      <label className="agentry-field">
        <span className="agentry-field__label">opencode server</span>
        <input
          className="agentry-input agentry-input--mono"
          value={settings.url}
          placeholder="http://127.0.0.1:4096"
          spellCheck={false}
          onChange={(event) => set({ url: event.target.value })}
        />
      </label>
      <label className="agentry-field">
        <span className="agentry-field__label">Password</span>
        <input
          className="agentry-input"
          type="password"
          autoComplete="off"
          value={settings.password}
          placeholder="OPENCODE_SERVER_PASSWORD"
          onChange={(event) => set({ password: event.target.value })}
        />
      </label>
      <label className="agentry-field">
        <span className="agentry-field__label">Project folder</span>
        <input
          className="agentry-input agentry-input--mono"
          value={settings.directory}
          placeholder="the server's own"
          spellCheck={false}
          onChange={(event) => set({ directory: event.target.value })}
        />
      </label>
      <div className="agentry-chat__pair">
        <label className="agentry-field">
          <span className="agentry-field__label">Agent</span>
          <input
            className="agentry-input agentry-input--mono"
            value={settings.agent}
            placeholder="plan"
            spellCheck={false}
            onChange={(event) => set({ agent: event.target.value })}
          />
        </label>
        <label className="agentry-field">
          <span className="agentry-field__label">Model</span>
          <input
            className="agentry-input agentry-input--mono"
            value={settings.model}
            placeholder="provider/model"
            spellCheck={false}
            onChange={(event) => set({ model: event.target.value })}
          />
        </label>
      </div>
      <span className="agentry-field__hint">
        Start opencode with OPENCODE_SERVER_PASSWORD set and let this editor in:{' '}
        <code>opencode serve --cors {window.location.origin}</code>. The password stays on this machine.
      </span>
    </div>
  );
}

export function AiChatPanel({ chat, settings, onChangeSettings, onClose }: AiChatPanelProps) {
  const [draft, setDraft] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [chat.messages, chat.busy]);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (chat.busy || !draft.trim()) return;
    chat.send(draft);
    setDraft('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <aside className="agentry-chat" aria-label="AI chat">
      <header className="agentry-chat__head">
        <span className="agentry-inspector__eyebrow">AI chat</span>
        <code className="agentry-chat__server" title={settings.url}>
          {hostOf(settings.url)}
        </code>
        <span className="agentry-chat__actions">
          <button
            type="button"
            className="agentry-iconbtn"
            aria-label="Connection settings"
            title="Connection settings"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((open) => !open)}
          >
            <SettingsIcon size={14} />
          </button>
          <button type="button" className="agentry-iconbtn" aria-label="New chat" title="New chat" onClick={chat.reset}>
            <PlusIcon size={14} />
          </button>
          <button type="button" className="agentry-iconbtn" aria-label="Hide AI chat" title="Hide AI chat" onClick={onClose}>
            <PanelRightCloseIcon size={14} />
          </button>
        </span>
      </header>
      {settingsOpen && <ConnectionSettings settings={settings} onChange={onChangeSettings} />}
      <div className="agentry-chat__log" ref={logRef} role="log" aria-live="polite">
        {chat.messages.length === 0 && !chat.busy && (
          <div className="agentry-chat__empty">
            <ChatIcon size={22} className="agentry-empty__icon" />
            <p className="agentry-empty__title">Ask for a change</p>
            <p className="agentry-empty__hint">
              The model edits a copy of this workflow; you see what changes before anything touches the canvas.
            </p>
            <button type="button" className="agentry-chat__example" onClick={() => setDraft(EXAMPLE_REQUEST)}>
              {EXAMPLE_REQUEST}
            </button>
          </div>
        )}
        {chat.messages.map((message) => (
          <Message key={message.id} message={message} chat={chat} />
        ))}
        {chat.busy && chat.startedAt !== null && (
          <div className="agentry-chat__busy" role="status">
            <span className="agentry-chat__spinner" aria-hidden="true" />
            Waiting for opencode {'\u00b7'} <Elapsed since={chat.startedAt} />
          </div>
        )}
      </div>
      <form className="agentry-chat__composer" onSubmit={submit}>
        <textarea
          className="agentry-input agentry-textarea agentry-chat__input"
          rows={3}
          value={draft}
          placeholder="Describe a change to this workflow"
          aria-label="Message"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
        />
        {chat.busy ? (
          <button type="button" className="agentry-btn agentry-btn--ghost" onClick={chat.stop}>
            <StopIcon size={12} />
            Stop
          </button>
        ) : (
          <button type="submit" className="agentry-btn agentry-btn--primary" disabled={!draft.trim()}>
            <SendIcon size={14} />
            Send
          </button>
        )}
      </form>
    </aside>
  );
}
