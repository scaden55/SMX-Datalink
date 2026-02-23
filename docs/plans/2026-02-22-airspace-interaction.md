# Airspace Interaction (FIR/TRACON Click + Hover) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add hover highlights with preview cards and click-to-open detail panels for online FIR and TRACON boundaries on the live map.

**Architecture:** Extend `FirBoundaryLayer` and `TraconBoundaryLayer` with Leaflet `mouseover`/`mouseout`/`click` events. Add a new `AirspaceDetailPanel` component (same right-panel pattern as `AirportDetailPanel`). Use ray-casting point-in-polygon to determine which VATSIM pilots are inside the boundary polygon.

**Tech Stack:** React 19, Leaflet (react-leaflet), TypeScript, Zustand, Tailwind CSS

---

### Task 1: Point-in-polygon utility

**Files:**
- Create: `frontend/src/lib/geo-utils.ts`

**Step 1: Create the utility file**

```ts
/**
 * Ray-casting point-in-polygon test.
 * Works on GeoJSON Polygon / MultiPolygon coordinate arrays.
 */
export function isPointInPolygon(
  lat: number,
  lon: number,
  geometry: GeoJSON.Geometry,
): boolean {
  if (geometry.type === 'Polygon') {
    return isInsideRings(lat, lon, geometry.coordinates);
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((poly) => isInsideRings(lat, lon, poly));
  }
  return false;
}

/** Test point against polygon rings (first = outer, rest = holes) */
function isInsideRings(lat: number, lon: number, rings: number[][][]): boolean {
  // Must be inside outer ring
  if (!raycast(lat, lon, rings[0])) return false;
  // Must not be inside any hole
  for (let i = 1; i < rings.length; i++) {
    if (raycast(lat, lon, rings[i])) return false;
  }
  return true;
}

/** Standard ray-casting algorithm — coords are [lon, lat] per GeoJSON spec */
function raycast(lat: number, lon: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][1], yi = ring[i][0]; // lat, lon
    const xj = ring[j][1], yj = ring[j][0];
    if ((yi > lon) !== (yj > lon) && lat < ((xj - xi) * (lon - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Filter pilots whose position falls inside a GeoJSON feature's geometry.
 */
export function pilotsInAirspace(
  pilots: { latitude: number; longitude: number }[],
  feature: GeoJSON.Feature,
): typeof pilots {
  return pilots.filter((p) => isPointInPolygon(p.latitude, p.longitude, feature.geometry));
}
```

**Step 2: Commit**

```bash
git add frontend/src/lib/geo-utils.ts
git commit -m "feat: add point-in-polygon geo utility for airspace containment"
```

---

### Task 2: Add hover + click events to FirBoundaryLayer

**Files:**
- Modify: `frontend/src/components/map/FirBoundaryLayer.tsx`

**Step 1: Update the component**

Add these changes to `FirBoundaryLayer`:

1. Accept new props: `onSelectAirspace` callback and `hoveredAirspaceId` / `onHoverAirspace` for hover state.
2. In `onEachFeature`, add `mouseover` / `mouseout` / `click` Leaflet events.
3. In `style`, when the feature ID matches `hoveredAirspaceId`, boost fill opacity and stroke weight.

Updated props interface:
```ts
interface Props {
  controllers: VatsimControllerWithPosition[];
  visible: boolean;
  hoveredAirspaceId: string | null;
  onHoverAirspace: (id: string | null, feature: GeoJSON.Feature | null, event: L.LeafletMouseEvent | null) => void;
  onSelectAirspace: (id: string, feature: GeoJSON.Feature) => void;
}
```

Updated `style` callback — add hovered check:
```ts
const isHovered = hoveredAirspaceId === id;
return {
  color: isOnline ? '#22d3ee' : '#2e3138',
  weight: isOnline ? (isHovered ? 3 : 2) : 0.8,
  opacity: isOnline ? (isHovered ? 1 : 0.8) : 0.4,
  fillColor: isOnline ? '#22d3ee' : 'transparent',
  fillOpacity: isOnline ? (isHovered ? 0.20 : 0.08) : 0,
};
```

