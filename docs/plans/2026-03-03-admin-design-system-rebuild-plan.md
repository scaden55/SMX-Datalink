# Admin Design System Rebuild — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ground-up redesign of the admin panel's frontend — new token-based design system, component primitives, layout shell, and full page rewrites for all 12 pages.

**Architecture:** A `tokens.css` file is the single source of truth for all visual constants (colors, typography, spacing, elevation). New component primitives (`Surface`, `StatCard`, `StatusBadge`, `SectionHeader`, `DataRow`, `MetricDisplay`) replace raw div+tailwind patterns. Every layout component and page is rewritten from scratch using these primitives. Motion library provides orchestrated animations.

**Tech Stack:** React 19, Tailwind CSS 3.4, motion (framer-motion), shadcn/ui, Phosphor Icons, TanStack Table, Recharts, Socket.io

**Design doc:** `docs/plans/2026-03-03-admin-design-system-rebuild-design.md`

---

## Phase 1: Foundation (Tokens + Dependencies)

### Task 1: Install motion dependency

**Files:**
- Modify: `admin/package.json`

**Steps:**
1. Run: `cd admin && npm install motion`
2. Verify: `npm ls motion` shows installed version

**Commit:** `chore(admin): add motion library for page transitions and animations`

---

### Task 2: Create design tokens file

**Files:**
- Create: `admin/src/styles/tokens.css`

Create the complete token file with all CSS custom properties organized by category. This is the single source of truth — no raw hex values in components after this.

```css
/* ═══════════════════════════════════════════════════════════
   SMA ACARS Admin — Design Tokens
   Single source of truth for all visual constants.
   ═══════════════════════════════════════════════════════════ */

:root {
  /* ── Surface Colors (4-tier depth system) ─────────────── */
  --surface-0: #0a0d14;    /* Deepest — sidebar, table headers, footers */
  --surface-1: #0f1219;    /* Content area background */
  --surface-2: #151a24;    /* Cards, panels, elevated surfaces */
  --surface-3: #1c2230;    /* Hover states, active rows, inputs */

  /* ── Text Hierarchy ───────────────────────────────────── */
  --text-primary: #f0f1f3;     /* Titles, values, critical data */
  --text-secondary: #c4c7ce;   /* Body text, descriptions */
  --text-tertiary: #7a7f8e;    /* Labels, timestamps, column headers */
  --text-quaternary: #4a4f5e;  /* Disabled, placeholders, decorative */

  /* ── Semantic Accent Colors ───────────────────────────── */
  --accent-blue: #3b82f6;
  --accent-blue-bg: rgba(59, 130, 246, 0.12);
  --accent-blue-ring: rgba(59, 130, 246, 0.25);

  --accent-emerald: #10b981;
  --accent-emerald-bg: rgba(16, 185, 129, 0.12);
  --accent-emerald-ring: rgba(16, 185, 129, 0.25);

  --accent-amber: #f59e0b;
  --accent-amber-bg: rgba(245, 158, 11, 0.12);
  --accent-amber-ring: rgba(245, 158, 11, 0.25);

  --accent-red: #ef4444;
  --accent-red-bg: rgba(239, 68, 68, 0.12);
  --accent-red-ring: rgba(239, 68, 68, 0.25);

  --accent-cyan: #06b6d4;
  --accent-cyan-bg: rgba(6, 182, 212, 0.12);
  --accent-cyan-ring: rgba(6, 182, 212, 0.25);

  /* ── Border System ────────────────────────────────────── */
  --border-primary: #1e2535;
  --border-secondary: #2a3040;
  --border-hover: #3a4050;

  /* ── Elevation (Shadows) ──────────────────────────────── */
  --elevation-0: none;
  --elevation-1: 0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2);
  --elevation-2: 0 4px 12px rgba(0, 0, 0, 0.4);
  --elevation-3: 0 8px 24px rgba(0, 0, 0, 0.5);

  /* ── Typography ───────────────────────────────────────── */
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'IBM Plex Mono', 'Menlo', monospace;

  --text-display-size: 24px;
  --text-heading-size: 16px;
  --text-subheading-size: 11px;
  --text-body-size: 13px;
  --text-caption-size: 11px;
  --text-data-size: 13px;
  --text-data-sm-size: 11px;
  --text-data-lg-size: 20px;

  /* ── Spacing Scale ────────────────────────────────────── */
  --space-0: 0;
  --space-0\.5: 2px;
  --space-1: 4px;
  --space-1\.5: 6px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* ── Border Radius ────────────────────────────────────── */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-full: 9999px;

  /* ── Animation ────────────────────────────────────────── */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.45, 0, 0.55, 1);
  --duration-fast: 120ms;
  --duration-normal: 200ms;
  --duration-slow: 350ms;

  /* ── Z-Index Scale ────────────────────────────────────── */
  --z-base: 0;
  --z-dropdown: 50;
  --z-sticky: 100;
  --z-overlay: 200;
  --z-modal: 300;
  --z-toast: 400;
}
```

