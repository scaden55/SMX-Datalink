# Revenue Model Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the flat $50/hr pilot pay with an RTM-based cargo revenue model using aircraft classes, cargo unit types, logarithmic distance scaling, and SimBrief-sourced cargo weights.

**Architecture:** New `RevenueModelService` handles all revenue/pay calculation. Called from both `pirep.ts` (auto-approve) and `pirep-admin.ts` (manual approve). Config stored in single-row `revenue_model_config` table. Aircraft class stored on `fleet` table.

**Tech Stack:** TypeScript, better-sqlite3, Express routes, React admin pages

**No tests exist in this project.** Skip all TDD steps — implement directly and verify via build.

---

### Task 1: Database Migration

**Files:**
- Create: `backend/src/db/migrations/041-revenue-model.sql`

**Step 1: Write the migration**

```sql
-- Revenue Model configuration (single-row table)
CREATE TABLE IF NOT EXISTS revenue_model_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  -- Yield rates ($/kg) per aircraft class and cargo unit type
  class_i_standard REAL NOT NULL DEFAULT 10.00,
  class_i_nonstandard REAL NOT NULL DEFAULT 20.00,
  class_i_hazard REAL NOT NULL DEFAULT 40.00,
  class_ii_standard REAL NOT NULL DEFAULT 3.00,
  class_ii_nonstandard REAL NOT NULL DEFAULT 6.00,
  class_ii_hazard REAL NOT NULL DEFAULT 12.00,
  class_iii_standard REAL NOT NULL DEFAULT 2.00,
  class_iii_nonstandard REAL NOT NULL DEFAULT 4.00,
  class_iii_hazard REAL NOT NULL DEFAULT 8.00,
  -- Pilot pay
  pilot_pay_per_hour REAL NOT NULL DEFAULT 300.00,
  -- Manifest split percentages (must sum to 1.0)
  manifest_std_pct REAL NOT NULL DEFAULT 0.70,
  manifest_nonstd_pct REAL NOT NULL DEFAULT 0.20,
  manifest_hazard_pct REAL NOT NULL DEFAULT 0.10,
  -- Distance reference (nm) for log curve normalization
  reference_nm REAL NOT NULL DEFAULT 1000.0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default config row
INSERT OR IGNORE INTO revenue_model_config (id) VALUES (1);

-- Add aircraft class to fleet
ALTER TABLE fleet ADD COLUMN aircraft_class TEXT NOT NULL DEFAULT 'III'
  CHECK (aircraft_class IN ('I', 'II', 'III'));
```

**Step 2: Verify build**

Run: `npm run build -w backend`

**Step 3: Commit**

```
feat: add revenue model migration (041)
```

---

### Task 2: RevenueModelService

**Files:**
- Create: `backend/src/services/revenue-model.ts`

**Step 1: Create the service**

The service must:
1. Read config from `revenue_model_config` table
2. Look up aircraft class from `fleet` table by registration or aircraft type
3. Generate a randomized manifest split from cargo weight
4. Calculate revenue using: `tier_kg * yield[class][unit_type] * distance_factor`
5. Calculate pilot pay: `block_hours * pilot_pay_per_hour`
6. Return a breakdown object

Key function signatures:

```typescript
interface RevenueBreakdown {
  cargoKg: number;
  distanceNm: number;
  distanceFactor: number;
  aircraftClass: 'I' | 'II' | 'III';
  manifest: {
    standardKg: number;
    nonstandardKg: number;
    hazardKg: number;
  };
  revenue: {
    standard: number;
    nonstandard: number;
    hazard: number;
    total: number;
  };
  pilotPay: number;
  blockHours: number;
}
```

Distance factor formula:
```typescript
function distanceFactor(routeNm: number, referenceNm: number): number {
  return Math.log(routeNm / 100 + 1) / Math.log(referenceNm / 100 + 1);
}
```

Manifest generation: use `manifest_*_pct` from config as centers, add random variance (±10% for standard, ±5% for others), clamp to ensure non-negative, then normalize so percentages sum to 1.0.

Aircraft class lookup: query `fleet` table by `registration = ?` first. If no match or no registration, fall back to default class III.

**Step 2: Verify build**

Run: `npm run build -w backend`

**Step 3: Commit**

```
feat: add RevenueModelService with RTM-based calculation
```

---

### Task 3: Wire Revenue Model into PIREP Flow

**Files:**
- Modify: `backend/src/services/pirep.ts` (lines 214-233 — replace old $50/hr pay)
- Modify: `backend/src/services/pirep-admin.ts` (lines 126-152 — replace old pay + cargo revenue)

**Step 1: Update pirep.ts (auto-approve path)**

Replace lines 214-233 (the `if (autoApprove && flightTimeMin > 0)` block):

1. Import `RevenueModelService` at top
2. Instantiate alongside other services
3. In the auto-approve block:
   - Call `revenueModel.calculate({ cargoLbs, distanceNm: schedule.distance_nm, aircraftRegistration: aircraftReg, aircraftType: schedule.aircraft_type, blockHours: flightTimeMin / 60 })`
   - Create finance entry for pilot pay: type `'pay'`, amount = `breakdown.pilotPay`
   - Create finance entry for cargo revenue: type `'income'`, amount = `breakdown.revenue.total`
   - Include breakdown in notification: `Pay: $X, Cargo Revenue: $Y`