Updated `onEachFeature` — add interactive events:
```ts
const onEachFeature = useCallback(
  (feature: GeoJsonFeature, layer: Layer) => {
    const id = feature.properties.id || feature.properties.icao || feature.properties.ICAO || '';
    const name = feature.properties.name || feature.properties.NAME || id;
    const info = firControllerInfo.get(id);
    const isOnline = onlineFirIds.has(id);

    // Only make online FIRs interactive
    if (isOnline) {
      (layer as L.Path).setStyle({ cursor: 'pointer' });

      layer.on('mouseover', (e: L.LeafletMouseEvent) => {
        onHoverAirspace(id, feature as GeoJSON.Feature, e);
      });
      layer.on('mouseout', () => {
        onHoverAirspace(null, null, null);
      });
      layer.on('click', () => {
        onSelectAirspace(id, feature as GeoJSON.Feature);
      });
    }

    // Keep existing tooltip
    const tooltip = info
      ? `${name}\n${info.callsign} — ${info.frequency}`
      : name;
    layer.bindTooltip(tooltip, {
      sticky: true,
      className: 'vatsim-boundary-tooltip',
      direction: 'top',
    });
  },
  [firControllerInfo, onlineFirIds, onHoverAirspace, onSelectAirspace],
);
```

Also add `hoveredAirspaceId` to the GeoJSON `key` prop so it re-renders on hover:
```tsx
<GeoJSON
  key={`fir-${onlineFirIds.size}-${hoveredAirspaceId ?? ''}`}
  data={geoJson}
  style={style}
  onEachFeature={onEachFeature}
/>
```

**Step 2: Commit**

```bash
git add frontend/src/components/map/FirBoundaryLayer.tsx
git commit -m "feat: add hover highlight and click handler to FIR boundaries"
```

---

### Task 3: Add hover + click events to TraconBoundaryLayer

**Files:**
- Modify: `frontend/src/components/map/TraconBoundaryLayer.tsx`

**Step 1: Update the component**

Same pattern as Task 2. Updated props:
```ts
interface Props {
  controllers: VatsimControllerWithPosition[];
  visible: boolean;
  hoveredAirspaceId: string | null;
  onHoverAirspace: (id: string | null, feature: GeoJSON.Feature | null, event: L.LeafletMouseEvent | null) => void;
  onSelectAirspace: (id: string, feature: GeoJSON.Feature) => void;
}
```

Updated style — add hovered check:
```ts
const isHovered = hoveredAirspaceId === id;
if (!isOnline) return { opacity: 0, fillOpacity: 0 };
return {
  color: '#f59e0b',
  weight: isHovered ? 2.5 : 1.5,
  opacity: isHovered ? 1 : 0.7,
  fillColor: '#f59e0b',
  fillOpacity: isHovered ? 0.15 : 0.06,
};
```

Updated `onEachFeature` — add events (only for online TRACONs):
```ts
if (info) {
  (layer as L.Path).setStyle({ cursor: 'pointer' });

  layer.on('mouseover', (e: L.LeafletMouseEvent) => {
    onHoverAirspace(id, feature as GeoJSON.Feature, e);
  });
  layer.on('mouseout', () => {
    onHoverAirspace(null, null, null);
  });
  layer.on('click', () => {
    onSelectAirspace(id, feature as GeoJSON.Feature);
  });

  layer.bindTooltip(`${name}\n${info.callsign} — ${info.frequency}`, {
    sticky: true,
    className: 'vatsim-boundary-tooltip',
    direction: 'top',
  });
}
```

Update GeoJSON key:
```tsx
<GeoJSON
  key={`tracon-${onlineTraconIds.size}-${hoveredAirspaceId ?? ''}`}
  ...
/>
```

