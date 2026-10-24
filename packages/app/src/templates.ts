import { templateInfo, workflowFromYaml } from '@agentry/core';
import type { TemplateInfo, Workflow } from '@agentry/core';

export interface WorkflowTemplate extends TemplateInfo {
  id: string;
  workflow: Workflow;
}

// Bundled at build time, so the desktop app lists them without the repository at hand.
const sources = import.meta.glob<string>('../../../workflows/templates/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export const workflowTemplates: WorkflowTemplate[] = Object.entries(sources)
  .map(([file, text]) => ({
    id: file.slice(file.lastIndexOf('/') + 1).replace(/\.yaml$/, ''),
    ...templateInfo(text),
    workflow: workflowFromYaml(text),
  }))
  .sort((a, b) => a.title.localeCompare(b.title));
