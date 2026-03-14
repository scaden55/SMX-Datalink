# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Identity

SMA Virtual is primarily a **cargo airline**. Cargo is first and foremost in all UI ordering and emphasis.

**Airline code: SMX** — use "SMX" for all flight numbers, user IDs, callsigns, and identifiers (not "SMA").

## Commands

```
npm run dev:all          # Run backend + frontend + electron (ALWAYS use this, not just `npm run dev`)
npm run dev              # Backend + frontend only (NO Electron — avoid this)
npm run dev:vps          # Frontend pointed at VPS + electron (for testing against production backend)
npm run build            # Build all workspaces (shared first, then rest in parallel)
npm run build -w <ws>    # Build a single workspace: shared, backend, frontend, electron, admin
npm run package          # Full build + Electron NSIS installer
scripts/release.sh <ver> # 10-step release pipeline (bump, build all, package, deploy VPS, tag, GitHub release)
```

**There are no tests.** No test framework is configured in any workspace.

## Project Structure

```
shared/      @acars/shared — types, constants, simvar definitions (build FIRST)
backend/     Express 4 API, Socket.io 4, better-sqlite3, JWT auth, port 3001
frontend/    React 19, Zustand 5, Leaflet, Tailwind CSS, Vite 6, shadcn/ui (pilot app)
admin/       React 19, Zustand 5, Tailwind CSS, Vite 6, shadcn/ui (admin panel, port 5174)
electron/    Electron 33, NSIS installer, SimConnect bridge, auto-updater
scripts/     release.sh, prepare-backend.js, generate-ico.mjs
```

## Build Order

`shared` must be built before backend/frontend/electron/admin (they all import `@acars/shared`).

```
npx tsc -p shared/         # 1. Always first
npm run build -w backend    # 2. Can parallel with frontend/electron/admin
npm run build -w frontend
npm run build -w electron
npm run build -w admin
```

## Architecture

### Telemetry Data Flow (dual path)

The system has two parallel paths for getting flight data from the simulator to observers:

```
MSFS ──SimConnect──► Electron Main Process (200ms poll)
                         │
                         ├──IPC──► Renderer (pilot sees own telemetry)
                         │              └──Socket.io──► Backend (stored/broadcast)
                         │
                         └──VPS Relay──► Backend (dispatch observers see pilot telemetry)
```

- **Local path**: SimConnect → Electron main → IPC `SIM_TELEMETRY` → renderer → telemetryStore
- **Relay path**: SimConnect → Electron main → Socket.io `flight:telemetry` → VPS backend → dispatch observers
- The relay activates on demand: VPS sends `relay:start`/`relay:stop` when observers join/leave
- A 30s heartbeat sends lightweight position data when full relay is inactive

### Flight Phase FSM (duplicated)

The flight phase state machine exists in **two places** with identical logic:
- **Electron**: `electron/src/simconnect/flight-phase.ts` (CJS, constants inlined — cannot import ESM shared)
- **Backend**: `backend/src/services/flight-phase.ts` (ESM, imports from `@acars/shared`)

10 states: PREFLIGHT → TAXI_OUT → TAKEOFF → CLIMB → CRUISE → DESCENT → APPROACH → LANDING → TAXI_IN → PARKED

Changes to phase logic must be made in **both files**.

### Auth Architecture

- JWT HS256 with access + refresh tokens; `config.ts` requires `JWT_SECRET` in production
- Backend middleware chain: `authMiddleware` → `adminMiddleware` or `dispatcherMiddleware`
- Four auth levels: unauthenticated, pilot, dispatcher (can approve PIREPs/schedules), admin
- **Pilot frontend** stores tokens via Zustand persist middleware (key: `acars-auth`)
- **Admin frontend** stores tokens via manual localStorage (key: `admin-auth`) — separate from pilot auth
- Both frontends implement mutex-based 401 → refresh → retry on API calls

### Socket.io Architecture

Backend WebSocket handler (`backend/src/websocket/handler.ts`) manages:
- **Subscription tracking**: Per-socket Sets prevent count drift (telemetry, vatsim, livemap subscribers)
- **Active flights**: `Map<bid_id, ActiveFlightHeartbeat>` for heartbeat data
- **Flight observers**: `Map<bid_id, Set<socket_id>>` for dispatch observer tracking
- **Throttled broadcast**: Telemetry only broadcasts when subscribers exist
- Key events: `telemetry:update`, `flights:active`, `track:update`, `exceedance:event`, `acars:message`

### Database

- better-sqlite3 in WAL mode with foreign keys enabled
- 41 SQL migrations in `backend/src/db/migrations/` (numbered `001-*` through `041-*`)
- Auto-applied on startup: reads migration dir, diffs against `schema_migrations` table
- Seeds admin user (`admin@smavirtual.com`) and 95 airports on first run
- Row types in `backend/src/types/db-rows.ts` — use `*Row` for SELECT *, `*QueryRow` for shaped queries

### Backend Startup Sequence