**Step 2: Commit**

```bash
git add frontend/src/components/map/TraconBoundaryLayer.tsx
git commit -m "feat: add hover highlight and click handler to TRACON boundaries"
```

---

### Task 4: Create AirspaceHoverCard component

**Files:**
- Create: `frontend/src/components/map/AirspaceHoverCard.tsx`

**Step 1: Create the floating hover preview card**

This renders as an absolutely-positioned div near the mouse cursor, showing controller info + aircraft count. It's rendered outside the MapContainer (overlaid on top) using pixel coordinates from the Leaflet mouse event.

```tsx
import { useMemo } from 'react';
import { Radio, Plane, Clock } from 'lucide-react';
import type { VatsimControllerWithPosition, VatsimPilot } from '@acars/shared';
import { pilotsInAirspace } from '../../lib/geo-utils';

interface Props {
  airspaceId: string;
  airspaceType: 'fir' | 'tracon';
  feature: GeoJSON.Feature;
  controllers: VatsimControllerWithPosition[];
  pilots: VatsimPilot[];
  /** Screen-relative position from the Leaflet mouse event containerPoint */
  x: number;
  y: number;
}

function formatLogonDuration(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function AirspaceHoverCard({ airspaceId, airspaceType, feature, controllers, pilots, x, y }: Props) {
  const name = feature.properties?.name || feature.properties?.NAME || airspaceId;

  // Find controllers for this boundary
  const matchedControllers = useMemo(() => {
    return controllers.filter((c) => c.boundaryId === airspaceId);
  }, [controllers, airspaceId]);

  // Count pilots in this airspace
  const pilotCount = useMemo(() => {
    return pilotsInAirspace(pilots, feature).length;
  }, [pilots, feature]);

  const isFir = airspaceType === 'fir';
  const accentColor = isFir ? '#22d3ee' : '#f59e0b';

  return (
    <div
      className="absolute z-[2000] pointer-events-none"
      style={{ left: x + 16, top: y - 8 }}
    >
      <div className="bg-acars-panel border border-acars-border rounded-md shadow-lg p-3 w-56">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <Radio className="w-3.5 h-3.5 shrink-0" style={{ color: accentColor }} />
          <div className="min-w-0">
            <div className="text-xs font-bold text-acars-text truncate">{name}</div>
            <div className="text-[9px] text-acars-muted uppercase tracking-wider">
              {isFir ? 'FIR / Center' : 'TRACON / Approach'}
            </div>
          </div>
        </div>

        {/* Controllers */}
        {matchedControllers.map((ctrl) => (
          <div key={ctrl.callsign} className="flex items-center gap-2 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
            <span className="text-[11px] font-mono font-bold text-acars-text">{ctrl.callsign}</span>
            <span className="text-[11px] font-mono ml-auto" style={{ color: accentColor }}>
              {ctrl.frequency}
            </span>
          </div>
        ))}

        {matchedControllers.length > 0 && (
          <div className="flex items-center gap-1.5 text-[9px] text-acars-muted mb-2">
            <Clock className="w-2.5 h-2.5" />
            <span>Online {formatLogonDuration(matchedControllers[0].logon_time)}</span>
          </div>
        )}

        {/* Separator + pilot count */}
        <div className="border-t border-acars-border pt-2 flex items-center gap-1.5">
          <Plane className="w-3 h-3 text-acars-muted" />
          <span className="text-[11px] text-acars-text font-mono font-bold">{pilotCount}</span>
          <span className="text-[10px] text-acars-muted">aircraft in airspace</span>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/map/AirspaceHoverCard.tsx
git commit -m "feat: add floating hover preview card for airspace boundaries"
```

---

### Task 5: Create AirspaceDetailPanel component

**Files:**
- Create: `frontend/src/components/map/AirspaceDetailPanel.tsx`

**Step 1: Create the detail panel**

