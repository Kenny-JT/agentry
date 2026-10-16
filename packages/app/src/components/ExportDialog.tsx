import { useEffect, useState } from 'react';
import type { ValidationIssue } from '@agentry/core';
import { CloseIcon, CopyIcon, DownloadIcon, ErrorIcon, WarningIcon } from './icons';
import { saveYamlFile } from '../platform';

export interface ExportDialogProps {
  yaml: string;
  filename: string;
  issues?: ValidationIssue[];
  onClose: () => void;
}

export function ExportDialog({ yaml, filename, issues = [], onClose }: ExportDialogProps) {
  const [copied, setCopied] = useState(false);
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(yaml);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const onDownload = () => {
    void saveYamlFile(filename, yaml);
  };

  return (
    <div className="agentry-dialog__scrim" role="presentation" onClick={onClose}>
      <div
        className="agentry-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Export workflow YAML"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="agentry-dialog__head">
          <div className="agentry-dialog__titles">
            <span className="agentry-dialog__title">Export workflow</span>
            <code className="agentry-dialog__file">{filename}</code>
          </div>
          <button type="button" className="agentry-iconbtn" title="Close" onClick={onClose}>
            <CloseIcon size={16} />
          </button>
        </header>

        {issues.length > 0 && (
          <ul className="agentry-issues" role="status">
            {[...errors, ...warnings].map((issue, index) => (
              <li
                key={`${issue.code}-${issue.nodeId ?? issue.field ?? index}`}
                className={`agentry-issue is-${issue.severity}`}
              >
                {issue.severity === 'error' ? <ErrorIcon size={14} /> : <WarningIcon size={14} />}
                <span className="agentry-issue__text">{issue.message}</span>
              </li>
            ))}
          </ul>
        )}

        <pre className="agentry-dialog__code">{yaml}</pre>

        <footer className="agentry-dialog__foot">
          <span className="agentry-dialog__hint">workflow.yaml v0 · provisional</span>
          <div className="agentry-dialog__actions">
            <button type="button" className="agentry-btn agentry-btn--ghost" onClick={onCopy}>
              <CopyIcon size={15} />
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button type="button" className="agentry-btn agentry-btn--primary" onClick={onDownload}>
              <DownloadIcon size={15} />
              Download .yaml
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
