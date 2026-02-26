# Fleet Maintenance Tracking System — Design

**Date**: 2026-02-25
**Status**: Approved

## Overview

Full fleet maintenance lifecycle tracking for the SMA ACARS admin panel. Covers A/B/C/D checks with hour/cycle/calendar-based scheduling, Airworthiness Directive compliance, MEL deferrals, and component-level tracking. Maintenance status enforced operationally — overdue aircraft are grounded.

## Data Model

### `aircraft_hours`

One row per aircraft. Tracks cumulative airframe hours/cycles and snapshot values at each completed check.

| Column | Type | Notes |
|--------|------|-------|
| aircraft_id | INTEGER PK | FK → fleet(id) |
| total_hours | REAL | Accumulated airframe hours |
| total_cycles | INTEGER | Accumulated flight cycles |
| hours_at_last_a | REAL | Hours when last A-check completed |
| hours_at_last_b | REAL | Hours when last B-check completed |
| hours_at_last_c | REAL | Hours when last C-check completed |
| cycles_at_last_c | INTEGER | Cycles when last C-check completed |
| last_d_check_date | TEXT | Date of last D-check |
| updated_at | TEXT | |

### `maintenance_checks`

Check interval definitions per aircraft type. Seeded with standard values, admin-editable.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| icao_type | TEXT | e.g., "B738" |
| check_type | TEXT | 'A', 'B', 'C', 'D' |
| interval_hours | REAL | Hours between checks (NULL if N/A) |
| interval_cycles | INTEGER | Cycles between checks (NULL if N/A) |
| interval_months | INTEGER | Calendar months (NULL if N/A) |
| overflight_pct | REAL | Overflight tolerance (0.10 = 10%, 0 = none) |
| estimated_duration_hours | INTEGER | Expected downtime |
| description | TEXT | |

### `maintenance_log`

Every maintenance action — scheduled checks, unscheduled work, ADs, SFPs.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| aircraft_id | INTEGER | FK → fleet(id) |
| check_type | TEXT | 'A','B','C','D','LINE','UNSCHEDULED','AD','MEL','SFP' |
| title | TEXT | Short description |
| description | TEXT | Detailed work performed |
| performed_by | TEXT | Technician/shop name |
| performed_at | TEXT | ISO date |
| hours_at_check | REAL | Aircraft hours at time of check |
| cycles_at_check | INTEGER | Aircraft cycles at time |
| cost | REAL | Optional |
| status | TEXT | 'scheduled','in_progress','completed','deferred' |
| sfp_destination | TEXT | Destination ICAO (SFP only) |
| sfp_expiry | TEXT | Valid until (SFP only) |
| created_by | INTEGER | FK → users(id) |
| created_at | TEXT | |
| updated_at | TEXT | |

### `airworthiness_directives`

AD compliance tracking per aircraft.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| aircraft_id | INTEGER | FK → fleet(id) |
| ad_number | TEXT | e.g., "2024-15-07" |
| title | TEXT | |
| description | TEXT | |
| compliance_status | TEXT | 'open','complied','recurring','not_applicable' |
| compliance_date | TEXT | |
| compliance_method | TEXT | |
| recurring_interval_hours | REAL | For recurring ADs |
| next_due_hours | REAL | |
| next_due_date | TEXT | |
| created_by | INTEGER | |
| created_at | TEXT | |
| updated_at | TEXT | |

### `mel_deferrals`

MEL deferred items per aircraft.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| aircraft_id | INTEGER | FK → fleet(id) |
| item_number | TEXT | MEL reference |
| title | TEXT | |
| category | TEXT | 'A','B','C','D' (repair timeframe categories) |
| deferral_date | TEXT | |
| expiry_date | TEXT | |
| rectified_date | TEXT | NULL until fixed |
| status | TEXT | 'open','rectified','expired' |
| remarks | TEXT | |
| created_by | INTEGER | |
| created_at | TEXT | |

### `aircraft_components`

