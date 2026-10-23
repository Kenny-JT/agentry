/** Input schemas of the tools — what a host's model sees in tools/list. */
import { z } from 'zod/v4';

const nodeId = z.string().min(1).describe('node id (a key of agents)');
const fileArg = z.string().describe('workflow file, relative to the project: workflows/<name>.yaml (the workflows/ prefix is optional)');

const condition = z
  .object({
    contains: z.string().optional(),
    not_contains: z.string().optional(),
    equals: z.string().optional(),
  })
  .describe('tested against the upstream output text, case-insensitive; keys are AND-combined');

export const triggerSchema = z
  .object({
    when: condition.extend({ from: nodeId.describe('upstream whose output is tested') }).optional().describe('run this node only when the condition holds, else skip it'),
    loop: z
      .object({
        max: z.number().int().min(1).describe('maximum iterations'),
        exit_when: condition.optional().describe('stop looping early when this holds'),
      })
      .optional()
      .describe('re-run the node until exit_when holds or max is reached'),
  })
  .describe('per-node control flow');

const routeCondition = z
  .object({
    equals: z.string().optional(),
    contains: z.string().optional(),
    not_contains: z.string().optional(),
    gte: z.number().optional(),
    gt: z.number().optional(),
    lte: z.number().optional(),
    lt: z.number().optional(),
  })
  .describe('gate of a branch port, tested against the branch_on value; omit for the default (else) port');

const outputSchema = z.record(z.string(), z.string()).describe('output field name -> type hint, e.g. {"files": "string[]", "summary": "string"}');
const agentName = z.string().describe('opencode agent the node runs as (build, explore, plan, ...)');
const nodeType = z.enum(['straight', 'branch', 'reporter', 'documenter', 'sub-workflow']);

export const operationSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('add_node'),
    id: nodeId,
    type: nodeType.optional().describe('default straight'),
    introduction: z.string().optional(),
    prompt: z.string().optional(),
    agent: agentName.optional().describe('default build'),
    from: z.union([z.string(), z.array(z.string())]).optional().describe('upstream node id(s) feeding this node'),
    output_schema: outputSchema.optional(),
  }),
  z.object({ op: z.literal('remove_node'), id: nodeId }).describe('delete a node and every reference to it'),
  z.object({
    op: z.literal('update_node'),
    id: nodeId,
    set: z.object({
      introduction: z.string().optional(),
      prompt: z.string().optional(),
      agent: agentName.optional(),
      type: nodeType.optional(),
      output_schema: outputSchema.optional(),
      trigger: triggerSchema.optional(),
      input_extra_info: z.string().optional(),
      join: z.enum(['all', 'any']).optional().describe('fan-in: wait for all upstreams (default) or fire on the first'),
    }),
  }),
  z.object({ op: z.literal('connect'), from: nodeId, to: nodeId }).describe('add an edge: to.input.from gains from (a branch source gains a route instead)'),
  z.object({ op: z.literal('disconnect'), from: nodeId, to: nodeId }),
  z.object({ op: z.literal('rename_node'), id: nodeId, new_id: nodeId }).describe('rename a node and rewrite every reference, including {id.field} tokens in prompts'),
  z.object({
    op: z.literal('set_branch'),
    id: nodeId,
    branch_on: z.string().describe('output field whose value picks the port'),
    routes: z.array(z.object({ to: nodeId, when: routeCondition.optional() })).describe('ports in priority order; first matching route wins, a route without when is the default'),
  }),
  z.object({
    op: z.literal('set_workflow_io'),
    input_description: z.string().optional(),
    output_description: z.string().optional(),
  }),
]);

export type Operation = z.infer<typeof operationSchema>;

export const toolInputs = {
  list_workflows: z.object({}),
  get_workflow: z.object({ file: fileArg }),
  validate_workflow: z.object({
    file: fileArg.optional(),
    yaml: z.string().optional().describe('YAML text to check instead of a file'),
  }),
  save_workflow: z.object({
    file: fileArg,
    yaml: z.string().describe('the complete workflow.yaml text'),
    overwrite: z.boolean().optional().describe('replace an existing file (default false)'),
    force: z.boolean().optional().describe('write even when validation reports errors (default false)'),
  }),
  edit_workflow: z.object({
    file: fileArg,
    operations: z.array(operationSchema).min(1).describe('applied in order; nothing is written if any fails'),
    force: z.boolean().optional().describe('write even when the result has validation errors (default false)'),
  }),
  run_workflow: z.object({
    file: fileArg,
    input: z.string().optional().describe('text handed to the entry nodes as the workflow input'),
    runtime: z
      .enum(['auto', 'opencode', 'claude', 'codex'])
      .optional()
      .describe('who runs the steps: opencode (its server + the Agentry plugin), claude (one headless `claude -p` per step) or codex (one `codex exec` per step); default auto = AGENTRY_RUNTIME, else opencode when the project has the Agentry plugin, else the host you are calling from, else opencode'),
  }),
  get_run: z.object({ run_id: z.string().optional().describe('default: the latest run') }),
  wait_for_run: z.object({
    run_id: z.string(),
    timeout_s: z.number().min(1).max(50).optional().describe('seconds to wait before answering anyway (default 45, max 50)'),
  }),
  list_runs: z.object({ limit: z.number().int().min(1).max(100).optional().describe('default 10') }),
  cancel_run: z.object({ run_id: z.string().optional().describe('default: whatever is running') }),
};
