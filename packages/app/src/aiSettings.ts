/**
 * Settings of the AI chat: which local opencode server answers, as whom, with
 * which model. Kept in localStorage like the other editor preferences; the
 * password never leaves this machine except in the Basic auth header of the
 * requests to that server.
 */

export interface AiSettings {
  /** Base URL of the opencode server, e.g. http://127.0.0.1:4096. */
  url: string;
  /** OPENCODE_SERVER_PASSWORD of that server (the username is always `opencode`); empty when it has none. */
  password: string;
  /** Project directory the chat session is opened in (`?directory=`); empty for the server's own. */
  directory: string;
  /** opencode agent that answers; `plan` is read-only. */
  agent: string;
  /** `provider/model` override; empty for the agent's default model. */
  model: string;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  url: 'http://127.0.0.1:4096',
  password: '',
  directory: '',
  agent: 'plan',
  model: '',
};

const SETTINGS_KEY = 'agentry.ai.settings';
const PANEL_KEY = 'agentry.ai.panel';

const str = (value: unknown, fallback: string): string => (typeof value === 'string' ? value : fallback);

export function readAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_AI_SETTINGS;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_AI_SETTINGS;
    const stored = parsed as Record<string, unknown>;
    return {
      url: str(stored.url, DEFAULT_AI_SETTINGS.url),
      password: str(stored.password, ''),
      directory: str(stored.directory, ''),
      agent: str(stored.agent, DEFAULT_AI_SETTINGS.agent),
      model: str(stored.model, ''),
    };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export function writeAiSettings(settings: AiSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('agentry: failed to persist AI settings', error);
  }
}

export function readAiPanelOpen(): boolean {
  try {
    return localStorage.getItem(PANEL_KEY) === 'open';
  } catch {
    return false;
  }
}

export function writeAiPanelOpen(open: boolean): void {
  try {
    localStorage.setItem(PANEL_KEY, open ? 'open' : 'closed');
  } catch (error) {
    console.warn('agentry: failed to persist AI panel state', error);
  }
}
