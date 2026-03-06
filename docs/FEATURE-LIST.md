# SMA ACARS — Feature List

> **Legend:** Implemented | Partial (in-progress / partially built) | Planned (not yet started)
>
> Last updated: 2026-03-05

---

## 1. Authentication & User Management

| Feature | Status | Details |
|---------|--------|---------|
| Pilot registration & login | Implemented | JWT HS256, access + refresh tokens, auto-rotate |
| Role-based access control | Implemented | 4 tiers: unauthenticated, pilot, dispatcher, admin |
| Admin user management | Implemented | CRUD users, set roles/rank/status, force password reset |
| Separate admin auth | Implemented | Admin panel uses its own `admin-auth` localStorage key |
| Rate limiting on auth | Implemented | 15 req / 15 min on login/register, 30/15min on refresh |
| Token cleanup | Implemented | Hourly sweep of expired refresh tokens |
| Pilot type ratings | Planned | Per-pilot aircraft qualifications, checkride flights, bid gating |

---

## 2. Schedule & Route Management

| Feature | Status | Details |
|---------|--------|---------|
| Scheduled flights (CRUD) | Implemented | Admin creates routes with flight number, dep/arr, times, days of week |
| Flight type codes | Implemented | 22 ICAO flight types (F=Scheduled Cargo, H=Charter Cargo, etc.) |
| Flight number format | Implemented | SMX prefix, structured numbering |
| Dynamic charter generation | Implemented | Monthly auto-generation of charter schedules from approved airports |
| VATSIM event charters | Implemented | Polls VATSIM events API, auto-generates event-specific charters |
| Charter expiration cleanup | Implemented | Daily cleanup of expired charters |
| Approved airports management | Implemented | Admin manages hub airports with handlers |
| Bid system | Implemented | Pilots bid on schedules, aircraft selection at bid time |
| Bid expiration | Implemented | 5-minute sweep, auto-expires stale bids, Socket.io notification |
| Bid aircraft reservation | Implemented | Fleet aircraft reserved per-bid, prevents double-booking |
| Schedule days-of-week filter | Implemented | Flights available on specific days |
| Fare codes & cargo remarks | Implemented | Optional metadata on schedules |
| Admin schedule management | Implemented | Full CRUD + bulk operations in admin panel |

---

## 3. Flight Planning & Dispatch

| Feature | Status | Details |
|---------|--------|---------|
| SimBrief integration | Implemented | Generate/fetch OFP, auto-populate route, fuel, waypoints |
| Flight plan form | Implemented | Route, cruise FL, alternates, fuel breakdown, aircraft assignment |
| Route map preview | Implemented | Leaflet map with waypoint visualization |
| Altitude profile chart | Implemented | Vertical profile from SimBrief steps |
| Weather integration | Implemented | METAR/TAF display on planning page |
| VATSIM pre-file | Implemented | File flight plan to VATSIM from planning page |
| Dispatch board (pilot view) | Implemented | View active flights, phase tracking, real-time telemetry |
| Dispatch board (admin view) | Implemented | Live flight tracking, ACARS chat, exceedance toasts |
| Dispatcher flight edits | Implemented | Dispatchers can edit route, fuel, alternates, remarks |
| Dispatcher release system | Implemented | "Release" flight plan changes to pilot, tracked field-by-field |
| ACARS messaging | Implemented | Real-time chat between dispatcher and pilot via Socket.io |
| Regulatory compliance engine | Implemented | 14 CFR Parts 91/110/121 classification, ETOPS, RVSM assessment |
| Operations Specifications | Implemented | OpSpec records, compliance checks (block/warn/info severity) |
| Aircraft airworthiness check | Implemented | Dispatch-time check of aircraft maintenance status |
| Dispatch release document | Planned | Pre-flight document with route, weather, MEL, NOTAMs, alternates |
| MEL dispatch awareness | Planned | Yellow banner on planning page when aircraft has active MEL deferrals |
| W&B envelope chart | Planned | SVG weight/CG envelope visualization on planning page |

---

