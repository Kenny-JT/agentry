/**
 * Static "typecheck" for a workflow: does every consumer get the fields it
 * needs from its producers? Pure — takes a serialized {@link Workflow} and
 * returns a flat issue list, so the editor (live + on export) and, later, the
 * plugin can run the exact same rules.
 */

import { checkDecisionSpec, decisionOutputSchema } from './decision';
import { dependencyGraph, feedbackLoopBody, findCycles } from './loops';
import { branchParents, FEEDBACK_MAX_LIMIT, inputSources, isRouter, isValidFeedbackMax, joinMode } from './runtime';
import { checkToolSpec, templateRefs, toolTemplateFields } from './tool';
import { checkTriggers } from './triggers';
import type { AgentDefinition, Workflow } from './workflow';

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: IssueSeverity;
  code: string;
  message: string;
  nodeId?: string;
  field?: string;
}

const asList = (from: string | string[] | undefined): string[] =>
  from === undefined ? [] : Array.isArray(from) ? from : [from];

/** A tool node's `tool` block: shape errors, plus a warning per `{ref}` that is not an upstream source or `input`. */
function toolIssues(id: string, def: AgentDefinition, sources: readonly string[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!def.tool) {
    issues.push({ severity: 'error', code: 'tool-missing', nodeId: id, field: 'tool', message: `"${id}" is a tool node but has no tool block.` });
    return issues;
  }
  for (const message of checkToolSpec(id, def.tool)) {
    issues.push({ severity: 'error', code: 'tool-invalid', nodeId: id, field: 'tool', message });
  }
  if (issues.length) return issues;
  for (const { field, text } of toolTemplateFields(def.tool)) {
    for (const ref of templateRefs(text)) {
      if (ref.root === 'input' || sources.includes(ref.root)) continue;
      issues.push({
        severity: 'warning',
        code: 'template-unknown-source',
        nodeId: id,
        field,
        message: `"${id}" references ${ref.raw} in tool.${field}, but "${ref.root}" is not an upstream of this node (nor "input") — it is left as written.`,
      });
    }
  }
  return issues;
}

/** A node's `input.feedback` block: it must close a loop, and it should have a way out. */
function feedbackIssues(id: string, workflow: Pick<Workflow, 'agents'>): ValidationIssue[] {
  const feedback = workflow.agents[id]?.input?.feedback;
  if (!feedback) return [];
  const issues: ValidationIssue[] = [];
  const from = feedback.from;
  if (!workflow.agents[from]) {
    issues.push({ severity: 'error', code: 'feedback-unknown', nodeId: id, field: from, message: `"${id}" loops back from "${from}", which is not a node in this workflow.` });
  } else if (!feedbackLoopBody(workflow, id)) {
    issues.push({ severity: 'error', code: 'feedback-not-loop', nodeId: id, field: from, message: `"${id}" loops back from "${from}", but "${from}" is not downstream of "${id}" — a loop-back edge must return from a node this one leads to.` });
  }
  if (feedback.max !== undefined && !isValidFeedbackMax(feedback.max)) {
    issues.push({ severity: 'error', code: 'feedback-max', nodeId: id, field: 'max', message: `"${id}" loops back with max ${JSON.stringify(feedback.max)}; expected a whole number from 1 to ${FEEDBACK_MAX_LIMIT}.` });
  }
  if (!feedback.when || Object.keys(feedback.when).length === 0) {
    issues.push({ severity: 'warning', code: 'loop-no-exit', nodeId: id, message: `"${id}" loops back from "${from}" without a condition, so it always runs the full ${feedback.max ?? 'default'} extra rounds.` });
  }
  return issues;
}

/** A decision node's `decision` block: shape errors, plus a warning per `{ref}` in `state` / `for_each` that is not an upstream source or `input`. */
function decisionIssues(id: string, def: AgentDefinition, sources: readonly string[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!def.decision) {
    issues.push({ severity: 'error', code: 'decision-missing', nodeId: id, field: 'decision', message: `"${id}" is a decision node but has no decision block.` });
    return issues;
  }
  for (const message of checkDecisionSpec(id, def.decision, def.routes !== undefined)) {
    issues.push({ severity: 'error', code: 'decision-invalid', nodeId: id, field: 'decision', message });
  }
  if (issues.length) return issues;
  const templated = [{ field: 'state', text: def.decision.state }, { field: 'for_each', text: def.decision.for_each }];
  for (const { field, text } of templated) {
    if (text === undefined) continue;
    for (const ref of templateRefs(text)) {
      if (ref.root === 'input' || sources.includes(ref.root)) continue;
      issues.push({
        severity: 'warning',
        code: 'template-unknown-source',
        nodeId: id,
        field,
        message: `"${id}" references ${ref.raw} in decision.${field}, but "${ref.root}" is not an upstream of this node (nor "input") — it is left as written.`,
      });
    }
  }
  return issues;
}