**Commit:** `feat(admin): add design tokens CSS — single source of truth for all visual constants`

---

### Task 3: Rewrite globals.css to consume tokens

**Files:**
- Rewrite: `admin/src/styles/globals.css`

Simplify globals.css — import tokens, update the dark theme CSS variables to reference tokens, keep Leaflet overrides.

The key changes:
- Import `tokens.css` at the top
- Wire the shadcn HSL variables (`--background`, `--foreground`, etc.) to use token values for compatibility
- Remove any raw hex values that now live in tokens
- Keep Leaflet dark theme overrides but reference tokens
- Keep `@tailwind` directives

```css
@import './tokens.css';
@import 'leaflet/dist/leaflet.css';

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --radius: 0.5rem;
    --sidebar-background: 0 0% 98%;
    --sidebar-foreground: 240 5.3% 26.1%;
    --sidebar-primary: 240 5.9% 10%;
    --sidebar-primary-foreground: 0 0% 98%;
    --sidebar-accent: 240 4.8% 95.9%;
    --sidebar-accent-foreground: 240 5.9% 10%;
    --sidebar-border: 220 13% 91%;
    --sidebar-ring: 217.2 91.2% 59.8%;
  }

  .dark {
    /* Map shadcn HSL variables for component compatibility */
    --background: 222 30% 7%;        /* maps to --surface-1 */
    --foreground: 220 10% 95%;       /* maps to --text-primary */
    --card: 220 24% 11%;             /* maps to --surface-2 */
    --card-foreground: 220 10% 95%;
    --popover: 220 24% 11%;
    --popover-foreground: 220 10% 95%;

    --primary: 217 91% 60%;          /* --accent-blue */
    --primary-foreground: 0 0% 100%;

    --secondary: 220 18% 13%;
    --secondary-foreground: 220 10% 95%;

    --muted: 220 16% 14%;
    --muted-foreground: 225 8% 50%;

    --accent: 220 18% 13%;
    --accent-foreground: 220 10% 95%;

    --destructive: 0 84% 60%;        /* --accent-red */
    --destructive-foreground: 0 0% 100%;

    --border: 220 16% 16%;           /* --border-primary approx in HSL */
    --input: 220 18% 13%;
    --ring: 217 91% 60%;

    /* Sidebar */
    --sidebar-background: 222 30% 5%;
    --sidebar-foreground: 240 4.8% 95.9%;
    --sidebar-primary: 217 91% 60%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 220 16% 14%;
    --sidebar-accent-foreground: 240 4.8% 95.9%;
    --sidebar-border: 220 16% 14%;
    --sidebar-ring: 217 91% 60%;
  }

  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground font-sans antialiased;
    min-height: 100vh;
    background-color: var(--surface-1);
    color: var(--text-primary);
  }
}

/* ── Leaflet dark theme overrides ────────────────────── */
.aircraft-tooltip {
  background: var(--surface-0) !important;
  border: 1px solid var(--border-primary) !important;
  color: var(--text-primary) !important;
  font-family: var(--font-mono);
  font-size: var(--text-data-sm-size);
  font-weight: 600;
  padding: 2px 6px !important;
  border-radius: var(--radius-sm) !important;
  box-shadow: var(--elevation-2) !important;
}
.aircraft-tooltip::before {
  border-top-color: var(--surface-0) !important;
}
.leaflet-control-zoom a {
  background: var(--surface-2) !important;
  color: var(--text-primary) !important;
  border-color: var(--border-primary) !important;
}
.leaflet-control-zoom a:hover {
  background: var(--surface-3) !important;
}

/* ── Scrollbar styling ──────────────────────────────── */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--border-secondary);
  border-radius: var(--radius-full);
}
::-webkit-scrollbar-thumb:hover {
  background: var(--border-hover);
}
```

**Commit:** `refactor(admin): wire globals.css to design tokens, add scrollbar styling`

---

## Phase 2: Component Primitives

### Task 4: Create Surface primitive

**Files:**
- Create: `admin/src/components/primitives/Surface.tsx`

The `Surface` component replaces all raw `div + bg-[#1c2033]` card patterns. It provides:
- 3 elevation levels (background tiers + optional shadow)
- Optional colored left accent border
- Configurable padding
- Forwards className and all div props