## 4. Flight Tracking & Telemetry

| Feature | Status | Details |
|---------|--------|---------|
| SimConnect integration | Implemented | 200ms poll, aircraft state, position, controls, lights, engines |
| Flight phase FSM | Implemented | 10 states: PREFLIGHT through PARKED, dual-path (Electron + backend) |
| OOOI timestamps | Implemented | Out/Off/On/In gate times from phase transitions |
| Real-time telemetry broadcast | Implemented | Socket.io, subscriber-gated, throttled to active observers |
| VPS relay | Implemented | Electron → VPS Socket.io for remote dispatch observers |
| 30s heartbeat | Implemented | Lightweight position data when full relay is inactive |
| Flight track recording | Implemented | Lat/lon/alt/spd/hdg stored per-point, 30-day retention |
| Active flights map | Implemented | Live map showing all active pilot positions |
| Exceedance detection | Implemented | Hard landing, overspeed, overweight landing, unstable approach, tailstrike |
| Exceedance severity levels | Implemented | Warning vs. critical thresholds |
| Exceedance → maintenance link | Implemented | Hard landings auto-create maintenance inspection records |
| Exceedance-free streak stat | Planned | Pilot profile badge for consecutive clean flights |
| Telemetry store (frontend) | Implemented | Zustand store for all sim variables (position, fuel, engines, etc.) |
| Flight event tracking | Implemented | Client-side + backend event tracking for phase transitions |

---

## 5. Cargo System

| Feature | Status | Details |
|---------|--------|---------|
| Cargo manifest generation | Implemented | Procedural ULD generation based on aircraft type + payload |
| ULD types & positions | Implemented | Aircraft-specific container configs (LD3, PMC, P6P, etc.) |
| Cargo categories | Implemented | 10 categories: general freight, pharma, seafood, DG, live animals, etc. |
| Real-world company names | Implemented | Shipper/consignee names from actual cargo companies |
| NOTOC items | Implemented | Dangerous goods tracking with UN numbers, classes, packing groups |
| Temperature-controlled cargo | Implemented | Temp requirements and advisories per ULD |
| CG calculation | Implemented | Center of gravity from ULD positions and weights |
| Section weight tracking | Implemented | Per-section utilization (forward, aft, bulk, main deck) |
| AWB numbers | Implemented | Air waybill number generation |
| Cargo manifest storage | Implemented | Persisted in DB, linked to flights |
| Mixed vs. single mode | Implemented | "Mixed" random categories or "single" focused category |
| Cargo validation engine | Implemented | Weight limits, CG bounds, hazmat rules |
| Passenger charter rebrand | Planned | Rename to "ACMI Charter" or "Combi" — label change only |

---

## 6. PIREP / Logbook System

| Feature | Status | Details |
|---------|--------|---------|
| Logbook entries | Implemented | Full flight record: times, fuel, route, landing rate, score, cargo |
| PIREP status workflow | Implemented | pending → approved/rejected/completed/diverted/cancelled |
| Admin PIREP review | Implemented | Individual + bulk approve/reject with reviewer notes |
| Logbook filtering | Implemented | By pilot, airport, aircraft, status, date range, VATSIM-only |
| Flight detail page | Implemented | Full breakdown of individual flight data |
| VATSIM flight tracking | Implemented | Records VATSIM connection, callsign, CID with PIREPs |
| Cargo manifest linkage | Implemented | PIREPs linked to cargo manifests (weight, ULD count, NOTOC flag) |
| Block time calculation | Implemented | OOOI IN - OUT for actual block time |
| PIREP scoring | Implemented | Landing rate, fuel accuracy, etc. |
| Auto-PIREP filing | Planned | Auto-file when OOOI detects IN (parking brake at destination) |
| Revised PIREP scoring weights | Planned | 20% each: landing, fuel, schedule, route compliance, completion |

---

## 7. Fleet Management

