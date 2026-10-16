import { useEffect } from 'react';
import { THEMES } from '@agentry/design';
import type { Theme, ThemeDef, ThemeMode } from '@agentry/design';
import { CheckIcon, CloseIcon } from './icons';

export interface SettingsPanelProps {
  theme: Theme;
  onSelectTheme: (id: Theme) => void;
  onClose: () => void;
}

const GROUPS: ReadonlyArray<{ mode: ThemeMode; label: string }> = [
  { mode: 'dark', label: 'Dark' },
  { mode: 'light', label: 'Light' },
];

function ThemeCard({
  def,
  active,
  onSelect,
}: {
  def: ThemeDef;
  active: boolean;
  onSelect: () => void;
}) {
  const { swatch } = def;
  return (
    <button
      type="button"
      className={`agentry-theme-card${active ? ' is-active' : ''}`}
      aria-pressed={active}
      title={def.label}
      onClick={onSelect}
    >
      <span className="agentry-theme-swatch" style={{ background: swatch.bg }} aria-hidden>
        <span className="agentry-theme-swatch__surface" style={{ background: swatch.surface }}>
          <span className="agentry-theme-swatch__bar" style={{ background: swatch.text }} />
          <span className="agentry-theme-swatch__pill" style={{ background: swatch.accent }} />
        </span>
        <span className="agentry-theme-swatch__dots">
          {swatch.hues.map((hue, index) => (
            <span
              key={`${hue}-${index}`}
              className="agentry-theme-swatch__dot"
              style={{ background: hue }}
            />
          ))}
        </span>
        {active && (
          <span className="agentry-theme-swatch__check" style={{ background: swatch.accent }}>
            <CheckIcon size={12} />
          </span>
        )}
      </span>
      <span className="agentry-theme-card__meta">
        <span className="agentry-theme-card__name">{def.label}</span>
        <span className="agentry-theme-card__tag">{def.mode === 'dark' ? 'Dark' : 'Light'}</span>
      </span>
    </button>
  );
}

export function SettingsPanel({ theme, onSelectTheme, onClose }: SettingsPanelProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="agentry-dialog__scrim" role="presentation" onClick={onClose}>
      <div
        className="agentry-dialog agentry-settings"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="agentry-dialog__head">
          <div className="agentry-dialog__titles">
            <span className="agentry-dialog__title">Settings</span>
          </div>
          <button type="button" className="agentry-iconbtn" title="Close" onClick={onClose}>
            <CloseIcon size={16} />
          </button>
        </header>

        <div className="agentry-settings__body">
          <section className="agentry-settings__section">
            <h3 className="agentry-settings__section-title">Appearance</h3>
            <p className="agentry-settings__section-label">Color theme</p>
            {GROUPS.map((group) => {
              const themes = THEMES.filter((def) => def.mode === group.mode);
              if (themes.length === 0) return null;
              return (
                <div key={group.mode} className="agentry-settings__group">
                  <span className="agentry-settings__group-label">{group.label}</span>
                  <div className="agentry-theme-grid">
                    {themes.map((def) => (
                      <ThemeCard
                        key={def.id}
                        def={def}
                        active={theme === def.id}
                        onSelect={() => onSelectTheme(def.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        </div>
      </div>
    </div>
  );
}
