/**
 * Decision answers: the confidence formulas TypeSafe documents, the normalized
 * answer both backends produce, how a Jev response and an LLM's strict-JSON
 * reply become one, and the node's output record (single and batch).
 */

import { extractJson } from './runtime';
import { confidenceField } from './decision';
import type { DecisionQuestion, DecisionSpec } from './decision';

export type DecisionBackend = 'jev' | 'llm';

export type DecisionAnswer =
  | { type: 'choice'; choice: string; probabilities: Record<string, number>; confidence: number }
  | { type: 'score'; score: number; probabilities: number[]; confidence: number }
  | { type: 'yes_no'; p: number };

export type DecisionAnswers = Record<string, DecisionAnswer>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/** Three decimals: plenty to route on, without float noise in the output. */
const round3 = (x: number): number => Math.round(x * 1000) / 1000;

// ── confidence (docs.typesafe.ai/confidence) ──

/** `(p_max - 1/n) / (1 - 1/n)`: 0 at an even split, 1 when one option holds everything. */
export function choiceConfidence(probabilities: readonly number[]): number {
  const n = probabilities.length;
  if (n < 2) return 1;
  return clamp01((Math.max(...probabilities) - 1 / n) / (1 - 1 / n));
}

/** `1 - Σ p_i·|i - m| / MAD_uniform`, m = most likely level; neighbours cost less than far levels. */
export function scoreConfidence(probabilities: readonly number[]): number {
  const n = probabilities.length;
  if (n < 2) return 1;
  const m = probabilities.indexOf(Math.max(...probabilities));
  const spread = probabilities.reduce((sum, p, i) => sum + p * Math.abs(i - m), 0);
  const even = probabilities.reduce((sum, _, i) => sum + Math.abs(i - (n - 1) / 2), 0) / n;
  return clamp01(1 - spread / even);
}

/** `|2p - 1|`: the Choice formula on a yes/no split. */
export const yesNoConfidence = (p: number): number => clamp01(Math.abs(2 * p - 1));

export const answerConfidence = (answer: DecisionAnswer): number =>
  answer.type === 'yes_no' ? yesNoConfidence(answer.p) : answer.confidence;

/** Scale non-negative weights to sum 1; an all-zero list becomes an even split. */
function normalize(weights: readonly number[]): number[] {
  const safe = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const total = safe.reduce((a, b) => a + b, 0);
  return total > 0 ? safe.map((w) => w / total) : safe.map(() => 1 / safe.length);
}

const argmax = (values: readonly number[]): number => values.indexOf(Math.max(...values));

/** Probability-weighted mean level, the score Jev reports: 0 = the first level, may fall between two. */
const expectedLevel = (probabilities: readonly number[]): number => round3(probabilities.reduce((sum, p, i) => sum + p * i, 0));

// ── Jev response → answers ──

/** `answers` of a System One response, checked against the questions asked. Throws on a shape mismatch. */
export function fromJevAnswers(spec: DecisionSpec, raw: unknown): DecisionAnswers {
  if (!isRecord(raw)) throw new Error('Jev response has no answers object');
  const out: DecisionAnswers = {};
  for (const [name, q] of Object.entries(spec.questions)) {
    const a = raw[name];
    if (!isRecord(a)) throw new Error(`Jev answered nothing for "${name}"`);
    switch (q.type) {
      case 'choice': {
        const given = a.probabilities;
        if (typeof a.choice !== 'string' || !isRecord(given)) throw new Error(`Jev answer "${name}" is not a choice`);
        const probabilities = Object.fromEntries(Object.keys(q.options).map((opt) => [opt, Number(given[opt] ?? 0)]));
        const confidence = typeof a.confidence === 'number' ? a.confidence : choiceConfidence(Object.values(probabilities));
        out[name] = { type: 'choice', choice: a.choice, probabilities, confidence };
        break;
      }
      case 'score': {
        const given = a.probabilities;
        if (typeof a.score !== 'number' || !isRecord(given)) throw new Error(`Jev answer "${name}" is not a score`);
        const probabilities = q.levels.map((_, i) => Number(given[String(i)] ?? 0));
        const confidence = typeof a.confidence === 'number' ? a.confidence : scoreConfidence(probabilities);
        out[name] = { type: 'score', score: a.score, probabilities, confidence };
        break;
      }
      case 'yes_no': {
        if (typeof a.noul !== 'number') throw new Error(`Jev answer "${name}" is not a noul`);
        out[name] = { type: 'yes_no', p: clamp01(a.noul) };
        break;
      }
    }
  }
  return out;
}

// ── LLM fallback: one strict-JSON prompt per state ──

function describeQuestion(name: string, q: DecisionQuestion): string {
  switch (q.type) {
    case 'choice': {
      const options = Object.entries(q.options).map(([opt, desc]) => (desc ? `"${opt}" (${desc})` : `"${opt}"`)).join(', ');
      return `- "${name}" (choice): ${q.instructions}\n  Answer: an object mapping EVERY option to its probability, summing to 1. Options: ${options}.`;
    }
    case 'yes_no':
      return `- "${name}" (yes/no): ${q.instructions}\n  Answer: the probability (0..1) that this statement is true.`;
    case 'score':
      return `- "${name}" (score): ${q.instructions}\n  Answer: an array of ${q.levels.length} probabilities, one per level in order, summing to 1. Levels: ${q.levels.map((l, i) => `${i} = ${l}`).join('; ')}.`;
  }
}

