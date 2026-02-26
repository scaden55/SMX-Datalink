# SimConnect Demand-Driven Relay — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore SimConnect in the Electron exe by loading node-simconnect in the main process, sending telemetry locally via IPC, and relaying to the VPS on demand when other users are observing.

**Architecture:** Electron main process owns SimConnect (copied from backend). Lightweight heartbeats (position/callsign) sent to VPS every 30s. Full telemetry relayed only when VPS signals observer demand. Frontend reads from IPC (local) or WebSocket (remote) into the same telemetryStore.

**Tech Stack:** node-simconnect 4.x, socket.io-client 4.x, Electron IPC, existing Socket.io server on VPS

---

## Task 1: Add Relay WebSocket Events to Shared Types

**Files:**
- Modify: `shared/src/types/websocket.ts`
- Modify: `shared/src/types/flight.ts`
- Modify: `shared/src/index.ts`

**Step 1: Define ActiveFlight heartbeat type in `shared/src/types/flight.ts`**

Add after the `ConnectionStatus` interface (line 31):

```typescript
/** Lightweight heartbeat sent by pilot's Electron app every 30s */
export interface ActiveFlightHeartbeat {
  userId: number;
  callsign: string;
  aircraftType: string;
  latitude: number;
  longitude: number;
  altitude: number;
  heading: number;
  groundSpeed: number;
  phase: string;
  timestamp: string;
}
```

**Step 2: Add new WebSocket events to `shared/src/types/websocket.ts`**

Add to `ClientToServerEvents` (after line 47):

```typescript
  'flight:heartbeat': (data: ActiveFlightHeartbeat) => void;
  'flight:telemetry': (data: TelemetrySnapshot) => void;
  'flight:ended': () => void;
  'livemap:subscribe': () => void;
  'livemap:unsubscribe': () => void;
```

Add to `ServerToClientEvents` (after line 39):

```typescript
  'relay:start': () => void;
  'relay:stop': () => void;
  'flights:active': (flights: ActiveFlightHeartbeat[]) => void;
```

Add `ActiveFlightHeartbeat` to the imports from `./flight.js`.

**Step 3: Export `ActiveFlightHeartbeat` from `shared/src/index.ts`**

Add to the flight.ts export line:

```typescript
export type { FlightData, ConnectionStatus, ActiveFlightHeartbeat } from './types/flight.js';
```

**Step 4: Build shared types**

Run: `cd shared && npx tsc`
Expected: Clean compile, no errors

**Step 5: Commit**

```
git add shared/
git commit -m "feat(shared): add ActiveFlightHeartbeat type and relay WebSocket events"
```

---

## Task 2: Copy SimConnect Module Into Electron

**Files:**
- Create: `electron/src/simconnect/simvars.ts` (copy from `shared/src/constants/simvars.ts`)
- Create: `electron/src/simconnect/types.ts` (adapted from `backend/src/simconnect/types.ts`)
- Create: `electron/src/simconnect/definitions.ts` (adapted from `backend/src/simconnect/definitions.ts`)
- Create: `electron/src/simconnect/reader.ts` (adapted from `backend/src/simconnect/reader.ts`)
- Create: `electron/src/simconnect/null-manager.ts` (adapted from `backend/src/simconnect/null-manager.ts`)
- Create: `electron/src/simconnect/connection.ts` (adapted from `backend/src/simconnect/connection.ts`)

**Step 1: Copy `simvars.ts` verbatim**

Copy `shared/src/constants/simvars.ts` → `electron/src/simconnect/simvars.ts` with no changes. This file has zero external dependencies (the `SimConnectDataType` enum is defined locally, and `const enum` values inline at compile time).

**Step 2: Create `types.ts`**

Adapt from `backend/src/simconnect/types.ts`. Replace the `@acars/shared` type imports with inline type definitions since the Electron project uses CommonJS and doesn't have `@acars/shared` as a runtime dependency.

Key changes:
- Import `EventEmitter` from `events` (same)
- Define `ConnectionStatus` interface locally (copy from `shared/src/types/flight.ts:25-31`)
- Define the position/engine/fuel/flight types locally OR import them as `type` (erased at compile)
- Keep the `ISimConnectManager` and `SimConnectEvents` interfaces identical