| Feature | Status | Details |
|---------|--------|---------|
| Fleet CRUD | Implemented | Add/edit/remove aircraft with full specs |
| Aircraft weight specs | Implemented | OEW, MZFW, MTOW, MLW, max fuel (all in lbs) |
| Equipment codes | Implemented | ICAO equip code, transponder, PBN, category, SELCAL, hex code |
| Fleet status tracking | Implemented | active / stored / retired / maintenance states |
| Aircraft location tracking | Implemented | Base ICAO + current location ICAO |
| Cargo vs. pax flag | Implemented | `isCargo` boolean per aircraft |
| SimBrief aircraft search | Implemented | Search/import aircraft specs from SimBrief database |
| Admin fleet page | Implemented | Table view with filters, detail page per aircraft |
| Aircraft detail page | Implemented | Admin drill-down with all specs, maintenance info, financial profile |

---

## 8. Maintenance System

| Feature | Status | Details |
|---------|--------|---------|
| Maintenance log | Implemented | CRUD for maintenance entries (line, A/B/C/D, unscheduled, AD, MEL, SFP) |
| Check schedules | Implemented | Per-type intervals (hours, cycles, months) with overflight percentages |
| Aircraft hours/cycles tracking | Implemented | Total hours, total cycles, hours-at-last-check for A/B/C/D |
| Fleet maintenance status | Implemented | Overdue checks, overdue ADs, expired MEL indicators per aircraft |
| Airworthiness Directives (ADs) | Implemented | CRUD, compliance tracking, recurring intervals, next-due calculations |
| MEL deferrals | Implemented | Category A-D, deferral/expiry dates, rectification tracking |
| Component tracking | Implemented | Engine, APU, landing gear, prop, avionics — hours/cycles since new/overhaul |
| Special Flight Permits (SFP) | Implemented | Destination + expiry tracking for ferry flights |
| Maintenance cost tracking | Implemented | Per-entry cost field for financial reporting |
| Check due alerts | Implemented | Approaching/due/overdue status with remaining hours/cycles |
| Hard landing → auto-inspection | Implemented | Exceedance detector creates maintenance entry automatically |
| Admin maintenance page | Implemented | 6-tab interface: fleet status, log, check schedules, ADs, MEL, components |

---

## 9. Finance System

| Feature | Status | Details |
|---------|--------|---------|
| Pilot pay ledger | Implemented | pay/bonus/deduction/expense/income entries per pilot |
| Pilot balance tracking | Implemented | Running balance with totals by type |
| Finance summary | Implemented | Aggregate totals across all pilots |
| Admin finance page | Implemented | Ledger view, create entries, pilot balance overview |
| **Finance Engine (advanced)** | Implemented | Full cargo airline economics simulation |
| — Commodity rate system | Implemented | Per-category and per-commodity pricing (rate/lb, hazmat, temp-controlled) |
| — Lane rates | Implemented | Origin→destination pair-specific pricing |
| — Aircraft financial profiles | Implemented | Lease (dry/wet), insurance, fuel burn, maintenance reserves, crew costs |
| — Station fees | Implemented | Landing, parking, handling, fuel, nav, de-ice, ULD handling per airport |
| — Flight cost breakdown | Implemented | Fuel, landing, parking, handling, nav, de-ice, ULD, crew costs |
| — Fixed cost allocation | Implemented | Maintenance reserve, lease allocation, insurance allocation per flight |
| — Cargo revenue rating | Implemented | Per-shipment rating with base charge, surcharges, fuel, security, valuation |
| — Flight P&L | Implemented | Revenue vs. costs, gross profit, margin %, break-even load factor |
| — Period P&L | Implemented | Monthly/quarterly/annual aggregation: EBITDA, CASM, RASM, avg yield |
| — Operational events | Implemented | Crew delay, customs hold, weather divert, cargo claim, AOG, DGR rejection |
| — Maintenance thresholds | Implemented | A/C/D/ESV check cost ranges and downtime estimates |
| — Admin cost engine page | Implemented | Full configuration UI for rates, profiles, station fees |

---

## 10. VATSIM Integration