Follows `AirportDetailPanel` pattern: right-side sliding panel with tabs (Traffic, Controller). Uses `pilotsInAirspace` from geo-utils for traffic filtering.

The component should include:

1. **Header**: Airspace name, type badge (FIR/TRACON), accent-colored border-left indicator, close button.
2. **Summary row**: Aircraft count badge, controller count with green pulse dot.
3. **Tabs**: "Traffic" and "Controller".
4. **Traffic tab**: Pilots grouped by status (Departing, Cruising, En Route, Arriving, On Ground) using the same `deriveStatus` logic from PilotDetailPanel. Each row: callsign, aircraft type, altitude, origin → destination.
5. **Controller tab**: Each controller's callsign, name, facility type, frequency, logon duration, ATIS text (if CTR has text_atis).

Props:
```ts
interface Props {
  airspaceId: string;
  airspaceType: 'fir' | 'tracon';
  feature: GeoJSON.Feature;
  controllers: VatsimControllerWithPosition[];
  pilots: VatsimPilot[];
  atis: VatsimAtis[];
  onClose: () => void;
}
```

Panel position & styling: `absolute top-3 right-3 bottom-3 w-[350px] z-[1000]` — identical to AirportDetailPanel.

Use the same `CollapsibleSection` internal component pattern. Accent color: cyan `#22d3ee` for FIR, amber `#f59e0b` for TRACON.

Pilot status derivation (inline helper, same as PilotDetailPanel):
```ts
function deriveStatus(pilot: VatsimPilot) {
  const gs = pilot.groundspeed;
  const alt = pilot.altitude;
  if (gs < 50) return { label: 'On Ground', color: '#8e939b' };
  if (alt < 10000 && gs >= 50 && gs < 250) return { label: 'Departing', color: '#3fb950' };
  if (alt >= 25000 && gs >= 200) return { label: 'Cruising', color: '#79c0ff' };
  if (alt >= 10000) return { label: 'En Route', color: '#58a6ff' };
  return { label: 'Arriving', color: '#f0883e' };
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/map/AirspaceDetailPanel.tsx
git commit -m "feat: add AirspaceDetailPanel with traffic and controller tabs"
```

---

### Task 6: Wire everything into LiveMapPage

**Files:**
- Modify: `frontend/src/pages/LiveMapPage.tsx`

**Step 1: Add imports and state**

New imports:
```ts
import { AirspaceDetailPanel } from '../components/map/AirspaceDetailPanel';
import { AirspaceHoverCard } from '../components/map/AirspaceHoverCard';
```

New state in `LiveMapPage`:
```ts
const [selectedAirspace, setSelectedAirspace] = useState<{
  type: 'fir' | 'tracon';
  boundaryId: string;
  feature: GeoJSON.Feature;
} | null>(null);

const [hoveredAirspace, setHoveredAirspace] = useState<{
  id: string;
  type: 'fir' | 'tracon';
  feature: GeoJSON.Feature;
  x: number;
  y: number;
} | null>(null);
```

**Step 2: Update detailPanelOpen**

```ts
const detailPanelOpen = selectedAirport != null || selectedPilot != null || selectedAirspace != null;
```

**Step 3: Create hover/click handler callbacks**

```ts
const handleFirHover = useCallback((id: string | null, feature: GeoJSON.Feature | null, e: L.LeafletMouseEvent | null) => {
  if (id && feature && e) {
    setHoveredAirspace({ id, type: 'fir', feature, x: e.containerPoint.x, y: e.containerPoint.y });
  } else {
    setHoveredAirspace(null);
  }
}, []);

const handleTraconHover = useCallback((id: string | null, feature: GeoJSON.Feature | null, e: L.LeafletMouseEvent | null) => {
  if (id && feature && e) {
    setHoveredAirspace({ id, type: 'tracon', feature, x: e.containerPoint.x, y: e.containerPoint.y });
  } else {
    setHoveredAirspace(null);
  }
}, []);

const handleFirSelect = useCallback((id: string, feature: GeoJSON.Feature) => {
  setSelectedAirspace({ type: 'fir', boundaryId: id, feature });
  setSelectedAirport(null);
  setSelectedPilot(null);
  setHoveredAirspace(null);
}, []);

const handleTraconSelect = useCallback((id: string, feature: GeoJSON.Feature) => {
  setSelectedAirspace({ type: 'tracon', boundaryId: id, feature });
  setSelectedAirport(null);
  setSelectedPilot(null);
  setHoveredAirspace(null);
}, []);
```