Since `import type` is erased at compile time and the Electron tsconfig resolves `@acars/shared` via the workspace during build, we can keep the `import type` from `@acars/shared`. The types never appear in compiled JS.

So: copy `backend/src/simconnect/types.ts` verbatim. The `import type` from `@acars/shared` resolves during compilation via workspace, and is erased from output.

**Step 3: Create `definitions.ts`**

Copy from `backend/src/simconnect/definitions.ts`. Change one import:

```typescript
// OLD:
import { POSITION_VARS, ENGINE_VARS, ... } from '@acars/shared';

// NEW:
import { POSITION_VARS, ENGINE_VARS, FUEL_VARS, FLIGHT_VARS, AUTOPILOT_VARS, RADIO_VARS, AIRCRAFT_INFO_VARS } from './simvars';
```

This is a **runtime** import so it must resolve to a local file. All other imports (`node-simconnect` types) remain unchanged.

Note: Electron uses CommonJS, so no `.js` extension needed. But `.js` extensions also work with `require()`, so either way is fine.

**Step 4: Create `reader.ts`**

Copy `backend/src/simconnect/reader.ts` verbatim. All `@acars/shared` imports are `import type` (erased at compile time). The `RawBuffer` import from `node-simconnect` is also a type.

**Step 5: Create `null-manager.ts`**

Adapt from `backend/src/simconnect/null-manager.ts`:
- Remove: `import { logger } from '../lib/logger.js';`
- Replace `logger.info(...)` with `console.log(...)` (only one call on line 26)
- Import `ConnectionStatus` type from `./types` instead

```typescript
import { EventEmitter } from 'events';
import type { ISimConnectManager } from './types';

export class NullSimConnectManager extends EventEmitter implements ISimConnectManager {
  get connected(): boolean { return false; }
  getConnectionStatus() {
    return {
      connected: false as const,
      simulator: 'unknown' as const,
      simConnectVersion: 'N/A',
      applicationName: 'N/A',
      lastUpdate: new Date().toISOString(),
    };
  }
  async connect(): Promise<void> {
    console.log('[SimConnect] Disabled — running without simulator');
  }
  disconnect(): void {}
}
```

**Step 6: Create `connection.ts`**

Adapt from `backend/src/simconnect/connection.ts`:
- Remove: `import { config } from '../config.js';` and `import { logger } from '../lib/logger.js';`
- Replace `logger.info/warn/error(...)` with `console.log/warn/error(...)`
- Replace `config.simconnect.appName` with a hardcoded `'SMX ACARS'`
- Replace `config.simconnect.reconnectInterval` with a constructor parameter (default 5000)
- Import definitions from local `./definitions` instead

Constructor signature:
```typescript
constructor(private reconnectInterval = 5000) { super(); }
```

Use `'SMX ACARS'` as the app name in the `open()` call. Use `this.reconnectInterval` in `scheduleReconnect()`.

**Step 7: Verify Electron compiles**

Run: `cd electron && npx tsc --noEmit`
Expected: Clean compile. If there are errors about `@acars/shared` types not resolving, we need to add a path mapping to `electron/tsconfig.json`:

```json
"paths": { "@acars/shared": ["../shared/src"] }
```

**Step 8: Commit**

```
git add electron/src/simconnect/
git commit -m "feat(electron): copy SimConnect module for main process integration"
```

---

## Task 3: Electron Main Process — SimConnect Init + IPC

**Files:**
- Modify: `electron/src/ipc-channels.ts` (add SIM_TELEMETRY channel)
- Modify: `electron/src/preload.ts` (expose new channel to renderer)
- Modify: `electron/src/main.ts` (init SimConnect, wire IPC, compose telemetry snapshot)

**Step 1: Add IPC channel for telemetry**

In `electron/src/ipc-channels.ts`, add after `SIM_STATUS` (line 23):

```typescript
  SIM_TELEMETRY: 'sim:telemetry',
```

**Step 2: Expose channel in preload**

