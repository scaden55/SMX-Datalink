# Maintenance Engine Expansion — Design Spec

**Goal:** Expand the SMA ACARS maintenance system into a realistic FAA Part 121 maintenance engine with pilot discrepancy write-ups, MEL master list enforcement, per-aircraft logbooks, and full admin UI for all existing backend subsystems (ADs, MELs, Components).

**Regulatory Basis:** 14 CFR Part 121 Subparts L (Maintenance) and DD (Recordkeeping), plus 14 CFR 43.9 (maintenance record content). This is a simulation — we model the workflows and data accurately but don't enforce every procedural nuance.

---

## 1. Architecture Overview

### Approach: Discrepancy-Centric Workflow

The discrepancy is the central entity. A pilot writes up a problem; a dispatcher/mechanic triages and resolves it via one of three paths: corrected, deferred via MEL, or aircraft grounded.

### System Boundaries

- **Pilot app (Electron):** Submit discrepancies (post-flight form), view MEL briefing (pre-departure), receive resolution notifications
- **Admin panel:** Triage discrepancies, manage MEL deferrals, view aircraft logbooks, manage ADs and components, configure MEL master list
- **Backend:** Discrepancy service, MEL validation, auto-grounding logic, ATA chapter reference data

---

## 2. Data Model

### 2.1 New Tables

#### `ata_chapters` — ATA 100 Reference Data
| Column | Type | Description |
|--------|------|-------------|
| chapter | TEXT PK | Two-digit code (e.g., "32") |
| title | TEXT NOT NULL | Human name (e.g., "Landing Gear") |
| description | TEXT | Extended description |

Seeded with ~78 standard ATA chapters (05 through 80). Read-only reference table.

**Migration note:** The fleet table PK is `fleet(id)`. All new FKs must reference `fleet(id)`, NOT `aircraft(id)` (existing migration 036 has this bug). New migrations start at 044 (043 is the last existing one).

#### `discrepancies` — Pilot Write-Ups
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| aircraft_id | INTEGER FK → fleet | Which aircraft |
| flight_number | TEXT | Flight during which it was noticed (nullable) |
| logbook_entry_id | INTEGER FK → logbook | Back-filled after PIREP is filed/approved. Set to NULL at creation; updated when the PIREP for this flight is committed. If PIREP is rejected, the discrepancy remains valid (standalone). Nullable. |
| reported_by | INTEGER FK → users | Pilot or dispatcher who created it |
| reported_at | TEXT DEFAULT CURRENT_TIMESTAMP | ISO timestamp (defaults to now if not provided) |
| ata_chapter | TEXT NOT NULL FK → ata_chapters | ATA chapter code |
| description | TEXT NOT NULL | Free-text write-up |
| flight_phase | TEXT | Phase when noticed (preflight, taxi_out, takeoff, climb, cruise, descent, approach, landing, taxi_in, parked) |
| severity | TEXT NOT NULL CHECK(severity IN ('grounding','non_grounding')) | `grounding` or `non_grounding` |
| status | TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_review','deferred','resolved','grounded')) | `open`, `in_review`, `deferred`, `resolved`, `grounded` |
| resolved_by | INTEGER FK → users | Dispatcher/mechanic who resolved (nullable) |
| resolved_at | TEXT | When resolved (nullable) |
| resolution_type | TEXT | `corrected`, `deferred_mel`, `grounded`, null if unresolved |
| corrective_action | TEXT | Description of fix performed (nullable) |
| mel_deferral_id | INTEGER FK → mel_deferrals | Link to MEL deferral if deferred (nullable) |
| created_at | TEXT DEFAULT CURRENT_TIMESTAMP | |
| updated_at | TEXT DEFAULT CURRENT_TIMESTAMP | |

Status workflow: `open` → `in_review` → (`resolved` | `deferred` | `grounded`)

