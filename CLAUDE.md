# SMA ACARS — Claude Code Instructions

## Identity

SMA Virtual is primarily a **cargo airline**. Cargo is first and foremost in all UI ordering and emphasis.

## Quick Reference

```
npm run dev:all          # Run backend + frontend + electron (ALWAYS use this, not just `npm run dev`)
npm run build            # Build all workspaces (shared first, then rest in parallel)
npm run build -w <ws>    # Build a single workspace (shared, backend, frontend, electron)
npm run package          # Full build + Electron NSIS installer
scripts/release.sh <ver> # 8-step release pipeline (bump, build, deploy VPS, tag, GitHub release)
```

## Project Structure

```
shared/      @acars/shared — types, constants, simvar definitions (build FIRST)
backend/     Express 4 API, Socket.io 4, better-sqlite3, JWT auth, port 3001
frontend/    React 19, Zustand 5, Leaflet, Tailwind CSS, Vite 6, shadcn/ui
electron/    Electron 33, NSIS installer, SimConnect bridge, auto-updater
scripts/     release.sh, prepare-backend.js, generate-ico.mjs
```

## Build Order

`shared` must be built before backend/frontend/electron (they import `@acars/shared` types).

```
npx tsc -p shared/         # 1. Always first
npm run build -w backend    # 2. Can parallel with frontend/electron
npm run build -w frontend
npm run build -w electron
```

## Coding Conventions

### Backend
- **Logger**: Use `logger.info/warn/error(tag, msg, meta)` from `backend/src/lib/logger.ts` — NOT console.log
- **DB types**: Use typed interfaces from `backend/src/types/db-rows.ts` for all query results
- **Imports**: Use `.js` extension in imports (Node16 module resolution)
- **Auth**: Middleware augments `req.user` with `AuthPayload` (userId, role, callsign)
- **Env vars**: `JWT_SECRET` and `SIMBRIEF_API_KEY` required in production; `LOG_LEVEL` controls verbosity

### Frontend
- **Toasts**: Use `toast.error/warning/success/info(msg)` from `frontend/src/stores/toastStore.ts`
- **Sockets**: Use `useSocketSubscription` hook for subscribe/listen/cleanup
- **Path alias**: `@/*` maps to `./src/*`
- **Lazy loading**: Map-heavy pages use `React.lazy`

### Design System
- **Accent**: Blue `#3b82f6` (`--accent` / `--accent-rgb`)
- **Panels**: Solid `#1c2033` (`--bg-panel`), `rounded-md`, inner shadow
- **Typography**: `IBM Plex Mono` for data values (`font-mono`)
- **Components**: shadcn/ui in `frontend/src/components/ui/`
- **Forbidden**: No purple, no glassmorphism, no `rounded-xl` containers, no `backdrop-blur`

### Electron
- **Packaging**: `scripts/prepare-backend.js` creates standalone `.backend-standalone/` — never bundle `backend/node_modules` directly (hoisting empties it)
- **better-sqlite3**: Raw C++ API, ABI-version specific — must `@electron/rebuild` for Electron
- **ELECTRON_RUN_AS_NODE**: Must be `'1'` in fork env

## Critical Rules

- **NEVER kill or restart explorer.exe** — breaks Windows taskbar, requires full reboot
- **NEVER commit .env files** — secrets live on VPS only; `.env.example` is the template
- **NEVER use `backend/node_modules` for Electron packaging** — use prepare-backend standalone install
- Always run the app with Electron: `npm run dev:all`, not just `npm run dev`