| Feature | Status | Details |
|---------|--------|---------|
| VATSIM data feed polling | Implemented | Periodic fetch from data.vatsim.net/v3 |
| Pilot overlay on maps | Implemented | All VATSIM pilots shown on live map |
| Controller positions | Implemented | With transceiver-based positioning and boundary resolution |
| ATIS display | Implemented | ATIS text and frequency |
| VATSIM track recording | Implemented | Historical position logging for VA pilots on VATSIM |
| VATSIM flight status per bid | Implemented | Tracks if pilot is connected, their VATSIM callsign/CID |
| VATSIM events integration | Implemented | Polls events, auto-generates charter schedules |
| Controller boundary resolution | Implemented | Maps callsigns to geographic boundaries |
| Transceiver data | Implemented | Frequency and position data from transceivers feed |
| WebSocket broadcast | Implemented | Real-time VATSIM data to subscribed clients |

---

## 11. Live Map & Visualization

| Feature | Status | Details |
|---------|--------|---------|
| Live map page | Implemented | Full-page Leaflet map with multiple layers |
| VATSIM pilot overlay | Implemented | All network pilots with callsign/altitude/speed |
| VATSIM controller overlay | Implemented | ATC coverage visualization |
| Active VA flights | Implemented | Real-time positions of SMA Virtual pilots |
| Flight track replay | Implemented | Historical track visualization on map |
| Route visualization | Implemented | Great circle arcs for planned routes |
| Airport markers | Implemented | Hub airports and route endpoints |
| Dashboard map | Implemented | Mini-map on pilot dashboard |

---

## 12. Admin Panel

| Feature | Status | Details |
|---------|--------|---------|
| Admin login | Implemented | Separate auth flow from pilot app |
| Dashboard | Implemented | Stats overview: users, flights, PIREPs, revenue, fleet, routes |
| Dispatch board | Implemented | Live flight monitoring, ACARS chat, telemetry, exceedance alerts |
| User management | Implemented | Table with search/filter, inline edit, role/status changes |
| Schedule management | Implemented | CRUD with form sheet, day-of-week selector |
| PIREP management | Implemented | Review queue, bulk approve/reject, detail panel |
| Fleet management | Implemented | Aircraft table + detail page |
| Maintenance management | Implemented | 6-tab interface covering all maintenance subsystems |
| Finance management | Implemented | Ledger, pilot balances, summary |
| Cost engine | Implemented | Rate config, commodity rates, lane rates, aircraft profiles, station fees |
| Reports page | Implemented | 5 chart types: flights, hours, revenue, top routes, pilot activity |
| Notifications page | Implemented | Admin notification feed |
| Audit log | Implemented | Action history with actor, target, before/after data |
| Settings page | Implemented | VA-wide configuration (key-value settings) |
| Command palette | Implemented | Quick navigation via keyboard shortcut |
| Global search | Implemented | Cross-entity search (admin-search endpoint) |

---

## 13. Pilot Frontend (Electron Desktop App)

| Feature | Status | Details |
|---------|--------|---------|
| Custom title bar | Implemented | Frameless window with min/max/close controls |
| Splash screen | Implemented | Branded loading screen on startup |
| Auto-updater | Implemented | Check for updates on launch, download + install via splash |
| Dashboard | Implemented | Stats, recent flights, active bids, leaderboard, news, map |
| Schedule browser | Implemented | Search/filter schedules, bid system, aircraft selection |
| Flight planning | Implemented | SimBrief integration, route map, altitude profile, weather |
| Dispatch page | Implemented | Active flight monitoring, regulatory assessment, cargo manifest |
| Live map | Implemented | VATSIM overlay, active flights, track replay |
| Fleet viewer | Implemented | Browse fleet with specs |
| Logbook | Implemented | Personal flight history with detail pages |
| Reports | Implemented | Personal statistics |
| Settings | Implemented | User preferences |
| News system | Implemented | VA news feed with create/edit/delete (admin) |
| Leaderboard | Implemented | Pilot rankings |
| Notifications | Implemented | In-app notification system |
| SimConnect bridge | Implemented | IPC from main process to renderer |
| VPS relay | Implemented | Forward telemetry to remote backend for dispatch observers |
| File dialogs | Implemented | Native open/save dialogs |
| SimBrief session management | Implemented | Clear cookies for re-auth |
| Diagnostic logging | Implemented | SimConnect diagnostic log export |