`backend/src/index.ts` initializes in order:
1. Database init → migrations → seed
2. Express middleware (Helmet, CORS, rate limiting)
3. SimConnect (optional, falls back to NullSimConnectManager)
4. Services (TelemetryService, FlightEventTracker)
5. Route registration (all `/api` prefix, admin routes require auth + role check)
6. Socket.io setup
7. Periodic tasks (bid expiration 5m, token cleanup 1h, charter generation 24h)
8. Async startup jobs (airport import, VATSIM polling)

## Coding Conventions

### Backend
- **Logger**: Use `logger.info/warn/error(tag, msg, meta)` from `backend/src/lib/logger.ts` — NOT console.log
- **DB types**: Use typed interfaces from `backend/src/types/db-rows.ts` for all query results
- **Imports**: Use `.js` extension in imports (Node16 module resolution)
- **Auth**: Middleware augments `req.user` with `AuthPayload` (userId, role, callsign)
- **Routes**: Each file exports a factory function returning Express Router; some receive injected services (telemetry, io)
- **Env vars**: `JWT_SECRET` and `SIMBRIEF_API_KEY` required in production; `LOG_LEVEL` controls verbosity

### Frontend (pilot app)
- **Router**: HashRouter (for Electron file:// protocol compatibility)
- **Toasts**: Use `toast.error/warning/success/info(msg)` from `frontend/src/stores/toastStore.ts`
- **Sockets**: Use `useSocketSubscription` hook for subscribe/listen/cleanup; auto-init in MainShell
- **Path alias**: `@/*` maps to `./src/*`
- **Lazy loading**: Map-heavy pages use `React.lazy`
- **Icons**: Phosphor icons (`@phosphor-icons/react`)
- **Base URL**: `./` (relative, for Electron packaged builds)

### Admin (admin panel)
- **Router**: BrowserRouter with `basename="/admin"` (VPS-hosted at `/admin/` subpath)
- **Socket**: Manual initialization — connects on DashboardPage and DispatchBoardPage, not globally
- **Auth storage**: Manual localStorage (`admin-auth` key), NOT Zustand persist
- **Icons**: Phosphor icons (`@phosphor-icons/react`), same as pilot frontend
- **Base URL**: `/admin/` in Vite config
- **Port**: 5174 in dev
- Backend serves admin at `express.static(adminDistPath)` with SPA fallback for `/admin/*`

### Design System (both apps — unified deep indigo theme)
- **Background**: `#030726` (solid, no gradients) — `--surface-0` / `--bg-app`
- **Foreground**: `#111532` — `--surface-1` / `--bg-panel`
- **Surface-2**: `#181D3E` (cards, inputs) — `--surface-2` / `--bg-input`
- **Surface-3**: `#1F2549` (elevated) — `--surface-3` / `--bg-hover`
- **Accent**: Blue `#4F6CCD` (`--accent` / `--accent-blue`)
- **Accent bright**: `#7B94E0` (`--accent-blue-bright`)
- **Token file (admin)**: `admin/src/styles/tokens.css` — single source of truth for all admin visual constants
- **Token file (frontend)**: `frontend/src/styles/planning-tokens.css` — all pilot app colors
- **Typography (sans)**: Lufga (custom font); sizes via `--text-*-size` tokens (display 24px, body 13px, caption 11px)
- **Typography (mono)**: System monospace (`ui-monospace, Cascadia Mono, Consolas, monospace`) — use `font-mono` class for ALL aviation data (flight numbers, ICAO codes, altitudes, speeds, headings, callsigns, timestamps, durations, registrations)
- **Icon weight**: Use `weight="regular"` for Phosphor icons (not "light") for better readability
- **Aviation formatting**: Leading zeros on FL (FL001), headings (045°), speeds (120kt). Use `tabular-nums` on all numeric data
- **Spacing**: `--space-*` scale (4px increments); border radius via `--radius-*` tokens
- **Components**: shadcn/ui in `<workspace>/src/components/ui/`
- **Forbidden**: No purple, no glassmorphism, no `rounded-xl` containers, no `backdrop-blur`

### Electron
- **IPC**: 30 channels defined in `electron/src/ipc-channels.ts`, whitelisted in preload.ts
- **Packaging**: `scripts/prepare-backend.js` creates standalone `.backend-standalone/` — never bundle `backend/node_modules` directly (hoisting empties it)
- **better-sqlite3**: Raw C++ API, ABI-version specific — must `@electron/rebuild` for Electron
- **ELECTRON_RUN_AS_NODE**: Must be `'1'` in fork env
- **SimConnect**: Optional `node-simconnect`, graceful fallback to NullSimConnectManager

## Critical Rules

- **NEVER kill or restart explorer.exe** — breaks Windows taskbar, requires full reboot
- **NEVER commit .env files** — secrets live on VPS only; `.env.example` is the template
- **NEVER use `backend/node_modules` for Electron packaging** — use prepare-backend standalone install
- Always run the app with Electron: `npm run dev:all`, not just `npm run dev`
- Flight phase changes must be updated in BOTH `electron/src/simconnect/flight-phase.ts` AND `backend/src/services/flight-phase.ts`
