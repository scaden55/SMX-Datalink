# Bid Reservation System Design

## Problem

Bids currently persist indefinitely and have no exclusivity — multiple pilots can bid on the same flight and use the same aircraft. This creates conflicts and doesn't reflect real airline operations where flight assignments are exclusive.

## Requirements

1. Bids expire after 24 hours if the flight hasn't started
2. A bid exclusively reserves both the flight and the aircraft — no other pilot can bid on either
3. Airborne flights are protected from expiry
4. Admins can force-remove any bid
5. Fleet page shows aircraft reservation/flight status
6. Expired bids are fully deleted with pilot notification

## Design

### Database

New migration `025-bid-expiration.sql`:
- Add `expires_at TEXT` column to `active_bids`, defaulting to `datetime('now', '+24 hours')`

No new tables. Exclusivity enforced in application logic (must skip expired bids in checks).

### Backend — Bid Exclusivity

`POST /api/bids` gains two new checks before insert:

1. **Schedule exclusivity**: reject if any non-expired bid exists for that `schedule_id` from another user
2. **Aircraft exclusivity**: reject if any non-expired bid exists for that `aircraft_id` from another user

Expired bids (where `expires_at < datetime('now')`) are ignored in exclusivity checks.

### Backend — Expiration Sweep

New `BidExpirationService` class:
- `setInterval` every 5 minutes
- Query: `expires_at < datetime('now') AND flight_plan_phase NOT IN ('airborne')`
- Delete each expired bid (reuse charter cleanup logic)
- Emit `bid:expired` socket event to affected pilot
- Structured logging for each expiration

### Backend — Admin Force-Remove

New endpoint: `DELETE /api/bids/:id/force` (admin/dispatch role required)
- Deletes bid regardless of ownership
- Emits `bid:expired` to affected pilot with admin flag
- Reuses existing charter cleanup logic

### Frontend — Notifications

- Listen for `bid:expired` socket event globally
- Toast notification: "Your bid for [flight] has expired" or "was removed by an administrator"
- Auto-refresh bids list

### Frontend — Schedule Page

- Flights with existing reservations show "Reserved" badge, bid button disabled
- User's own bids show countdown timer (time remaining until expiry)
- Aircraft selector filters out aircraft reserved by other pilots

### Frontend — Fleet Page

Two new computed display states overlaid on real `fleet.status`:
- **Reserved** (amber badge): aircraft has active bid, flight not started
- **In Flight** (blue badge): aircraft's bid is in `airborne` phase
- Derived from bid data returned alongside fleet data — no changes to the `fleet.status` DB column

### API Endpoint for Fleet Bid Status

Existing `GET /api/fleet/manage` extended to include bid reservation info per aircraft:
- `reservedByBidId`, `reservedByPilot`, `flightPhase` fields on each aircraft
- Frontend uses these to render the appropriate badge

### Socket Events

New event: `bid:expired`
```typescript
'bid:expired': (data: { bidId: number; flightNumber: string; reason: 'expired' | 'admin_removed' }) => void;
```

### Data Flow

```
Pilot bids → exclusivity check → insert with expires_at → return bid

Every 5 min → sweep expired non-airborne bids → delete + notify pilot

Admin force-remove → delete any bid → notify pilot

Fleet page → GET /api/fleet/manage (includes bid info) → Reserved/In Flight badges
```
