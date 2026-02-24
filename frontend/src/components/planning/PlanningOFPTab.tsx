import { useFlightPlanStore } from '../../stores/flightPlanStore';
import { FileText, DownloadSimple } from '@phosphor-icons/react';

export function PlanningOFPTab() {
  const { ofp } = useFlightPlanStore();

  if (!ofp) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-2 p-4">
        <FileText className="w-6 h-6 text-acars-muted/20" />
        <p className="text-[11px] text-acars-muted font-sans">Generate an OFP to view it here</p>
      </div>
    );
  }

  const handleDownload = () => {
    const blob = new Blob([ofp.rawText || `${ofp.origin} → ${ofp.destination}\nRoute: ${ofp.route}\nFL${Math.round(ofp.cruiseAltitude / 100)}`], {
      type: 'text/plain',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OFP_${ofp.origin}_${ofp.destination}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-acars-border">
        <span className="text-[11px] text-acars-muted font-mono">
          {ofp.origin} → {ofp.destination} | {ofp.route.slice(0, 60)}{ofp.route.length > 60 ? '...' : ''}
        </span>
        <button
          onClick={handleDownload}
          className="btn-secondary btn-sm inline-flex items-center gap-1"
        >
          <DownloadSimple className="w-3 h-3" /> DownloadSimple
        </button>
      </div>
      <div className="flex-1 overflow-auto p-3">
        <pre className="text-[11px] font-mono text-acars-mono whitespace-pre-wrap break-words leading-relaxed">
          {ofp.rawText || buildOFPText(ofp)}
        </pre>
      </div>
    </div>
  );
}

function buildOFPText(ofp: any): string {
  const lines: string[] = [];
  lines.push(`=== OPERATIONAL FLIGHT PLAN ===`);
  lines.push(`${ofp.airline}${ofp.flightNumber}  ${ofp.aircraftType}`);
  lines.push(`${ofp.origin} → ${ofp.destination}`);
  lines.push(`Path: ${ofp.route}`);
  lines.push(`Cruise: FL${Math.round(ofp.cruiseAltitude / 100)}  CI: ${ofp.costIndex}`);
  lines.push('');
  lines.push(`--- FUEL ---`);
  lines.push(`Burn:    ${ofp.fuel.burnLbs} lbs`);
  lines.push(`Reserve: ${ofp.fuel.reserveLbs} lbs`);
  lines.push(`Taxi:    ${ofp.fuel.taxiLbs} lbs`);
  lines.push(`Total:   ${ofp.fuel.totalLbs} lbs`);
  lines.push('');
  lines.push(`--- WEIGHTS ---`);
  lines.push(`ZFW: ${ofp.weights.estZfw} lbs  (max ${ofp.weights.maxZfw})`);
  lines.push(`TOW: ${ofp.weights.estTow} lbs  (max ${ofp.weights.maxTow})`);
  lines.push(`LDW: ${ofp.weights.estLdw} lbs  (max ${ofp.weights.maxLdw})`);
  lines.push('');
  if (ofp.alternates?.length > 0) {
    lines.push(`--- ALTERNATES ---`);
    ofp.alternates.forEach((alt: any) => lines.push(`${alt.icao} (${alt.name}) — ${alt.distanceNm} nm`));
  }
  return lines.join('\n');
}
