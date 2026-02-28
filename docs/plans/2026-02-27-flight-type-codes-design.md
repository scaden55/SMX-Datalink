# Unified Flight Creation with IATA Flight Type Codes

## Problem

The current system uses `charter_type` (`'cargo' | 'passenger' | 'reposition' | 'generated' | 'event'`) which conflates creation context with flight purpose. Pilots see a "Create Charter" button with only 3 options. The airline needs standard IATA flight type codes for all flights.

## Decision

Replace `charter_type` with `flight_type` using 22 single-letter IATA codes. Unify the "Create Charter" button into a single "Create" button on the schedule page with a flight type dropdown.

## Flight Type Codes

| Code | Description |
|------|-------------|
| J | Scheduled Passenger |
| F | Scheduled Cargo |
| C | Charter Passenger |
| A | Additional/Supplemental Cargo |
| E | VIP |
| G | Additional/Supplemental Passenger |
| H | Charter Cargo |
| I | Ambulance |
| K | Training |
| M | Mail Service |
| O | Special Handling |
| P | Positioning |
| T | Technical Test |
| S | Shuttle |
| B | Additional/Supplemental Shuttle |
| Q | Combination Cargo/Passenger |
| R | Additional/Supplemental Combo |
| L | Special Charter |
| D | General Aviation |
| N | Air Taxi/Business |
| Y | Company-Specific |
| Z | Other |

## Migration

`030-flight-type.sql`:
- `ALTER TABLE scheduled_flights RENAME COLUMN charter_type TO flight_type`
- Map old values: cargo→F, passenger→J, reposition→P, generated→F, event→J

## Shared Types

Replace `CharterType` with:
```typescript
export type FlightType = 'J' | 'F' | 'C' | 'A' | 'E' | 'G' | 'H' | 'I' | 'K' | 'M' | 'O' | 'P' | 'T' | 'S' | 'B' | 'Q' | 'R' | 'L' | 'D' | 'N' | 'Y' | 'Z';

export const FLIGHT_TYPES: Record<FlightType, string> = {
  J: 'Scheduled Passenger', F: 'Scheduled Cargo', C: 'Charter Passenger',
  A: 'Additional/Supplemental Cargo', E: 'VIP', G: 'Additional/Supplemental Passenger',
  H: 'Charter Cargo', I: 'Ambulance', K: 'Training', M: 'Mail Service',
  O: 'Special Handling', P: 'Positioning', T: 'Technical Test', S: 'Shuttle',
  B: 'Additional/Supplemental Shuttle', Q: 'Combination Cargo/Passenger',
  R: 'Additional/Supplemental Combo', L: 'Special Charter', D: 'General Aviation',
  N: 'Air Taxi/Business', Y: 'Company-Specific', Z: 'Other'
};
```

## Frontend

- "Create Charter" button → "Create" button on schedule page
- Charter modal → "Create Flight" modal with flight type `<select>` dropdown
- Dropdown format: `F — Scheduled Cargo`
- Default: `F` (Scheduled Cargo) — SMA is a cargo airline
- Keep airport search, dep time, optional flight number fields

## Backend

- `POST /api/charters` accepts `flightType` (letter code) instead of `charterType`
- All SQL queries: `charter_type` → `flight_type`
- Charter generator: `'generated'` → `'F'`
- VATSIM events: `'event'` → `'J'`

## Files Touched

| File | Change |
|------|--------|
| `backend/src/db/migrations/030-flight-type.sql` | New migration |
| `shared/src/types/schedule.ts` | Replace CharterType, update interfaces |
| `backend/src/routes/schedules.ts` | charterType → flightType |
| `backend/src/services/schedule.ts` | charter_type SQL → flight_type |
| `backend/src/services/schedule-admin.ts` | Same |
| `backend/src/services/charter-generator.ts` | Use 'F' |
| `backend/src/services/vatsim-events.ts` | Use 'J' |
| `backend/src/services/dispatch.ts` | SQL references |
| `backend/src/services/bid-expiration.ts` | SQL references |
| `backend/src/services/regulatory.ts` | SQL references |
| `backend/src/routes/admin-schedules.ts` | charterType → flightType |
| `backend/src/routes/regulatory.ts` | SQL references |
| `backend/src/types/db-rows.ts` | DB row type field |
| `frontend/src/pages/SchedulePage.tsx` | Button + modal overhaul |
| `frontend/src/pages/admin/AdminSchedulesPage.tsx` | charterType → flightType |
