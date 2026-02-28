# OOOI Automation — Design

## Overview

Auto-detect OUT/OFF/ON/IN timestamps from SimConnect telemetry via the existing flight phase state machine. Store per-flight timestamps to calculate block time (OUT→IN) and flight time (OFF→ON). Display an OOOI timeline on flight detail pages and block time in the logbook.

## OOOI Events

| Event | Meaning | Phase Transition | Trigger |
|-------|---------|-----------------|---------|
| OUT | Gate departure | PREFLIGHT → TAXI_OUT | Parking brake released |
| OFF | Wheels-off | TAKEOFF → CLIMB | `simOnGround` flips false |
| ON | Touchdown | any → LANDING | `simOnGround` flips true |
| IN | Gate arrival | TAXI_IN → PARKED | Parking brake set + stopped |

## Approach: Extend FlightEventTracker

The `FlightEventTracker` singleton already captures `takeoffTime` and `landingRateFpm` at phase transitions. We add four OOOI timestamp fields captured at the same phase change points. No new services or listeners needed.

## Data Capture

`FlightEventTracker` gains four fields:

```
oooiOut: string | null   — set at PREFLIGHT → TAXI_OUT
oooiOff: string | null   — set at TAKEOFF → CLIMB
oooiOn:  string | null   — set at any → LANDING
oooiIn:  string | null   — set at TAXI_IN → PARKED
```

All timestamps are ISO 8601 UTC via `new Date().toISOString()`.

## Database

Migration `031-oooi-times.sql` — four nullable TEXT columns on `logbook`:

```sql
ALTER TABLE logbook ADD COLUMN oooi_out TEXT;
ALTER TABLE logbook ADD COLUMN oooi_off TEXT;
ALTER TABLE logbook ADD COLUMN oooi_on TEXT;
ALTER TABLE logbook ADD COLUMN oooi_in TEXT;
```

Additionally fix existing time semantics:
- `actual_dep` = `oooiOff` (wheels-off, real departure)
- `actual_arr` = `oooiOn` (touchdown, real arrival)
- `flight_time_min` = OFF → ON duration (air time)

## PIREP Submission Changes

1. Read OOOI times from `FlightEventTracker`
2. If `oooiIn` is null at submission time, use `new Date().toISOString()` as fallback
3. Store all four OOOI columns in logbook INSERT
4. Calculate `flight_time_min` from OFF → ON
5. Set `actual_dep = oooiOff`, `actual_arr = oooiOn`

## Shared Types

Add to `LogbookEntry`:

```typescript
oooiOut?: string;
oooiOff?: string;
oooiOn?: string;
oooiIn?: string;
blockTimeMin?: number;  // calculated: IN - OUT
```

## Frontend — OOOI Timeline

FlightDetailPage gets a horizontal timeline:

```
OUT ──────── OFF ════════════════ ON ──────── IN
14:32Z       14:45Z               16:12Z      16:19Z
        Taxi 13m          Flight 1h27m     Taxi 7m
              ╠══ Block Time: 1h47m ══╣
```

- Dashed lines = ground segments, solid = airborne
- Timestamps in Zulu
- Block time and flight time as summary stats
- Design system: `font-mono`, `--bg-panel`, blue accent for airborne segment

LogbookPage table adds a "Block" column showing block time.

## Edge Cases

- **Early PIREP submission** (before IN): submission timestamp used as fallback IN time
- **Touch-and-go**: ON resets on each touchdown; only final ON is kept
- **Sim crash/disconnect**: partial OOOI data stored as-is; null fields show "N/A" in UI
- **Existing logbook entries**: OOOI columns nullable, old entries display without timeline
