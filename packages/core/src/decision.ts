/**
 * Decision nodes (PROVISIONAL, README "Decision steps"): typed answers with
 * calibrated probabilities instead of generated text. The node's `decision`
 * block names the questions; the runner asks them of Jev (TypeSafe's System One
 * model) when a key is configured, else of an LLM through a strict-JSON prompt.
 * No `prompt`; `agent_mapping` only names the fallback agent. This file is the
 * pure half (types, shape check, derived output schema, Jev wire mapping, the
 * state a node is asked about); the HTTP + LLM calls live in the plugin.
 */

import { extractJson } from './runtime';
import { renderTemplate } from './tool';
import type { TemplateScope } from './tool';

export const DECISION_QUESTION_TYPES = ['choice', 'yes_no', 'score'] as const;
export type DecisionQuestionType = (typeof DECISION_QUESTION_TYPES)[number];

export const DECISION_DEFAULT_MODEL = 'jev-latest';
export const SCORE_LEVELS_MIN = 2;
export const SCORE_LEVELS_MAX = 10;

export interface ChoiceQuestion {
  type: 'choice';
  instructions: string;
  /** Option -> description (null when the option name says it all). */
  options: Record<string, string | null>;
}

export interface YesNoQuestion {
  type: 'yes_no';
  /** A statement; the answer is the probability it is true. */
  instructions: string;
}

export interface ScoreQuestion {
  type: 'score';
  instructions: string;
  /** Ordered level descriptions, lowest first (2..10). The answer is the expected level: 0 is the first, and it may fall between two. */
  levels: string[];
}

export type DecisionQuestion = ChoiceQuestion | YesNoQuestion | ScoreQuestion;

export interface DecisionSpec {
  /** Jev model id; default `jev-latest`. */
  model?: string;
  /** Templated (`{ref}` language). Omitted = every upstream output, one JSON object keyed by step id. */
  state?: string;
  questions: Record<string, DecisionQuestion>;
  /** Batch mode: a template resolving to a JSON array; the questions are asked about every item. */
  for_each?: string;
  /** Answers whose confidence is below this are listed in `unsure` (0..1). */
  min_confidence?: number;
}

/** Field names the derived output schema reserves; a question may not use them. */
const RESERVED_NAMES = ['unsure', 'backend', 'items', 'counts', 'index'];
const NAME_RE = /^[A-Za-z_]\w*$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

function checkQuestion(at: string, name: string, raw: unknown, errors: string[]): void {
  if (!NAME_RE.test(name) || RESERVED_NAMES.includes(name)) {
    errors.push(`${at}: question name must be an identifier and not one of ${RESERVED_NAMES.join(', ')}`);
  }
  if (!isRecord(raw)) {
    errors.push(`${at}: expected an object`);
    return;
  }
  const type = raw.type;
  if (typeof type !== 'string' || !(DECISION_QUESTION_TYPES as readonly string[]).includes(type)) {
    errors.push(`${at}.type: expected one of ${DECISION_QUESTION_TYPES.join(', ')}, got ${JSON.stringify(type)}`);
    return;
  }
  if (!isText(raw.instructions)) errors.push(`${at}.instructions: required string`);
  switch (type as DecisionQuestionType) {
    case 'choice': {
      const options = raw.options;
      if (!isRecord(options) || Object.keys(options).length < 2) errors.push(`${at}.options: expected an object with at least two options`);
      else if (Object.values(options).some((v) => v !== null && typeof v !== 'string')) errors.push(`${at}.options: descriptions must be strings or null`);
      break;
    }
    case 'score': {
      const levels = raw.levels;
      if (!Array.isArray(levels) || levels.length < SCORE_LEVELS_MIN || levels.length > SCORE_LEVELS_MAX || !levels.every(isText)) {
        errors.push(`${at}.levels: expected ${SCORE_LEVELS_MIN}..${SCORE_LEVELS_MAX} level descriptions`);
      }
      break;
    }
    case 'yes_no':
      break;
  }
}

/**
 * Shape check of one node's `decision` block — reported by `checkRunnable`
 * (runner) and `validateWorkflow` (editor). `hasRoutes`: the node also carries
 * `routes[]`, which batch mode cannot drive.
 */
