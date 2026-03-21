import { useState } from 'react';
import { PageShell } from '@/components/shared/PageShell';
import { FleetGrid } from './maintenance/FleetGrid';
import { AircraftProfile } from './maintenance/AircraftProfile';

export function MaintenancePage() {
  const [selectedAircraftId, setSelectedAircraftId] = useState<number | null>(null);

  if (selectedAircraftId) {
    return (
      <PageShell title="Maintenance">
        <AircraftProfile
          aircraftId={selectedAircraftId}
          onBack={() => setSelectedAircraftId(null)}
        />
      </PageShell>
    );
  }

  return (
    <PageShell title="Maintenance">
      <FleetGrid onSelectAircraft={setSelectedAircraftId} />
    </PageShell>
  );
}
