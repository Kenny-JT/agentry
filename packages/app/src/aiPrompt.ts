/**
 * The prompt the AI chat sends for one edit: the request, the workflow as it is
 * now, a compact description of the file format, and the shape of the reply
 * the chat can parse (one sentence or two, then the complete file in a yaml
 * block).
 */

export const FORMAT_CHEAT_SHEET = `Format of workflow.yaml (keys of each step under \`agents\`):
- \`prompt\`, \`agent_mapping: { opencode: <agent> }\` and \`output: { schema: { field: type } }\`: what a step does, which opencode agent runs it, the shape of its answer. Types are hints such as string, number, boolean, string[].
- \`introduction\`: one line on the step; \`type\`: straight (default), branch, reporter, documenter, sub-workflow or tool.
- \`input.from\`: the id or list of ids whose output the step receives. With several ids it waits for all of them; \`input.join: any\` goes on as soon as the first one is done.
- \`input.select: { <upstream id>: [field, ...] }\`: pass only those fields of that upstream's output.
- \`input.extra_info\`: free text for the step; \`input.files\`: reference files.
- \`trigger.when: { from: <id>, contains | not_contains | equals: <text> }\`: run the step only if that upstream's output matches; otherwise it is skipped.
- \`trigger.loop: { max: <n>, exit_when: { contains | equals: <text> } }\`: run the step again until exit_when matches, at most max times.
- \`type: branch\` with \`branch_on: <output field>\` and \`routes: [{ to: <id>, when: { equals | contains | not_contains | gte | gt | lte | lt: <value> } }, { to: <id> }]\`: continue on the first route whose condition matches; a route without \`when\` is the default. A branch feeds its routes, so those steps do not list the branch in \`input.from\`.
- \`type: tool\` with \`tool: { kind: http | read_file | write_file | script, ... }\`: a step without a model. http takes url, method, headers, body; read_file takes path; write_file takes path, content, mode (overwrite | append); script takes command, cwd. Write \`{step_id}\` for an upstream's whole output, \`{step_id.field}\` for one field and \`{input}\` for the run input. Tool steps have no prompt and no agent_mapping.
- \`type: sub-workflow\` with \`tech_stack.workflow\`: a whole workflow embedded as one step.
Top level: \`introduction\`, \`type: pipeline\`, \`input: { description, to: [entry step ids] }\`, \`output: { description, from: [final step ids] }\`, optional \`on\` (file, schedule, web, mail, git triggers), and \`workflow\`: every step id in order. A step that is not listed in \`workflow\` does not run.`;

export const OUTPUT_CONTRACT =
  'Reply with one or two sentences, then the complete updated workflow in a single ```yaml block. Keep node ids that still exist. Do not read or write files and do not run tools; everything you need is above.';

export function buildEditPrompt(request: string, workflowYaml: string): string {
  return [
    'You are editing an Agentry workflow file (workflow.yaml) for a visual editor. Apply the request to the current workflow and nothing more.',
    '',
    'Request:',
    request.trim(),
    '',
    'Current workflow:',
    '```yaml',
    workflowYaml.trimEnd(),
    '```',
    '',
    FORMAT_CHEAT_SHEET,
    '',
    OUTPUT_CONTRACT,
  ].join('\n');
}
