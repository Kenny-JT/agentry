export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export interface OpenedFile {
  name: string;
  content: string;
}

const YAML_FILTERS = [{ name: 'YAML', extensions: ['yaml', 'yml'] }];

export async function saveYamlFile(filename: string, yaml: string): Promise<void> {
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { invoke } = await import('@tauri-apps/api/core');
    const path = await save({ defaultPath: filename, filters: YAML_FILTERS });
    if (!path) return;
    await invoke('write_text_file', { path, contents: yaml });
    return;
  }

  const blob = new Blob([yaml], { type: 'text/yaml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function openYamlFile(): Promise<OpenedFile | null> {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { invoke } = await import('@tauri-apps/api/core');
    const selected = await open({ multiple: false, directory: false, filters: YAML_FILTERS });
    if (typeof selected !== 'string') return null;
    const content = await invoke<string>('read_text_file', { path: selected });
    return { name: selected.split(/[\\/]/).pop() || 'workflow.yaml', content };
  }

  return openYamlFileWeb();
}

function openYamlFileWeb(): Promise<OpenedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.yaml,.yml,application/x-yaml,text/yaml';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve({ name: file.name, content: String(reader.result ?? '') }));
      reader.addEventListener('error', () => resolve(null));
      reader.readAsText(file);
    });
    input.click();
  });
}
