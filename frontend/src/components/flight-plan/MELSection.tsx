import { CollapsibleSection } from '../common/CollapsibleSection';
import { useDispatchEdit } from '../../contexts/DispatchEditContext';

interface MELSectionProps {
  melRestrictions?: string;
}

export function MELSection({ melRestrictions }: MELSectionProps) {
  const { canEditMEL, editableFields, onFieldChange } = useDispatchEdit();

  const text = (editableFields.melRestrictions ?? melRestrictions ?? '').trim();
  const hasItems = text.length > 0;
  const lines = hasItems ? text.split('\n').filter((l) => l.trim()) : [];

  if (canEditMEL) {
    return (
      <CollapsibleSection
        title="MEL & Restrictions"
        summary={hasItems ? `${lines.length} item${lines.length !== 1 ? 's' : ''}` : 'None'}
        useCheckmark
        status={hasItems ? 'amber' : 'green'}
        defaultOpen
      >
        <div>
          <label className="data-label block mb-1">MEL items (one per line)</label>
          <textarea
            value={editableFields.melRestrictions ?? melRestrictions ?? ''}
            onChange={(e) => onFieldChange('melRestrictions', e.target.value)}
            className="w-full h-20 rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-2 py-1.5 tabular-nums resize-none focus:outline-none focus:border-sky-400"
            placeholder="Enter MEL items, one per line..."
          />
        </div>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection
      title="MEL & Restrictions"
      summary={hasItems ? `${lines.length} item${lines.length !== 1 ? 's' : ''}` : 'None'}
      useCheckmark
      status={hasItems ? 'amber' : 'green'}
      defaultOpen
    >
      <div className="space-y-1.5 text-[11px]">
        {hasItems ? (
          lines.map((line, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500 mt-1 shrink-0" />
              <span className="text-acars-text">{line}</span>
            </div>
          ))
        ) : (
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-acars-muted">No active MELs or restrictions</span>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}