In `electron/src/preload.ts`, add `IpcChannels.SIM_TELEMETRY` to the `RECEIVE_CHANNELS` set (line 39-47).

**Step 3: Initialize SimConnect in main.ts**

In `electron/src/main.ts`, after the `app.whenReady()` block (around line 300):

```typescript
import type { ISimConnectManager } from './simconnect/types';
import { NullSimConnectManager } from './simconnect/null-manager';

// --- Inside app.whenReady().then(async () => { ... }) ---

// SimConnect — loaded in main process for direct MSFS communication
let simConnect: ISimConnectManager;
try {
  const { SimConnectManager } = require('./simconnect/connection');
  simConnect = new SimConnectManager();
  console.log('[Electron] SimConnect module loaded');
} catch (err) {
  console.warn('[Electron] SimConnect not available:', (err as Error).message);
  simConnect = new NullSimConnectManager();
}

// Start connection loop (auto-reconnects)
simConnect.connect();
```

**Step 4: Wire SimConnect events to IPC**

After SimConnect init, add event handlers that compose a `TelemetrySnapshot`-like object and send it to the renderer:

```typescript
// Accumulate latest data from each SimConnect group
const latestData: Record<string, unknown> = {};

simConnect.on('positionUpdate', (data) => { latestData.position = data; });
simConnect.on('engineUpdate', (data) => { latestData.engine = data; });
simConnect.on('fuelUpdate', (data) => { latestData.fuel = data; });
simConnect.on('flightStateUpdate', (data) => { latestData.flightState = data; });
simConnect.on('autopilotUpdate', (data) => { latestData.autopilot = data; });
simConnect.on('radioUpdate', (data) => { latestData.radio = data; });
simConnect.on('aircraftInfoUpdate', (data) => { latestData.aircraftInfo = data; });

// Broadcast composed snapshot to renderer at poll interval
let telemetryInterval: ReturnType<typeof setInterval> | null = null;

simConnect.on('connected', (status) => {
  mainWindow?.webContents.send(IpcChannels.SIM_STATUS, status);

  if (!telemetryInterval) {
    telemetryInterval = setInterval(() => {
      if (!simConnect.connected || !mainWindow) return;
      const snapshot = {
        aircraft: {
          position: latestData.position ?? {},
          autopilot: latestData.autopilot ?? {},
          radio: latestData.radio ?? {},
          info: latestData.aircraftInfo ?? {},
        },
        engine: latestData.engine ?? {},
        fuel: latestData.fuel ?? {},
        flight: latestData.flightState ?? {},
        timestamp: new Date().toISOString(),
      };
      mainWindow.webContents.send(IpcChannels.SIM_TELEMETRY, snapshot);
    }, 200);
  }
});

simConnect.on('disconnected', () => {
  mainWindow?.webContents.send(IpcChannels.SIM_STATUS, simConnect.getConnectionStatus());
  if (telemetryInterval) {
    clearInterval(telemetryInterval);
    telemetryInterval = null;
  }
});
```

**Step 5: Update BACKEND_STATUS handler**

Replace the static `'connected'` return with actual SimConnect status awareness. The IPC handler at line 196-203 should remain for the VPS backend status (it IS always connected). The sim status goes through the separate `SIM_STATUS` channel.

**Step 6: Clean up on quit**

In the `app.on('before-quit')` handler (line 295), add:

```typescript
simConnect.disconnect();
if (telemetryInterval) clearInterval(telemetryInterval);
```

**Step 7: Verify Electron compiles**

Run: `cd electron && npx tsc --noEmit`
Expected: Clean compile

**Step 8: Commit**

```
git add electron/
git commit -m "feat(electron): initialize SimConnect in main process with IPC telemetry"
```

---

## Task 4: Electron VPS Relay

**Files:**
- Create: `electron/src/relay.ts`
- Modify: `electron/src/main.ts` (start relay alongside SimConnect)

**Step 1: Create relay module**

`electron/src/relay.ts` — Socket.io client that connects to VPS and handles the heartbeat/relay protocol:

```typescript
import { io, type Socket } from 'socket.io-client';
import type { ISimConnectManager } from './simconnect/types';
import type { ServerToClientEvents, ClientToServerEvents } from '@acars/shared';

type RelaySocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface RelayConfig {
  vpsUrl: string;
  heartbeatIntervalMs: number;
  token: string;       // JWT for auth
  userId: number;
  callsign: string;
}

export class VpsRelay {
  private socket: RelaySocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private relaying = false;
  private latestPosition: { latitude: number; longitude: number; altitude: number; heading: number; groundSpeed: number } | null = null;
  private config: RelayConfig;
  private simConnect: ISimConnectManager;

  constructor(simConnect: ISimConnectManager, config: RelayConfig) {
    this.simConnect = simConnect;
    this.config = config;
  }

  start(): void {
    this.socket = io(this.config.vpsUrl, {
      transports: ['websocket'],
      auth: { token: this.config.token },
      reconnection: true,
      reconnectionDelay: 5000,
    });

    this.socket.on('connect', () => {
      console.log('[Relay] Connected to VPS');
      this.startHeartbeat();
    });

    this.socket.on('relay:start', () => {
      console.log('[Relay] Observer watching — starting full telemetry relay');
      this.relaying = true;
    });

    this.socket.on('relay:stop', () => {
      console.log('[Relay] No observers — stopping full telemetry relay');
      this.relaying = false;
    });

    this.socket.on('disconnect', () => {
      console.log('[Relay] Disconnected from VPS');
      this.stopHeartbeat();
      this.relaying = false;
    });

    // Listen to SimConnect position updates for heartbeat data
    this.simConnect.on('positionUpdate', (data) => {
      this.latestPosition = data;
    });
  }

  /** Send full telemetry snapshot to VPS (called from main process poll loop) */
  sendTelemetry(snapshot: unknown): void {
    if (this.relaying && this.socket?.connected) {
      this.socket.emit('flight:telemetry', snapshot as any);
    }
  }

  /** Update auth token (e.g. after refresh) */
  updateAuth(token: string): void {
    this.config.token = token;
    if (this.socket) {
      this.socket.auth = { token };
    }
  }

  stop(): void {
    this.socket?.emit('flight:ended');
    this.stopHeartbeat();
    this.socket?.disconnect();
    this.socket = null;
    this.relaying = false;
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => {
      if (!this.simConnect.connected || !this.socket?.connected || !this.latestPosition) return;
      this.socket.emit('flight:heartbeat', {
        userId: this.config.userId,
        callsign: this.config.callsign,
        aircraftType: '', // updated when aircraftInfo arrives
        latitude: this.latestPosition.latitude,
        longitude: this.latestPosition.longitude,
        altitude: this.latestPosition.altitude,
        heading: this.latestPosition.heading,
        groundSpeed: this.latestPosition.groundSpeed,
        phase: 'active',
        timestamp: new Date().toISOString(),
      });
    }, this.config.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
```

**Step 2: Integrate relay into main.ts**

After SimConnect initialization in `main.ts`, create the relay:

```typescript
// VPS relay — starts after SimConnect connects and user logs in
// The renderer will send auth info via IPC when the user logs in
let vpsRelay: VpsRelay | null = null;

ipcMain.handle('relay:auth', (_event, data: { token: string; userId: number; callsign: string; vpsUrl: string }) => {
  if (vpsRelay) vpsRelay.stop();
  vpsRelay = new VpsRelay(simConnect, {
    vpsUrl: data.vpsUrl,
    heartbeatIntervalMs: 30_000,
    token: data.token,
    userId: data.userId,
    callsign: data.callsign,
  });
  vpsRelay.start();
  return true;
});
```

In the telemetry poll interval, also forward to relay:

```typescript
// Inside the setInterval callback:
vpsRelay?.sendTelemetry(snapshot);
```

**Step 3: Add IPC channel for relay auth**

In `ipc-channels.ts`:
```typescript
  RELAY_AUTH: 'relay:auth',
```

Add to `INVOKE_CHANNELS` in `preload.ts`.

Add to `electronAPI` in `preload.ts`:
```typescript
  setRelayAuth: (data: { token: string; userId: number; callsign: string; vpsUrl: string }) =>
    ipcRenderer.invoke(IpcChannels.RELAY_AUTH, data),
```

