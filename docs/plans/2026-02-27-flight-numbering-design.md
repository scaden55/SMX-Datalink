# Flight Numbering Scheme Design

## Problem

All auto-generated flights use `SMX-100` to `SMX-9999` with no distinction by purpose. Real airlines reserve number ranges for specific operations (tactical, non-revenue, custom dispatch, etc.).

## Flight Number Format

**Prefix**: `SMX` (no dash) — e.g., `SMX1234`, `SMX100`, `SMX1234B`

**European suffix**: If either departure or arrival airport is in a European country, auto-append a random letter suffix (A-Z excluding I and O — 24 valid letters).

## Reserved Ranges

| Range | Purpose | Who Creates |
|-------|---------|-------------|
| 0-9 | Reserved | Admin only |
| 10-99 | Tactical (VIP, Ambulance, Special Handling, Company, Other) | User charter / admin |
| 500-599, 5000-5999 | Custom Dispatch (SFP, special permission) | Admin only |
| 700-799, 7000-7999 | Reserved | Never auto-generate |
| 900-999, 9000-9999 | Non-revenue (Training, Positioning, Technical Test) | Admin / user charter |

## Auto-Generation Pool

Numbers available for `randomFlightNumber()` — auto-generated charters + VATSIM event charters:

**100-499, 600-699, 800-899, 1000-4999, 6000-6999, 8000-8999**

Total: 8,390 possible numbers. Current peak usage: ~400/month.

## User-Created Charters

- Text input for flight number (user types their own, e.g., `SMX15` for a tactical flight)
- "Random" button generates a number from the auto-generation pool
- No server-side validation against reserved ranges for manual input (user chooses intentionally)

## European Suffix Logic

Check `oa_airports.iso_country` for both departure and arrival. If either matches a European country code, append a random letter (A-Z minus I, O).

European country set: AT, BE, BG, HR, CY, CZ, DK, EE, FI, FR, DE, GR, HU, IS, IE, IT, LV, LT, LU, MT, NL, NO, PL, PT, RO, SK, SI, ES, SE, CH, GB, UA, RS, ME, MK, AL, BA, MD, BY, XK

## Migration

Strip dash from all existing `SMX-####` flight numbers → `SMX####`.

## Changes

1. `randomFlightNumber()` — restricted ranges, no dash, European suffix param
2. `createCharter()` — accept user-provided flight number with random fallback
3. Frontend charter modal — flight number text input + random button
4. DB migration — strip dash from existing flight numbers
5. European country constant set
