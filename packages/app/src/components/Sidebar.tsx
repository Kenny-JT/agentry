import type { HistorySort, SidebarView } from '../App';
import { AGENT_DROP_MIME, agentGroupLabel, agentGroups, agentTemplates } from '../agentTemplates';
import type { AgentTemplate } from '../agentTemplates';
import type { SavedWorkflow } from '../workflowStore';
import { HistoryIcon, ImportIcon, ManageIcon, PlusIcon, SortIcon, TrashIcon } from './icons';

export interface HistoryProps {
  items: SavedWorkflow[];
  sort: HistorySort;
  onSort: (sort: HistorySort) => void;
  onOpen: (entry: SavedWorkflow) => void;
  onDelete: (id: string) => void;
  currentId: string | null;
}

export interface SidebarProps {
  view: SidebarView;
  onAddAgent: (template: AgentTemplate) => void;
  onImportSubworkflow: () => void;
  history: HistoryProps;
}

const historySortModes: readonly HistorySort[] = ['Name', 'Created', 'Edited'];

const historySortHint: Record<HistorySort, string> = {
  Name: 'A → Z',
  Created: 'Newest first',
  Edited: 'Recently edited',
};

function nextSort(current: HistorySort): HistorySort {
  const index = historySortModes.indexOf(current);
  return historySortModes[(index + 1) % historySortModes.length] ?? 'Name';
}

function sortItems(items: SavedWorkflow[], sort: HistorySort): SavedWorkflow[] {
  const copy = [...items];
  if (sort === 'Name') return copy.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'Created') return copy.sort((a, b) => b.createdAt - a.createdAt);
  return copy.sort((a, b) => b.updatedAt - a.updatedAt);
}

function relativeTime(timestamp: number): string {
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

const nodeCount = (item: SavedWorkflow): number => Object.keys(item.workflow.agents).length;

function AgentCard({ agent, onAddAgent }: { agent: AgentTemplate; onAddAgent: (template: AgentTemplate) => void }) {
  return (
    <article
      className="agentry-agentcard"
      title="Drag onto the canvas, or click to add"
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(AGENT_DROP_MIME, agent.id);
        event.dataTransfer.effectAllowed = 'move';
      }}
      onClick={() => onAddAgent(agent)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onAddAgent(agent);
        }
      }}
    >
      <span className="agentry-agentcard__glyph">{agent.name.charAt(0)}</span>
      <div className="agentry-agentcard__body">
        <div className="agentry-agentcard__row">
          <span className="agentry-agentcard__name">{agent.name}</span>
          <code className="agentry-agentcard__type">{agent.opencodeAgent}</code>
        </div>
        <p className="agentry-agentcard__desc">{agent.description}</p>
      </div>
    </article>
  );
}

function AgentsPanel({
  onAddAgent,
  onImportSubworkflow,
}: {
  onAddAgent: (template: AgentTemplate) => void;
  onImportSubworkflow: () => void;
}) {
  return (
    <section className="agentry-panel" aria-label="Agents library">
      <div className="agentry-sidebar__header">
        <span className="agentry-sidebar__title">Agents</span>
        <div className="agentry-sidebar__actions">
          <button type="button" className="agentry-iconbtn" title="New agent">
            <PlusIcon size={15} />
          </button>
          <button
            type="button"
            className="agentry-iconbtn"
            title="Import a .yaml as a sub-workflow node"
            onClick={onImportSubworkflow}
          >
            <ImportIcon size={15} />
          </button>
          <button type="button" className="agentry-iconbtn" title="Manage">
            <ManageIcon size={15} />
          </button>
        </div>
      </div>
      <div className="agentry-sidebar__body">
        {agentGroups.map((group) => (
          <div key={group} className="agentry-agentgroup">
            <span className="agentry-agentgroup__label">{agentGroupLabel[group]}</span>
            {agentTemplates
              .filter((agent) => agent.group === group)
              .map((agent) => (
                <AgentCard key={agent.id} agent={agent} onAddAgent={onAddAgent} />
              ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function HistoryPanel({ items, sort, onSort, onOpen, onDelete, currentId }: HistoryProps) {
  const sorted = sortItems(items, sort);

  return (
    <section className="agentry-panel" aria-label="Workflow history">
      <div className="agentry-sidebar__header">
        <span className="agentry-sidebar__title">History</span>
        <button
          type="button"
          className="agentry-sortcycle"
          title={`Sort: ${sort} (${historySortHint[sort]}) — click to cycle`}
          aria-label={`Sort by ${sort}. Click to cycle sort order.`}
          onClick={() => onSort(nextSort(sort))}
        >
          <span key={sort} className="agentry-sortcycle__icon">
            <SortIcon size={13} />
          </span>
          <span className="agentry-sortcycle__label">{sort}</span>
        </button>
      </div>
      {sorted.length === 0 ? (
        <div className="agentry-sidebar__body agentry-sidebar__body--center">
          <div className="agentry-empty">
            <HistoryIcon size={26} className="agentry-empty__icon" />
            <p className="agentry-empty__title">No saved workflows yet</p>
            <p className="agentry-empty__hint">Use Save in the toolbar; saved workflows appear here.</p>
          </div>
        </div>
      ) : (
        <div className="agentry-sidebar__body">
          {sorted.map((item) => (
            <article
              key={item.id}
              className={`agentry-historycard${item.id === currentId ? ' is-active' : ''}`}
              role="button"
              tabIndex={0}
              title={`${item.name}\n${nodeCount(item)} nodes · updated ${relativeTime(item.updatedAt)}`}
              onClick={() => onOpen(item)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpen(item);
                }
              }}
            >
              <div className="agentry-historycard__row">
                <span className="agentry-historycard__name">{item.name}</span>
                <button
                  type="button"
                  className="agentry-iconbtn"
                  title="Delete"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(item.id);
                  }}
                >
                  <TrashIcon size={14} />
                </button>
              </div>
              <span className="agentry-historycard__meta">
                {nodeCount(item)} nodes · {relativeTime(item.updatedAt)}
              </span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function Sidebar({ view, onAddAgent, onImportSubworkflow, history }: SidebarProps) {
  return (
    <aside className="agentry-sidebar">
      {view === 'agents' ? (
        <AgentsPanel onAddAgent={onAddAgent} onImportSubworkflow={onImportSubworkflow} />
      ) : (
        <HistoryPanel {...history} />
      )}
    </aside>
  );
}