#### `mel_master_list` — Approved MEL Items Per Aircraft Type
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| icao_type | TEXT NOT NULL | Aircraft ICAO type (e.g., "B763", "B752") |
| ata_chapter | TEXT NOT NULL FK → ata_chapters | ATA chapter |
| item_number | TEXT NOT NULL | MEL item number (e.g., "34-01") |
| title | TEXT NOT NULL | Item title |
| description | TEXT | Extended description |
| category | TEXT NOT NULL | `A`, `B`, `C`, or `D` |
| repair_interval_days | INTEGER | Override for category default (mainly for Cat A) |
| remarks | TEXT | Category-specific remarks |
| operations_procedure | TEXT | (O) procedure — what flight crew must do |
| maintenance_procedure | TEXT | (M) procedure — what maintenance must do before dispatch |
| is_active | INTEGER DEFAULT 1 | Soft-delete flag |
| created_at | TEXT DEFAULT CURRENT_TIMESTAMP | |
| updated_at | TEXT DEFAULT CURRENT_TIMESTAMP | |

Unique constraint: `(icao_type, item_number)`

Seeded with common cargo aircraft MEL items for B763 and B752 (the fleet's primary types).

### 2.2 Modified Tables

#### `mel_deferrals` — Add Linkage Fields
| New Column | Type | Description |
|------------|------|-------------|
| discrepancy_id | INTEGER FK → discrepancies | Source discrepancy (nullable for legacy/manual) |
| mel_master_id | INTEGER FK → mel_master_list | Which approved MEL item (nullable for legacy) |
| ata_chapter | TEXT FK → ata_chapters | ATA chapter (denormalized for display; also derivable from mel_master_id) |
| placard_info | TEXT | Placard text (e.g., "WX RADAR INOP") |
| operations_procedure | TEXT | Copied from mel_master_list or overridden |
| maintenance_procedure | TEXT | (M) procedure if any |
| authorized_by | INTEGER FK → users | Dispatcher who authorized |

**MEL Category Time Limits (auto-computed expiry):**
- Category A: Per `repair_interval_days` in mel_master_list (or remarks). Must be specified.
- Category B: 3 consecutive calendar days from day after deferral
- Category C: 10 consecutive calendar days from day after deferral
- Category D: 120 consecutive calendar days from day after deferral

When creating an MEL deferral, `expiry_date` is auto-computed from `deferral_date` + category interval. Category A requires explicit `repair_interval_days` in the master list entry.

#### `maintenance_log` — Add Discrepancy Link
| New Column | Type | Description |
|------------|------|-------------|
| discrepancy_id | INTEGER FK → discrepancies | Links corrective work to original write-up (nullable) |

---

## 3. Discrepancy Workflow

### 3.1 Pilot Submission (Electron App)

Pilots submit discrepancies via a form accessible after flight completion (post-PIREP) or from a standalone menu option. Fields:

- **Aircraft** — auto-filled from active bid/flight
- **ATA Chapter** — dropdown of all ATA chapters with search
- **Description** — free text (required, min 10 chars)
- **Flight Phase** — single-select pills matching the flight phase FSM states
- **Severity** — binary choice: Grounding or Non-Grounding

On submit:
1. POST to `/api/discrepancies` (pilot auth)
2. Status set to `open`
3. Notification sent to all dispatchers/admins via existing notification system
4. If severity = `grounding`, the aircraft status is NOT auto-changed (dispatcher makes the call after review)

### 3.2 Dispatcher Triage (Admin Panel)

Dispatchers see open discrepancies in the Discrepancies tab queue. Clicking a row opens a detail panel with the full write-up and three resolution actions:

**A) Corrected**
- Dispatcher enters corrective action text (required)
- Discrepancy status → `resolved`, resolution_type → `corrected`
- Optionally creates a maintenance_log entry linked to the discrepancy

