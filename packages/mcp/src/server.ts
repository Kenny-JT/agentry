/** The MCP server: ten tools over one {@link Project} and its {@link Runs}. */
import { McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import { applyOperations } from './edit';
import { Project, ToolError, summarizeNodes } from './project';
import type { Runs } from './runs';
import { toolInputs } from './schemas';

export const SERVER_INFO = { name: 'agentry', version: '0.1.0' } as const;

const text = (data: unknown): CallToolResult => ({ content: [{ type: 'text', text: JSON.stringify(data) }] });
const failure = (message: string): CallToolResult => ({ isError: true, content: [{ type: 'text', text: message }] });

/** Every tool answers; a refusal or a fault becomes an isError result the model can act on. */
const guarded = <A>(run: (args: A) => Promise<unknown> | unknown) => async (args: A): Promise<CallToolResult> => {
  try {
    return text(await run(args));
  } catch (err) {
    if (err instanceof ToolError) return failure(err.message);
    return failure(`agentry-mcp: ${err instanceof Error ? err.message : String(err)}`);
  }
};

export function createServer(project: Project, runs: Runs): McpServer {
  const server = new McpServer(SERVER_INFO, { capabilities: { tools: {} } });

  server.registerTool('list_workflows', {
    title: 'List workflows',
    description: `Every workflow (*.yaml, *.yml) under ${project.workflowsDir}: file (use it as the file argument of the other tools), introduction, node count and the on: triggers that start it by itself.`,
    inputSchema: toolInputs.list_workflows,
    annotations: { readOnlyHint: true },
  }, guarded(() => ({ project: project.dir, workflows: project.list() })));

  server.registerTool('get_workflow', {
    title: 'Get a workflow',
    description: 'The YAML text of one workflow plus a node summary (id, type, agent, upstream ids, branch routes, trigger) and its current validation issues.',
    inputSchema: toolInputs.get_workflow,
    annotations: { readOnlyHint: true },
  }, guarded(({ file }) => {
    const { workflow, issues, errors, yaml } = project.check(file, undefined);
    return { file: project.relativeFile(file), introduction: workflow.introduction, yaml, nodes: summarizeNodes(workflow), order: workflow.workflow, issues, errors };
  }));

  server.registerTool('validate_workflow', {
    title: 'Validate a workflow',
    description: 'Check a workflow file or a YAML text: the runner\'s structural gate (missing prompt / agent_mapping, unknown node references, bad trigger shapes) and the editor\'s static checks (unknown inputs, branch fields, output fields, documenters, disconnected nodes). errors > 0 means the runner would refuse it.',
    inputSchema: toolInputs.validate_workflow,
    annotations: { readOnlyHint: true },
  }, guarded(({ file, yaml }) => {
    const { issues, errors } = project.check(file, yaml);
    return { ...(file !== undefined ? { file: project.relativeFile(file) } : {}), ok: errors === 0, errors, issues };
  }));

  server.registerTool('save_workflow', {
    title: 'Save a workflow',
    description: 'Write a complete workflow.yaml text to workflows/<file>. Refuses to replace an existing file unless overwrite is true, and refuses a text with validation errors unless force is true. Returns the issues either way.',
    inputSchema: toolInputs.save_workflow,
    annotations: { destructiveHint: true },
  }, guarded(({ file, yaml, overwrite, force }) => project.save(file, yaml, { overwrite: overwrite ?? false, force: force ?? false })));

  server.registerTool('edit_workflow', {
    title: 'Edit a workflow',
    description: 'Apply a list of patch operations to an existing workflow, in order, as one atomic change: add_node, remove_node (also drops every reference), update_node, connect, disconnect, rename_node (rewrites every reference and {id.field} prompt tokens), set_branch, set_workflow_io. The result is validated and written only when every operation applied and it has no errors (or force is true). Returns the new YAML and its issues.',
    inputSchema: toolInputs.edit_workflow,
    annotations: { destructiveHint: true },
  }, guarded(({ file, operations, force }) => {
    const { workflow } = project.check(file, undefined);
    const edited = applyOperations(workflow, operations);
    return { ...project.saveWorkflow(file, edited, force ?? false), nodes: summarizeNodes(edited) };
  }));

  server.registerTool('run_workflow', {
    title: 'Run a workflow',
    description: 'Start a run of workflows/<file> in this project through its opencode server (started when needed) and the Agentry plugin, and return its run_id at once — the run continues on its own. Follow it with get_run or wait_for_run; stop it with cancel_run. Needs opencode and the Agentry plugin (.opencode/plugins/agentry.js) in the project.',
    inputSchema: toolInputs.run_workflow,
  }, guarded(async ({ file, input }) => {
    const rel = project.relativeFile(file);
    const { errors, issues } = project.check(rel, undefined);
    if (errors) throw new ToolError(`${rel} has ${errors} validation error(s); the runner would refuse it:\n${issues.filter((i) => i.severity === 'error').map((i) => `- ${i.message}`).join('\n')}`);
    return { file: rel, ...(await runs.start(rel, input)) };
  }));

  server.registerTool('get_run', {
    title: 'Get a run',
    description: 'State of one run (default: the latest): status (running | done | failed | cancelled), every node with its state, agent, iteration, duration and a short output preview, and the run report when the documenter wrote one. Live state comes from the panel while the run is going, the run directory afterwards.',
    inputSchema: toolInputs.get_run,
    annotations: { readOnlyHint: true },
  }, guarded(({ run_id }) => runs.get(run_id)));

  server.registerTool('wait_for_run', {
    title: 'Wait for a run',
    description: 'Poll a run until it finishes or timeout_s passes (default 45 s, max 50 — hosts cut long tool calls), then answer like get_run. Call it again while status is still running.',
    inputSchema: toolInputs.wait_for_run,
    annotations: { readOnlyHint: true },
  }, guarded(({ run_id, timeout_s }) => runs.wait(run_id, timeout_s ?? 45)));

  server.registerTool('list_runs', {
    title: 'List runs',
    description: 'Runs of this project, newest first: run_id, status, workflow and start time.',
    inputSchema: toolInputs.list_runs,
    annotations: { readOnlyHint: true },
  }, guarded(({ limit }) => runs.list(limit ?? 10)));

  server.registerTool('cancel_run', {
    title: 'Cancel a run',
    description: 'Stop the running workflow (the run ends at its next step boundary and can be resumed from the panel). Says so when nothing is running.',
    inputSchema: toolInputs.cancel_run,
    annotations: { destructiveHint: true },
  }, guarded(({ run_id }) => runs.cancel(run_id)));

  return server;
}