---

## 14. Infrastructure & DevOps

| Feature | Status | Details |
|---------|--------|---------|
| SQLite WAL mode | Implemented | better-sqlite3, foreign keys, auto-migrations |
| 38 database migrations | Implemented | Numbered 001-038, auto-applied on startup |
| Auto-seed | Implemented | Admin user + 95 airports on first run |
| OurAirports import | Implemented | 28,000+ airports from open data |
| Structured logger | Implemented | Tag-based logging, replaced 141+ console calls |
| CORS + Helmet security | Implemented | Standard Express security middleware |
| Graceful shutdown | Implemented | SIGINT/SIGTERM handlers, cleanup all services |
| NSIS installer | Implemented | Windows installer via electron-builder |
| Release pipeline | Implemented | 10-step script: bump, build, package, deploy VPS, tag, GitHub release |
| PM2 production deployment | Implemented | VPS at 138.197.127.39 |
| Admin static serving | Implemented | Backend serves admin SPA at `/admin/` |
| Health check endpoint | Implemented | `/api/stats` for monitoring |

---

## 15. Planned / Future Features

| Feature | Priority | Effort | Details |
|---------|----------|--------|---------|
| Pilot type ratings | P3 | Medium | Per-pilot aircraft qualifications, checkride flights, rating required to bid |
| Revised PIREP scoring | P4 | Low | 20% each: landing, fuel, schedule adherence, route compliance, completion |
| Auto-PIREP filing | P5 | Low | Auto-file when OOOI detects IN; "Flight Complete" overlay (depends on OOOI) |
| Dispatch release document | P6 | Medium | Pre-flight doc: route, weather, fuel, MEL items, NOTAMs, alternates |
| MEL dispatch awareness | P7 | Low | Yellow banner on planning page when aircraft has MEL deferrals |
| W&B envelope chart | P8 | Medium | SVG weight/CG envelope with ZFW, TOW, LDW plot points |
| Passenger charter rebrand | P9 | Trivial | Rename "Passenger Charter" to "ACMI Charter" or "Combi" |
| Exceedance-free streak | — | Low | Badge on pilot profile for consecutive clean flights |
| ACARS auto-trigger messages | — | Low | OOOI phase changes auto-send ACARS system messages |
| Dispatcher remarks in ACARS | — | Low | Full dispatcher remarks management in ACARS panel |
| ACARS system info panel | — | Medium | MEL items, route notes, burn corrections in ACARS |
| ACARS message log | — | Low | UTC-timestamped message history |
| Cargo FDC integration | — | Large | External API for real cargo data (deferred) |

### Rejected / Abandoned Ideas

| Feature | Reason |
|---------|--------|
| Purple glassmorphism design | Not aligned with dark blue + cargo-first aesthetic |
| Airspace interaction system | Too complex for current scope |

---

## Feature Count Summary

| Category | Implemented | Partial | Planned |
|----------|------------|---------|---------|
| Auth & Users | 6 | 0 | 1 |
| Schedules & Routes | 12 | 0 | 0 |
| Flight Planning & Dispatch | 13 | 0 | 3 |
| Flight Tracking & Telemetry | 12 | 0 | 1 |
| Cargo System | 12 | 0 | 1 |
| PIREP / Logbook | 9 | 0 | 2 |
| Fleet Management | 9 | 0 | 0 |
| Maintenance | 12 | 0 | 0 |
| Finance | 17 | 0 | 0 |
| VATSIM | 10 | 0 | 0 |
| Maps & Visualization | 8 | 0 | 0 |
| Admin Panel | 16 | 0 | 0 |
| Pilot App (Electron) | 19 | 0 | 0 |
| Infrastructure | 12 | 0 | 0 |
| **TOTAL** | **~167** | **0** | **~12** |