**B) Defer via MEL**
1. System queries `mel_master_list` for matching items: same `icao_type` as the aircraft AND same `ata_chapter` as the discrepancy
2. If matches found → dispatcher selects the appropriate MEL item
3. System auto-fills: category, expiry date, ops/maintenance procedures from master list
4. Dispatcher can add/override placard text and remarks
5. On authorize:
   - Creates `mel_deferrals` record with FK to discrepancy and mel_master
   - Updates discrepancy: status → `deferred`, resolution_type → `deferred_mel`, mel_deferral_id set
   - Aircraft fleet status set to `active` (dispatchable with MEL)
6. If NO matches found in mel_master_list → system blocks the deferral with a message: "This item is not on the approved MEL for [aircraft type]. The discrepancy must be corrected or the aircraft grounded."

**C) Ground Aircraft**
- Discrepancy status → `grounded`, resolution_type → `grounded`
- Aircraft fleet status → `maintenance`
- Notification sent to pilot

### 3.3 Dispatcher Manual Entry

Dispatchers can also create discrepancies manually via the "New Discrepancy" button (for items discovered outside of pilot reports). Same fields minus auto-fill.

---

## 4. MEL Master List

### 4.1 Purpose

The MEL master list defines which items CAN be deferred for each aircraft type. It is the operator's MEL, derived from the manufacturer's MMEL. If an item is not on this list, it cannot be deferred — the aircraft must be repaired or grounded.

### 4.2 Management

Managed by admins via a section within the MEL Deferrals tab or a dedicated admin settings area. CRUD operations:
- Add/edit/deactivate MEL items per aircraft type
- Each item tied to an ATA chapter, given a category (A/B/C/D), and optionally assigned ops and maintenance procedures

### 4.3 Seed Data

The migration seeds common cargo aircraft MEL items for B763 and B752, covering:
- ATA 21 (Air Conditioning) — pack items
- ATA 23 (Communications) — HF radio, SATCOM
- ATA 26 (Fire Protection) — select items
- ATA 29 (Hydraulic Power) — select items
- ATA 30 (Ice/Rain Protection) — windshield heat
- ATA 33 (Lights) — cargo lights, landing lights
- ATA 34 (Navigation) — weather radar, IRS
- ATA 35 (Oxygen) — select items
- ATA 49 (APU) — APU inoperative
- ATA 52 (Doors) — select non-critical items

Items that are NEVER on a real MEL (and must not be seeded):
- Flight controls (ATA 27), primary structure, emergency exits, fire suppression, all engines, landing gear retraction

---

## 5. Aircraft Logbook

### 5.1 Purpose

A per-aircraft chronological view combining all maintenance events. Accessed by clicking an aircraft row on the Fleet Status tab.

### 5.2 Structure

**Header:** Aircraft registration, type, total hours, total cycles, current status, badge counts (open discrepancies, active MELs)

**Sub-tabs:**
- **Timeline** — Unified chronological feed pulling from: discrepancies, mel_deferrals, maintenance_log, airworthiness_directives. Each entry color-coded by type and status.
- **Check Status** — Current A/B/C/D check due status with hours remaining, overflight status, and last completion date. Same data as existing `computeChecksDue()` but presented per-aircraft.
- **Active MELs** — Filtered view of open MEL deferrals for this aircraft only
- **ADs** — Filtered AD compliance for this aircraft
- **Components** — Installed components with hours/cycles tracking

### 5.3 Timeline Data Source

The timeline is a UNION query across four tables, projected into a common interface:

```typescript
interface TimelineEntry {
  type: 'discrepancy' | 'mel_deferral' | 'maintenance' | 'ad_compliance';
  id: number;
  date: string;        // Sort key — see date mapping below
  title: string;
  description: string;
  status: string;
  ataChapter?: string;
  metadata?: Record<string, unknown>; // Type-specific extra fields
}
```

