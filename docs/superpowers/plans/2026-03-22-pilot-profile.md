# Pilot Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pilot profile system with avatar upload, admin-assigned badges, flight stats, recent flights, and public profile viewing.

**Architecture:** Backend-first approach — migration, service, routes, then frontend. Profile data comes from `users` table (extended with avatar/bio/home_base), badges from new `badges`/`user_badges` tables, and flight stats computed from existing `logbook`/`finance_flight_pnl` tables. Frontend adds a `/profile` page with left card + right content layout, a sidebar popover, and public profile links.

**Tech Stack:** Express 4, better-sqlite3, multer (upload), sharp (image resize), React 19, Zustand, Tailwind CSS, shadcn/ui, Phosphor icons

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `backend/src/db/migrations/059-pilot-profile.sql` | New tables + user columns |
| Create | `backend/src/services/profile.ts` | Profile queries, stats computation, recent flights |
| Modify | `backend/src/services/user.ts` | Add avatarUrl, bio, homeBase to toProfile() |
| Create | `backend/src/services/badge.ts` | Badge CRUD, award/revoke |
| Create | `backend/src/routes/profile.ts` | Profile + avatar endpoints |
| Create | `backend/src/routes/admin-badges.ts` | Admin badge CRUD + award/revoke |
| Modify | `backend/src/index.ts` | Register new routes, static file serving |
| Modify | `backend/package.json` | Add sharp + multer dependencies |
| Modify | `shared/src/types/auth.ts` | Add avatarUrl, bio, homeBase to UserProfile |
| Modify | `frontend/src/App.tsx` | Add /profile routes |
| Create | `frontend/src/pages/ProfilePage.tsx` | Full profile page layout |
| Create | `frontend/src/components/profile/ProfileCard.tsx` | Left column identity card |
| Create | `frontend/src/components/profile/ProfileDetails.tsx` | Left column details card |
| Create | `frontend/src/components/profile/RecentFlights.tsx` | Recent flights table |
| Create | `frontend/src/components/profile/TopRoutes.tsx` | Top routes panel |
| Create | `frontend/src/components/profile/AircraftBreakdown.tsx` | Aircraft flown panel |
| Create | `frontend/src/components/profile/EditProfileForm.tsx` | Edit mode form + avatar upload |
| Create | `frontend/src/components/profile/ProfilePopover.tsx` | Sidebar popover |
| Modify | `frontend/src/components/navigation/NavSidebar.tsx` | Click avatar → popover |

---

### Task 1: Database Migration + Dependencies

**Files:**
- Create: `backend/src/db/migrations/059-pilot-profile.sql`
- Modify: `backend/package.json`

- [ ] **Step 1: Create migration file**

```sql
-- 059-pilot-profile.sql: Pilot profile, badges, and avatar support

-- Add profile fields to users
ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN home_base TEXT;

-- Badge definitions (admin-created)
CREATE TABLE IF NOT EXISTS badges (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  description TEXT,
  icon        TEXT    NOT NULL,
  color       TEXT    NOT NULL DEFAULT '#4F6CCD',
  created_by  INTEGER REFERENCES users(id),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- User-badge assignments
CREATE TABLE IF NOT EXISTS user_badges (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id    INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  awarded_by  INTEGER REFERENCES users(id),
  awarded_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  reason      TEXT,
  UNIQUE(user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user  ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge ON user_badges(badge_id);
```

- [ ] **Step 2: Install dependencies**

```bash
cd backend && npm install sharp multer && npm install -D @types/multer
```

- [ ] **Step 3: Verify migration runs**

Start the backend briefly to confirm migration applies:
```bash
npm run dev:all
```
Check console for `[db] Applied migration 059-pilot-profile.sql`. Then stop.

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/migrations/059-pilot-profile.sql backend/package.json backend/package-lock.json
git commit -m "feat: add pilot profile migration and install sharp/multer"
```

---

### Task 2: Update Shared Types

**Files:**
- Modify: `shared/src/types/auth.ts`

- [ ] **Step 1: Add profile fields to UserProfile**

In `shared/src/types/auth.ts`, add to the `UserProfile` interface:

```typescript
avatarUrl: string | null;
bio: string | null;
homeBase: string | null;
```

These must also be returned from `/api/auth/me` so the sidebar can show the avatar. Update the `toProfile()` method in the user service (Task 3) to include them.

- [ ] **Step 2: Add profile-specific types**

Add to `shared/src/types/auth.ts` (or create a new `shared/src/types/profile.ts` and export from index):

```typescript
export interface ProfileBadge {
  id: number;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  awardedAt: string;
  reason: string | null;
}

