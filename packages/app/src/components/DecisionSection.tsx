import { useState } from 'react';
import { DECISION_DEFAULT_MODEL, DECISION_QUESTION_TYPES, SCORE_LEVELS_MAX, SCORE_LEVELS_MIN } from '@agentry/core';
import type { DecisionQuestion, DecisionQuestionType, DecisionSpec } from '@agentry/core';
import { uniqueAgentId } from '../agentTemplates';
import type { IncomingSource } from './Inspector';
import { PlusIcon, TrashIcon } from './icons';
import { DeferredText, ReferenceHint } from './ToolSection';

const TYPE_LABEL: Record<DecisionQuestionType, string> = {
  choice: 'Choice',
  yes_no: 'Yes / no',
  score: 'Score',
};

const PLACEHOLDER: Record<DecisionQuestionType, string> = {
  choice: 'Which option fits the input?',
  yes_no: 'A statement, e.g. The change touches the public API.',
  score: 'What to rate, e.g. How risky is this change?',
};

/** A question renamed in place; the parent moves `branch_on` along with it. */
export type QuestionRename = { from: string; to: string };

type Entry = [string, DecisionQuestion];

const linesOf = (text: string): string[] => text.split('\n').map((line) => line.trim()).filter(Boolean);

const optionsToText = (options: Record<string, string | null>): string =>
  Object.entries(options)
    .map(([name, description]) => (description ? `${name}: ${description}` : name))
    .join('\n');

/** One option per line: a name, optionally followed by `: when it applies`. */
function textToOptions(text: string): Record<string, string | null> {
  const options: Record<string, string | null> = {};
  for (const line of linesOf(text)) {
    const colon = line.indexOf(':');
    const name = (colon > 0 ? line.slice(0, colon) : line).trim();
    if (name) options[name] = colon > 0 ? line.slice(colon + 1).trim() || null : null;
  }
  return options;
}

/** A new type keeps the wording; options and levels survive only where the type has them. */
function retype(question: DecisionQuestion, type: DecisionQuestionType): DecisionQuestion {
  const { instructions } = question;
  switch (type) {
    case 'choice':
      return { type, instructions, options: question.type === 'choice' ? question.options : { yes: null, no: null } };
    case 'score':
      return { type, instructions, levels: question.type === 'score' ? question.levels : ['low', 'medium', 'high'] };
    case 'yes_no':
      return { type, instructions };
  }
}