**Date mapping per source:**
- `discrepancies` → `reported_at`
- `mel_deferrals` → `deferral_date`
- `maintenance_log` → `performed_at` (or `created_at` if not yet performed)
- `airworthiness_directives` → `compliance_date` (or `created_at` if open/not yet complied)

Ordered by date descending. Each type rendered with distinct color:
- Red dot: Open discrepancy
- Amber dot: MEL deferral
- Green dot: Completed maintenance / resolved discrepancy
- Blue dot: AD compliance

**Endpoint:** `GET /api/admin/maintenance/aircraft/:id/timeline?page=1&pageSize=50`

---

## 6. Admin UI — Tab Structure

### Tab 1: Fleet Status (Enhanced)
Existing table enhanced with:
- **New columns:** "Open Discrep." count, "Active MELs" count
- **Clickable rows** → opens Aircraft Logbook drill-down (full page, replaces tab content with back button)
- Existing features preserved: type filter, adjust hours, return to service

### Tab 2: Discrepancies
- **Stats row:** Open, In Review, Deferred, Resolved (30d) counts
- **Filter bar:** Search, status toggle (All / Open / In Review / Deferred / Resolved)
- **Table columns:** Severity (GND/NON badge), Aircraft, ATA, Description, Reported By, Age, Status
- **Clickable rows** → detail panel on right (same pattern as Schedules page)
- **Detail panel:** Full write-up on left, resolution actions on right (Correct / Defer via MEL / Ground)
- **"New Discrepancy" button** for manual dispatcher entry

### Tab 3: MEL Deferrals
- **Stats row:** Active, Expiring <48h, Cat A/B count, Cat C/D count, Rectified (30d)
- **Table columns:** Category badge, Aircraft, MEL Item #, Title, Deferred date, Expires date, Remaining (color-coded), Status
- **Clickable rows** → detail panel with deferral info, linked discrepancy, placard, ops procedure, Rectify button
- **Critical items** highlighted with red background tint when <48h remaining
- **MEL Master List** management accessible via button/sub-section

### Tab 4: Compliance
Two sub-tabs:
- **Airworthiness Directives:** Stats (open, recurring, complied, N/A), table with AD number, aircraft, title, status, next due. Full CRUD.
- **Life-Limited Components:** Table with component type, aircraft, serial/part number, hours/cycles since new/overhaul, status. Full CRUD.

Both already have backend support — this is new UI only.

---

## 7. Pilot App Features

### 7.1 Discrepancy Write-Up Form
- Accessible from: post-flight completion screen, standalone menu item
- Auto-fills aircraft from active bid/flight when available
- ATA chapter dropdown with search (seeded from ata_chapters table)
- Free-text description, flight phase pills, severity toggle
- Submits to `POST /api/discrepancies`
- Pilot receives notification when resolved

### 7.2 MEL Briefing (Pre-Departure)
- Shown when pilot has an active bid with an aircraft that has open MEL deferrals
- Displays: count banner, each MEL item card (category, item number, ATA chapter, title, placard, ops procedure, expiry)
- Requires acknowledgment button before flight plan can proceed
- Data source: `GET /api/aircraft/:id/mel-briefing` (pilot auth, returns active MELs for aircraft)
- Acknowledgment stored in the `active_bids` table via a new column `mel_ack_at TEXT` (nullable). Set when pilot acknowledges; cleared if a new MEL is added to the aircraft after acknowledgment.

---

## 8. Backend API — New Endpoints

### Discrepancies (pilot + admin)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/discrepancies` | pilot+ | Create discrepancy |
| GET | `/api/discrepancies` | pilot+ | List authenticated user's own discrepancies only (regardless of role) |
| GET | `/api/admin/discrepancies` | dispatcher+ | List all with filters |
| GET | `/api/admin/discrepancies/:id` | dispatcher+ | Get single |
| PATCH | `/api/admin/discrepancies/:id` | dispatcher+ | Update (triage, add notes) |
| POST | `/api/admin/discrepancies/:id/resolve` | dispatcher+ | Resolve: corrected |
| POST | `/api/admin/discrepancies/:id/defer` | dispatcher+ | Defer via MEL (validates against master list, creates mel_deferral) |
| POST | `/api/admin/discrepancies/:id/ground` | dispatcher+ | Ground aircraft |

