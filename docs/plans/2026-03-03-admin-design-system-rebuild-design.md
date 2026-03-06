# Admin Design System Rebuild — Design Document

**Date**: 2026-03-03
**Scope**: Ground-up frontend redesign of the entire admin panel
**Approach**: Full design system rebuild (Approach C) — new token system, component primitives, and page rewrites
**New dependency**: `motion` (framer-motion successor, ~15kb gzipped)

---

## 1. Design Tokens (`styles/tokens.css`)

All raw hex/HSL values removed from components. Everything references tokens.

### 1.1 Surface Colors (4-tier depth system)

| Token | Hex | Usage |
|-------|-----|-------|
| `--surface-0` | `#0a0d14` | Deepest — sidebar, table headers, footers |
| `--surface-1` | `#0f1219` | Content area background |
| `--surface-2` | `#151a24` | Cards, panels, elevated surfaces |
| `--surface-3` | `#1c2230` | Hover states, active rows, inputs, dropdowns |

### 1.2 Text Hierarchy (4 tiers)

| Token | Hex | Usage |
|-------|-----|-------|
| `--text-primary` | `#f0f1f3` | Titles, values, critical data |
| `--text-secondary` | `#c4c7ce` | Body text, descriptions |
| `--text-tertiary` | `#7a7f8e` | Labels, timestamps, hints, column headers |
| `--text-quaternary` | `#4a4f5e` | Disabled, placeholders, decorative |

### 1.3 Semantic Accent Colors

Each accent has 3 variants: solid, background (15% opacity), ring (25% opacity).

| Token | Hex | Usage |
|-------|-----|-------|
| `--accent-blue` | `#3b82f6` | Primary actions, flights, navigation, links |
| `--accent-emerald` | `#10b981` | Success, active, healthy, approved |
| `--accent-amber` | `#f59e0b` | Warning, pending, attention needed |
| `--accent-red` | `#ef4444` | Error, rejected, critical, destructive |
| `--accent-cyan` | `#06b6d4` | Info, routes, secondary data, metadata |

### 1.4 Border System

| Token | Hex | Usage |
|-------|-----|-------|
| `--border-primary` | `#1e2535` | Card borders, dividers |
| `--border-secondary` | `#2a3040` | Input borders, table cell borders |
| `--border-hover` | `#3a4050` | Hover state borders |
| `--border-accent` | var(--accent-blue) | Focus rings, active indicators |

### 1.5 Typography Scale

| Token | Size | Weight | Font | Usage |
|-------|------|--------|------|-------|
| `--text-display` | 24px | 700 | Inter | Page titles |
| `--text-heading` | 16px | 600 | Inter | Section headers, card titles |
| `--text-subheading` | 11px | 600 | Inter | Group labels (uppercase, tracking-wider) |
| `--text-body` | 13px | 400 | Inter | Content, descriptions |
| `--text-body-medium` | 13px | 500 | Inter | Emphasized body text |
| `--text-caption` | 11px | 400 | Inter | Timestamps, hints, metadata |
| `--text-data` | 13px | 500 | IBM Plex Mono | Numeric values, ICAOs |
| `--text-data-sm` | 11px | 500 | IBM Plex Mono | Table cell data |
| `--text-data-lg` | 20px | 600 | IBM Plex Mono | KPI values in stat cards |

### 1.6 Spacing Scale

Base unit: 4px. Tokens: `--space-1` (4px) through `--space-16` (64px).

Key values: `--space-2` (8px), `--space-3` (12px), `--space-4` (16px), `--space-6` (24px), `--space-8` (32px).

### 1.7 Elevation (Shadows)

| Token | Usage |
|-------|-------|
| `--elevation-0` | none | Flat elements |
| `--elevation-1` | `0 1px 3px rgba(0,0,0,0.3)` | Cards, panels |
| `--elevation-2` | `0 4px 12px rgba(0,0,0,0.4)` | Dropdowns, popovers |
| `--elevation-3` | `0 8px 24px rgba(0,0,0,0.5)` | Modals, sheets |

### 1.8 Animation Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Enter animations |
| `--ease-in-out` | `cubic-bezier(0.45, 0, 0.55, 1)` | Transitions |
| `--duration-fast` | `120ms` | Hover states, toggles |
| `--duration-normal` | `200ms` | Panel slides, fades |
| `--duration-slow` | `350ms` | Page transitions, reveals |

### 1.9 Z-Index Scale

`--z-base` (0), `--z-dropdown` (50), `--z-sticky` (100), `--z-overlay` (200), `--z-modal` (300), `--z-toast` (400).

---

## 2. Component Primitives (`components/primitives/`)

New shared components that every page uses. Replace raw div+tailwind patterns.

