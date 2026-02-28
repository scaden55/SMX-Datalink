# Dispatch Page Overhaul — Design

**Date:** 2026-02-28
**Branch:** `feat/exceedance-detection` (or new branch)

## Problem Statement

Four issues with the dispatch page:

1. **Pilot visibility**: Pilots should see only their own dispatched flights
2. **Admin visibility**: Admins should see their own flights plus all other pilots' flights
3. **Telemetry isolation**: When an admin selects another pilot's flight, the admin's own SimConnect telemetry overrides the observed pilot's data
4. **Release notifications with field highlighting**: When an admin edits and releases a flight, the pilot should receive a notification and see highlighted fields on the dispatch page

## Design

### 1. Role-Based Flight Visibility

**Backend** (`GET /api/dispatch/flights`): Already correctly filters — pilots get their own flights only, admins get all. No backend changes needed.

**Frontend sidebar**: Currently, pilots see airport cards while admins see a flight list. Change:
- Pilots see a flight list (their own flights) in the sidebar, replacing airport cards entirely
- Admins continue seeing the full flight list (all pilots' flights)
- Both roles use the same `SidebarPanel` flight list component, just with different data

### 2. Telemetry Isolation

**Root cause**: Components on the dispatch page read from `telemetryStore.snapshot` (the local user's SimConnect data) instead of `useDispatchTelemetry()` which correctly returns remote data for observed flights.

**Fix**:
- Audit all dispatch-page telemetry consumers to use `useDispatchTelemetry()`:
  - `FlightMap` — aircraft position
  - `VerticalProfile` — altitude profile
  - `FlightHeader` — phase/speed/altitude
  - `FlightDetailSections` — engine/fuel/flight data
  - `FlightLogTab` — event tracking
  - `DispatchActionBar` — phase buttons
- Add an "Observing" amber banner when `isOwnFlight === false`:
  - Shows pilot callsign and flight number
  - Renders at top of `FlightPlanPanel`

### 3. Dispatcher Release with Persistent Field Highlighting

**Backend**:

- **Migration**: Add `released_fields TEXT DEFAULT NULL` to `active_bids` (JSON array of field names)
- **Modify release endpoint** (`POST /dispatch/flights/:bidId/release`): Persist `changedFields` to `released_fields`
- **New acknowledge endpoint** (`POST /dispatch/flights/:bidId/acknowledge`): Clears `released_fields` to NULL. Available to bid owner or admin.
- **Include `releasedFields` in dispatch flight response** from `GET /api/dispatch/flights`

**Frontend**:

- Listen for `dispatch:released` WebSocket event → update flight's `releasedFields` in state
- Fields in `releasedFields` array get amber left-border highlight: `border-l-2 border-amber-400 bg-amber-400/5`
- "Acknowledge Changes" button in `DispatchActionBar` (pilot only, when `releasedFields` is non-empty)
- Clicking acknowledge calls endpoint and clears highlights

### 4. Shared Type Changes

- Add `releasedFields?: string[] | null` to `DispatchFlight`
- No changes to telemetry types or socket event signatures

## Files to Modify

### Backend
- `backend/src/routes/dispatch.ts` — release endpoint modification, new acknowledge endpoint
- `backend/src/services/dispatch.ts` — include `released_fields` in query, add acknowledge method
- `backend/src/migrations/` — new migration for `released_fields` column

### Frontend
- `frontend/src/pages/DispatchPage.tsx` — pass flights to sidebar for pilots too, listen for `dispatch:released`
- `frontend/src/components/sidebar/SidebarPanel.tsx` — show flight list for pilots (not just admins)
- `frontend/src/components/flight-plan/FlightPlanPanel.tsx` — observing banner
- `frontend/src/components/flight-plan/FlightHeader.tsx` — use `useDispatchTelemetry()`
- `frontend/src/components/flight-plan/FlightDetailSections.tsx` — use `useDispatchTelemetry()`, field highlighting
- `frontend/src/components/flight-plan/DispatchActionBar.tsx` — acknowledge button
- `frontend/src/components/map/FlightMap.tsx` — use `useDispatchTelemetry()`
- `frontend/src/components/map/VerticalProfile.tsx` — use `useDispatchTelemetry()`
- `frontend/src/components/info-panel/FlightLogTab.tsx` — use `useDispatchTelemetry()`

### Shared
- `shared/src/types/dispatch.ts` — add `releasedFields` to `DispatchFlight`
