import { useCallback, useRef, useState } from 'react';
import { validateWorkflow, workflowFromYaml, workflowToYaml } from '@agentry/core';
import type { ValidationIssue, Workflow } from '@agentry/core';
import { AiRequestError, abortSession, createSession, isAbortError, sendPrompt } from './aiClient';
import type { ChatSession } from './aiClient';
import { buildEditPrompt } from './aiPrompt';
import { extractYamlBlock, summarizeWorkflowChange } from './aiProposal';
import type { ChangeSummary } from './aiProposal';
import type { AiSettings } from './aiSettings';

export type ProposalStatus = 'pending' | 'applied' | 'discarded' | 'undone';

/** A parsed, validated workflow the model proposed, waiting for Apply or Discard. */
export interface AiProposal {
  workflow: Workflow;
  yaml: string;
  summary: ChangeSummary;
  issues: ValidationIssue[];
  status: ProposalStatus;
}

export interface AiChatMessage {
  id: number;
  /** `system` lines are the chat's own notes: a failed request, a stopped turn. */
  role: 'user' | 'assistant' | 'system';
  text: string;
  /** Why nothing can be applied from this message, when that is the case. */
  error?: string;
  /** What to do about `error`, shown as-is. */
  hint?: string;
  proposal?: AiProposal;
}

export interface AiChat {
  messages: AiChatMessage[];
  /** A request is in flight. */
  busy: boolean;
  /** When the in-flight request started, for the elapsed counter. */
  startedAt: number | null;
  send: (text: string) => void;
  stop: () => void;
  /** Forget the thread: next message opens a new server session. */
  reset: () => void;
  apply: (messageId: number) => void;
  discard: (messageId: number) => void;
  undo: (messageId: number) => void;
  /** The applied change Undo would revert: always the newest one still applied. */
  undoableId: number | null;
}

export interface UseAiChatOptions {
  settings: AiSettings;
  /** The workflow as it is on the canvas; read when a message is sent. */
  workflow: Workflow;
  /** Puts the workflow on the canvas and returns what puts the canvas back. */
  onApply: (workflow: Workflow) => () => void;
}

/** The reply without its fenced code blocks: the model's one or two sentences. */
const proseOf = (text: string): string =>
  text
    .replace(/```[^\n]*\n[\s\S]*?```/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/** Turn a finished reply into a chat message, with a proposal when its YAML is a workflow. */
export function proposalMessage(reply: string, before: Workflow): Omit<AiChatMessage, 'id'> {
  const block = extractYamlBlock(reply);
  if (!block) {
    return {
      role: 'assistant',
      text: reply || 'The model sent an empty reply.',
      error: 'The reply has no ```yaml block, so there is nothing to apply.',
    };
  }
  const text = proseOf(reply);
  try {
    const workflow = workflowFromYaml(block);
    if (Object.keys(workflow.agents).length === 0) {
      return { role: 'assistant', text, error: 'The YAML in the reply has no `agents`, so it is not a workflow. Nothing applied.' };
    }
    return {
      role: 'assistant',
      text,
      proposal: {
        workflow,
        yaml: workflowToYaml(workflow),
        summary: summarizeWorkflowChange(before, workflow),
        issues: validateWorkflow(workflow),
        status: 'pending',
      },
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'invalid YAML';
    return { role: 'assistant', text, error: `The YAML in the reply could not be read (${detail}). Nothing applied.` };
  }
}

/** Where a session lives; a different server or directory means a new session. */
const sessionScope = (settings: AiSettings): string => `${settings.url.trim()}|${settings.directory.trim()}`;

export function useAiChat({ settings, workflow, onApply }: UseAiChatOptions): AiChat {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const latest = useRef({ settings, workflow, onApply });
  latest.current = { settings, workflow, onApply };
  const nextId = useRef(1);
  const thread = useRef<{ session: ChatSession; scope: string } | null>(null);
  const undoers = useRef(new Map<number, () => void>());
  const controller = useRef<AbortController | null>(null);

  const push = useCallback((message: Omit<AiChatMessage, 'id'>) => {
    const id = nextId.current;
    nextId.current += 1;
    setMessages((current) => {
      // A new proposal is built on the canvas as it is now; older pending ones are stale.
      const settled = message.proposal
        ? current.map((item) =>
            item.proposal?.status === 'pending' ? { ...item, proposal: { ...item.proposal, status: 'discarded' as const } } : item,
          )
        : current;
      return [...settled, { ...message, id }];
    });
  }, []);

  const send = useCallback(
    (text: string) => {
      const request = text.trim();
      if (!request || controller.current) return;
      const { settings: current, workflow: before } = latest.current;
      const prompt = buildEditPrompt(request, workflowToYaml(before));
      const abort = new AbortController();
      controller.current = abort;
      push({ role: 'user', text: request });
      setStartedAt(Date.now());
      void (async () => {
        try {
          const scope = sessionScope(current);
          if (!thread.current || thread.current.scope !== scope) {
            thread.current = { session: await createSession(current, abort.signal), scope };
          }
          const reply = await sendPrompt(current, thread.current.session, prompt, abort.signal);
          push(proposalMessage(reply.text, before));
        } catch (error) {
          if (isAbortError(error)) push({ role: 'system', text: 'Stopped.' });
          else if (error instanceof AiRequestError) {
            if (error.status === 404) thread.current = null;
            push({ role: 'system', text: '', error: `${error.message}.`, hint: error.hint });
          } else push({ role: 'system', text: '', error: error instanceof Error ? error.message : String(error) });
        } finally {
          if (controller.current === abort) {
            controller.current = null;
            setStartedAt(null);
          }
        }
      })();
    },
    [push],
  );

  const stop = useCallback(() => {
    const abort = controller.current;
    if (!abort) return;
    abort.abort();
    if (thread.current) void abortSession(latest.current.settings, thread.current.session);
  }, []);

  const reset = useCallback(() => {
    stop();
    thread.current = null;
    undoers.current.clear();
    setMessages([]);
  }, [stop]);

  const settle = useCallback((messageId: number, from: ProposalStatus, to: ProposalStatus) => {
    setMessages((current) =>
      current.map((item) =>
        item.id === messageId && item.proposal?.status === from
          ? { ...item, proposal: { ...item.proposal, status: to } }
          : item,
      ),
    );
  }, []);

  const apply = useCallback(
    (messageId: number) => {
      const target = messages.find((item) => item.id === messageId)?.proposal;
      if (!target || target.status !== 'pending') return;
      undoers.current.set(messageId, latest.current.onApply(target.workflow));
      settle(messageId, 'pending', 'applied');
    },
    [messages, settle],
  );

  const discard = useCallback((messageId: number) => settle(messageId, 'pending', 'discarded'), [settle]);

  const lastApplied = [...messages].reverse().find((item) => item.proposal?.status === 'applied')?.id;
  const undoableId = lastApplied !== undefined && undoers.current.has(lastApplied) ? lastApplied : null;
  const undo = useCallback(
    (messageId: number) => {
      const restore = undoers.current.get(messageId);
      if (messageId !== undoableId || !restore) return;
      restore();
      undoers.current.delete(messageId);
      settle(messageId, 'applied', 'undone');
    },
    [undoableId, settle],
  );

  return { messages, busy: startedAt !== null, startedAt, send, stop, reset, apply, discard, undo, undoableId };
}