### 2.1 `Surface`

Card/panel wrapper with tokenized elevation and optional accent border.

```tsx
<Surface elevation={1} accent="emerald" className="...">
  {children}
</Surface>
```

Props: `elevation` (0-3), `accent` (blue|emerald|amber|red|cyan), `padding` (none|compact|default|spacious), `className`.

Renders: `div` with `--surface-{n}` bg, `--border-primary` border, optional 3px left accent, `--elevation-{n}` shadow, `rounded-lg`.

### 2.2 `StatCard`

KPI metric display. Used in PageShell stats row and dashboard.

```tsx
<StatCard
  icon={AirplaneTakeoff}
  label="Active Flights"
  value={12}
  accent="emerald"
  trend={{ value: 8, direction: 'up' }}
/>
```

Layout: Icon in colored circle (accent at 15% opacity) | Label (subheading) above Value (data-lg) | Optional trend badge.

### 2.3 `StatusBadge`

Unified status indicator across all pages.

```tsx
<StatusBadge status="approved" />
<StatusBadge status="pending" />
<StatusBadge status="rejected" />
<StatusBadge status="active" />
<StatusBadge status="completed" />
```

Maps status to accent color + label. Pill shape with ring border.

### 2.4 `SectionHeader`

Groups content within pages and panels.

```tsx
<SectionHeader title="Flight Information" count={5} action={{ label: "View all", onClick }} />
```

Renders: Uppercase subheading label + optional count badge + optional right action link + bottom border.

### 2.5 `DataRow`

Key-value pair for detail panels.

```tsx
<DataRow label="Departure" value="KJFK" mono />
<DataRow label="Status" value={<StatusBadge status="approved" />} />
```

Two-column: label (tertiary text, fixed width) | value (primary text, optional mono font).

### 2.6 `MetricDisplay`

Large number with context. For dashboard widgets.

```tsx
<MetricDisplay value="$12,450" label="Monthly Revenue" trend={{ value: 12, direction: 'up' }} />
```

---

## 3. Layout Shell

### 3.1 Sidebar (`AppSidebar`)

**Background**: `--surface-0` (deepest tier)

**Structure**:
1. **Logo area**: SMA logo/chevron, compact
2. **Operations pulse**: Small `Surface` card showing:
   - Active flights count (emerald dot + number)
   - Pending PIREPs count (amber dot + number)
   - Fetched on mount from `/api/admin/dashboard`, updated via socket
3. **Navigation groups**: 3 sections separated by `SectionHeader`-style labels
   - OPERATIONS: Dashboard, Dispatch Board
   - MANAGEMENT: Schedules, PIREPs, Users, Notifications
   - FLEET & FINANCE: Maintenance, Fleet, Finances, Reports
   - SYSTEM: Audit Log, Settings
4. **Active item**: 3px blue left border + `--surface-3` background + white text
5. **Notification dots**: Colored circles on items with pending work
6. **Footer**: User avatar circle + name + role badge (small StatusBadge-like)

### 3.2 TopBar

**Background**: `--surface-1` with 1px `--border-primary` bottom

**Left**: Sidebar toggle + current page title (heading size, white text)
**Center**: Search shortcut pill — bordered, subtle, "(Ctrl+K) Search..."
**Right**: Socket status indicator (green/amber/red dot + label) + user dropdown

### 3.3 DashboardLayout

- Sidebar + `SidebarInset` pattern stays
- Content area: `--surface-1` background, `padding: --space-6`
- Overflow: `overflow-y-auto` on content area
- Dashboard page (globe) will use negative margin to go full-bleed as today

---

## 4. Page Rewrites

Every page gets rewritten using the new primitives. Key changes per page:

### 4.1 Login Page

- Centered card on `--surface-0` background
- SMA logo prominent at top
- Form with tokenized inputs (--surface-3 bg, --border-secondary)
- Blue primary button, full width
- Subtle animated entrance (motion: fade + slide up)

### 4.2 Dashboard Page

- Globe remains as full-bleed background with `isolate`
- **Bottom overlay redesigned**:
  - Stat cards row at very top of overlay (4 KPIs: Active Flights, Pending PIREPs, Fleet Health, Monthly Revenue) — semi-transparent `Surface` cards
  - Recent Flights table below stats in a `Surface` panel
  - Active Flights sidebar panel (conditional, emerald accent)
- **Motion**: Staggered reveal on page load — stats slide up first, then panels

### 4.3 Dispatch Board Page

- 3-panel layout stays but with tokenized colors
- FlightListPanel: `--surface-0` bg, better row styling
- FlightMap: Dark tile layer, better controls
- FlightDetailPanel: Uses `DataRow` and `SectionHeader` primitives
- Connection status uses tokenized accent colors

