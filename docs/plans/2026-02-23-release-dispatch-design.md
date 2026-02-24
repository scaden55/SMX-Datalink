# Release Dispatch — Design Document

**Date**: 2026-02-23
**Scope**: Full-stack (shared types, backend route, frontend context + UI)

## Problem Statement

Dispatchers edit flight plan fields (route, fuel, alternates, MEL, remarks) with auto-save, but there is no explicit action to notify the assigned pilot that changes have been made. The pilot has no way to know when the dispatcher has finished editing their flight plan.

## Solution

A **"Release Dispatch"** button in the dispatch TopBar (admin-only) that, when clicked:
1. Sends a **SYSTEM ACARS message** summarizing the changed fields
2. Creates a **notification bell entry** for the pilot
3. Emits a **WebSocket event** so the pilot's UI can show a real-time toast

The release is **informational only** — it does not gate the pilot's workflow. It is **repeatable** — the dispatcher can edit more fields and release again.

## Architecture

### Data Flow

```
Dispatcher edits fields → auto-save (existing, unchanged)
                        → DispatchEditContext accumulates field names in `releasedFieldsRef`

Dispatcher clicks "Release Dispatch"
  → POST /api/dispatch/flights/:bidId/release { changedFields: string[] }
  → Backend:
    1. Looks up bid owner (pilot userId)
    2. Creates SYSTEM ACARS message: "Dispatch update: route, fuelPlanned, alternate1 modified"
    3. Creates notification: "Dispatcher updated your flight plan for SMA-205"
    4. Emits dispatch:released WebSocket event to bid room
  → Frontend:
    1. Clears releasedFieldsRef
    2. Button goes disabled until next edit
    3. Toast: "Dispatch released to pilot"
```

### Button Behavior

| State | Condition | Appearance |
|-------|-----------|------------|
| Hidden | Not admin, or phase is completed | Not rendered |
| Disabled | No fields changed since last release (or page load with no edits) | Grayed out |
| Enabled | At least one field changed since last release | Blue accent, clickable |
| Loading | POST in flight | Spinner, disabled |

### Components Changed

| File | Change |
|------|--------|
| `shared/src/types/dispatch.ts` | Add `DispatchReleasePayload` type |
| `shared/src/types/websocket.ts` | Add `dispatch:released` to `ServerToClientEvents` |
| `backend/src/routes/dispatch.ts` | Add `POST /api/dispatch/flights/:bidId/release` endpoint |
| `frontend/src/contexts/DispatchEditContext.tsx` | Add `releasedFieldsRef`, `releaseDispatch()`, `hasUnreleasedChanges`, `releasing` |
| `frontend/src/components/layout/TopBar.tsx` | Add Release Dispatch button (admin-only) |

### New Shared Type

```typescript
export interface DispatchReleasePayload {
  changedFields: string[];
}
```

### New WebSocket Event

```typescript
'dispatch:released': (data: { bidId: number; changedFields: string[] }) => void
```

### Backend Endpoint

```
POST /api/dispatch/flights/:bidId/release
Auth: admin only
Body: { changedFields: string[] }
Response: { ok: true }
Side effects:
  - SYSTEM ACARS message created
  - Notification sent to pilot
  - WebSocket dispatch:released emitted
```

### Frontend Context Extensions

- `releasedFieldsRef: Set<string>` — accumulates field keys on each `onFieldChange`
- `hasUnreleasedChanges: boolean` — derived from set size > 0
- `releaseDispatch(): Promise<void>` — POSTs to release endpoint, clears set
- `releasing: boolean` — loading state for the button

## Success Criteria

- Admin sees Release Dispatch button on dispatch page (disabled when no changes)
- Clicking Release sends ACARS message + notification to pilot
- Pilot receives notification bell entry with flight info
- Pilot sees SYSTEM message in ACARS message thread
- Button resets after release; re-enables on next edit
- Non-admin users never see the button