```tsx
import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Accent = 'blue' | 'emerald' | 'amber' | 'red' | 'cyan';
type Elevation = 0 | 1 | 2 | 3;
type Padding = 'none' | 'compact' | 'default' | 'spacious';

interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: Elevation;
  accent?: Accent;
  padding?: Padding;
}

const elevationStyles: Record<Elevation, string> = {
  0: '',
  1: 'border border-[var(--border-primary)]',
  2: 'border border-[var(--border-primary)] shadow-[var(--elevation-1)]',
  3: 'border border-[var(--border-primary)] shadow-[var(--elevation-2)]',
};

const bgStyles: Record<Elevation, string> = {
  0: 'bg-[var(--surface-0)]',
  1: 'bg-[var(--surface-2)]',
  2: 'bg-[var(--surface-2)]',
  3: 'bg-[var(--surface-3)]',
};

const paddingStyles: Record<Padding, string> = {
  none: '',
  compact: 'p-3',
  default: 'p-4',
  spacious: 'p-6',
};

const accentBorder: Record<Accent, string> = {
  blue: 'border-l-[3px] border-l-[var(--accent-blue)]',
  emerald: 'border-l-[3px] border-l-[var(--accent-emerald)]',
  amber: 'border-l-[3px] border-l-[var(--accent-amber)]',
  red: 'border-l-[3px] border-l-[var(--accent-red)]',
  cyan: 'border-l-[3px] border-l-[var(--accent-cyan)]',
};

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(
  ({ elevation = 1, accent, padding = 'default', className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-lg',
          bgStyles[elevation],
          elevationStyles[elevation],
          paddingStyles[padding],
          accent && accentBorder[accent],
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
Surface.displayName = 'Surface';
```

**Commit:** `feat(admin): add Surface primitive component`

---

### Task 5: Create StatCard primitive

**Files:**
- Create: `admin/src/components/primitives/StatCard.tsx`

KPI display card with icon, label, value, optional trend. Replaces the current `PageShell` inline stat cards and `widgets/StatCard.tsx`.

```tsx
import type { ComponentType } from 'react';
import type { IconProps } from '@phosphor-icons/react';
import { TrendUp, TrendDown } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

type Accent = 'blue' | 'emerald' | 'amber' | 'red' | 'cyan';

interface StatCardProps {
  icon: ComponentType<IconProps>;
  label: string;
  value: string | number;
  accent?: Accent;
  trend?: { value: number; direction: 'up' | 'down' };
  className?: string;
}

const iconBg: Record<Accent, string> = {
  blue: 'bg-[var(--accent-blue-bg)] text-[var(--accent-blue)]',
  emerald: 'bg-[var(--accent-emerald-bg)] text-[var(--accent-emerald)]',
  amber: 'bg-[var(--accent-amber-bg)] text-[var(--accent-amber)]',
  red: 'bg-[var(--accent-red-bg)] text-[var(--accent-red)]',
  cyan: 'bg-[var(--accent-cyan-bg)] text-[var(--accent-cyan)]',
};

export function StatCard({ icon: Icon, label, value, accent = 'blue', trend, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--border-primary)] bg-[var(--surface-2)] p-4',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn('flex items-center justify-center w-9 h-9 rounded-lg', iconBg[accent])}>
          <Icon size={18} weight="duotone" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            {label}
          </p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xl font-mono font-bold text-[var(--text-primary)]">
              {value}
            </span>
            {trend && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 text-xs font-medium',
                  trend.direction === 'up' ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-red)]',
                )}
              >
                {trend.direction === 'up' ? <TrendUp size={12} /> : <TrendDown size={12} />}
                {trend.value}%
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Commit:** `feat(admin): add StatCard primitive component`

---

### Task 6: Create StatusBadge primitive

**Files:**
- Create: `admin/src/components/primitives/StatusBadge.tsx`

Unified status indicator used across all pages (PIREPs, schedules, users, maintenance, etc.).

```tsx
import { cn } from '@/lib/utils';

type Status =
  | 'approved' | 'active' | 'completed' | 'published'
  | 'pending' | 'scheduled' | 'in_progress'
  | 'rejected' | 'suspended' | 'overdue' | 'critical'
  | 'info' | 'filed';

interface StatusBadgeProps {
  status: Status | string;
  label?: string;
  className?: string;
}

