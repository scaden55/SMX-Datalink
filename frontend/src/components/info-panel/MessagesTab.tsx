export function MessagesTab() {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-acars-text">ACARS Messages</h3>
      <div className="panel p-3">
        <div className="text-[11px] text-acars-muted italic">
          No messages yet. OOOI events will appear here automatically during flight.
        </div>
      </div>
    </div>
  );
}