**Step 4: Update FirBoundaryLayer and TraconBoundaryLayer props**

```tsx
<FirBoundaryLayer
  controllers={vatsimSnapshot.controllers}
  visible={vatsimLayers.showFirBoundaries}
  hoveredAirspaceId={hoveredAirspace?.type === 'fir' ? hoveredAirspace.id : null}
  onHoverAirspace={handleFirHover}
  onSelectAirspace={handleFirSelect}
/>
<TraconBoundaryLayer
  controllers={vatsimSnapshot.controllers}
  visible={vatsimLayers.showTraconBoundaries}
  hoveredAirspaceId={hoveredAirspace?.type === 'tracon' ? hoveredAirspace.id : null}
  onHoverAirspace={handleTraconHover}
  onSelectAirspace={handleTraconSelect}
/>
```

**Step 5: Add hover card and detail panel rendering**

After the existing `PilotDetailPanel` render block, add:

```tsx
{/* Airspace detail panel */}
{selectedAirspace && (
  <AirspaceDetailPanel
    airspaceId={selectedAirspace.boundaryId}
    airspaceType={selectedAirspace.type}
    feature={selectedAirspace.feature}
    controllers={vatsimSnapshot?.controllers ?? []}
    pilots={vatsimSnapshot?.pilots ?? []}
    atis={vatsimSnapshot?.atis ?? []}
    onClose={() => setSelectedAirspace(null)}
  />
)}

{/* Airspace hover preview (floating, pointer-events-none) */}
{hoveredAirspace && !selectedAirspace && (
  <AirspaceHoverCard
    airspaceId={hoveredAirspace.id}
    airspaceType={hoveredAirspace.type}
    feature={hoveredAirspace.feature}
    controllers={vatsimSnapshot?.controllers ?? []}
    pilots={vatsimSnapshot?.pilots ?? []}
    x={hoveredAirspace.x}
    y={hoveredAirspace.y}
  />
)}
```

**Step 6: Clear airspace selection when airport/pilot is selected**

Update existing selection handlers to also clear airspace:
```ts
// In AirportLabels onSelectAirport:
onSelectAirport={(icao) => { setSelectedAirport(icao); setSelectedPilot(null); setSelectedAirspace(null); }}

// In PilotMarkers onSelectPilot:
onSelectPilot={(p) => { setSelectedPilot(p); setSelectedAirport(null); setSelectedAirspace(null); }}
```

**Step 7: Commit**

```bash
git add frontend/src/pages/LiveMapPage.tsx
git commit -m "feat: wire airspace hover card and detail panel into live map"
```

---

### Task 7: Verify and test

**Step 1: Start the app**

```bash
npm run dev:all
```

**Step 2: Manual verification**

1. Navigate to the Live Map page
2. Ensure VATSIM FIR and TRACON boundary layers are visible (toggle in VATSIM panel)
3. Hover over an online FIR (cyan) — verify highlight brightens and hover card appears
4. Hover over an online TRACON (amber) — same verification
5. Click an online FIR — verify AirspaceDetailPanel opens with Traffic + Controller tabs
6. Verify aircraft count in the panel matches pilots inside the polygon
7. Click an airport label — verify airspace panel closes and airport panel opens (mutual exclusion)
8. Hover over offline FIR — verify no hover card appears (only online boundaries are interactive)

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete airspace interaction — hover cards and detail panels for FIR/TRACON"
```
