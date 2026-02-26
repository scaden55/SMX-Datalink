# SimConnect Demand-Driven Relay — Design

**Date**: 2026-02-25
**Status**: Approved

## Problem

Commit `5cb2d0b` refactored the Electron app to be a pure VPS client, removing the local backend fork. SimConnect is a Windows-only SDK that must run on the same machine as MSFS. Since the only backend now runs on a Linux VPS, SimConnect can never connect — the pilot always sees "disconnected."

## Solution

Load `node-simconnect` directly in the Electron main process. Telemetry flows locally via IPC for the pilot's own UI. A lightweight heartbeat (position, callsign, route) is always sent to the VPS so the LiveMap shows active flights. Full telemetry is only relayed to the VPS when another user is actively observing the flight.

## Architecture

```
PILOT'S MACHINE                              VPS (Linux)
┌─────────────────────────┐                 ┌──────────────────────────┐
│  MSFS 2024              │                 │  Express + Socket.io     │
│    ↕ SimConnect         │                 │                          │
│  Electron Main Process  │                 │  Active Flights Registry │
│  ├─ SimConnectBridge    │ ──Socket.io──→  │  ├─ heartbeats (30s)     │
│  │  (node-simconnect)   │                 │  └─ full relay (on demand)│
│  └─ IPC ↓               │                 │                          │
│  Renderer (React)       │                 │  Observer Tracking       │
│  ├─ local telemetry     │                 │  ├─ who's viewing what   │
│  └─ VPS data (WebSocket)│                 │  └─ signal start/stop    │
└─────────────────────────┘                 └──────────────────────────┘
                                                      ↕ WebSocket
                                            ┌──────────────────────────┐
                                            │  OTHER USER (browser)    │
                                            │  └─ sees live flights    │
                                            └──────────────────────────┘
```

### Telemetry Delivery Modes

| Scenario | Source | Path |
|----------|--------|------|
| Pilot viewing own flight | SimConnect | Main process → IPC → Renderer |
| Heartbeat (always on) | SimConnect | Main process → Socket.io → VPS (30s) |
| Observer viewing pilot's flight | SimConnect | Main → Socket.io → VPS → Socket.io → Observer |

## Electron SimConnect Bridge

Copy the ~5 SimConnect files from `backend/src/simconnect/` into `electron/src/simconnect/` (connection, definitions, reader, types, null-manager). The Electron main process owns its own copy — no cross-package dependency.

### Lifecycle

1. On app ready, dynamically `import()` the SimConnect bridge (try/catch fallback to null manager)
2. `bridge.connect()` starts the auto-reconnect loop
3. Bridge emits parsed telemetry events (position, engine, fuel, flight state, etc.)
4. On `positionUpdate` → IPC to renderer (`sim:telemetry`) + buffer for heartbeat
5. On app quit → `bridge.disconnect()`

### IPC Channels (Electron → Renderer)

- `sim:telemetry` — full `TelemetrySnapshot` at poll interval (~200ms)
- `sim:status` — `ConnectionStatus` object (already defined in `ipc-channels.ts`, currently unused)

## VPS Relay Protocol

### New WebSocket Events

**Pilot → VPS (`ClientToServerEvents`):**
- `flight:heartbeat` — `{ callsign, lat, lon, alt, heading, groundspeed, phase, aircraftType }`. Sent every 30s.
- `flight:telemetry` — full `TelemetrySnapshot`. Only sent when VPS signals demand.
- `flight:ended` — pilot disconnected SimConnect or ended flight.

**VPS → Pilot (`ServerToClientEvents`):**
- `relay:start` — "observer watching, start full telemetry relay"
- `relay:stop` — "no observers, stop relay"

**VPS → Observer (`ServerToClientEvents`):**
- `telemetry:update` — existing event, reused. VPS forwards pilot telemetry to subscribers.
- `flights:active` — list of all active flights with heartbeat data (for LiveMap).

### VPS Logic

- `activeFlights` Map keyed by userId
- On `flight:heartbeat` → upsert entry, broadcast `flights:active` to all clients
- On observer subscribe → increment observer count → if count goes from 0→1, send `relay:start` to pilot
- On observer unsubscribe/disconnect → decrement count → if count reaches 0, send `relay:stop` to pilot
- On `flight:ended` → remove from registry, notify observers

## Frontend Changes

### Dual-Source Telemetry

The `telemetryStore` remains the single source of truth. Two input paths:

1. **Local (Electron IPC)**: New `useLocalSimConnect()` hook listens on `sim:telemetry` and `sim:status` IPC channels. Feeds `telemetryStore.setSnapshot()` and `setConnectionStatus()`.
2. **Remote (VPS WebSocket)**: Existing `useSocket()` hook handles `telemetry:update` and `connection:status` from VPS.

When in Electron with SimConnect connected, local IPC takes priority. Components don't need to know the source — they read from the same store.

### LiveMap Active Flights

- New `flights:active` WebSocket event populates the LiveMap with icons for all active flights
- Clicking a flight subscribes to that pilot's telemetry (triggers demand relay)
- Unsubscribing (navigating away) signals VPS to stop relay if no observers remain

## Build & Packaging

### Electron Dependencies (`electron/package.json`)

- Add `node-simconnect: ^4.0.0` to `optionalDependencies`
- Add `socket.io-client: ^4.8.1` to `dependencies` (main process VPS relay)
- Re-enable `npmRebuild: true` so electron-builder rebuilds native modules automatically

### Release Pipeline

No changes to the 8-step release script. `prepare-backend.js` remains unused (VPS doesn't need SimConnect). Electron-builder handles native module rebuild natively.

### Development Mode

- `npm run dev:all` runs backend externally (SimConnect in backend process for dev)
- Electron in dev mode defers to the local backend's SimConnect — no duplication
- Production mode: Electron main process owns SimConnect directly

## Files to Create/Modify

### New Files
- `electron/src/simconnect/connection.ts` — adapted from backend copy
- `electron/src/simconnect/definitions.ts` — copied from backend
- `electron/src/simconnect/reader.ts` — copied from backend
- `electron/src/simconnect/types.ts` — copied from backend
- `electron/src/simconnect/null-manager.ts` — copied from backend
- `electron/src/relay.ts` — Socket.io client for VPS heartbeat + relay
- `frontend/src/hooks/useLocalSimConnect.ts` — IPC telemetry listener

### Modified Files
- `electron/src/main.ts` — add SimConnect init + IPC handlers + relay startup
- `electron/src/ipc-channels.ts` — add `SIM_TELEMETRY` channel
- `electron/src/preload.ts` — expose `sim:telemetry` in receive channels
- `electron/package.json` — add deps, re-enable npmRebuild
- `shared/src/types/websocket.ts` — add relay events
- `backend/src/websocket/handler.ts` — add active flights registry + relay signaling
- `frontend/src/hooks/useSocket.ts` — handle `flights:active` event
- `frontend/src/stores/telemetryStore.ts` — no changes (already correct interface)
- `frontend/src/components/map/FlightMap.tsx` — render active flight icons