### 4.4 Users Page

- PageShell with 4 StatCards (Total, Active, Admins, Dispatchers)
- DataTable with new styling (hover bars, better badges)
- DetailPanel uses DataRow + SectionHeader grouping
- Role badges use StatusBadge with appropriate colors
- Create/Edit dialogs use tokenized form styling

### 4.5 Schedules Page

- Same pattern as Users but schedule-specific stats
- DataTable with route display (ICAO codes in mono, colored)
- Enabled/Disabled toggle more prominent
- Days-of-week display as small pill badges

### 4.6 PIREPs Page

- Tabs restyled with better active indicator
- Stats row: Total, Pending (amber), Approved (emerald), Rejected (red)
- DataTable: landing rate color coding, route display
- DetailPanel: organized sections (Flight Info, Performance, Fuel, Load, Score, OOOI, Review)
- Review form in detail panel footer (sticky)
- Bulk action bar appears when rows selected

### 4.7 Maintenance Page

- Tab navigation for check types
- DataTable per tab with overdue highlighting (red accent)
- Component tracking with category icons
- MEL deferrals with severity badges

### 4.8 Finances Page

- Stats: Revenue, Costs, Profit, Pilot Pay
- Transaction table with type badges (income=emerald, expense=red, bonus=cyan)
- Charts section using recharts with tokenized colors

### 4.9 Reports Page

- Chart-focused layout
- Each report in a Surface card
- Recharts styled with token colors
- Date range selector in PageShell actions

### 4.10 Notifications Page

- Compose card: Type buttons use accent colors, message textarea, target selector
- History table: Type badges, target display, timestamps

### 4.11 Audit Page

- Filterable log table
- Action badges (Create=emerald, Update=blue, Delete=red)
- Expandable rows showing before/after data diffs

### 4.12 Settings Page

- Grouped sections using SectionHeader
- Each setting in a DataRow-like layout
- Toggle switches for booleans
- Input fields for values
- Save button per section or global save

---

## 5. Motion & Animation Strategy

Using `motion` library for:

1. **Page transitions**: Content fades in with slight upward slide on route change
2. **Staggered reveals**: StatCards, table rows appear in sequence on page load
3. **Panel slides**: DetailPanel slides from right with spring physics
4. **Hover micro-interactions**: Cards lift slightly, buttons scale
5. **Number counting**: KPI values animate from 0 to actual value on first load
6. **List reordering**: Active flights list animates when order changes

CSS-only for:
- Hover backgrounds/borders (instant, no JS needed)
- Focus rings
- Skeleton shimmer
- Sidebar collapse transition

---

## 6. Files Changed/Created

### New Files
- `admin/src/styles/tokens.css`
- `admin/src/components/primitives/Surface.tsx`
- `admin/src/components/primitives/StatCard.tsx`
- `admin/src/components/primitives/StatusBadge.tsx`
- `admin/src/components/primitives/SectionHeader.tsx`
- `admin/src/components/primitives/DataRow.tsx`
- `admin/src/components/primitives/MetricDisplay.tsx`
- `admin/src/components/primitives/index.ts` (barrel export)

### Rewritten Files (every page + layout)
- `admin/src/styles/globals.css` (simplified, imports tokens.css)
- `admin/src/components/layout/AppSidebar.tsx`
- `admin/src/components/layout/TopBar.tsx`
- `admin/src/components/layout/DashboardLayout.tsx`
- `admin/src/components/shared/PageShell.tsx`
- `admin/src/components/shared/DataTable.tsx`
- `admin/src/components/shared/DetailPanel.tsx`
- `admin/src/pages/LoginPage.tsx`
- `admin/src/pages/DashboardPage.tsx`
- `admin/src/pages/DispatchBoardPage.tsx`
- `admin/src/pages/UsersPage.tsx`
- `admin/src/pages/SchedulesPage.tsx`
- `admin/src/pages/PirepsPage.tsx`
- `admin/src/pages/MaintenancePage.tsx`
- `admin/src/pages/FinancesPage.tsx`
- `admin/src/pages/ReportsPage.tsx`
- `admin/src/pages/NotificationsPage.tsx`
- `admin/src/pages/AuditPage.tsx`
- `admin/src/pages/SettingsPage.tsx`

### Updated Files
- `admin/package.json` (add motion dependency)
- `admin/src/index.html` (verify font loading)
- `admin/tailwind.config.ts` (wire tokens if needed)
- `admin/src/App.tsx` (page transition wrapper)

### Deleted Files
- `admin/src/components/widgets/StatCard.tsx` (replaced by primitive)
- Any orphaned/unused components discovered during rewrite
