/**
 * Workflow templates are ordinary workflow.yaml files that open with a comment
 * block the editor's template library reads: the first line is the title, then
 * `Use when:` and `Tags:` lines. Any other comment lines are for people reading
 * the file.
 */

export interface TemplateInfo {
  title: string;
  useWhen: string;
  tags: string[];
}

export function templateInfo(yamlText: string): TemplateInfo {
  const header: string[] = [];
  for (const line of yamlText.split(/\r?\n/)) {
    if (!line.startsWith('#')) break;
    header.push(line.replace(/^#\s?/, '').trim());
  }
  const field = (label: string): string => {
    const line = header.find((entry) => entry.toLowerCase().startsWith(label));
    return line ? line.slice(label.length).trim() : '';
  };
  return {
    title: header[0] ?? '',
    useWhen: field('use when:'),
    tags: field('tags:')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
  };
}
