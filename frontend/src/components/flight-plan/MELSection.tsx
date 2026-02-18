import { CollapsibleSection } from '../common/CollapsibleSection';

export function MELSection() {
  return (
    <CollapsibleSection title="MEL & Restrictions" summary="2 MELs | 1 Restriction">
      <div className="space-y-1.5 text-[11px]">
        <div className="flex items-start gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-acars-amber mt-1 shrink-0" />
          <span className="text-acars-text">MEL 28-41-01: Fuel Quantity Indicator (Center) — CAT C, 10 days remaining</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-acars-amber mt-1 shrink-0" />
          <span className="text-acars-text">MEL 34-51-02: APU Generator — CAT B, deferred 02FEB</span>
        </div>
        <div className="mt-2 pt-2 border-t border-acars-border/50 flex items-start gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-acars-red mt-1 shrink-0" />
          <span className="text-acars-text">Restriction: Max FL370 due MEL 28-41-01</span>
        </div>
      </div>
    </CollapsibleSection>
  );
}