function QuestionCard({
  name,
  question,
  taken,
  removable,
  onRename,
  onChange,
  onRemove,
}: {
  name: string;
  question: DecisionQuestion;
  taken: readonly string[];
  removable: boolean;
  onRename: (next: string) => void;
  onChange: (next: DecisionQuestion) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(name);
  const commitName = () => {
    const next = draft.trim();
    if (!next || next === name || taken.includes(next)) setDraft(name);
    else onRename(next);
  };
  const { instructions } = question;

  return (
    <div className="agentry-subgroup">
      <div className="agentry-question__head">
        <input
          className="agentry-input agentry-input--mono"
          aria-label="Question name"
          title="The answer's field name in the output"
          value={draft}
          spellCheck={false}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
        <select
          className="agentry-select"
          aria-label={`Type of ${name}`}
          value={question.type}
          onChange={(event) => onChange(retype(question, event.target.value as DecisionQuestionType))}
        >
          {DECISION_QUESTION_TYPES.map((type) => (
            <option key={type} value={type}>
              {TYPE_LABEL[type]}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="agentry-iconbtn"
          title={removable ? 'Remove this question' : 'A decision needs at least one question'}
          aria-label={`Remove ${name}`}
          disabled={!removable}
          onClick={onRemove}
        >
          <TrashIcon size={14} />
        </button>
      </div>

      <DeferredText
        key={`i-${instructions}`}
        label={question.type === 'yes_no' ? 'Statement' : 'Question'}
        rows={2}
        mono={false}
        value={instructions}
        placeholder={PLACEHOLDER[question.type]}
        onCommit={(text) => onChange({ ...question, instructions: text })}
      />

      {question.type === 'choice' && (
        <DeferredText
          key={`o-${optionsToText(question.options)}`}
          label="Options"
          rows={3}
          value={optionsToText(question.options)}
          placeholder={'merge\nfix: It has a bug that must be fixed first'}
          hint="One per line: a name, optionally followed by a colon and when it applies. The answer is the option's name."
          onCommit={(text) => onChange({ type: 'choice', instructions, options: textToOptions(text) })}
        />
      )}
      {question.type === 'score' && (
        <DeferredText
          key={`l-${question.levels.join('\n')}`}
          label="Levels"
          rows={3}
          mono={false}
          value={question.levels.join('\n')}
          placeholder={'Can wait\nThis week\nToday'}
          hint={`${SCORE_LEVELS_MIN} to ${SCORE_LEVELS_MAX} lines, lowest first. The answer is the expected level: 0 is the first line, and it may fall between two.`}
          onCommit={(text) => onChange({ type: 'score', instructions, levels: linesOf(text) })}
        />
      )}
      {question.type === 'yes_no' && (
        <span className="agentry-field__hint">
          The answer is true when the statement is more likely true than not; <code>{name}_p</code> holds the probability.
        </span>
      )}
    </div>
  );
}

export function DecisionSection({
  spec,
  fallbackAgent,
  incoming,
  onChange,
  onFallbackAgent,
}: {
  spec: DecisionSpec;
  fallbackAgent: string;
  incoming: IncomingSource[];
  onChange: (next: DecisionSpec, renamed?: QuestionRename) => void;
  onFallbackAgent: (agent: string) => void;
}) {
  const entries: Entry[] = Object.entries(spec.questions);
  const names = entries.map(([name]) => name);
  const write = (next: Entry[], renamed?: QuestionRename) => onChange({ ...spec, questions: Object.fromEntries(next) }, renamed);
  const replace = (index: number, entry: Entry): Entry[] => entries.map((current, i) => (i === index ? entry : current));

  return (
    <section className="agentry-section">
      <span className="agentry-section__title">Decision</span>
      <p className="agentry-field__hint">
        Answers typed questions instead of writing text. With <code>TYPESAFE_API_KEY</code> set, Jev answers them with
        calibrated probabilities; without it, the fallback agent answers them as strict JSON.
      </p>

      {entries.map(([name, question], index) => (
        <QuestionCard
          key={name}
          name={name}
          question={question}
          taken={names}
          removable={entries.length > 1}
          onRename={(next) => write(replace(index, [next, question]), { from: name, to: next })}
          onChange={(next) => write(replace(index, [name, next]))}
          onRemove={() => write(entries.filter((_, i) => i !== index))}
        />
      ))}
      <button
        type="button"
        className="agentry-schema__add"
        onClick={() => write([...entries, [uniqueAgentId('question', names), { type: 'yes_no', instructions: '' }]])}
      >
        <PlusIcon size={13} />
        Add question
      </button>

      <DeferredText
        key={`s-${spec.state ?? ''}`}
        label="Ask about"
        rows={2}
        value={spec.state ?? ''}
        placeholder="(the outputs of all upstream steps)"
        hint="Leave empty to ask about the outputs of all upstream steps, keyed by step id."
        onCommit={(state) => onChange({ ...spec, state: state.trim() ? state : undefined })}
      />
      <DeferredText
        key={`f-${spec.for_each ?? ''}`}
        label="Ask about each item of"
        value={spec.for_each ?? ''}
        placeholder="{find.items}"
        hint="Batch mode: a reference to a JSON array. Every item gets the same questions and the output counts the answers. A batch decision does not route."
        onCommit={(forEach) => onChange({ ...spec, for_each: forEach.trim() ? forEach.trim() : undefined })}
      />
      <label className="agentry-field">
        <span className="agentry-field__label">Unsure below confidence</span>
        <input
          className="agentry-input"
          type="number"
          min={0}
          max={1}
          step={0.05}
          value={spec.min_confidence ?? ''}
          placeholder="0.6"
          onChange={(event) => {
            const raw = event.target.value;
            const value = Number(raw);
            onChange({ ...spec, min_confidence: raw.trim() === '' || !Number.isFinite(value) ? undefined : value });
          }}
        />
        <span className="agentry-field__hint">
          From 0 to 1. Answers with less confidence are listed in <code>unsure</code>; empty lists none.
        </span>
      </label>
      <DeferredText
        key={`m-${spec.model ?? ''}`}
        label="Jev model"
        value={spec.model ?? ''}
        placeholder={DECISION_DEFAULT_MODEL}
        onCommit={(model) => onChange({ ...spec, model: model.trim() ? model.trim() : undefined })}
      />
      <DeferredText
        key={`a-${fallbackAgent}`}
        label="Fallback agent"
        value={fallbackAgent}
        placeholder="general"
        hint="The opencode agent that answers when TYPESAFE_API_KEY is not set."
        onCommit={(agent) => onFallbackAgent(agent.trim())}
      />
      <ReferenceHint incoming={incoming} />
    </section>
  );
}