**Step 4: Commit**

```
git add electron/
git commit -m "feat(electron): add VPS relay with demand-driven full telemetry"
```

---

## Task 5: VPS Backend — Active Flights Registry + Relay Signaling

**Files:**
- Modify: `backend/src/websocket/handler.ts`

**Step 1: Add active flights registry**

At the top of `setupWebSocket()`, after the existing subscriber Sets (line 46):

```typescript
// Active flights from Electron clients (pilots running SimConnect)
const activeFlights = new Map<number, ActiveFlightHeartbeat>(); // keyed by userId
const flightObservers = new Map<number, Set<string>>(); // userId → set of observer socket IDs
const pilotSockets = new Map<number, string>(); // userId → pilot's socket ID
```

Import `ActiveFlightHeartbeat` from `@acars/shared`.

**Step 2: Handle heartbeat events**

Inside `io.on('connection', ...)`, add handlers:

```typescript
socket.on('flight:heartbeat', (data: ActiveFlightHeartbeat) => {
  if (!socket.user) return;
  activeFlights.set(socket.user.userId, data);
  pilotSockets.set(socket.user.userId, socket.id);
  // Broadcast updated active flights to livemap subscribers
  const flights = Array.from(activeFlights.values());
  for (const sid of livemapSubscribers) {
    io.to(sid).emit('flights:active', flights);
  }
});

socket.on('flight:telemetry', (snapshot: TelemetrySnapshot) => {
  if (!socket.user) return;
  // Forward to all observers of this pilot's flight
  const observers = flightObservers.get(socket.user.userId);
  if (observers) {
    for (const sid of observers) {
      io.to(sid).emit('telemetry:update', snapshot);
    }
  }
});

socket.on('flight:ended', () => {
  if (!socket.user) return;
  activeFlights.delete(socket.user.userId);
  pilotSockets.delete(socket.user.userId);
  flightObservers.delete(socket.user.userId);
  // Broadcast updated list
  const flights = Array.from(activeFlights.values());
  for (const sid of livemapSubscribers) {
    io.to(sid).emit('flights:active', flights);
  }
});
```

**Step 3: Handle livemap subscriptions and observer demand**

```typescript
const livemapSubscribers = new Set<string>();

// Inside io.on('connection', ...):

socket.on('livemap:subscribe', () => {
  livemapSubscribers.add(socket.id);
  // Send current active flights immediately
  socket.emit('flights:active', Array.from(activeFlights.values()));
});

socket.on('livemap:unsubscribe', () => {
  livemapSubscribers.delete(socket.id);
});
```

For on-demand telemetry relay, extend the existing `telemetry:subscribe` handler. When a non-pilot user subscribes to telemetry, check if there are active flights and signal the pilot to start relaying:

```typescript
socket.on('telemetry:subscribe', () => {
  telemetrySubscribers.add(socket.id);
  // If this subscriber is NOT a pilot with an active flight,
  // they're an observer — signal all active pilots to start relaying
  const isActivePilot = socket.user && activeFlights.has(socket.user.userId);
  if (!isActivePilot) {
    for (const [pilotUserId, pilotSocketId] of pilotSockets) {
      let observers = flightObservers.get(pilotUserId);
      if (!observers) {
        observers = new Set();
        flightObservers.set(pilotUserId, observers);
      }
      const wasEmpty = observers.size === 0;
      observers.add(socket.id);
      if (wasEmpty) {
        io.to(pilotSocketId).emit('relay:start');
      }
    }
  }
  startBroadcast();
});
```

Update unsubscribe/disconnect to remove observers and signal relay:stop:

```typescript
// In disconnect handler, also clean up observer tracking:
if (socket.user && activeFlights.has(socket.user.userId)) {
  // Pilot disconnected
  activeFlights.delete(socket.user.userId);
  pilotSockets.delete(socket.user.userId);
  flightObservers.delete(socket.user.userId);
}
// Clean this socket from all observer sets
for (const [pilotUserId, observers] of flightObservers) {
  observers.delete(socket.id);
  if (observers.size === 0) {
    const pilotSocketId = pilotSockets.get(pilotUserId);
    if (pilotSocketId) {
      io.to(pilotSocketId).emit('relay:stop');
    }
  }
}
livemapSubscribers.delete(socket.id);
```

