# Pilot Profile Design Spec

**Goal:** Add a user profile system to the pilot frontend — profile page with avatar upload, badges, flight stats, recent flights, and public profile viewing. Admin can create and assign badges.

---

## Data Model

### New Tables

**`badges`** — Admin-created badge definitions

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| name | TEXT | NOT NULL |
| description | TEXT | |
| icon | TEXT | NOT NULL (emoji or short string) |
| color | TEXT | NOT NULL (hex, e.g. `#4F6CCD`) |
| created_by | INTEGER | REFERENCES users(id) |
| created_at | TEXT | NOT NULL DEFAULT datetime('now') |

**`user_badges`** — Join table linking badges to pilots

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| user_id | INTEGER | NOT NULL REFERENCES users(id) ON DELETE CASCADE |
| badge_id | INTEGER | NOT NULL REFERENCES badges(id) ON DELETE CASCADE |
| awarded_by | INTEGER | REFERENCES users(id) |
| awarded_at | TEXT | NOT NULL DEFAULT datetime('now') |
| reason | TEXT | Optional note from admin |

UNIQUE constraint on `(user_id, badge_id)` — a pilot can only have each badge once.

### New Columns on `users`

| Column | Type | Notes |
|--------|------|-------|
| avatar_url | TEXT | Path to uploaded avatar (e.g. `/uploads/avatars/42.webp`) |
| bio | TEXT | Short pilot bio, max 200 chars |
| home_base | TEXT | ICAO code (optional) |

### Avatar Storage

- Files saved to `backend/data/avatars/` as `{userId}.webp`
- Backend serves via Express static middleware at `/uploads/avatars/`
- Max 2MB upload, accepts jpg/png/webp
- Resized to 256x256 on upload using `sharp`
- On delete, file removed from disk and `avatar_url` set to NULL

### Dependencies

- **`sharp`** — Image processing for avatar resize/convert. Has native bindings; needs `@electron/rebuild` for Electron packaging (same as better-sqlite3). Add to `backend/package.json`.
- **`multer`** — Multipart form parsing for avatar upload. Memory storage with 2MB file size limit. Add to `backend/package.json`.

---

## Backend API

**Route registration:** New route files must be registered in `backend/src/index.ts` alongside existing routes.

### Profile Endpoints (auth required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/profile` | Full profile for logged-in user (user data + badges + flight stats) |
| GET | `/api/profile/:userId` | Public profile for any pilot (read-only, no email) |
| PATCH | `/api/profile` | Update own profile (firstName, lastName, bio, homeBase) |
| POST | `/api/profile/avatar` | Upload avatar (multipart, max 2MB, converts to webp) |
| DELETE | `/api/profile/avatar` | Remove avatar, revert to initials |
| GET | `/api/profile/stats` | Own flight stats (top routes, aircraft breakdown, best landing, longest flight) |
| GET | `/api/profile/:userId/stats` | Public flight stats for any pilot |

### Profile Response Shape

```typescript
interface ProfileResponse {
  id: number;
  callsign: string;
  firstName: string;
  lastName: string;
  rank: string;
  hoursTotal: number;
  avatarUrl: string | null;
  bio: string | null;
  homeBase: string | null;
  createdAt: string;
  lastLogin: string | null;
  badges: ProfileBadge[];
  // only on own profile:
  email?: string;
  totalEarnings?: number; // SUM(crew_cost) from finance_flight_pnl for pilot's flights
}

interface ProfileBadge {
  id: number;
  name: string;
  icon: string;
  color: string;
  awardedAt: string;
}
```

### Stats Response Shape

```typescript
interface ProfileStats {
  totalFlights: number;
  totalHours: number;
  totalCargo: number;
  avgScore: number | null;
  bestLanding: number | null;       // fpm (closest to zero = softest touchdown)
  longestFlight: number | null;     // minutes
  lastFlightAt: string | null;
  preferredAircraft: string | null; // most-flown ICAO type
  topRoutes: { dep: string; arr: string; count: number }[];
  aircraftBreakdown: { icaoType: string; hours: number }[];
}
```

Stats are computed from the existing `logbook` table — no new tables needed:
- **Top routes**: `GROUP BY dep_icao, arr_icao ORDER BY COUNT(*) DESC LIMIT 5`
- **Aircraft breakdown**: `GROUP BY aircraft_type ORDER BY SUM(flight_time_min) DESC LIMIT 5`
- **Best landing**: `MAX(landing_rate_fpm) WHERE landing_rate_fpm < 0` (closest to zero = softest touchdown)
- **Longest flight**: `MAX(flight_time_min)`
- **Preferred aircraft**: most hours by `aircraft_type`
- **Total earnings** (own profile only): `SUM(crew_cost) FROM finance_flight_pnl JOIN logbook ON logbook_id = logbook.id WHERE logbook.user_id = ?`