export function checkDecisionSpec(id: string, raw: unknown, hasRoutes = false): string[] {
  const at = `agents.${id}.decision`;
  if (!isRecord(raw)) return [`${at}: required object for a decision node`];
  const errors: string[] = [];
  const questions = raw.questions;
  if (!isRecord(questions) || Object.keys(questions).length === 0) errors.push(`${at}.questions: required non-empty object`);
  else for (const [name, question] of Object.entries(questions)) checkQuestion(`${at}.questions.${name}`, name, question, errors);
  if (raw.model !== undefined && !isText(raw.model)) errors.push(`${at}.model: expected a string`);
  if (raw.state !== undefined && typeof raw.state !== 'string') errors.push(`${at}.state: expected a string`);
  if (raw.for_each !== undefined && !isText(raw.for_each)) errors.push(`${at}.for_each: expected a template string`);
  const min = raw.min_confidence;
  if (min !== undefined && (typeof min !== 'number' || !(min >= 0 && min <= 1))) errors.push(`${at}.min_confidence: expected a number between 0 and 1`);
  if (hasRoutes && raw.for_each !== undefined) errors.push(`${at}.for_each: a batch decision cannot route (remove routes or for_each)`);
  return errors;
}

export const isBatchDecision = (spec: DecisionSpec | undefined): boolean => isText(spec?.for_each);

/** The confidence-style companion field of a question: `<name>_p` for yes/no, `<name>_confidence` otherwise. */
export const confidenceField = (name: string, question: DecisionQuestion): string =>
  question.type === 'yes_no' ? `${name}_p` : `${name}_confidence`;

/** Output schema a decision node always produces — derived from its questions, never hand-edited. */
export function decisionOutputSchema(spec: DecisionSpec): Record<string, string> {
  if (isBatchDecision(spec)) return { items: 'object[]', counts: 'object', unsure: 'number[]', backend: 'string' };
  const schema: Record<string, string> = {};
  for (const [name, question] of Object.entries(spec.questions)) {
    schema[name] = question.type === 'choice' ? 'string' : question.type === 'yes_no' ? 'boolean' : 'number';
    schema[confidenceField(name, question)] = 'number';
  }
  schema.unsure = 'string[]';
  schema.backend = 'string';
  return schema;
}

/** Runner-side agent label, e.g. `decision:jev`. */
export const decisionAgentLabel = (backend: 'jev' | 'llm'): string => `decision:${backend}`;

// ── Jev wire format (POST /v1/systemone) ──

export type JevQuestion =
  | { type: 'choice'; instructions: string; criteria: Record<string, string | null> }
  | { type: 'score'; instructions: string; criteria: string[] }
  | { type: 'noul'; instructions: string };

/** The `questions` map of a System One request, from the node's questions. */
export function toJevQuestions(spec: DecisionSpec): Record<string, JevQuestion> {
  const out: Record<string, JevQuestion> = {};
  for (const [name, q] of Object.entries(spec.questions)) {
    switch (q.type) {
      case 'choice':
        out[name] = { type: 'choice', instructions: q.instructions, criteria: q.options };
        break;
      case 'score':
        out[name] = { type: 'score', instructions: q.instructions, criteria: q.levels };
        break;
      case 'yes_no':
        out[name] = { type: 'noul', instructions: q.instructions };
        break;
    }
  }
  return out;
}

// ── the state a node is asked about ──

export interface DecisionStates {
  /** One state per request: a single state, or one per `for_each` item. */
  states: unknown[];
  /** Template references in scope that had no value. */
  notices: string[];
}

const parseJsonText = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return extractJson(text) ?? text;
  }
};

/**
 * Resolve what the questions are asked about. `state` renders through the
 * `{ref}` language; omitted, it is every upstream's output keyed by step id
 * (parsed when JSON), or the run input for an entry node. `for_each` must
 * render to a JSON array — each item is one state.
 */
export function decisionStates(spec: DecisionSpec, scope: TemplateScope): DecisionStates {
  const notices: string[] = [];
  if (isText(spec.for_each)) {
    const rendered = renderTemplate(spec.for_each, scope);
    notices.push(...rendered.notices);
    const list = parseJsonText(rendered.text);
    if (!Array.isArray(list)) throw new Error(`decision.for_each must resolve to a JSON array, got ${typeof list === 'string' ? 'text' : typeof list}`);
    return { states: list, notices };
  }
  if (typeof spec.state === 'string') {
    const rendered = renderTemplate(spec.state, scope);
    notices.push(...rendered.notices);
    return { states: [parseJsonText(rendered.text)], notices };
  }
  const upstream: Record<string, unknown> = {};
  for (const id of scope.sources) {
    const text = scope.outputs.get(id);
    if (text !== undefined) upstream[id] = parseJsonText(text);
  }
  if (Object.keys(upstream).length === 0) return { states: [scope.input === undefined ? {} : parseJsonText(scope.input)], notices };
  return { states: [upstream], notices };
}