Tracked life-limited components.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| aircraft_id | INTEGER | FK → fleet(id) |
| component_type | TEXT | 'ENGINE','APU','LANDING_GEAR','PROP', etc. |
| position | TEXT | 'L','R','1','2','NOSE','MAIN_L', etc. |
| serial_number | TEXT | |
| part_number | TEXT | |
| hours_since_new | REAL | TSN |
| cycles_since_new | INTEGER | CSN |
| hours_since_overhaul | REAL | TSO |
| cycles_since_overhaul | INTEGER | CSO |
| overhaul_interval_hours | REAL | Life limit |
| installed_date | TEXT | |
| status | TEXT | 'installed','removed','in_shop','scrapped' |
| remarks | TEXT | |
| created_at | TEXT | |
| updated_at | TEXT | |

## API Endpoints

All under `/api/admin/maintenance/*`, protected by `authMiddleware` + `adminMiddleware`.

### Fleet Status
- `GET /fleet-status` — All aircraft with hours, next-due checks, overdue flags
- `PATCH /aircraft/:id/hours` — Manual hours/cycles adjustment

### Maintenance Log
- `GET /log` — Paginated, filterable by aircraft/type/status/date
- `GET /log/:id` — Single entry
- `POST /log` — Create entry
- `PATCH /log/:id` — Update entry
- `DELETE /log/:id` — Delete entry

### Check Schedules
- `GET /check-schedules` — All interval definitions
- `POST /check-schedules` — Create
- `PATCH /check-schedules/:id` — Edit
- `DELETE /check-schedules/:id` — Delete

### Airworthiness Directives
- `GET /ads` — All ADs, filterable
- `POST /ads` — Create
- `PATCH /ads/:id` — Update
- `DELETE /ads/:id` — Delete

### MEL Deferrals
- `GET /mel` — All deferrals, filterable
- `POST /mel` — Create
- `PATCH /mel/:id` — Update
- `DELETE /mel/:id` — Delete

### Components
- `GET /components` — All components, filterable
- `POST /components` — Add
- `PATCH /components/:id` — Update
- `DELETE /components/:id` — Remove

## Frontend

### Route
`/admin/maintenance` — admin only, single page with 6 tabs.

### Tabs
1. **Fleet Status** — Overview table, color-coded rows (green/amber/red), stats bar
2. **Maintenance Log** — CRUD table with filters and modal form
3. **Check Schedules** — Interval definitions grouped by aircraft type
4. **Airworthiness Directives** — AD tracking table with compliance status
5. **MEL Deferrals** — Deferral table with category color-coding
6. **Components** — Component tracking with overhaul life progress bars

### Sidebar
New "Maintenance" entry with Wrench icon, admin-only, after existing fleet entries.

## Operational Rules

### A/B Checks — Soft Limits
- Overflight permitted up to configured tolerance (default 10% of interval)
- Within tolerance: aircraft stays active, flagged amber
- Past tolerance: grounded (`fleet.status = 'maintenance'`)

### C/D Checks — Hard Limits
- No overflight. When due, immediately grounded.
- Special Flight Permit (SFP) allows a single ferry flight to maintenance facility
- SFP includes destination ICAO and expiry date
- After SFP flight or expiry, aircraft returns to grounded

### Grounding Triggers
- A/B check overdue past overflight tolerance
- C/D check due (any threshold reached)
- AD past compliance due date/hours
- MEL deferral expired

### Return to Service
- Admin completes the overdue maintenance log entry
- System verifies no other outstanding items
- If clear → `fleet.status = 'active'`
- If other items remain → stays in maintenance

### PIREP Approval Hook
1. Add flight hours to `aircraft_hours.total_hours`
2. Increment `total_cycles` by 1
3. Increment component hours/cycles
4. Run `checkOverdue()` — ground if thresholds exceeded

### Bid/Assignment Guard
- Reject bids/assignments to aircraft with `status = 'maintenance'`

## References
- [14 CFR Part 121 Subpart L](https://www.ecfr.gov/current/title-14/chapter-I/subchapter-G/part-121/subpart-L)
- [14 CFR 121.380 — Maintenance Recording Requirements](https://www.law.cornell.edu/cfr/text/14/121.380)
- [Types of Aviation Maintenance Checks](https://www.naa.edu/types-of-aviation-maintenance-checks/)
