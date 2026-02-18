export function RunwaySelector() {
  return (
    <div className="grid grid-cols-5 gap-2 border-b border-acars-border px-3 py-2 text-[11px]">
      <div>
        <span className="data-label">Runway</span>
        <select className="mt-0.5 w-full rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-1 py-0.5">
          <option>12R</option>
        </select>
      </div>
      <div>
        <span className="data-label">SID</span>
        <select className="mt-0.5 w-full rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-1 py-0.5">
          <option>STAYY4</option>
        </select>
      </div>
      <div>
        <span className="data-label">Take Off Alt</span>
        <select className="mt-0.5 w-full rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-1 py-0.5">
          <option>KLAX</option>
        </select>
      </div>
      <div>
        <span className="data-label">STAR</span>
        <select className="mt-0.5 w-full rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-1 py-0.5">
          <option>FQM</option>
        </select>
      </div>
      <div>
        <span className="data-label">Runway</span>
        <select className="mt-0.5 w-full rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-1 py-0.5">
          <option>GLS | R22</option>
        </select>
      </div>
    </div>
  );
}
