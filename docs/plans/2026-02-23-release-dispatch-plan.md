# Release Dispatch Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Release Dispatch" button that notifies the assigned pilot (via ACARS message + notification bell) when a dispatcher finishes editing their flight plan.

**Architecture:** Frontend-tracked dirty fields in DispatchEditContext accumulate changed field names. On button click, POST to a new backend endpoint that creates a SYSTEM ACARS message + notification + WebSocket event. No DB schema changes needed.

**Tech Stack:** TypeScript, React 19, Express 4, Socket.io 4, better-sqlite3, Zustand, @acars/shared

---

### Task 1: Add shared types (DispatchReleasePayload + WebSocket event)

**Files:**
- Modify: `shared/src/types/dispatch.ts:34` (end of file)
- Modify: `shared/src/types/websocket.ts:38` (add event to ServerToClientEvents)

**Step 1: Add DispatchReleasePayload to dispatch.ts**

At the end of `shared/src/types/dispatch.ts`, add:

```typescript
/** Payload sent when a dispatcher releases flight plan edits to the pilot */
export interface DispatchReleasePayload {
  changedFields: string[];
}
```

**Step 2: Add dispatch:released event to websocket.ts**

In `shared/src/types/websocket.ts`, inside `ServerToClientEvents` (after line 38, the `flight:completed` entry), add:

```typescript
  'dispatch:released': (data: { bidId: number; changedFields: string[] }) => void;
```

**Step 3: Export the new type from shared index**

Check `shared/src/types/index.ts` (or wherever dispatch types are re-exported) and ensure `DispatchReleasePayload` is exported. The existing barrel export of `dispatch.ts` should cover it automatically.

**Step 4: Build shared to verify**

Run: `cd shared && npx tsc --noEmit`
Expected: 0 errors

**Step 5: Commit**

```bash
git add shared/src/types/dispatch.ts shared/src/types/websocket.ts
git commit -m "feat(shared): add DispatchReleasePayload type and dispatch:released WebSocket event"
```

---

### Task 2: Add backend POST /api/dispatch/flights/:bidId/release endpoint

**Files:**
- Modify: `backend/src/routes/dispatch.ts:209` (before `return router;`)
- Read (reference): `backend/src/services/dispatch.ts` (for `findBidOwner`)
- Read (reference): `backend/src/services/messages.ts` (for `createMessage`)
- Read (reference): `backend/src/services/notification.ts` (for `send`)

**Step 1: Import NotificationService in dispatch router**

At the top of `backend/src/routes/dispatch.ts`, add this import (after the existing service imports around line 7):

```typescript
import { NotificationService } from '../services/notification.js';
```

And instantiate it inside `dispatchRouter()` (after `const pirepService = ...` around line 23):

```typescript
  const notificationService = new NotificationService();
```

**Step 2: Add the release endpoint**

Before the `return router;` line (line 212) in `backend/src/routes/dispatch.ts`, add:

```typescript
  // POST /api/dispatch/flights/:bidId/release — release dispatch edits to pilot
  router.post('/dispatch/flights/:bidId/release', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const bidId = Number(req.params.bidId);
      if (isNaN(bidId)) {
        res.status(400).json({ error: 'Invalid bid ID' });
        return;
      }

      const { changedFields } = req.body as { changedFields?: string[] };
      if (!Array.isArray(changedFields) || changedFields.length === 0) {
        res.status(400).json({ error: 'changedFields array is required' });
        return;
      }

      // Look up who owns this bid (the pilot)
      const bid = dispatchService.findBidOwner(bidId);
      if (!bid) {
        res.status(404).json({ error: 'Bid not found' });
        return;
      }

      // Build a human-readable summary of changed fields
      const fieldSummary = changedFields.join(', ');
      const messageContent = `Dispatch update: ${fieldSummary} modified`;

      // Create SYSTEM ACARS message in the flight's message thread
      const message = messageService.createMessage(bidId, req.user!.userId, 'SYSTEM', messageContent);

      // Send notification bell entry to the pilot
      notificationService.send({
        userId: bid.userId,
        message: `Dispatcher updated your flight plan (${fieldSummary})`,
        type: 'info',
        link: '/dispatch',
      });

      // Broadcast via WebSocket
      if (io) {
        io.to(`bid:${bidId}`).emit('dispatch:released', { bidId, changedFields });
        io.to(`bid:${bidId}`).emit('acars:message', message);
      }

      res.json({ ok: true });
    } catch (err) {
      logger.error('Dispatch', 'Release dispatch error', err);
      res.status(500).json({ error: 'Failed to release dispatch' });
    }
  });
```

**Step 3: Build backend to verify**

Run: `cd backend && npx tsc --noEmit`
Expected: 0 errors

**Step 4: Commit**

```bash
git add backend/src/routes/dispatch.ts
git commit -m "feat(dispatch): add POST /release endpoint with ACARS message + notification"
```

---

### Task 3: Extend DispatchEditContext with release tracking

**Files:**
- Modify: `frontend/src/contexts/DispatchEditContext.tsx`

**Step 1: Add release state to the context interface**

In `DispatchEditContext.tsx`, extend `DispatchEditContextValue` (lines 6-18) to add these fields:

```typescript
  hasUnreleasedChanges: boolean;
  releasing: boolean;
  releaseDispatch: () => Promise<void>;
```

Update the default context value (lines 20-32) to include:

```typescript
  hasUnreleasedChanges: false,
  releasing: false,
  releaseDispatch: async () => {},
```

**Step 2: Add the release tracking ref and state**

Inside `DispatchEditProvider`, add after the existing refs (around line 51):

```typescript
  const releasedFieldsRef = useRef<Set<string>>(new Set());
  const [hasUnreleasedChanges, setHasUnreleasedChanges] = useState(false);
  const [releasing, setReleasing] = useState(false);
```

**Step 3: Accumulate field names on edit**

In the existing `onFieldChange` callback (line 94), add one line to track the field for release:

```typescript
  const onFieldChange = useCallback((key: string, value: string) => {
    setEditableFields((prev) => ({ ...prev, [key]: value }));
    dirtyFieldsRef.current[key as keyof DispatchEditPayload] = value;
    releasedFieldsRef.current.add(key);
    setHasUnreleasedChanges(true);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(flush, 1500);
  }, [flush]);
```

**Step 4: Reset release tracking on flight change**

In the existing `useEffect` that resets on bid/data change (line 63), also reset the release set:

```typescript
  useEffect(() => {
    bidIdRef.current = bidId;
    setEditableFields(flightPlanData ?? {});
    dirtyFieldsRef.current = {};
    releasedFieldsRef.current = new Set();
    setHasUnreleasedChanges(false);
    setLastSavedAt(null);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, [bidId, flightPlanData]);
```

**Step 5: Add releaseDispatch function**

After the `onFieldChange` callback, add:

```typescript
  const releaseDispatch = useCallback(async () => {
    const currentBidId = bidIdRef.current;
    if (!currentBidId || releasedFieldsRef.current.size === 0) return;

    // Flush any pending auto-save first
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      await flush();
    }

    const changedFields = Array.from(releasedFieldsRef.current);
    setReleasing(true);
    try {
      await api.post(`/api/dispatch/flights/${currentBidId}/release`, { changedFields });
      releasedFieldsRef.current = new Set();
      setHasUnreleasedChanges(false);
      toast.success('Dispatch released to pilot');
    } catch (err) {
      console.error('[DispatchEdit] Release failed:', err);
      toast.error('Failed to release dispatch');
    } finally {
      setReleasing(false);
    }
  }, [flush]);
```

**Step 6: Pass new values through the provider**

Update the `value` prop of `DispatchEditContext.Provider` (line 114) to include:

```typescript
      value={{
        canEdit,
        canEditFuel,
        canEditRoute,
        canEditMEL,
        canEditRemarks,
        phase,
        bidId,
        editableFields,
        onFieldChange,
        saving,
        lastSavedAt,
        hasUnreleasedChanges,
        releasing,
        releaseDispatch,
      }}
```

**Step 7: Build frontend to verify**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors

**Step 8: Commit**

```bash
git add frontend/src/contexts/DispatchEditContext.tsx
git commit -m "feat(dispatch): extend DispatchEditContext with release tracking"
```

---

### Task 4: Add Release Dispatch button to TopBar

**Files:**
- Modify: `frontend/src/components/layout/TopBar.tsx`

**Step 1: Import useDispatchEdit**

At the top of `TopBar.tsx`, add:

```typescript
import { useDispatchEdit } from '../../contexts/DispatchEditContext';
```

**Step 2: Consume context values**

Inside the `TopBar` component function, after the existing hooks (around line 16), add:

```typescript
  const { canEdit, hasUnreleasedChanges, releasing, releaseDispatch } = useDispatchEdit();
```

**Step 3: Add Release Dispatch button**

In the center section of the JSX (the `<div>` with `canEndFlight` button, around line 76), add the Release Dispatch button BEFORE the End Flight button:

```tsx
        {canEdit && (
          <button
            onClick={releaseDispatch}
            disabled={!hasUnreleasedChanges || releasing}
            className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold rounded border transition-colors ${
              hasUnreleasedChanges && !releasing
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20 hover:text-blue-300'
                : 'bg-acars-input text-acars-muted border-acars-border cursor-not-allowed opacity-50'
            }`}
          >
            {releasing ? (
              <div className="w-3 h-3 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
            ) : (
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" />
              </svg>
            )}
            {releasing ? 'Releasing...' : 'Release Dispatch'}
          </button>
        )}
```

**Step 4: Build frontend to verify**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors

**Step 5: Commit**

```bash
git add frontend/src/components/layout/TopBar.tsx
git commit -m "feat(dispatch): add Release Dispatch button to TopBar"
```

---

### Task 5: Manual integration test

**Step 1: Start the dev environment**

Run: `npm run dev:all`
Expected: Backend on port 3001, frontend on 5173, Electron opens

**Step 2: Test as admin**

1. Log in as admin
2. Navigate to dispatch page with an active flight
3. Verify "Release Dispatch" button is visible but disabled (gray)
4. Edit a field (e.g., change dispatcher remarks)
5. Verify button becomes enabled (blue)
6. Click "Release Dispatch"
7. Verify:
   - Button shows spinner, then resets to disabled
   - Toast appears: "Dispatch released to pilot"
   - ACARS messages tab shows SYSTEM message with changed field names
   - Notification bell shows entry for the pilot

**Step 3: Verify pilot view**

1. Open a second browser/incognito as the pilot
2. Verify "Release Dispatch" button is NOT visible
3. After admin releases, verify pilot sees notification bell entry

**Step 4: Commit any fixes if needed**