const statusConfig: Record<string, { bg: string; text: string; ring: string; label: string }> = {
  approved: { bg: 'bg-[var(--accent-emerald-bg)]', text: 'text-[var(--accent-emerald)]', ring: 'ring-[var(--accent-emerald-ring)]', label: 'Approved' },
  active: { bg: 'bg-[var(--accent-emerald-bg)]', text: 'text-[var(--accent-emerald)]', ring: 'ring-[var(--accent-emerald-ring)]', label: 'Active' },
  completed: { bg: 'bg-[var(--accent-blue-bg)]', text: 'text-[var(--accent-blue)]', ring: 'ring-[var(--accent-blue-ring)]', label: 'Completed' },
  published: { bg: 'bg-[var(--accent-blue-bg)]', text: 'text-[var(--accent-blue)]', ring: 'ring-[var(--accent-blue-ring)]', label: 'Published' },
  pending: { bg: 'bg-[var(--accent-amber-bg)]', text: 'text-[var(--accent-amber)]', ring: 'ring-[var(--accent-amber-ring)]', label: 'Pending' },
  scheduled: { bg: 'bg-[var(--accent-amber-bg)]', text: 'text-[var(--accent-amber)]', ring: 'ring-[var(--accent-amber-ring)]', label: 'Scheduled' },
  in_progress: { bg: 'bg-[var(--accent-cyan-bg)]', text: 'text-[var(--accent-cyan)]', ring: 'ring-[var(--accent-cyan-ring)]', label: 'In Progress' },
  rejected: { bg: 'bg-[var(--accent-red-bg)]', text: 'text-[var(--accent-red)]', ring: 'ring-[var(--accent-red-ring)]', label: 'Rejected' },
  suspended: { bg: 'bg-[var(--accent-red-bg)]', text: 'text-[var(--accent-red)]', ring: 'ring-[var(--accent-red-ring)]', label: 'Suspended' },
  overdue: { bg: 'bg-[var(--accent-red-bg)]', text: 'text-[var(--accent-red)]', ring: 'ring-[var(--accent-red-ring)]', label: 'Overdue' },
  critical: { bg: 'bg-[var(--accent-red-bg)]', text: 'text-[var(--accent-red)]', ring: 'ring-[var(--accent-red-ring)]', label: 'Critical' },
  info: { bg: 'bg-[var(--accent-cyan-bg)]', text: 'text-[var(--accent-cyan)]', ring: 'ring-[var(--accent-cyan-ring)]', label: 'Info' },
  filed: { bg: 'bg-[var(--accent-blue-bg)]', text: 'text-[var(--accent-blue)]', ring: 'ring-[var(--accent-blue-ring)]', label: 'Filed' },
};

const fallback = { bg: 'bg-[var(--accent-blue-bg)]', text: 'text-[var(--accent-blue)]', ring: 'ring-[var(--accent-blue-ring)]', label: '' };

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? fallback;
  const displayLabel = label ?? config.label ?? status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ring-1',
        config.bg, config.text, config.ring,
        className,
      )}
    >
      {displayLabel}
    </span>
  );
}
```

**Commit:** `feat(admin): add StatusBadge primitive component`

---

### Task 7: Create SectionHeader, DataRow, MetricDisplay primitives

**Files:**
- Create: `admin/src/components/primitives/SectionHeader.tsx`
- Create: `admin/src/components/primitives/DataRow.tsx`
- Create: `admin/src/components/primitives/MetricDisplay.tsx`
- Create: `admin/src/components/primitives/index.ts`

**SectionHeader** — groups content within pages and panels:
```tsx
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  title: string;
  count?: number;
  action?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, count, action, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between pb-2 mb-3 border-b border-[var(--border-primary)]', className)}>
      <div className="flex items-center gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          {title}
        </h3>
        {count != null && (
          <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-md bg-[var(--accent-blue-bg)] text-[var(--accent-blue)] text-[10px] font-semibold">
            {count}
          </span>
        )}
      </div>
      {action && <div className="text-[11px]">{action}</div>}
    </div>
  );
}
```

**DataRow** — key-value pair for detail panels:
```tsx
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DataRowProps {
  label: string;
  value: ReactNode;
  mono?: boolean;
  className?: string;
}

export function DataRow({ label, value, mono = false, className }: DataRowProps) {
  return (
    <div className={cn('flex items-center justify-between py-1.5', className)}>
      <span className="text-[12px] text-[var(--text-tertiary)] shrink-0">{label}</span>
      <span className={cn('text-[13px] text-[var(--text-primary)] text-right', mono && 'font-mono')}>
        {value}
      </span>
    </div>
  );
}
```

**MetricDisplay** — large number with context for dashboard widgets:
```tsx
import type { ComponentType } from 'react';
import type { IconProps } from '@phosphor-icons/react';
import { TrendUp, TrendDown } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface MetricDisplayProps {
  value: string | number;
  label: string;
  icon?: ComponentType<IconProps>;
  trend?: { value: number; direction: 'up' | 'down' };
  className?: string;
}

export function MetricDisplay({ value, label, icon: Icon, trend, className }: MetricDisplayProps) {
  return (
    <div className={cn('flex flex-col', className)}>
      {Icon && <Icon size={16} weight="duotone" className="text-[var(--text-tertiary)] mb-1" />}
      <span className="text-2xl font-mono font-bold text-[var(--text-primary)]">{value}</span>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-[11px] text-[var(--text-tertiary)]">{label}</span>
        {trend && (
          <span className={cn(
            'inline-flex items-center gap-0.5 text-[10px] font-medium',
            trend.direction === 'up' ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-red)]',
          )}>
            {trend.direction === 'up' ? <TrendUp size={10} /> : <TrendDown size={10} />}
            {trend.value}%
          </span>
        )}
      </div>
    </div>
  );
}
```

**Barrel export** (`index.ts`):
```ts
export { Surface } from './Surface';
export { StatCard } from './StatCard';
export { StatusBadge } from './StatusBadge';
export { SectionHeader } from './SectionHeader';
export { DataRow } from './DataRow';
export { MetricDisplay } from './MetricDisplay';
```

**Commit:** `feat(admin): add SectionHeader, DataRow, MetricDisplay primitives + barrel export`

---

### Task 8: Verify Phase 2 builds

**Steps:**
1. Run: `cd admin && npx tsc --noEmit`
2. Fix any type errors
3. Run: `cd admin && npx vite build` (or just verify dev server starts)

No commit needed — this is a verification checkpoint.

---

## Phase 3: Layout Shell

### Task 9: Rewrite DashboardLayout

**Files:**
- Rewrite: `admin/src/components/layout/DashboardLayout.tsx`

Changes: Use tokens for background, add subtle page transition wrapper.

```tsx
import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { TopBar } from './TopBar';