### MEL Master List (admin)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/maintenance/mel-master` | dispatcher+ | List all items (filter by icao_type) |
| POST | `/api/admin/maintenance/mel-master` | admin | Create item |
| PATCH | `/api/admin/maintenance/mel-master/:id` | admin | Update item |
| DELETE | `/api/admin/maintenance/mel-master/:id` | admin | Deactivate item |

### MEL Briefing (pilot)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/aircraft/:id/mel-briefing` | pilot+ | Active MEL items for aircraft |
| POST | `/api/aircraft/:id/mel-briefing/ack` | pilot+ | Acknowledge MEL briefing |

### Aircraft Logbook / Timeline (admin)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/maintenance/aircraft/:id/timeline` | dispatcher+ | Unified timeline entries (paginated) |

### Discrepancy & MEL Stats (admin)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/discrepancies/stats` | dispatcher+ | Counts by status (open, in_review, deferred, resolved_30d) |
| GET | `/api/admin/maintenance/mel/stats` | dispatcher+ | Counts (active, expiring_48h, cat_ab, cat_cd, rectified_30d) |

### ATA Chapters (read-only)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/ata-chapters` | pilot+ | List all ATA chapters (no pagination — ~78 rows) |

---

## 9. Seed Data

### ATA Chapters (~78 entries)
Standard ATA 100 chapters from 05 (Time Limits) through 80 (Starting). Key chapters for cargo ops:
- 21 Air Conditioning, 22 Auto Flight, 23 Communications, 24 Electrical
- 25 Equipment, 26 Fire Protection, 27 Flight Controls, 28 Fuel
- 29 Hydraulic, 30 Ice/Rain, 31 Instruments, 32 Landing Gear
- 33 Lights, 34 Navigation, 35 Oxygen, 36 Pneumatic
- 38 Water/Waste, 49 APU, 52 Doors, 53 Fuselage, 55 Stabilizers
- 56 Windows, 57 Wings, 71-80 Engine/Power Plant

### MEL Master List Items
Approximately 25-35 items per aircraft type (B763, B752), covering the most common deferrable items. Each with category, ops procedure, and maintenance procedure where applicable.

---

## 10. Integration Points

### Existing Systems Affected
- **PIREP submission** (`backend/src/services/pirep.ts`): After PIREP filed, include "Report a discrepancy?" link in the PIREP confirmation notification. Also back-fill `discrepancies.logbook_entry_id` for any open discrepancies matching the same aircraft + flight number.
- **Grounding logic** (`maintenance.ts` → `checkAndGroundAircraft`): Add discrepancy-based grounding check
- **Dashboard widget** (`MaintenanceColumn.tsx`): Add open discrepancy count to fleet status display
- **Notification system**: Discrepancy created → notify all users with role `dispatcher` or `admin` (requires querying users table and looping `NotificationService.send()` for each). Resolved → notify reporting pilot.
- **Audit service**: All discrepancy and MEL actions logged
- **Active bids table**: Add `mel_ack_at TEXT` column for MEL briefing acknowledgment

### No Changes Required
- Revenue model, finance, schedules, logbook — all untouched
- Flight phase FSM — untouched
- Socket.io — no real-time requirements for maintenance (notifications are poll/fetch based)

---

## 11. Out of Scope

- Service Difficulty Reports (SDR) filing — real Part 121 requirement, but overkill for sim
- Mechanic certification tracking — no need to model A&P license management
- Parts inventory management — beyond current scope
- Maintenance planning/forecasting — future enhancement
- CDL (Configuration Deviation List) — rare, defer to future
- Non-routine task cards / work packages — too granular for sim