**Step 4: Build backend**

Run: `cd backend && npx tsc`
Expected: Clean compile

**Step 5: Commit**

```
git add backend/ shared/
git commit -m "feat(backend): add active flights registry with demand-driven relay signaling"
```

---

## Task 6: Frontend — Local SimConnect via Electron IPC

**Files:**
- Create: `frontend/src/hooks/useLocalSimConnect.ts`
- Modify: `frontend/src/App.tsx` or top-level layout (add the hook)

**Step 1: Create useLocalSimConnect hook**

```typescript
import { useEffect } from 'react';
import { useTelemetryStore } from '../stores/telemetryStore';

/**
 * When running in Electron, listens for SimConnect telemetry and status
 * from the main process via IPC. Feeds into the same telemetryStore
 * that the WebSocket path uses — components don't need to know the source.
 */
export function useLocalSimConnect(): void {
  const setSnapshot = useTelemetryStore((s) => s.setSnapshot);
  const setConnectionStatus = useTelemetryStore((s) => s.setConnectionStatus);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.isElectron) return; // Not in Electron — no-op

    const unsubTelemetry = api.on('sim:telemetry', (data: unknown) => {
      setSnapshot(data as any);
    });

    const unsubStatus = api.on('sim:status', (data: unknown) => {
      setConnectionStatus(data as any);
    });

    return () => {
      unsubTelemetry?.();
      unsubStatus?.();
    };
  }, [setSnapshot, setConnectionStatus]);
}
```

**Step 2: Wire into app**

Find the top-level component that renders on all pages (likely `App.tsx` or a layout component). Add:

```typescript
import { useLocalSimConnect } from './hooks/useLocalSimConnect';

// Inside the component:
useLocalSimConnect();
```

This hook is safe in browser mode — it checks `window.electronAPI?.isElectron` and no-ops.

**Step 3: Send relay auth from frontend**

When the user logs in (in the auth flow), send credentials to Electron main process for the VPS relay. Find the login success handler and add:

```typescript
const api = (window as any).electronAPI;
if (api?.isElectron) {
  api.invoke('relay:auth', {
    token: accessToken,
    userId: user.userId,
    callsign: user.callsign,
    vpsUrl: getApiBase(),
  });
}
```

This should also be called on token refresh so the relay stays authenticated.

**Step 4: Commit**

```
git add frontend/
git commit -m "feat(frontend): add useLocalSimConnect hook for Electron IPC telemetry"
```

---

## Task 7: Frontend — Active Flights on LiveMap

**Files:**
- Modify: `frontend/src/hooks/useSocket.ts` (handle `flights:active` event)
- Create: `frontend/src/stores/activeFlightsStore.ts`
- Modify: `frontend/src/pages/LiveMapPage.tsx` (render active flight markers)

**Step 1: Create activeFlightsStore**

```typescript
import { create } from 'zustand';
import type { ActiveFlightHeartbeat } from '@acars/shared';

interface ActiveFlightsState {
  flights: ActiveFlightHeartbeat[];
  setFlights: (flights: ActiveFlightHeartbeat[]) => void;
}

export const useActiveFlightsStore = create<ActiveFlightsState>((set) => ({
  flights: [],
  setFlights: (flights) => set({ flights }),
}));
```

**Step 2: Subscribe to livemap events in useSocket**

In `frontend/src/hooks/useSocket.ts`, add inside the socket setup:

```typescript
import { useActiveFlightsStore } from '../stores/activeFlightsStore';

// Inside useEffect:
const setActiveFlights = useActiveFlightsStore.getState().setFlights;

socket.on('flights:active', (flights) => {
  setActiveFlights(flights);
});

// On connect, subscribe to livemap:
socket.on('connect', () => {
  socket.emit('telemetry:subscribe');
  socket.emit('livemap:subscribe');  // NEW
});

// On cleanup:
socket.emit('livemap:unsubscribe');  // NEW
```