export function DashboardLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <TopBar />
        <div className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--surface-1)', padding: 'var(--space-6)' }}>
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

**Commit:** `refactor(admin): rewrite DashboardLayout with token-based styling`

---

### Task 10: Rewrite AppSidebar

**Files:**
- Rewrite: `admin/src/components/layout/AppSidebar.tsx`

Major changes from current (183 lines):
- **Operations pulse widget** at top showing active flights + pending PIREPs counts
- **Better section grouping** with 4 groups: OPERATIONS, MANAGEMENT, FLEET & FINANCE, SYSTEM
- **Colored notification dots** on nav items with pending work
- **Refined active state**: 3px blue left border + tinted background
- **Better footer** with role badge styling
- **All colors from tokens** — no raw hex values

The sidebar should fetch dashboard stats on mount for the operations pulse, and include a `Notifications` nav item with notification dot support. Keep the existing shadcn `Sidebar` component structure but completely rewrite the content.

Key structure:
1. SidebarHeader: Logo + "Operations Pulse" mini-card (active flights with green dot, pending PIREPs with amber dot)
2. SidebarContent: 4 nav groups with improved styling
3. SidebarFooter: User avatar + name + role badge
4. All NavLink active states use `[&]:bg-[var(--surface-3)]` + blue left border

The operations pulse should call `api.get('/api/admin/dashboard')` on mount and display `activeFlights` and `pendingPireps` values. These are already returned by the backend.

**Commit:** `refactor(admin): rewrite AppSidebar with operations pulse and token styling`

---

### Task 11: Rewrite TopBar

**Files:**
- Rewrite: `admin/src/components/layout/TopBar.tsx`

Changes:
- Add page title display (read from current route)
- Style search pill with token border
- Add socket connection status indicator (green/amber/red dot + label)
- Bottom border using token
- All colors from tokens