/** The fallback prompt: calibrated probabilities per question, as one raw JSON object. */
export function decisionPrompt(spec: DecisionSpec, state: unknown): string {
  const stateText = typeof state === 'string' ? state : JSON.stringify(state, null, 2);
  return [
    'You are a calibrated classifier. Judge the STATE below and answer every question with probabilities that reflect your actual uncertainty.',
    '', 'STATE:', stateText, '', 'QUESTIONS:',
    ...Object.entries(spec.questions).map(([name, q]) => describeQuestion(name, q)),
    '',
    `Respond with ONLY a raw JSON object whose keys are exactly: ${Object.keys(spec.questions).map((n) => `"${n}"`).join(', ')}. No prose, no code fences.`,
  ].join('\n');
}

function choiceFromLlm(q: { options: Record<string, string | null> }, value: unknown): DecisionAnswer | undefined {
  const options = Object.keys(q.options);
  let weights: number[];
  if (typeof value === 'string') weights = options.map((opt) => (opt.toLowerCase() === value.trim().toLowerCase() ? 1 : 0));
  else if (isRecord(value)) weights = options.map((opt) => Number(value[opt] ?? 0));
  else return undefined;
  if (!weights.some((w) => w > 0)) return undefined;
  const probabilities = normalize(weights);
  const choice = options[argmax(probabilities)] ?? options[0] ?? '';
  return { type: 'choice', choice, probabilities: Object.fromEntries(options.map((opt, i) => [opt, probabilities[i] ?? 0])), confidence: choiceConfidence(probabilities) };
}

function scoreFromLlm(q: { levels: string[] }, value: unknown): DecisionAnswer | undefined {
  let weights: number[];
  if (Array.isArray(value) && value.length === q.levels.length) weights = value.map(Number);
  else if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < q.levels.length) weights = q.levels.map((_, i) => (i === value ? 1 : 0));
  else if (isRecord(value)) weights = q.levels.map((level, i) => Number(value[String(i)] ?? value[level] ?? 0));
  else return undefined;
  if (!weights.some((w) => w > 0)) return undefined;
  const probabilities = normalize(weights);
  return { type: 'score', score: expectedLevel(probabilities), probabilities, confidence: scoreConfidence(probabilities) };
}

function yesNoFromLlm(value: unknown): DecisionAnswer | undefined {
  if (typeof value === 'boolean') return { type: 'yes_no', p: value ? 1 : 0 };
  if (typeof value === 'number' && Number.isFinite(value)) return { type: 'yes_no', p: clamp01(value) };
  if (isRecord(value) && typeof value.p === 'number') return { type: 'yes_no', p: clamp01(value.p) };
  return undefined;
}

/** Parse the fallback reply; lenient about the shapes an LLM tends to pick. Throws naming the first unusable answer. */
export function parseLlmAnswers(spec: DecisionSpec, text: string): DecisionAnswers {
  const parsed = extractJson(text);
  if (!parsed) throw new Error('fallback reply holds no JSON object');
  const out: DecisionAnswers = {};
  for (const [name, q] of Object.entries(spec.questions)) {
    const value = parsed[name];
    const answer = q.type === 'choice' ? choiceFromLlm(q, value) : q.type === 'score' ? scoreFromLlm(q, value) : yesNoFromLlm(value);
    if (!answer) throw new Error(`fallback reply has no usable answer for "${name}": ${JSON.stringify(value)}`);
    out[name] = answer;
  }
  return out;
}

// ── output records ──

const answerValue = (answer: DecisionAnswer): string | number | boolean =>
  answer.type === 'choice' ? answer.choice : answer.type === 'score' ? answer.score : answer.p >= 0.5;

/** One state's flat record: `<name>`, its confidence field, and the names below `min_confidence`. */
export function decisionRecord(spec: DecisionSpec, answers: DecisionAnswers): Record<string, unknown> & { unsure: string[] } {
  const record: Record<string, unknown> = {};
  const unsure: string[] = [];
  const threshold = spec.min_confidence ?? 0;
  for (const [name, q] of Object.entries(spec.questions)) {
    const answer = answers[name];
    if (!answer) continue;
    record[name] = answerValue(answer);
    record[confidenceField(name, q)] = round3(answer.type === 'yes_no' ? answer.p : answer.confidence);
    if (answerConfidence(answer) < threshold) unsure.push(name);
  }
  return { ...record, unsure };
}

export interface BatchRecord {
  items: Array<Record<string, unknown>>;
  counts: Record<string, Record<string, number>>;
  unsure: number[];
}

/** Batch output: one record per item (with its index), tallies per choice / yes-no question, unsure item indices. */
export function batchRecord(spec: DecisionSpec, perItem: readonly DecisionAnswers[]): BatchRecord {
  const counts: Record<string, Record<string, number>> = {};
  for (const [name, q] of Object.entries(spec.questions)) if (q.type !== 'score') counts[name] = {};
  const unsure: number[] = [];
  const items = perItem.map((answers, index) => {
    const { unsure: itemUnsure, ...rest } = decisionRecord(spec, answers);
    if (itemUnsure.length) unsure.push(index);
    for (const name of Object.keys(counts)) {
      const key = String(rest[name]);
      const tally = counts[name] ?? {};
      tally[key] = (tally[key] ?? 0) + 1;
      counts[name] = tally;
    }
    return { index, ...rest };
  });
  return { items, counts, unsure };
}
