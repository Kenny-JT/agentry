import { useId, useState } from 'react';
import { BrandMark, ExportIcon, ImportIcon, SaveIcon, SettingsIcon } from './icons';
import type { RunConnectionStatus } from '../useRunEvents';

export interface ToolbarProps {
  workflowName: string;
  onWorkflowNameChange: (name: string) => void;
  onSave: () => void;
  onImport: () => void;
  onExport: () => void;
  observing: boolean;
  onToggleObserve: () => void;
  observeStatus: RunConnectionStatus;
  observePort: number | null;
  observeRunEnded: boolean;
  projectRoot: string;
  onProjectRootChange: (root: string) => void;
  panelPort: string;
  onPanelPortChange: (port: string) => void;
}

function observeStatusText(
  status: RunConnectionStatus,
  port: number | null,
  runEnded: boolean,
  overridePort: string,
): string {
  switch (status) {
    case 'idle':
      return 'Not observing';
    case 'searching':
      return 'Looking for panel.json…';
    case 'connecting':
      return 'Probing panel…';
    case 'connected':
      return `${runEnded ? 'Run finished' : 'Connected'} · :${port ?? '?'}`;
    case 'stale':
      return 'Panel is stale — rerun the workflow';
    case 'port-unreachable':
      return `No panel on :${overridePort.trim() || '?'} — check the port`;
    case 'disconnected':
      return 'Connection lost — retrying…';
  }
}

export function Toolbar({
  workflowName,
  onWorkflowNameChange,
  onSave,
  onImport,
  onExport,
  observing,
  onToggleObserve,
  observeStatus,
  observePort,
  observeRunEnded,
  projectRoot,
  onProjectRootChange,
  panelPort,
  onPanelPortChange,
}: ToolbarProps) {
  const [observeConfigOpen, setObserveConfigOpen] = useState(false);
  const popoverId = useId();
  const statusText = observeStatusText(observeStatus, observePort, observeRunEnded, panelPort);

  return (
    <header className="agentry-toolbar">
      <div className="agentry-toolbar__brand">
        <span className="agentry-brand__mark">
          <BrandMark size={20} />
        </span>
        <span className="agentry-brand__name">Agentry</span>
        <span className="agentry-brand__divider" />
        <input
          className="agentry-toolbar__file"
          value={workflowName}
          onChange={(event) => onWorkflowNameChange(event.target.value)}
          aria-label="Workflow name"
          spellCheck={false}
        />
      </div>

      <div className="agentry-toolbar__actions">
        <div className="agentry-observe">
          <button
            type="button"
            className={`agentry-btn agentry-btn--ghost agentry-observe__toggle${observing ? ' is-active' : ''}`}
            onClick={onToggleObserve}
            title={statusText}
          >
            <span className={`agentry-observe__dot is-${observeStatus}`} aria-hidden="true" />
            {observing ? 'Observing' : 'Observe'}
          </button>
          <button
            type="button"
            className="agentry-iconbtn agentry-observe__gear"
            onClick={() => setObserveConfigOpen((open) => !open)}
            aria-label="Observe settings"
            aria-expanded={observeConfigOpen}
            aria-controls={popoverId}
          >
            <SettingsIcon size={14} />
          </button>
          {observeConfigOpen && (
            <div className="agentry-observe__popover" id={popoverId}>
              <div className="agentry-field">
                <label className="agentry-field__label" htmlFor={`${popoverId}-root`}>
                  Project root
                </label>
                <input
                  id={`${popoverId}-root`}
                  className="agentry-input agentry-input--mono"
                  value={projectRoot}
                  onChange={(event) => onProjectRootChange(event.target.value)}
                  placeholder="C:\path\to\project"
                  spellCheck={false}
                />
                <span className="agentry-field__hint">
                  Folder where the plugin writes .agentry/panel.json.
                </span>
              </div>
              <div className="agentry-field">
                <label className="agentry-field__label" htmlFor={`${popoverId}-port`}>
                  Panel port
                </label>
                <input
                  id={`${popoverId}-port`}
                  className="agentry-input agentry-input--mono"
                  value={panelPort}
                  onChange={(event) => onPanelPortChange(event.target.value)}
                  placeholder="auto"
                  inputMode="numeric"
                  spellCheck={false}
                />
                <span className="agentry-field__hint">
                  Manual override; leave empty to discover via panel.json.
                </span>
              </div>
              <div className="agentry-observe__status">
                <span className={`agentry-observe__dot is-${observeStatus}`} aria-hidden="true" />
                <span>{statusText}</span>
              </div>
            </div>
          )}
        </div>

        <button type="button" className="agentry-btn agentry-btn--ghost" onClick={onSave}>
          <SaveIcon size={15} />
          Save
        </button>
        <button type="button" className="agentry-btn agentry-btn--ghost" onClick={onImport}>
          <ImportIcon size={15} />
          Import
        </button>
        <button type="button" className="agentry-btn agentry-btn--ghost" onClick={onExport}>
          <ExportIcon size={15} />
          Export YAML
        </button>
      </div>
    </header>
  );
}