export function validateWorkflow(workflow: Workflow): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const agents = workflow.agents ?? {};
  const ids = Object.keys(agents);
  const has = (id: string): boolean => Boolean(agents[id]);
  const fieldsOf = (id: string): string[] => {
    const def = agents[id];
    if (def?.type === 'decision' && def.decision) return Object.keys(decisionOutputSchema(def.decision));
    return Object.keys(def?.output?.schema ?? {});
  };
  const parents = branchParents({ agents });

  const consumed = new Set<string>();
  const fed = new Set<string>();

  for (const cycle of findCycles(dependencyGraph({ agents }))) {
    const path = [...cycle, cycle[0]].map((node) => `"${node}"`).join(' → ');
    issues.push({
      severity: 'error',
      code: 'cycle',
      nodeId: cycle[0],
      message: `${path} is a cycle: every node waits for the one before it, so none can start. Turn one edge into a loop-back edge (input.feedback) to repeat these steps.`,
    });
  }

  for (const id of ids) {
    const def = agents[id];
    if (!def) continue;

    if (def.type === 'tool') issues.push(...toolIssues(id, def, inputSources(def, parents.get(id) ?? [])));
    if (def.type === 'decision') issues.push(...decisionIssues(id, def, inputSources(def, parents.get(id) ?? [])));

    const feedback = feedbackIssues(id, { agents });
    issues.push(...feedback);
    if (def.input?.feedback && !feedback.some((issue) => issue.severity === 'error')) {
      consumed.add(def.input.feedback.from);
      fed.add(id);
    }

    for (const from of asList(def.input?.from)) {
      if (has(from)) {
        consumed.add(from);
        fed.add(id);
      } else {
        issues.push({
          severity: 'error',
          code: 'unknown-input',
          nodeId: id,
          field: from,
          message: `"${id}" reads from "${from}", which is not a node in this workflow.`,
        });
      }
    }

    if (isRouter(def) && def.routes) {
      let feeds = false;
      for (const route of def.routes) {
        if (has(route.to)) {
          fed.add(route.to);
          feeds = true;
        } else {
          issues.push({
            severity: 'error',
            code: 'unknown-route',
            nodeId: id,
            field: route.to,
            message: `Branch "${id}" routes to "${route.to}", which is not a node in this workflow.`,
          });
        }
      }
      if (feeds) consumed.add(id);

      const routeField = def.branch_on?.trim();
      const hasConditions = def.routes.some((route) => route.when && Object.keys(route.when).length > 0);
      if (routeField) {
        if (!fieldsOf(id).includes(routeField)) {
          issues.push({
            severity: 'error',
            code: 'branch-field-missing',
            nodeId: id,
            field: routeField,
            message: `Branch "${id}" routes on "${routeField}", but its output schema declares no such field.`,
          });
        }
      } else if (hasConditions) {
        issues.push({
          severity: 'error',
          code: 'branch-on-missing',
          nodeId: id,
          message: `Branch "${id}" has conditional routes but no "route on" output field selected.`,
        });
      }

      // Only ONE port is ever taken and a default is the fallback, so a second
      // default (blank condition) can never fire.
      const defaults = def.routes.filter((route) => !route.when || Object.keys(route.when).length === 0);
      for (const unreachable of defaults.slice(1)) {
        issues.push({
          severity: 'warning',
          code: 'branch-extra-default',
          nodeId: id,
          field: unreachable.to,
          message: `Branch "${id}" has more than one default (else) port; only the first, "${defaults[0]?.to}", is ever taken, so "${unreachable.to}" never runs from it.`,
        });
      }

      // Alternative ports never both run, so a node fed by two of them that
      // waits for ALL its upstreams is always skipped — it needs join: any.
      const targets = new Set(def.routes.map((route) => route.to));
      for (const consumer of ids) {
        const consumerDef = agents[consumer];
        if (!consumerDef || joinMode(consumerDef) === 'any') continue;
        const alternatives = asList(consumerDef.input?.from).filter((from) => targets.has(from));
        if (alternatives.length < 2) continue;
        issues.push({
          severity: 'warning',
          code: 'join-all-over-branch',
          nodeId: consumer,
          field: id,
          message: `"${consumer}" merges alternative ports of branch "${id}" (${alternatives.join(', ')}) but waits for all of them, so it will always be skipped. Set "Fire when" to any upstream.`,
        });
      }
    }

    const join = def.input?.join;
    if (join !== undefined && join !== 'all' && join !== 'any') {
      issues.push({
        severity: 'error',
        code: 'join-invalid',
        nodeId: id,
        field: 'join',
        message: `"${id}" has input.join "${String(join)}"; expected "all" or "any".`,
      });
    }

    // `input.select` issues are WARNINGS, not errors: the runner just skips
    // fields it cannot find in the upstream's parsed JSON, so a stale filter
    // degrades to pass-more-than-intended rather than a broken run.
    for (const [upstream, kept] of Object.entries(def.input?.select ?? {})) {
      if (!has(upstream)) {
        issues.push({
          severity: 'warning',
          code: 'select-unknown-source',
          nodeId: id,
          field: upstream,
          message: `"${id}" selects fields from "${upstream}", which is not a node in this workflow.`,
        });
        continue;
      }
      const produced = fieldsOf(upstream);
      for (const keptField of kept) {
        if (!produced.includes(keptField)) {
          issues.push({
            severity: 'warning',
            code: 'select-field-unknown',
            nodeId: id,
            field: keptField,
            message: `"${id}" keeps "${upstream}.${keptField}", but "${upstream}" declares no such output field.`,
          });
        }
      }
    }

    const triggerFrom = def.trigger?.when?.from?.trim();
    if (triggerFrom && !has(triggerFrom)) {
      issues.push({
        severity: 'error',
        code: 'unknown-trigger',
        nodeId: id,
        field: triggerFrom,
        message: `"${id}" triggers on "${triggerFrom}", which is not a node in this workflow.`,
      });
    }
  }

  for (const problem of checkTriggers(workflow.on)) {
    issues.push({
      severity: 'error',
      code: 'trigger-invalid',
      field: problem.field ? `${problem.kind}.${problem.field}` : problem.kind,
      message: problem.message,
    });
  }

  for (const id of workflow.input?.to ?? []) if (has(id)) fed.add(id);
  const outputFrom = workflow.output?.from ?? [];
  for (const id of outputFrom) if (has(id)) consumed.add(id);

  const outputRequired = Object.keys(workflow.output?.schema ?? {});
  if (outputRequired.length) {
    const produced = new Set(outputFrom.flatMap(fieldsOf));
    for (const field of outputRequired) {
      if (!produced.has(field)) {
        issues.push({
          severity: 'error',
          code: 'output-field-unsatisfied',
          field,
          message: `Workflow output needs "${field}", but no node wired to OUT produces it.`,
        });
      }
    }
    if (!outputFrom.length) {
      issues.push({
        severity: 'warning',
        code: 'output-unconnected',
        message: 'Workflow output declares required fields, but no node is wired to OUT.',
      });
    }
  }

  // A documenter is the workflow's log.md aggregator: it implicitly reads every
  // upstream node's log.md and its output IS the whole-run log.md, delivered
  // outside the normal OUT channel. So it needs no downstream wiring — never
  // flag it as "not connected" — and a workflow may hold AT MOST ONE of them.
  const documenters = ids.filter((id) => agents[id]?.type === 'documenter');
  if (documenters.length > 1) {
    for (const id of documenters) {
      issues.push({
        severity: 'error',
        code: 'multiple-documenters',
        nodeId: id,
        message: `A workflow can have at most one documenter (its output is the whole-run log.md), but found ${documenters.length}.`,
      });
    }
  }

  for (const id of ids) {
    if (consumed.has(id) && fieldsOf(id).length === 0) {
      issues.push({
        severity: 'warning',
        code: 'empty-output',
        nodeId: id,
        message: `"${id}" is read by a downstream node but declares no output fields.`,
      });
    }
    if (!consumed.has(id) && !fed.has(id) && agents[id]?.type !== 'documenter') {
      issues.push({
        severity: 'warning',
        code: 'disconnected',
        nodeId: id,
        message: `"${id}" is not connected to anything.`,
      });
    }
  }

  return issues;
}

export const countErrors = (issues: ValidationIssue[]): number =>
  issues.reduce((total, issue) => (issue.severity === 'error' ? total + 1 : total), 0);