**Step 3: Render active flight markers on LiveMap**

In `LiveMapPage.tsx`, import the store and render plane icons for each active flight. Use the existing `PLANE_SVG` function (line 54-71) to create markers. Each active flight gets a marker at its heartbeat position.

This is the existing pattern used for VATSIM pilot markers — adapt `PilotMarkers` component style.

```typescript
const activeFlights = useActiveFlightsStore((s) => s.flights);

// Render markers for each active flight (similar to VATSIM PilotMarkers)
{activeFlights.map((flight) => (
  <Marker
    key={flight.userId}
    position={[flight.latitude, flight.longitude]}
    icon={createPlaneIcon(flight.heading, 28, '#3b82f6', true)}
  >
    <Tooltip>{flight.callsign} · FL{Math.round(flight.altitude / 100)}</Tooltip>
  </Marker>
))}
```

**Step 4: Commit**

```
git add frontend/
git commit -m "feat(frontend): display active flights on LiveMap via heartbeat data"
```

---

## Task 8: Electron Build Config

**Files:**
- Modify: `electron/package.json`

**Step 1: Add dependencies**

```json
"dependencies": {
  "electron-updater": "^6.3.9",
  "socket.io-client": "^4.8.1"
},
"optionalDependencies": {
  "node-simconnect": "^4.0.0"
}
```

**Step 2: Enable native module rebuild**

Change `npmRebuild` from `false` to `true`:

```json
"npmRebuild": true,
```

This tells electron-builder to run `npm rebuild` targeting Electron's Node.js ABI during packaging. It replaces the manual `electron-rebuild` step from the old `prepare-backend.js` approach.

**Step 3: Install dependencies**

Run: `cd electron && npm install`

**Step 4: Verify Electron compiles and packages**

Run: `cd electron && npx tsc && npx electron-builder --win --dir`
Expected: Builds successfully, `release/win-unpacked/` contains the app with `node-simconnect` native module

**Step 5: Commit**

```
git add electron/package.json package-lock.json
git commit -m "build(electron): add node-simconnect + socket.io-client, enable npmRebuild"
```

---

## Task 9: Cleanup & Revert Unnecessary Changes

**Files:**
- Modify: `scripts/prepare-backend.js` (revert optionalDependencies addition — not needed)
- Modify: `scripts/release.sh` (keep VPS package.json stripping — it's still useful)

**Step 1: Revert prepare-backend.js**

The `optionalDependencies` carry-over we added in prepare-backend.js is no longer needed since `node-simconnect` now lives in electron/package.json directly. Revert the change to keep the script clean. However, leaving it doesn't hurt — use judgment on whether to revert or keep as safety net.

**Step 2: Commit**

```
git add scripts/
git commit -m "chore: clean up prepare-backend.js"
```

---

## Task 10: Integration Verification

**Step 1: Full dev stack test**

Run: `npm run dev:all`

1. Open the Electron app
2. Check the dev console for `[Electron] SimConnect module loaded`
3. Open MSFS 2024 and load into an aircraft
4. Verify console shows `[SimConnect] Connected to Microsoft Flight Simulator 2024`
5. Check the frontend status bar — should show "Connected" instead of "Sim Offline"
6. Verify telemetry data (position, fuel, engines) updates in the dispatch panel

**Step 2: Test VPS relay**

1. In the Electron app, start a flight
2. Open a browser to the VPS URL and log in as a different user
3. Navigate to the LiveMap
4. Verify the pilot's aircraft appears on the LiveMap (heartbeat marker)
5. Check the Electron console for `[Relay] Observer watching — starting full telemetry relay`
6. Close the browser tab
7. Check Electron console for `[Relay] No observers — stopping full telemetry relay`

**Step 3: Build test**

Run: `cd electron && npx tsc && npx electron-builder --win --dir`
Verify the unpacked exe runs and connects to SimConnect.

**Step 4: Final commit + release**

```
git add -A
git commit -m "feat: SimConnect demand-driven relay — Electron main process + VPS heartbeat"
bash scripts/release.sh <next-version>
```