The connection status should read from `useSocketStore` — show green dot + "Live" when `connected`, amber + "Connecting" when `connecting`, and hide when neither (most pages don't use socket).

```tsx
// Use useLocation() to derive page title from pathname
const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/dispatch': 'Dispatch Board',
  '/users': 'Users',
  '/schedules': 'Schedules',
  '/pireps': 'PIREPs',
  '/maintenance': 'Maintenance',
  '/finances': 'Finances',
  '/reports': 'Reports',
  '/notifications': 'Notifications',
  '/audit': 'Audit Log',
  '/settings': 'Settings',
};
```

**Commit:** `refactor(admin): rewrite TopBar with page title, connection status, token styling`

---

### Task 12: Rewrite PageShell

**Files:**
- Rewrite: `admin/src/components/shared/PageShell.tsx`

Major changes:
- Use `StatCard` primitive instead of inline stat cards
- Display-size page title (24px, bold)
- Proper subtitle as description text
- Better spacing rhythm using token spacing
- Action buttons area with proper alignment
- Stats row using CSS grid with `StatCard` components
- Content area with proper overflow handling

The stats prop changes from `StatCard[]` to accepting `StatCard` primitive props:
```tsx
interface PageShellStat {
  icon: ComponentType<IconProps>;
  label: string;
  value: string | number;
  accent?: 'blue' | 'emerald' | 'amber' | 'red' | 'cyan';
  trend?: { value: number; direction: 'up' | 'down' };
}
```

**Commit:** `refactor(admin): rewrite PageShell with StatCard primitives and token styling`

---

### Task 13: Rewrite DataTable

**Files:**
- Rewrite: `admin/src/components/shared/DataTable.tsx`

Visual overhaul only — keep all TanStack Table logic identical:
- **Header row**: `var(--surface-0)` background, uppercase tracking labels, sticky
- **Row hover**: Subtle left blue accent bar (2px) appears + `var(--surface-3)` background
- **Selected row**: Blue-tinted background (`var(--accent-blue-bg)`) + persistent left accent
- **Row striping**: Alternate rows use `var(--surface-2)` vs transparent
- **Column visibility dropdown**: Token-styled
- **Empty state**: Center-aligned message with muted text
- **Loading skeleton**: Token colors
- **All borders**: Use `var(--border-primary)` instead of raw hex

The DataTable props interface stays the same. This is purely a visual upgrade.

**Commit:** `refactor(admin): rewrite DataTable with token styling and hover accent bars`

---

### Task 14: Rewrite DetailPanel

**Files:**
- Rewrite: `admin/src/components/shared/DetailPanel.tsx`

Changes:
- **Background**: `var(--surface-2)`
- **Sticky header**: Title + subtitle + close button, `var(--border-primary)` bottom border
- **Actions bar**: Below header, above scrollable content
- **Content area**: Scrollable, properly padded
- All colors from tokens

**Commit:** `refactor(admin): rewrite DetailPanel with token styling`

---

### Task 15: Verify Phase 3 builds + visual check

**Steps:**
1. Run: `cd admin && npx tsc --noEmit`
2. Run: `npm run dev:all` (or just `cd admin && npx vite --port 5174`)
3. Verify sidebar, topbar, and layout render correctly
4. Fix any visual issues

**Commit:** `fix(admin): resolve any build issues from layout rewrite`

---

## Phase 4: Page Rewrites

**Important notes for all page rewrites:**
- Every page uses `PageShell` for title/stats/actions
- Replace all `bg-[#hex]` with token references
- Replace all inline status badges with `StatusBadge` primitive
- Replace all inline stat cards with `StatCard` primitive
- Use `Surface` for card containers
- Use `SectionHeader` for section grouping in detail panels
- Use `DataRow` for key-value pairs in detail panels
- Keep ALL existing functionality (data fetching, socket subscriptions, forms, table columns, pagination, filtering)
- Keep all existing dialog/sheet components (just update their internal colors to use tokens)

### Task 16: Rewrite LoginPage

**Files:**
- Rewrite: `admin/src/pages/LoginPage.tsx`

Simplest page (112 lines). Ground-up redesign:
- Full-screen `var(--surface-0)` background
- Centered `Surface elevation={2}` card
- SMA logo prominent at top
- Form with token-styled inputs (`var(--surface-3)` bg, `var(--border-secondary)` border)
- Blue primary button, full width
- Error message with red accent
- Subtle entrance animation via motion (`AnimatePresence` + `motion.div` with fade + slide up)

**Commit:** `refactor(admin): rewrite LoginPage with tokens and motion entrance`

---

### Task 17: Rewrite DashboardPage

**Files:**
- Rewrite: `admin/src/pages/DashboardPage.tsx`

The dashboard is the most visually important page. Rewrite with:
- Globe stays as full-bleed background (keep `isolate` stacking context fix)
- **Bottom overlay redesigned**: Semi-transparent `Surface` panels
- **Stat cards row** at top of overlay: 4 KPIs from dashboard API (Active Flights, Pending PIREPs, Fleet Health, Monthly Revenue)
- **Recent Flights panel** below stats with improved table styling (token colors, colored route ICAOs, StatusBadge for status, color-coded landing rates)
- **Active Flights panel** on right (conditional), emerald accent, flight cards with better styling
- All token colors, no raw hex
- Motion: staggered reveal on load (stats appear first, then panels)

The dashboard data fetch already returns `activeFlights`, `pendingPireps`, `fleetHealthPct`, `monthlyRevenue` — use these for the stat cards.

Helper functions (`timeAgo`, `statusBadge`, `phaseBadge`, `landingRateColor`) should use tokens. Replace inline `statusBadge` and `phaseBadge` functions with `StatusBadge` primitive.

**Commit:** `refactor(admin): rewrite DashboardPage with stat cards, tokens, and motion reveals`

---

### Task 18: Rewrite UsersPage

**Files:**
- Rewrite: `admin/src/pages/UsersPage.tsx` (585 lines)

Changes:
- PageShell with 4 `StatCard` (Total Users/blue, Active Pilots/emerald, Admins/red, Dispatchers/cyan)
- Role badges → `StatusBadge` with appropriate mapping (admin=red-ish, dispatcher=blue, pilot=emerald)
- Status badges → `StatusBadge` (active=emerald, suspended=red)
- DataTable with new styling (from Task 13)
- Detail panel using `SectionHeader` + `DataRow` primitives for user info sections
- Search/filter bar with token-styled inputs
- Token colors throughout, no raw hex
- Keep all existing CRUD operations (create/edit/suspend/delete dialogs)

Also update dialog components to use tokens:
- Modify: `admin/src/components/dialogs/CreateUserDialog.tsx`
- Modify: `admin/src/components/dialogs/EditUserDialog.tsx`

**Commit:** `refactor(admin): rewrite UsersPage with primitives and token styling`

---

### Task 19: Rewrite PirepsPage

**Files:**
- Rewrite: `admin/src/pages/PirepsPage.tsx` (971 lines)

Changes:
- PageShell with 4 `StatCard` (Total PIREPs/blue, Pending/amber, Approved/emerald, Rejected/red)
- Status tabs with better styling — active tab indicator using accent color
- Status badges → `StatusBadge` primitive
- DataTable columns: flight number (mono), route (blue dep → cyan arr), landing rate (color-coded), time (caption text), status badge
- Detail panel sections using `SectionHeader` + `DataRow`:
  - FLIGHT INFO: route, airports, aircraft, cruise alt
  - PERFORMANCE: landing rate (with color), flight time, block time, distance
  - FUEL: used, planned, variance
  - LOAD: cargo (lbs), passengers
  - SCORE: 0-100 with color coding
  - OOOI: OUT/OFF/ON/IN timestamps
  - REVIEW HISTORY: past reviews
  - REVIEW FORM: sticky at bottom for pending PIREPs
- Keep all review workflow (single approve/reject, bulk approve/reject)
- Token colors throughout

Also update the PIREP detail panel:
- Modify: `admin/src/components/panels/PirepDetailPanel.tsx` (531 lines) — rewrite with primitives

**Commit:** `refactor(admin): rewrite PirepsPage with primitives and token styling`

---

### Task 20: Rewrite SchedulesPage

**Files:**
- Rewrite: `admin/src/pages/SchedulesPage.tsx` (1241 lines)

Changes:
- PageShell with schedule-specific stats
- DataTable: flight number (mono), route display (blue ICAO → cyan ICAO), aircraft type, time display, days-of-week as small pill badges, enabled/disabled toggle
- Status → `StatusBadge`
- Detail/edit panel using `SectionHeader` + `DataRow`
- Token colors throughout
- Keep all existing functionality (create, edit, clone, toggle, delete, bulk ops)

Also update:
- Modify: `admin/src/components/dialogs/ScheduleFormSheet.tsx` (409 lines) — token styling

**Commit:** `refactor(admin): rewrite SchedulesPage with primitives and token styling`

---

### Task 21: Rewrite DispatchBoardPage + dispatch components

**Files:**
- Rewrite: `admin/src/pages/DispatchBoardPage.tsx` (156 lines)
- Rewrite: `admin/src/components/dispatch/FlightListPanel.tsx` (93 lines)
- Rewrite: `admin/src/components/dispatch/FlightDetailPanel.tsx` (152 lines)
- Rewrite: `admin/src/components/dispatch/FlightMap.tsx` (154 lines)
- Rewrite: `admin/src/components/dispatch/AcarsChat.tsx` (120 lines)

Changes:
- 3-panel layout with token backgrounds (surface-0 for list, surface-1 for map area, surface-2 for detail)
- FlightListPanel: better row styling with hover, phase badges via `StatusBadge`, connection indicator
- FlightDetailPanel: `SectionHeader` + `DataRow` for telemetry sections, ACARS chat below
- FlightMap: Dark tile layer maintained, token colors for markers/controls
- AcarsChat: Token-styled message bubbles and input
- Keep all socket subscriptions and real-time logic

**Commit:** `refactor(admin): rewrite DispatchBoardPage + dispatch components with tokens`

---

### Task 22: Rewrite MaintenancePage

**Files:**
- Rewrite: `admin/src/pages/MaintenancePage.tsx` (2868 lines)

This is the largest page. Changes:
- Tab navigation with token-styled active indicator
- Per-tab DataTable with overdue highlighting (red accent border on overdue rows)
- Status badges → `StatusBadge` (scheduled=amber, in_progress=cyan, completed=blue, overdue=red)
- Component tracking cards using `Surface` with category-specific accent colors
- MEL deferrals with severity badges (A=red/critical, B=amber/high, C/D=blue/medium)
- All stat cards via `StatCard` primitive
- Detail panels via `SectionHeader` + `DataRow`
- Token colors throughout
- Keep all existing CRUD operations and tab logic

**Commit:** `refactor(admin): rewrite MaintenancePage with primitives and token styling`

---

### Task 23: Rewrite FinancesPage

**Files:**
- Rewrite: `admin/src/pages/FinancesPage.tsx` (1870 lines)

Changes:
- PageShell with finance stats (Revenue/emerald, Costs/red, Profit/blue, Pilot Pay/cyan)
- Transaction type badges → `StatusBadge` (income=emerald, expense=red, bonus=cyan, deduction=amber)
- DataTable with token styling
- Charts: restyle recharts with token accent colors for bars/areas/lines
- Detail panel with `SectionHeader` + `DataRow` for transaction details
- Token colors throughout
- Keep all financial operations

**Commit:** `refactor(admin): rewrite FinancesPage with primitives and token styling`

---

### Task 24: Rewrite ReportsPage

**Files:**
- Rewrite: `admin/src/pages/ReportsPage.tsx` (1162 lines)

Changes:
- Chart containers using `Surface` cards
- Recharts styled with token accent colors:
  - `var(--accent-blue)` for primary data series
  - `var(--accent-emerald)` for positive/success metrics
  - `var(--accent-amber)` for warning thresholds
  - `var(--accent-red)` for negative metrics
  - `var(--accent-cyan)` for secondary series
- Custom tooltip styling with token backgrounds/text
- Date range selector with token-styled inputs
- Token colors throughout
- Keep all chart types and data fetching

**Commit:** `refactor(admin): rewrite ReportsPage with token-styled charts`

---

### Task 25: Rewrite NotificationsPage

**Files:**
- Rewrite: `admin/src/pages/NotificationsPage.tsx` (551 lines)

Changes:
- Compose card using `Surface elevation={2}`
- Type selector buttons with accent colors (info=cyan, success=emerald, warning=amber, error=red)
- Message textarea with token styling
- Target selector with token-styled inputs
- History table with `StatusBadge` for notification types
- Token colors throughout
- Keep all send/history functionality

**Commit:** `refactor(admin): rewrite NotificationsPage with tokens`

---

### Task 26: Rewrite AuditPage

**Files:**
- Rewrite: `admin/src/pages/AuditPage.tsx` (564 lines)

Changes:
- Filter dropdowns with token styling
- Action badges → `StatusBadge` (Create=emerald, Update=blue, Delete=red, Approved=emerald, Rejected=red)
- DataTable with token styling
- Date range filter with token-styled inputs
- Token colors throughout
- Keep all filtering and pagination

**Commit:** `refactor(admin): rewrite AuditPage with tokens`

---

### Task 27: Rewrite SettingsPage

**Files:**
- Rewrite: `admin/src/pages/SettingsPage.tsx` (310 lines)

Changes:
- Each settings group in a `Surface elevation={1}` card
- `SectionHeader` for each group title (Airline Info, Finance, Booking, PIREP, System)
- Settings rows using `DataRow`-like layout with labels and inputs
- Toggle switches with token accent color
- Save buttons with primary blue styling
- Token colors throughout
- Keep all settings save logic

**Commit:** `refactor(admin): rewrite SettingsPage with Surface cards and tokens`

---

## Phase 5: App-Level Polish

### Task 28: Update App.tsx for page transitions + Toaster styling

**Files:**
- Modify: `admin/src/App.tsx`

Changes:
- Update Toaster style to use tokens: `background: var(--surface-2)`, `border: 1px solid var(--border-primary)`, `color: var(--text-primary)`
- Optionally add `AnimatePresence` wrapper around `Routes` for page transitions (if motion is installed)

**Commit:** `refactor(admin): update App.tsx Toaster styling with tokens`

---

### Task 29: Clean up deleted/orphaned files

**Files:**
- Delete: `admin/src/components/widgets/StatCard.tsx` (replaced by primitive)
- Delete: `admin/src/components/dashboard/OperationsPanel.tsx` (unused)
- Delete: `admin/src/components/dashboard/PilotsPanel.tsx` (unused)
- Delete: `admin/src/components/dashboard/FinancePanel.tsx` (unused)
- Delete: `admin/src/components/dashboard/FleetPanel.tsx` (unused)
- Check if `admin/src/components/panels/PirepDetailPanel.tsx` is still used or if it was merged into PirepsPage — delete if orphaned

**Steps:**
1. Search for imports of each file
2. Delete orphaned files
3. Verify build still passes

**Commit:** `chore(admin): remove orphaned components replaced by design system primitives`

---

### Task 30: Final build verification and visual walkthrough

**Steps:**
1. Run: `cd admin && npx tsc --noEmit` — zero errors
2. Run: `npm run dev:all`
3. Walk through every page and verify:
   - Login page renders correctly
   - Dashboard globe + overlay panels render
   - All 10 authenticated pages render without errors
   - Sidebar navigation works, active states correct
   - DataTable sorting/selection works on Users, PIREPs, Schedules
   - Detail panels open/close correctly
   - Command palette (Ctrl+K) works
   - Socket connection indicator shows on Dispatch Board
4. Fix any visual/functional regressions

**Commit:** `fix(admin): resolve any regressions from design system rebuild`

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-3 | Foundation — dependency, tokens, globals |
| 2 | 4-8 | Primitives — Surface, StatCard, StatusBadge, SectionHeader, DataRow, MetricDisplay |
| 3 | 9-15 | Layout — DashboardLayout, AppSidebar, TopBar, PageShell, DataTable, DetailPanel |
| 4 | 16-27 | Pages — all 12 pages rewritten |
| 5 | 28-30 | Polish — App.tsx, cleanup, final verification |

**Total: 30 tasks across 5 phases.**

Each task is a single commit. Phases should be executed sequentially (later phases depend on earlier ones). Within Phase 4, pages can be done in any order, but the listed order starts with simplest (Login) and progresses to most complex (Maintenance), which is recommended for building momentum.
