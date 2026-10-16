import type { WorkflowCanvasMode } from '@agentry/canvas';
import { ErrorIcon, WarningIcon } from './icons';

export interface StatusBarProps {
  mode: WorkflowCanvasMode;
  nodeCount: number;
  edgeCount: number;
  errorCount?: number;
  warningCount?: number;
  onShowIssues?: () => void;
}

export function StatusBar({
  mode,
  nodeCount,
  edgeCount,
  errorCount = 0,
  warningCount = 0,
  onShowIssues,
}: StatusBarProps) {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return (
    <footer className="agentry-statusbar">
      <div className="agentry-statusbar__group">
        <button
          type="button"
          className="agentry-statusbar__diag"
          onClick={onShowIssues}
          disabled={!onShowIssues}
          title={`${plural(errorCount, 'error')}, ${plural(warningCount, 'warning')}`}
        >
          <span className={`agentry-statusbar__diag-item${errorCount > 0 ? ' is-error' : ''}`}>
            <ErrorIcon size={13} />
            {errorCount}
          </span>
          <span className={`agentry-statusbar__diag-item${warningCount > 0 ? ' is-warning' : ''}`}>
            <WarningIcon size={13} />
            {warningCount}
          </span>
        </button>
        <span className="agentry-statusbar__mode">{mode === 'edit' ? 'EDIT' : 'RUN'}</span>
        <span className="agentry-statusbar__item">
          {nodeCount} nodes · {edgeCount} edges
        </span>
      </div>
      <div className="agentry-statusbar__group">
        <span className="agentry-statusbar__item">opencode</span>
        <span className="agentry-statusbar__item">workflow.yaml v0 · provisional</span>
      </div>
    </footer>
  );
}
