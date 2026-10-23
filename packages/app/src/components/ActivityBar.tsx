import type { SidebarView } from '../App';
import { AgentsIcon, HistoryIcon, MoonIcon, SettingsIcon, SunIcon, TemplatesIcon } from './icons';
import { getThemeMode } from '@agentry/design';
import type { Theme } from '@agentry/design';

export interface ActivityBarProps {
  view: SidebarView;
  collapsed: boolean;
  onChange: (view: SidebarView) => void;
  theme: Theme;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
}

const items: ReadonlyArray<{ id: SidebarView; label: string; Icon: typeof AgentsIcon }> = [
  { id: 'agents', label: 'Agents', Icon: AgentsIcon },
  { id: 'templates', label: 'Templates', Icon: TemplatesIcon },
  { id: 'history', label: 'History', Icon: HistoryIcon },
];

export function ActivityBar({
  view,
  collapsed,
  onChange,
  theme,
  onToggleTheme,
  onOpenSettings,
}: ActivityBarProps) {
  const isDark = getThemeMode(theme) === 'dark';
  return (
    <nav className="agentry-activitybar" aria-label="Primary views">
      {items.map(({ id, label, Icon }) => {
        const active = !collapsed && view === id;
        return (
        <button
          key={id}
          type="button"
          className={`agentry-activitybar__item${active ? ' is-active' : ''}`}
          aria-pressed={active}
          title={label}
          onClick={() => onChange(id)}
        >
          <Icon size={20} />
        </button>
        );
      })}
      <span className="agentry-activitybar__spacer" />
      <button
        type="button"
        className="agentry-activitybar__item"
        onClick={onToggleTheme}
        title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
        aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      >
        {isDark ? <SunIcon size={20} /> : <MoonIcon size={20} />}
      </button>
      <button
        type="button"
        className="agentry-activitybar__item"
        onClick={onOpenSettings}
        title="Settings"
        aria-label="Settings"
      >
        <SettingsIcon size={20} />
      </button>
    </nav>
  );
}