export interface ProfileStats {
  totalFlights: number;
  totalHours: number;
  totalCargo: number;
  avgScore: number | null;
  bestLanding: number | null;
  longestFlight: number | null;
  lastFlightAt: string | null;
  preferredAircraft: string | null;
  topRoutes: { dep: string; arr: string; count: number }[];
  aircraftBreakdown: { icaoType: string; hours: number }[];
}

export interface ProfileResponse {
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
  email?: string;
  totalEarnings?: number;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  bio?: string;
  homeBase?: string;
}
```

- [ ] **Step 3: Rebuild shared**

```bash
npx tsc -p shared/
```

- [ ] **Step 4: Commit**

```bash
git add shared/
git commit -m "feat: add profile types to shared package"
```

---

### Task 3: Profile Service

**Files:**
- Create: `backend/src/services/profile.ts`
- Modify: `backend/src/services/user.ts`

- [ ] **Step 1: Update user service toProfile()**

In `backend/src/services/user.ts`, find the `toProfile()` method and add `avatarUrl`, `bio`, `homeBase` to the returned object, mapping from the DB row's `avatar_url`, `bio`, `home_base` columns.

- [ ] **Step 2: Create profile service**

Create `backend/src/services/profile.ts` with:

```typescript
import { getDb } from '../db/index.js';
import { logger } from '../lib/logger.js';
import type { ProfileResponse, ProfileStats, ProfileBadge } from '@acars/shared';

const TAG = 'ProfileService';

export class ProfileService {