**Step 2: Update pirep-admin.ts (manual approve path)**

Replace lines 127-152 (the `if (status === 'approved')` block):

Same pattern — use `RevenueModelService.calculate()` instead of the old `payRate * hours` + `cargoLbs * cargoRate`.

**Step 3: Verify build**

Run: `npm run build -w backend`

**Step 4: Commit**

```
feat: wire revenue model into PIREP auto-approve and admin review
```

---

### Task 4: Admin Revenue Model API Route

**Files:**
- Create: `backend/src/routes/admin-revenue-model.ts`
- Modify: `backend/src/index.ts` (register the new route)

**Step 1: Create the route**

Two endpoints:
- `GET /admin/revenue-model` — returns the single config row
- `PUT /admin/revenue-model` — updates yield rates, pilot pay, manifest splits

Both require `authMiddleware` + `adminMiddleware`.

**Step 2: Register in index.ts**

Add import and `app.use('/api', adminRevenueModelRouter())` alongside other admin routes (after line 171).

**Step 3: Verify build**

Run: `npm run build -w backend`

**Step 4: Commit**

```
feat: add admin revenue model API endpoints
```

---

### Task 5: Fleet Aircraft Class — Backend

**Files:**
- Modify: `backend/src/routes/fleet.ts` — accept `aircraftClass` in PATCH `/fleet/manage/:id`
- Modify: `backend/src/types/db-rows.ts` — add `aircraft_class` to `FleetRow`

**Step 1: Update FleetRow type**

Add `aircraft_class: 'I' | 'II' | 'III'` to the `FleetRow` interface in `db-rows.ts`.

**Step 2: Update fleet PATCH endpoint**

In `fleet.ts`, the `PATCH /fleet/manage/:id` handler builds a dynamic SET clause. Add `aircraftClass` to the accepted fields, mapping to `aircraft_class` column. Validate it's one of `'I'`, `'II'`, `'III'`.

**Step 3: Update fleet GET endpoint**

Ensure `aircraft_class` is included in the SELECT and returned in the response (it will be automatically if using `SELECT *`).

**Step 4: Verify build**

Run: `npm run build -w backend`

**Step 5: Commit**

```
feat: add aircraft class field to fleet management
```

---

### Task 6: Admin Fleet Page — Aircraft Class Dropdown

**Files:**
- Modify: `admin/src/pages/FleetPage.tsx` — add aircraft class column and edit dropdown

**Step 1: Update fleet table**

Add an "Aircraft Class" column to the fleet table. Display as "Class I", "Class II", "Class III".

**Step 2: Add edit capability**

In the fleet edit modal/form, add a dropdown for aircraft class with options I, II, III. On save, include `aircraftClass` in the PATCH request body.

**Step 3: Verify build**

Run: `npm run build -w admin`

**Step 4: Commit**

```
feat: add aircraft class dropdown to admin fleet page
```

---

### Task 7: Admin Revenue Model Page

**Files:**
- Create: `admin/src/pages/RevenueModelPage.tsx`
- Modify: `admin/src/components/layout/AppSidebar.tsx` — add nav link
- Modify: `admin/src/App.tsx` or router config — add route

**Step 1: Create the page**

A settings-style page with:
- **Yield Matrix** — 3×3 grid of editable number inputs (Class I/II/III × Standard/NonStandard/Hazard), displayed as $/kg
- **Pilot Pay** — single editable field ($/hr)
- **Manifest Split** — three percentage fields (must sum to 100%)
- **Save button** — PUTs to `/api/admin/revenue-model`
- Fetches current config on mount via GET

Follow admin design system: tokens.css, surface hierarchy, Inter font.

**Step 2: Add navigation**

Add "Revenue Model" to the sidebar under the Finances section. Icon: `CurrencyDollar` from Phosphor.

**Step 3: Add route**

Register `/revenue-model` path in the router pointing to `RevenueModelPage`.

**Step 4: Verify build**

Run: `npm run build -w admin`

**Step 5: Commit**

```
feat: add admin revenue model configuration page
```

---

### Task 8: Deploy and Verify

**Step 1: Build everything**

```bash
npx tsc -p shared/
npm run build -w backend
npm run build -w admin
```

**Step 2: Deploy to VPS**

```bash
scp -r backend/dist/* root@138.197.127.39:/opt/sma-acars/dist/
# Deploy admin
ssh root@138.197.127.39 "rm -rf /opt/sma-acars/admin-dist && mkdir -p /opt/sma-acars/admin-dist"
scp -r admin/dist/* root@138.197.127.39:/opt/sma-acars/admin-dist/
# Restart
ssh root@138.197.127.39 "pm2 restart sma-acars"
```

**Step 3: Verify**

- Visit `https://iacars.specialmissionsair.com/admin/` — log in
- Navigate to Revenue Model page — verify yield matrix loads with defaults
- Navigate to Fleet page — verify aircraft class column appears
- File a test PIREP via the app — verify finance entry shows realistic revenue

**Step 4: Commit all remaining changes**

```
feat: revenue model — RTM-based cargo revenue replaces flat hourly pay
```