### Admin Badge Endpoints (admin auth required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/badges` | List all badge definitions |
| POST | `/api/admin/badges` | Create badge (name, description, icon, color) |
| PATCH | `/api/admin/badges/:id` | Update badge |
| DELETE | `/api/admin/badges/:id` | Delete badge (cascades user_badges) |
| POST | `/api/admin/badges/:id/award` | Award badge to pilot (userId, reason) |
| DELETE | `/api/admin/badges/:id/revoke/:userId` | Revoke badge from pilot |

---

## Frontend — Pilot App

### Profile Page (`/profile` and `/profile/:userId`)

**Layout:** Two-column, left profile card (320px fixed) + right content (flex).

**Left Column — two cards stacked:**

1. **Identity Card:**
   - Avatar (96px circle, click to upload when own profile)
   - Rank badge above name
   - Full name (18px bold)
   - Callsign (monospace, accent blue)
   - Badges row (wrapped, under callsign)
   - Total Earnings (green, monospace, own profile only — computed from crew_cost in finance_flight_pnl)
   - 2x2 stats grid: Total Hours, Flights, Cargo lbs, Avg Score

2. **Details Card:**
   - Member Since (createdAt)
   - Home Base (ICAO, monospace)
   - Preferred Aircraft (most-flown type, monospace)
   - Last Flight (relative time)
   - Best Landing (fpm, green)
   - Longest Flight (duration)

3. **Edit Profile button** (own profile only)

**Right Column — stacked:**

1. **Recent Flights table** (last 10 from `logbook` where `status = 'completed'`):
   - Columns: Date, Flight #, Route (DEP-ARR), Aircraft, Duration, Landing Rate (color-coded), Score (color-coded)
   - Color coding: green (good, score >= 80 / rate > -200), amber (moderate), red (poor, score < 60 / rate < -350)
   - "View All Flights" footer link

2. **Bottom row — two panels side by side:**
   - **Top Routes**: ranked list (1-5) with route and flight count
   - **Aircraft Flown**: ICAO type, horizontal bar chart, hours

**Public vs Own profile:**
- Same component, route determines data source
- Public: no edit button, no earnings, no email
- Own: edit button, earnings shown, email in edit mode

### Profile Popover (NavSidebar)

- Triggered by clicking avatar/name area in sidebar
- Content: avatar (small), rank badge, name, callsign, badges, hours, flights count
- Actions: "View Full Profile" → `/profile`, "Sign Out"
- Floating popover positioned above the user area in sidebar

### Edit Profile Mode

- Inline on profile page (toggle state, not separate route)
- Avatar: click opens file picker, shows preview, uploads via POST
- Editable fields: first name, last name, bio (textarea, 200 char limit), home base (text input)
- Save and Cancel buttons replace Edit Profile button
- On save: PATCH `/api/profile`, refresh profile data

### Public Profile Links

Other pilots' profiles are accessible from:
- Leaderboard — pilot names become links to `/profile/:userId`
- PIREP list — author names become links

---

## Frontend — Admin Panel

### Badge Management

Add to existing admin panel (new section or tab):

- **Badge list**: table with name, icon preview, color swatch, description, # pilots awarded
- **Create/Edit dialog**: name, description, icon (text input for emoji), color (hex input with preview)
- **Delete**: confirmation dialog, warns about cascade

### User Badge Assignment

On admin user detail page:
- Section showing pilot's current badges with revoke button
- "Award Badge" button opens a picker from the badge definitions list with optional reason field

---

## File Structure

### Backend
- `backend/src/db/migrations/0XX-pilot-profile.sql` — New tables + user columns
- `backend/src/routes/profile.ts` — Profile + avatar endpoints
- `backend/src/routes/admin-badges.ts` — Admin badge CRUD + award/revoke
- `backend/src/services/profile.ts` — Profile queries, stats computation
- `backend/src/services/badge.ts` — Badge CRUD, award/revoke logic

### Frontend (pilot app)
- `frontend/src/pages/ProfilePage.tsx` — Full profile page
- `frontend/src/components/profile/ProfileCard.tsx` — Left column identity card
- `frontend/src/components/profile/ProfileDetails.tsx` — Left column details card
- `frontend/src/components/profile/RecentFlights.tsx` — Recent flights table
- `frontend/src/components/profile/TopRoutes.tsx` — Top routes panel
- `frontend/src/components/profile/AircraftBreakdown.tsx` — Aircraft flown panel
- `frontend/src/components/profile/EditProfileForm.tsx` — Edit mode form
- `frontend/src/components/profile/ProfilePopover.tsx` — Sidebar popover

### Admin panel
- `admin/src/pages/BadgesPage.tsx` — Badge management (or section within Users)