  /** Get full profile for a user (own or public view) */
  getProfile(userId: number, isOwnProfile: boolean): ProfileResponse | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT id, callsign, first_name, last_name, email, role, rank,
             hours_total, avatar_url, bio, home_base, created_at, last_login
      FROM users WHERE id = ? AND status = 'active'
    `).get(userId) as any;
    if (!row) return null;

    const badges = this.getUserBadges(userId);

    const profile: ProfileResponse = {
      id: row.id,
      callsign: row.callsign,
      firstName: row.first_name,
      lastName: row.last_name,
      rank: row.rank,
      hoursTotal: row.hours_total,
      avatarUrl: row.avatar_url,
      bio: row.bio,
      homeBase: row.home_base,
      createdAt: row.created_at,
      lastLogin: row.last_login,
      badges,
    };

    if (isOwnProfile) {
      profile.email = row.email;
      profile.totalEarnings = this.getTotalEarnings(userId);
    }

    return profile;
  }

  /** Get badges for a user */
  getUserBadges(userId: number): ProfileBadge[] {
    const db = getDb();
    return db.prepare(`
      SELECT b.id, b.name, b.description, b.icon, b.color,
             ub.awarded_at, ub.reason
      FROM user_badges ub
      JOIN badges b ON b.id = ub.badge_id
      WHERE ub.user_id = ?
      ORDER BY ub.awarded_at DESC
    `).all(userId) as any[];
    // Map snake_case → camelCase in the result
  }

  /** Compute total pilot earnings from crew_cost */
  getTotalEarnings(userId: number): number {
    const db = getDb();
    const row = db.prepare(`
      SELECT COALESCE(SUM(fp.crew_cost), 0) as total
      FROM finance_flight_pnl fp
      JOIN logbook l ON l.id = fp.logbook_id
      WHERE l.user_id = ?
    `).get(userId) as any;
    return row?.total ?? 0;
  }

  /** Get flight stats for profile display */
  getStats(userId: number): ProfileStats {
    const db = getDb();

    // Basic aggregates
    const agg = db.prepare(`
      SELECT
        COUNT(*) as total_flights,
        COALESCE(SUM(flight_time_min), 0) / 60.0 as total_hours,
        COALESCE(SUM(cargo_lbs), 0) as total_cargo,
        AVG(score) as avg_score,
        MAX(landing_rate_fpm) as best_landing,
        MAX(flight_time_min) as longest_flight,
        MAX(created_at) as last_flight_at
      FROM logbook
      WHERE user_id = ? AND status = 'completed'
    `).get(userId) as any;

    // Best landing: closest to zero (MAX where < 0)
    const bestLanding = db.prepare(`
      SELECT MAX(landing_rate_fpm) as best
      FROM logbook
      WHERE user_id = ? AND status = 'completed' AND landing_rate_fpm < 0
    `).get(userId) as any;

    // Preferred aircraft (most hours)
    const preferred = db.prepare(`
      SELECT aircraft_type, SUM(flight_time_min) as mins
      FROM logbook
      WHERE user_id = ? AND status = 'completed'
      GROUP BY aircraft_type
      ORDER BY mins DESC
      LIMIT 1
    `).get(userId) as any;

    // Top routes
    const topRoutes = db.prepare(`
      SELECT dep_icao as dep, arr_icao as arr, COUNT(*) as count
      FROM logbook
      WHERE user_id = ? AND status = 'completed'
      GROUP BY dep_icao, arr_icao
      ORDER BY count DESC
      LIMIT 5
    `).all(userId) as any[];

    // Aircraft breakdown
    const aircraftBreakdown = db.prepare(`
      SELECT aircraft_type as icaoType, ROUND(SUM(flight_time_min) / 60.0, 1) as hours
      FROM logbook
      WHERE user_id = ? AND status = 'completed'
      GROUP BY aircraft_type
      ORDER BY hours DESC
      LIMIT 5
    `).all(userId) as any[];

    return {
      totalFlights: agg.total_flights,
      totalHours: Math.round(agg.total_hours * 10) / 10,
      totalCargo: agg.total_cargo,
      avgScore: agg.avg_score ? Math.round(agg.avg_score * 10) / 10 : null,
      bestLanding: bestLanding?.best ?? null,
      longestFlight: agg.longest_flight,
      lastFlightAt: agg.last_flight_at,
      preferredAircraft: preferred?.aircraft_type ?? null,
      topRoutes,
      aircraftBreakdown,
    };
  }

  /** Get recent completed flights for a user (public-safe, no auth restriction) */
  getRecentFlights(userId: number, limit = 10): any[] {
    const db = getDb();
    return db.prepare(`
      SELECT id, flight_number, dep_icao, arr_icao, aircraft_type,
             flight_time_min, landing_rate_fpm, score, created_at
      FROM logbook
      WHERE user_id = ? AND status = 'completed'
      ORDER BY created_at DESC
      LIMIT ?
    `).all(userId, limit);
  }

  /** Update own profile fields */
  updateProfile(userId: number, data: { firstName?: string; lastName?: string; bio?: string; homeBase?: string }): boolean {
    const db = getDb();
    const sets: string[] = [];
    const params: unknown[] = [];

    if (data.firstName) { sets.push('first_name = ?'); params.push(data.firstName); }
    if (data.lastName) { sets.push('last_name = ?'); params.push(data.lastName); }
    if (data.bio !== undefined) { sets.push('bio = ?'); params.push(data.bio || null); }
    if (data.homeBase !== undefined) { sets.push('home_base = ?'); params.push(data.homeBase || null); }

    if (sets.length === 0) return false;

    sets.push("updated_at = datetime('now')");
    params.push(userId);

    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return true;
  }

  /** Set avatar URL for a user */
  setAvatarUrl(userId: number, url: string | null): void {
    const db = getDb();
    db.prepare("UPDATE users SET avatar_url = ?, updated_at = datetime('now') WHERE id = ?").run(url, userId);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/profile.ts backend/src/services/user.ts
git commit -m "feat: add profile service with stats computation"
```

---

### Task 4: Badge Service

**Files:**
- Create: `backend/src/services/badge.ts`

- [ ] **Step 1: Create badge service**

Create `backend/src/services/badge.ts` with full CRUD + award/revoke:

- `findAll()` — list all badges with awarded count
- `findById(id)` — single badge
- `create(data, actorId)` — create badge definition
- `update(id, data)` — update badge definition
- `remove(id)` — delete badge (cascades user_badges)
- `award(badgeId, userId, actorId, reason?)` — award to pilot (INSERT OR IGNORE for unique constraint)
- `revoke(badgeId, userId)` — remove from pilot
- `getUserBadges(userId)` — list badges for a user

Follow existing service patterns: `getDb()`, `logger.info/warn/error(TAG, msg, meta)`.

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/badge.ts
git commit -m "feat: add badge service with CRUD and award/revoke"
```

---

### Task 5: Profile Routes + Avatar Upload

**Files:**
- Create: `backend/src/routes/profile.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Create profile routes**

Create `backend/src/routes/profile.ts` exporting `profileRouter()`. Pattern: `export function profileRouter(): Router`.

Endpoints:
- `GET /profile` — own profile (authMiddleware, calls `profileService.getProfile(req.user!.userId, true)`)
- `GET /profile/stats` — own stats (must be before `:userId` param route)
- `GET /profile/:userId` — public profile (`profileService.getProfile(parseInt(params.userId), false)`)
- `GET /profile/:userId/stats` — public stats
- `GET /profile/:userId/flights` — public recent flights (last 10 completed, calls `profileService.getRecentFlights`)
- `PATCH /profile` — update own profile (validate: bio max 200 chars, homeBase max 4 chars uppercase)
- `POST /profile/avatar` — multipart upload with multer:
  - `multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: jpg/png/webp only })`
  - On upload: resize to 256x256 with `sharp`, save to `backend/data/avatars/{userId}.webp`
  - Update `avatar_url` to `/uploads/avatars/{userId}.webp`
  - Ensure `data/avatars/` directory exists (create with `fs.mkdirSync` if needed)
- `DELETE /profile/avatar` — remove file from disk, set `avatar_url` to null

All routes require `authMiddleware`.

- [ ] **Step 2: Register routes and static serving in index.ts**

In `backend/src/index.ts`:

Add import:
```typescript
import { profileRouter } from './routes/profile.js';
```

Add route registration (after existing `app.use('/api', ...)` block):
```typescript
app.use('/api', profileRouter());
```

Add static file serving for avatars (before the SPA fallback, after other static serving):
```typescript
import path from 'path';
// Serve avatar uploads
app.use('/uploads/avatars', express.static(path.join(__dirname, '../data/avatars')));
```

Note: `__dirname` resolves to `backend/src/` in dev and `backend/dist/` in prod. In both cases, `path.join(__dirname, '../data/avatars')` correctly resolves to `backend/data/avatars/`. The `path` import and `express.static` are already available in index.ts.

- [ ] **Step 3: Verify endpoints work**

Start `npm run dev:all`, then test:
```bash
# Get own profile (need auth token)
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/profile
# Get own stats
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/profile/stats
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/profile.ts backend/src/index.ts
git commit -m "feat: add profile routes with avatar upload"
```

---

### Task 6: Admin Badge Routes

**Files:**
- Create: `backend/src/routes/admin-badges.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Create admin badge routes**

Create `backend/src/routes/admin-badges.ts` exporting `adminBadgesRouter()`.

Endpoints (all require `authMiddleware` + `adminMiddleware`):
- `GET /admin/badges` — list all badges
- `POST /admin/badges` — create badge (body: name, description, icon, color)
- `PATCH /admin/badges/:id` — update badge
- `DELETE /admin/badges/:id` — delete badge
- `POST /admin/badges/:id/award` — award to pilot (body: userId, reason)
- `DELETE /admin/badges/:id/revoke/:userId` — revoke from pilot

Import `adminMiddleware` from `../middleware/auth.js` (same as other admin routes use).

- [ ] **Step 2: Register in index.ts**

Add import and `app.use('/api', adminBadgesRouter())`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/admin-badges.ts backend/src/index.ts
git commit -m "feat: add admin badge management routes"
```

---

### Task 7: Frontend Profile Page + Components

**Files:**
- Create: `frontend/src/pages/ProfilePage.tsx`
- Create: `frontend/src/components/profile/ProfileCard.tsx`
- Create: `frontend/src/components/profile/ProfileDetails.tsx`
- Create: `frontend/src/components/profile/RecentFlights.tsx`
- Create: `frontend/src/components/profile/TopRoutes.tsx`
- Create: `frontend/src/components/profile/AircraftBreakdown.tsx`
- Modify: `frontend/src/App.tsx`

This is the largest task. The implementer should read the mockup at `.superpowers/brainstorm/35907-1774234179/profile-layout-v4.html` for the visual design, plus follow existing page patterns from `frontend/src/pages/LogbookPage.tsx` and `frontend/src/pages/SettingsPage.tsx`.

- [ ] **Step 1: Create ProfilePage.tsx**

The page component that:
- Reads `userId` from route params (or uses own user ID from authStore)
- Fetches profile data from `GET /api/profile` or `GET /api/profile/:userId`
- Fetches stats from `GET /api/profile/stats` or `GET /api/profile/:userId/stats`
- Fetches recent flights from `GET /api/profile/:userId/flights` (a dedicated endpoint that bypasses logbook auth restrictions)
- Renders two-column layout: left (ProfileCard + ProfileDetails + Edit button) and right (RecentFlights + TopRoutes/AircraftBreakdown row)
- Has `isOwnProfile` boolean derived from comparing route userId vs auth userId
- Has `editing` state for edit mode toggle

Route setup in App.tsx:
```tsx
import { ProfilePage } from './pages/ProfilePage';
// Inside the MainShell routes:
<Route path="/profile" element={<ProfilePage />} />
<Route path="/profile/:userId" element={<ProfilePage />} />
```

- [ ] **Step 2: Create ProfileCard.tsx**

Left column identity card (320px):
- Avatar (96px circle) — shows uploaded image or initials fallback
- Rank badge above name (same style as mockup)
- Full name (18px bold, white)
- Callsign (monospace, accent blue)
- Badges row (wrapped flex, each badge = colored circle + name)
- Total Earnings (green monospace, own profile only)
- 2x2 stats grid (hours, flights, cargo, avg score)

Props: `{ profile: ProfileResponse; stats: ProfileStats; isOwnProfile: boolean }`

- [ ] **Step 3: Create ProfileDetails.tsx**

Details card below the identity card:
- Member Since, Home Base, Preferred Aircraft, Last Flight (relative time), Best Landing (fpm), Longest Flight (duration)

Props: `{ stats: ProfileStats; profile: ProfileResponse }`

- [ ] **Step 4: Create RecentFlights.tsx**

Recent flights table (last 10):
- Fetch from `GET /api/profile/:userId/flights` (NOT the logbook API — the logbook endpoint restricts non-admin users to their own data)
- Columns: Date, Flight #, Route, Aircraft, Duration, Landing Rate, Score
- Color coding: green (score >= 80 / rate > -200), amber (moderate), red (score < 60 / rate < -350)
- "View All Flights" footer link → `/logbook`

Props: `{ userId: number }`

- [ ] **Step 5: Create TopRoutes.tsx**

Ranked list of top 5 routes with flight count.

Props: `{ routes: { dep: string; arr: string; count: number }[] }`

- [ ] **Step 6: Create AircraftBreakdown.tsx**

Aircraft type list with horizontal bar chart showing hours. Bar width proportional to max hours.

Props: `{ aircraft: { icaoType: string; hours: number }[] }`

- [ ] **Step 7: Wire routes in App.tsx**

Add imports and routes for `/profile` and `/profile/:userId` inside the `MainShell` route group.

- [ ] **Step 8: Verify in browser**

Navigate to `/#/profile`. Expected: Profile page loads with own data, stats, recent flights, top routes, aircraft breakdown.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/ProfilePage.tsx frontend/src/components/profile/ frontend/src/App.tsx
git commit -m "feat: add pilot profile page with stats, flights, and badges"
```

---

### Task 8: Edit Profile Mode + Avatar Upload

**Files:**
- Create: `frontend/src/components/profile/EditProfileForm.tsx`
- Modify: `frontend/src/pages/ProfilePage.tsx`

- [ ] **Step 1: Create EditProfileForm.tsx**

Inline edit form that replaces the Edit Profile button when active:
- Avatar: clickable, opens file picker, shows preview, uploads via `POST /api/profile/avatar` (multipart FormData)
- Fields: First Name (text), Last Name (text), Bio (textarea, 200 char limit with counter), Home Base (text, ICAO format)
- Save button: `PATCH /api/profile` with changed fields
- Cancel button: resets to original values
- Delete avatar button (if avatar exists): `DELETE /api/profile/avatar`

Props: `{ profile: ProfileResponse; onSaved: () => void; onCancel: () => void }`

- [ ] **Step 2: Wire into ProfilePage**

Add `editing` state. When editing, render `EditProfileForm` below the ProfileCard instead of the Edit button. Pass `onSaved` to refresh profile data and exit edit mode.

- [ ] **Step 3: Update authStore after profile save**

After a successful profile update, refresh the auth store user data (call `GET /api/auth/me` or update the user object in the store directly) so the sidebar reflects name/avatar changes immediately.

- [ ] **Step 4: Verify**

Test: edit name, upload avatar, change bio/home base. Verify changes persist on reload. Verify sidebar updates.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/profile/EditProfileForm.tsx frontend/src/pages/ProfilePage.tsx
git commit -m "feat: add profile edit mode with avatar upload"
```

---

### Task 9: Profile Popover in Sidebar

**Files:**
- Create: `frontend/src/components/profile/ProfilePopover.tsx`
- Modify: `frontend/src/components/navigation/NavSidebar.tsx`

- [ ] **Step 1: Create ProfilePopover.tsx**

Floating popover component:
- Avatar (small, 40px), rank badge, name, callsign
- Badges row (if any)
- Quick stats: hours, flights count
- "View Full Profile" link → `/profile`
- "Sign Out" button (moved from sidebar)

Uses a simple `useState` for open/close. Positioned above the user area in the sidebar. Closes on click outside (use a backdrop overlay or `useEffect` with document click listener).

Style: `background: var(--surface-1)`, `border: 1px solid var(--border-primary)`, subtle shadow.

Props: `{ open: boolean; onClose: () => void; onSignOut: () => void }`

- [ ] **Step 2: Modify NavSidebar.tsx**

Change the "User Info" div (~line 211) to be a clickable button that toggles the popover:
- Wrap in a `<button>` with `onClick` to open popover
- Add `<ProfilePopover>` component, positioned above the user area
- Move "Sign Out" into the popover (remove from current location ~line 226-233)
- Keep the collapse toggle button in the sidebar

- [ ] **Step 3: Show avatar image in sidebar if available**

If `user.avatarUrl` exists, render an `<img>` instead of the initials div. The image should be 24x24 (matching current initials badge size), circular, object-cover.

- [ ] **Step 4: Verify**

Click avatar in sidebar → popover opens. "View Full Profile" navigates to `/profile`. "Sign Out" works. Popover closes on outside click.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/profile/ProfilePopover.tsx frontend/src/components/navigation/NavSidebar.tsx
git commit -m "feat: add profile popover to sidebar with avatar display"
```

---

### Task 10: Public Profile Links

**Files:**
- Modify: `frontend/src/pages/LogbookPage.tsx` (or wherever leaderboard/PIREP lists show pilot names)

- [ ] **Step 1: Find pilot name displays**

Check `frontend/src/pages/LogbookPage.tsx` and any leaderboard component. Where pilot names or callsigns are displayed, wrap them in a `<Link to={/profile/${userId}}>` (react-router-dom).

Only add links where the userId is available in the data. The leaderboard might not have userId — check the `LeaderboardEntry` type. If it doesn't have userId, skip leaderboard for now and note it as a follow-up.

- [ ] **Step 2: Style the links**

Pilot name links: `color: var(--accent-blue-bright)`, no underline, underline on hover. Same pattern as other links in the app.

- [ ] **Step 3: Verify**

Click a pilot name → navigates to their public profile. Verify the public profile shows stats and badges but no edit button, no earnings, no email.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/LogbookPage.tsx
git commit -m "feat: add public profile links from pilot names"
```

---

### Task 11: Admin Badge Management UI

**Files:**
- Create: `admin/src/pages/BadgesPage.tsx` (or add section to existing Users page)

- [ ] **Step 1: Create badge management page/section**

Follow existing admin patterns (e.g., `admin/src/pages/maintenance/CheckSchedulesSection.tsx`):
- Badge list table: Name, Icon (rendered), Color (swatch), Description, # Awarded, Actions (edit/delete)
- Create/Edit dialog: name (text), description (textarea), icon (text input for emoji), color (hex input with color preview)
- Delete confirmation dialog

API calls:
- `GET /api/admin/badges`
- `POST /api/admin/badges`
- `PATCH /api/admin/badges/:id`
- `DELETE /api/admin/badges/:id`

- [ ] **Step 2: Add badge award/revoke to admin user detail**

Find the admin user detail view (likely in `admin/src/pages/UsersPage.tsx` or a sub-component). Add a "Badges" section showing the user's current badges with a revoke button, and an "Award Badge" button that opens a picker.

API calls:
- `POST /api/admin/badges/:id/award` with `{ userId, reason }`
- `DELETE /api/admin/badges/:id/revoke/:userId`

- [ ] **Step 3: Verify**

In admin panel: create a badge, award it to a pilot, verify it appears on the pilot's profile. Revoke it, verify it disappears.

- [ ] **Step 4: Commit**

```bash
git add admin/src/pages/BadgesPage.tsx
git commit -m "feat: add admin badge management and award UI"
```
