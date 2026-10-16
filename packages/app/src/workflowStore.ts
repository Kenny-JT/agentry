import type { Workflow } from '@agentry/core';

export interface SavedWorkflow {
  id: string;
  name: string;
  workflow: Workflow;
  layout: Record<string, { x: number; y: number }>;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'agentry.workflows.v0';

export function listWorkflows(): SavedWorkflow[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SavedWorkflow[]) : [];
  } catch {
    return [];
  }
}

function writeAll(items: SavedWorkflow[]): SavedWorkflow[] {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.warn('agentry: failed to persist workflows', error);
  }
  return items;
}

export function upsertWorkflow(entry: SavedWorkflow): SavedWorkflow[] {
  const items = listWorkflows();
  const index = items.findIndex((item) => item.id === entry.id);
  if (index >= 0) items[index] = entry;
  else items.push(entry);
  return writeAll(items);
}

export function deleteWorkflow(id: string): SavedWorkflow[] {
  return writeAll(listWorkflows().filter((item) => item.id !== id));
}

export function newWorkflowId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `wf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
