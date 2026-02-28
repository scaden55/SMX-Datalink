# Admin Frontend Website — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a standalone admin/dispatcher web app served at `/admin` on the VPS, with an AirlineSim-inspired dark dashboard design and 11 pages.

**Architecture:** New `admin/` workspace in the npm monorepo. Vite 6 + React 19 + Zustand 5 + Tailwind CSS + shadcn/ui. Shares `@acars/shared` types. Backend serves static files at `/admin` subpath. Same JWT auth flow.

**Tech Stack:** TypeScript, React 19, React Router 7, Zustand 5, Tailwind 3.4, shadcn/ui (New York), Recharts, Leaflet, Phosphor Icons, Socket.io client

**Design Reference:** `docs/plans/2026-02-28-admin-frontend-design.md`

---

## Phase 1: Project Scaffolding (Tasks 1-5)

### Task 1: Create admin workspace and package.json

**Files:**
- Create: `admin/package.json`

**Step 1:** Create `admin/package.json`:

```json
{
  "name": "@acars/admin",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@phosphor-icons/react": "^2.1.10",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "leaflet": "^1.9.4",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-leaflet": "^5.0.0",
    "react-router-dom": "^7.13.0",
    "recharts": "^3.7.0",
    "socket.io-client": "^4.8.1",
    "tailwind-merge": "^3.5.0",
    "tailwindcss-animate": "^1.0.7",
    "zustand": "^5.0.3"
  },
  "devDependencies": {
    "@types/leaflet": "^1.9.17",
    "@types/node": "^22.12.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.5.1",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.3",
    "vite": "^6.1.0"
  }
}
```

**Step 2:** Add `"admin"` to root `package.json` workspaces array:

```json
"workspaces": ["shared", "backend", "frontend", "electron", "admin"]
```

**Step 3:** Run `npm install` from root to link the new workspace.

**Step 4:** Commit: `chore(admin): scaffold admin workspace`

---

### Task 2: Create TypeScript, Vite, Tailwind, and PostCSS configs

**Files:**
- Create: `admin/tsconfig.json`
- Create: `admin/tsconfig.node.json`
- Create: `admin/vite.config.ts`
- Create: `admin/tailwind.config.ts`
- Create: `admin/postcss.config.js`

**Step 1:** Create `admin/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

**Step 2:** Create `admin/tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "noEmit": true
  },
  "include": ["vite.config.ts"]
}
```

**Step 3:** Create `admin/vite.config.ts`:

```typescript
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, 'VITE_');
  const backendTarget = env.VITE_API_BASE || 'http://localhost:3001';

  return {
    base: '/admin/',
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      outDir: 'dist',
    },
    server: {
      host: true,
      port: 5174,
      proxy: {
        '/api': { target: backendTarget, changeOrigin: true },
        '/socket.io': { target: backendTarget, changeOrigin: true, ws: true },
      },
    },
  };
});
```

**Step 4:** Create `admin/tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss';
import tailwindAnimate from 'tailwindcss-animate';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#06b6d4',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [tailwindAnimate],
} satisfies Config;
```

**Step 5:** Create `admin/postcss.config.js`:

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**Step 6:** Commit: `chore(admin): add TypeScript, Vite, Tailwind configs`

---

### Task 3: Create entry files and globals CSS with dark theme

**Files:**
- Create: `admin/index.html`
- Create: `admin/src/main.tsx`
- Create: `admin/src/App.tsx`
- Create: `admin/src/styles/globals.css`
- Create: `admin/src/vite-env.d.ts`

**Step 1:** Create `admin/index.html`:

```html
<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SMA ACARS — Admin</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 2:** Create `admin/src/styles/globals.css` with the full dark theme:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --radius: 0.5rem;
  }

  .dark {
    /* Backgrounds */
    --background: 228 15% 7%;        /* #0f1117 */
    --foreground: 220 10% 92%;       /* #e8eaed */
    --card: 228 22% 14%;             /* #1a1d2e */
    --card-foreground: 220 10% 92%;
    --popover: 228 22% 14%;
    --popover-foreground: 220 10% 92%;

    /* Primary (blue accent) */
    --primary: 217 91% 60%;          /* #3b82f6 */
    --primary-foreground: 0 0% 100%;

    /* Secondary */
    --secondary: 228 18% 18%;        /* #232738 */
    --secondary-foreground: 220 10% 92%;

    /* Muted */
    --muted: 228 18% 18%;
    --muted-foreground: 228 8% 55%;  /* #8b8fa3 */

    /* Accent */
    --accent: 228 18% 18%;
    --accent-foreground: 220 10% 92%;

    /* Destructive */
    --destructive: 0 84% 60%;        /* #ef4444 */
    --destructive-foreground: 0 0% 100%;

    /* Borders & Input */
    --border: 228 16% 20%;           /* #2a2e3f */
    --input: 228 18% 18%;            /* #232738 */
    --ring: 217 91% 60%;             /* #3b82f6 */

    /* Sidebar */
    --sidebar-background: 228 18% 10%;  /* #151823 */
    --sidebar-foreground: 228 8% 55%;
    --sidebar-primary: 217 91% 60%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 228 18% 15%;
    --sidebar-accent-foreground: 220 10% 92%;
    --sidebar-border: 228 16% 20%;
    --sidebar-ring: 217 91% 60%;
  }

  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground font-sans antialiased;
    min-height: 100vh;
  }
}
```

**Step 3:** Create `admin/src/vite-env.d.ts`:

```typescript
/// <reference types="vite/client" />
```

**Step 4:** Create `admin/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

**Step 5:** Create `admin/src/App.tsx` (minimal router shell):

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

function Placeholder({ name }: { name: string }) {
  return (
    <div className="flex h-screen items-center justify-center">
      <h1 className="text-2xl font-semibold text-foreground">{name}</h1>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter basename="/admin">
      <Routes>
        <Route path="/login" element={<Placeholder name="Login" />} />
        <Route path="/" element={<Placeholder name="Dashboard" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

**Step 6:** Verify dev server starts: `npm run dev -w admin` → opens on port 5174, shows "Dashboard" text with dark background.

**Step 7:** Commit: `feat(admin): add entry files and dark theme CSS`

---

### Task 4: Initialize shadcn/ui and install core components

**Files:**
- Create: `admin/components.json`
- Create: `admin/src/lib/utils.ts`
- Generate: shadcn/ui components into `admin/src/components/ui/`

**Step 1:** Create `admin/components.json`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/styles/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "hooks": "@/hooks"
  }
}
```

**Step 2:** Create `admin/src/lib/utils.ts`:

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Step 3:** Install shadcn/ui components (run from `admin/` directory):

```bash
cd admin
npx shadcn@latest add button card dialog dropdown-menu input label select separator sheet sidebar table tabs tooltip badge avatar scroll-area skeleton
```

This generates all component files into `admin/src/components/ui/`.

**Step 4:** Verify build: `npm run build -w admin` — should compile and produce `admin/dist/`.

**Step 5:** Commit: `feat(admin): initialize shadcn/ui with core components`

---

### Task 5: Add shared stores, API client, and lib

**Files:**
- Create: `admin/src/lib/api.ts`
- Create: `admin/src/stores/authStore.ts`
- Create: `admin/src/stores/toastStore.ts`
- Create: `admin/src/stores/sidebarStore.ts`
- Create: `admin/src/components/ToastContainer.tsx`

**Step 1:** Create `admin/src/lib/api.ts` (simplified — no Electron detection):

```typescript
const DEV_BACKEND = 'http://localhost:3001';

// In production, admin is served from the same origin as the backend
// so relative URLs work. In dev, proxy handles it too.
const apiBase = '';

async function getAccessToken(): Promise<string | null> {
  const raw = localStorage.getItem('admin-auth');
  if (!raw) return null;
  try { return JSON.parse(raw).accessToken ?? null; } catch { return null; }
}

async function getRefreshToken(): Promise<string | null> {
  const raw = localStorage.getItem('admin-auth');
  if (!raw) return null;
  try { return JSON.parse(raw).refreshToken ?? null; } catch { return null; }
}

let refreshPromise: Promise<string | null> | null = null;

async function attemptRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return null;

    const res = await fetch(`${apiBase}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) return null;
    const data = await res.json();

    const raw = localStorage.getItem('admin-auth');
    if (raw) {
      const state = JSON.parse(raw);
      state.accessToken = data.accessToken;
      state.refreshToken = data.refreshToken;
      localStorage.setItem('admin-auth', JSON.stringify(state));
    }
    return data.accessToken;
  })();

  const result = await refreshPromise;
  refreshPromise = null;
  return result;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const accessToken = await getAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  let res = await fetch(`${apiBase}${url}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    const newToken = await attemptRefresh();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${apiBase}${url}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, data.message ?? res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body),
  put: <T>(url: string, body?: unknown) => request<T>('PUT', url, body),
  patch: <T>(url: string, body?: unknown) => request<T>('PATCH', url, body),
  delete: <T>(url: string, body?: unknown) => request<T>('DELETE', url, body),
};
```

**Step 2:** Create `admin/src/stores/authStore.ts`:

```typescript
import { create } from 'zustand';
import { api, ApiError } from '@/lib/api';

interface UserProfile {
  id: number;
  email: string;
  callsign: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'dispatcher' | 'pilot';
  rank: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isHydrating: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,
  isHydrating: true,

  login: async (email, password) => {
    const data = await api.post<{ accessToken: string; refreshToken: string; user: UserProfile }>(
      '/api/auth/login',
      { email, password },
    );

    if (data.user.role === 'pilot') {
      throw new ApiError(403, 'Pilot accounts cannot access the admin panel');
    }

    set({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user, isAuthenticated: true });
    localStorage.setItem('admin-auth', JSON.stringify({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user,
    }));
  },

  logout: () => {
    set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false });
    localStorage.removeItem('admin-auth');
  },

  hydrate: async () => {
    const raw = localStorage.getItem('admin-auth');
    if (!raw) { set({ isHydrating: false }); return; }

    try {
      const { accessToken, refreshToken, user } = JSON.parse(raw);
      set({ accessToken, refreshToken, user });

      const fresh = await api.get<UserProfile>('/api/auth/me');
      if (fresh.role === 'pilot') {
        get().logout();
      } else {
        set({ user: fresh, isAuthenticated: true });
        localStorage.setItem('admin-auth', JSON.stringify({ accessToken, refreshToken, user: fresh }));
      }
    } catch {
      get().logout();
    } finally {
      set({ isHydrating: false });
    }
  },
}));
```

**Step 3:** Create `admin/src/stores/toastStore.ts` (copy pattern from frontend):

```typescript
import { create } from 'zustand';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (t) => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), t.duration);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export const toast = {
  success: (message: string) => useToastStore.getState().addToast({ type: 'success', message, duration: 5000 }),
  error: (message: string) => useToastStore.getState().addToast({ type: 'error', message, duration: 7000 }),
  warning: (message: string) => useToastStore.getState().addToast({ type: 'warning', message, duration: 6000 }),
  info: (message: string) => useToastStore.getState().addToast({ type: 'info', message, duration: 5000 }),
};
```

**Step 4:** Create `admin/src/stores/sidebarStore.ts`:

```typescript
import { create } from 'zustand';

interface SidebarState {
  collapsed: boolean;
  toggle: () => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  collapsed: false,
  toggle: () => set((s) => ({ collapsed: !s.collapsed })),
}));
```

**Step 5:** Create `admin/src/components/ToastContainer.tsx`:

```tsx
import { useToastStore } from '@/stores/toastStore';
import { X } from '@phosphor-icons/react';

const typeStyles = {
  success: 'border-success/30 bg-success/10 text-success',
  error: 'border-danger/30 bg-danger/10 text-danger',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  info: 'border-info/30 bg-info/10 text-info',
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div key={t.id} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm shadow-lg ${typeStyles[t.type]}`}>
          <span className="flex-1">{t.message}</span>
          <button onClick={() => removeToast(t.id)} className="opacity-60 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
```

**Step 6:** Verify build: `npm run build -w admin`

**Step 7:** Commit: `feat(admin): add API client, auth store, toast store`

---

## Phase 2: Core Layout (Tasks 6-8)

### Task 6: Build the AppSidebar component

**Files:**
- Create: `admin/src/components/layout/AppSidebar.tsx`

Build the collapsible sidebar using shadcn's Sidebar component. Navigation items grouped by section (Operations, Management, Fleet, Finance, System). Each item: Phosphor icon + label. Active item highlighted with `--sidebar-primary` accent. Badge counts on PIREPs (pending) and Notifications (unread). Collapsed state shows only icons.

Use these Phosphor icons:
- Dashboard: `SquaresFour`
- Dispatch Board: `Broadcast`
- Schedules: `CalendarDots`
- PIREPs: `ClipboardText`
- Users: `Users`
- Maintenance: `Wrench`
- Finances: `CurrencyDollar`
- Reports: `ChartBar`
- Notifications: `Bell`
- Audit Log: `ClockCounterClockwise`
- Settings: `GearSix`

Use `NavLink` from react-router-dom for active state detection. The sidebar should use shadcn's `Sidebar`, `SidebarContent`, `SidebarGroup`, `SidebarGroupLabel`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton` components.

At the top of the sidebar, render the SMA logo/text with a collapse toggle button.

**Commit:** `feat(admin): add collapsible sidebar navigation`

---

### Task 7: Build the TopBar and DashboardLayout components

**Files:**
- Create: `admin/src/components/layout/TopBar.tsx`
- Create: `admin/src/components/layout/DashboardLayout.tsx`

**TopBar:** Horizontal bar above the content area with:
- Page title (passed as prop or derived from route)
- Search input (placeholder, cosmetic for now)
- Notification bell icon (with badge count)
- User avatar/name dropdown (profile, logout)

Use shadcn `DropdownMenu` for the user menu. Use shadcn `Input` for search.

**DashboardLayout:** The shell that wraps all authenticated pages:

```tsx
<SidebarProvider>
  <AppSidebar />
  <main className="flex-1 flex flex-col overflow-hidden">
    <TopBar />
    <div className="flex-1 overflow-y-auto p-6">
      <Outlet />
    </div>
  </main>
</SidebarProvider>
```

Uses React Router `<Outlet />` for nested routes.

**Commit:** `feat(admin): add TopBar and DashboardLayout shell`

---

### Task 8: Build LoginPage and wire up routing with auth guard

**Files:**
- Create: `admin/src/pages/LoginPage.tsx`
- Create: `admin/src/components/auth/AuthGuard.tsx`
- Modify: `admin/src/App.tsx`

**LoginPage:** Centered card on dark background. SMA logo, email + password inputs, login button, error display. On submit, calls `authStore.login()`. On success, navigates to `/`. Rejects pilot role with error message.

Style: card with `--bg-card` background, blue accent button, subtle border. Clean and minimal like the AirlineSim login flow.

**AuthGuard:** Wrapper component that checks `isAuthenticated` and `isHydrating`:
- If hydrating → show loading spinner
- If not authenticated → redirect to `/login`
- If authenticated + role is pilot → redirect to `/login` with error
- Otherwise → render children

**App.tsx:** Wire up full route structure:

```tsx
<BrowserRouter basename="/admin">
  <ToastContainer />
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<AuthGuard><DashboardLayout /></AuthGuard>}>
      <Route index element={<DashboardPage />} />
      <Route path="dispatch" element={<DispatchBoardPage />} />
      <Route path="users" element={<UsersPage />} />
      <Route path="schedules" element={<SchedulesPage />} />
      <Route path="pireps" element={<PirepsPage />} />
      <Route path="maintenance" element={<MaintenancePage />} />
      <Route path="finances" element={<FinancesPage />} />
      <Route path="reports" element={<ReportsPage />} />
      <Route path="notifications" element={<NotificationsPage />} />
      <Route path="audit" element={<AuditPage />} />
      <Route path="settings" element={<SettingsPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
</BrowserRouter>
```

All page components are placeholder stubs initially (just a heading with the page name).

**Commit:** `feat(admin): add login page, auth guard, and route structure`

---

## Phase 3: Dashboard Page (Tasks 9-10)

### Task 9: Build new backend dashboard aggregation endpoint

**Files:**
- Create: `backend/src/services/dashboard.ts`
- Modify: `backend/src/routes/admin-dashboard.ts` (create new)
- Modify: `backend/src/index.ts` (register route)

**`GET /api/admin/dashboard`** (admin or dispatcher role):

Returns aggregated data in a single call:

```typescript
{
  activeFlights: number,      // COUNT from active_bids WHERE status = 'active'
  pendingPireps: number,      // COUNT from logbook WHERE status = 'pending'
  fleetHealthPct: number,     // % of fleet with no overdue checks
  monthlyRevenue: number,     // SUM from finances WHERE type='income' this month
  recentFlights: Array<{      // Last 10 from logbook ORDER BY actual_dep DESC
    flightNumber, depIcao, arrIcao, status, pilotCallsign, landingRate, actualDep
  }>,
  maintenanceAlerts: Array<{  // Open MEL + overdue checks
    type, aircraftId, title, severity
  }>,
  pilotActivity: Array<{      // Top 10 pilots by hours this month
    callsign, firstName, lastName, hoursThisMonth
  }>,
  financialSummary: {         // Last 6 months income/costs/profit
    months: string[],
    income: number[],
    costs: number[],
    profit: number[],
  }
}
```

Each sub-query is a simple SQLite query against existing tables. Use `getDb()` from `backend/src/db/index.ts`. Add proper typing with interfaces.

Register the route in `backend/src/index.ts` alongside the existing admin routes.

**Commit:** `feat(backend): add dashboard aggregation endpoint`

---

### Task 10: Build DashboardPage with widget grid

**Files:**
- Create: `admin/src/pages/DashboardPage.tsx`
- Create: `admin/src/components/widgets/StatCard.tsx`
- Create: `admin/src/components/widgets/RecentFlightsWidget.tsx`
- Create: `admin/src/components/widgets/FinancialOverviewWidget.tsx`
- Create: `admin/src/components/widgets/MaintenanceAlertsWidget.tsx`
- Create: `admin/src/components/widgets/PilotActivityWidget.tsx`

**StatCard:** Reusable widget showing an icon, label, and large value. Used for the top row (Active Flights, Pending PIREPs, Fleet Health, Revenue).

**RecentFlightsWidget:** Table of last 10 flights with status badges (approved=green, pending=amber, rejected=red).

**FinancialOverviewWidget:** Recharts `AreaChart` with income/costs/profit lines over 6 months. Summary stats below.

**MaintenanceAlertsWidget:** List of alerts with severity icons (amber warning, red critical).

**PilotActivityWidget:** Recharts horizontal `BarChart` showing top 10 pilots by hours.

**DashboardPage:** Grid layout using CSS grid. Fetches `/api/admin/dashboard` on mount. Loading skeletons while fetching.

```
[Stat] [Stat] [Stat] [Stat]       ← 4-col top row
[RecentFlights        ] [Financial]  ← 2-col main row
[MaintenanceAlerts    ] [Pilots   ]  ← 2-col bottom row
```

All widgets use shadcn `Card` with the dark theme colors.

**Commit:** `feat(admin): add dashboard page with widget grid`

---

## Phase 4: Management Pages (Tasks 11-13)

### Task 11: Build UsersPage

**Files:**
- Create: `admin/src/pages/UsersPage.tsx`
- Create: `admin/src/components/tables/UsersTable.tsx`
- Create: `admin/src/components/dialogs/CreateUserDialog.tsx`
- Create: `admin/src/components/dialogs/EditUserDialog.tsx`

Port existing `AdminUsersPage.tsx` functionality with the new design. Use shadcn `Table` (or DataTable pattern with pagination). Stat cards at top. Search input + role/status filter dropdowns. Row actions via shadcn `DropdownMenu`. Create/edit via shadcn `Dialog`. Suspend/reactivate/delete with `AlertDialog` confirmation.

All API calls use existing `/api/admin/users` endpoints.

**Commit:** `feat(admin): add users management page`

---

### Task 12: Build SchedulesPage

**Files:**
- Create: `admin/src/pages/SchedulesPage.tsx`
- Create: `admin/src/components/tables/SchedulesTable.tsx`
- Create: `admin/src/components/tables/AirportsTable.tsx`
- Create: `admin/src/components/dialogs/ScheduleFormDialog.tsx`

shadcn `Tabs` with three panels: Flights, Airports, Charters.

**Flights tab:** DataTable of scheduled flights. Search + filter by type/active. Create/edit schedule via `Sheet` (slide-over form). Airport autofill on dep/arr ICAO inputs (calls `/api/admin/schedules/autofill`). Clone and toggle active actions.

**Airports tab:** Table of approved airports. Add airport search dialog (queries OurAirports). Toggle hub, delete with confirmation.

**Charters tab:** Charter generation status card, manual trigger button, VATSIM events list.

All API calls use existing `/api/admin/schedules`, `/api/admin/airports`, `/api/admin/charters`, `/api/admin/events` endpoints.

**Commit:** `feat(admin): add schedules management page`

---

### Task 13: Build PirepsPage

**Files:**
- Create: `admin/src/pages/PirepsPage.tsx`
- Create: `admin/src/components/tables/PirepsTable.tsx`
- Create: `admin/src/components/panels/PirepDetailPanel.tsx`

shadcn `Tabs` for status filtering (All / Pending / Approved / Rejected). DataTable with bulk select checkboxes. Bulk approve/reject toolbar appears when items selected.

Click row → `Sheet` slide-over showing full PIREP detail: flight info, route, landing rate, fuel usage, score, remarks. Review form at bottom: approve/reject radio + notes textarea + submit.

Pending count badge synced with sidebar.

All API calls use existing `/api/admin/pireps` endpoints.

**Commit:** `feat(admin): add PIREPs review page`

---

## Phase 5: Fleet & Finance (Tasks 14-15)

### Task 14: Build MaintenancePage

**Files:**
- Create: `admin/src/pages/MaintenancePage.tsx`
- Create: `admin/src/components/tables/FleetStatusTable.tsx`
- Create: `admin/src/components/tables/MaintenanceLogTable.tsx`
- Create: `admin/src/components/tables/CheckSchedulesTable.tsx`
- Create: `admin/src/components/tables/AirworthinessTable.tsx`
- Create: `admin/src/components/tables/MelTable.tsx`
- Create: `admin/src/components/tables/ComponentsTable.tsx`

Six-tab layout using shadcn `Tabs`. Each tab has its own DataTable with CRUD dialogs. The most complex page — reference the existing `AdminMaintenancePage.tsx` closely for field names and behavior.

All API calls use existing `/api/admin/maintenance/*` endpoints.

**Commit:** `feat(admin): add maintenance management page`

---

### Task 15: Build FinancesPage

**Files:**
- Create: `admin/src/pages/FinancesPage.tsx`
- Create: `admin/src/components/tables/FinanceLedgerTable.tsx`
- Create: `admin/src/components/widgets/BalancesView.tsx`
- Create: `admin/src/components/charts/FinanceSummaryCharts.tsx`
- Create: `admin/src/components/dialogs/CreateFinanceEntryDialog.tsx`

Three tabs: Ledger, Balances, Summary.

**Ledger:** DataTable with pilot/type/date filters. Create manual entry dialog.
**Balances:** Per-pilot cards or table showing current balance.
**Summary:** Recharts bar + pie charts by type over date range.

All API calls use existing `/api/admin/finances` endpoints.

**Commit:** `feat(admin): add finances page`

---

## Phase 6: New Features (Tasks 16-19)

### Task 16: Build backend reports endpoints

**Files:**
- Create: `backend/src/services/reports.ts`
- Create: `backend/src/routes/admin-reports.ts`
- Modify: `backend/src/index.ts` (register route)

Five new endpoints, all admin/dispatcher role:

```
GET /api/admin/reports/flight-hours?from=&to=
GET /api/admin/reports/landing-rates?from=&to=
GET /api/admin/reports/fuel-efficiency?from=&to=
GET /api/admin/reports/on-time?from=&to=
GET /api/admin/reports/route-popularity?from=&to=
```

Each queries the `logbook` table with date range filtering and aggregates the data into chart-friendly arrays. Return typed interfaces.

**Commit:** `feat(backend): add reports analytics endpoints`

---

### Task 17: Build ReportsPage

**Files:**
- Create: `admin/src/pages/ReportsPage.tsx`
- Create: `admin/src/components/charts/FlightHoursChart.tsx`
- Create: `admin/src/components/charts/LandingRatesChart.tsx`
- Create: `admin/src/components/charts/FuelEfficiencyChart.tsx`
- Create: `admin/src/components/charts/OnTimeChart.tsx`
- Create: `admin/src/components/charts/RoutePopularityChart.tsx`

Dashboard of chart widgets. Date range picker at top (shadcn date inputs). Each chart is a Recharts component in a Card widget. Export to CSV button generates a download.

**Commit:** `feat(admin): add reports analytics page`

---

### Task 18: Build backend notifications endpoints and NotificationsPage

**Files:**
- Create: `backend/src/services/notification-admin.ts`
- Create: `backend/src/routes/admin-notifications.ts`
- Modify: `backend/src/index.ts` (register route)
- Create: `admin/src/pages/NotificationsPage.tsx`
- Create: `admin/src/components/dialogs/ComposeNotificationDialog.tsx`
- Create: `admin/src/components/tables/NotificationHistoryTable.tsx`

**Backend:**
```
POST /api/admin/notifications   — Create notification(s) targeting user(s)
GET  /api/admin/notifications   — List sent notifications with pagination
```

Uses existing `notifications` table. Compose supports targeting: all pilots, specific user, or by role.

**Frontend:** Compose dialog with type selector (info/success/warning/error), message textarea, target selector. History table showing sent notifications with read/unread status.

**Commit:** `feat: add notifications management`

---

### Task 19: Build DispatchBoardPage

**Files:**
- Create: `admin/src/pages/DispatchBoardPage.tsx`
- Create: `admin/src/components/dispatch/FlightMap.tsx`
- Create: `admin/src/components/dispatch/FlightListPanel.tsx`
- Create: `admin/src/components/dispatch/FlightDetailPanel.tsx`
- Create: `admin/src/components/dispatch/AcarsChat.tsx`
- Create: `admin/src/stores/socketStore.ts`
- Create: `admin/src/hooks/useSocket.ts`

The most complex page. Three-panel layout: map (center), flight list (left), detail panel (right).

**socketStore:** Manages Socket.io connection to backend. Connect on mount, disconnect on unmount.

**useSocket:** Hook for subscribing to socket events with cleanup.

**FlightMap:** Leaflet map with aircraft markers. Subscribe to `livemap:subscribe` → `flights:active`. Click marker selects flight.

**FlightListPanel:** List of active flights with phase badges (color-coded). Click selects flight.

**FlightDetailPanel:** Selected flight detail — live telemetry values, ACARS chat panel. Subscribe to `dispatch:subscribe(bidId)` for selected flight.

**AcarsChat:** Message list + input. Send via `acars:sendMessage`. Receive via `acars:message`.

Exceedance events shown as toast notifications with severity colors.

Reuse `aircraft-icons.ts` pattern from existing frontend for map markers.

**Commit:** `feat(admin): add live dispatch board with map and ACARS`

---

## Phase 7: System Pages (Tasks 20-21)

### Task 20: Build AuditPage

**Files:**
- Create: `admin/src/pages/AuditPage.tsx`
- Create: `admin/src/components/tables/AuditTable.tsx`

DataTable with filters: actor (user search), action type dropdown, target type dropdown, date range. Expandable rows showing before/after JSON data.

Uses existing `/api/admin/audit` endpoint.

**Commit:** `feat(admin): add audit log page`

---

### Task 21: Build SettingsPage

**Files:**
- Create: `admin/src/pages/SettingsPage.tsx`

Grouped form sections: Airline Info, Finance, Bookings, System. Each section is a Card with form fields. Per-section save button with saving/saved feedback.

Uses existing `/api/admin/settings` endpoints.

**Commit:** `feat(admin): add settings page`

---

## Phase 8: Deployment Integration (Tasks 22-23)

### Task 22: Backend — serve admin static files at /admin

**Files:**
- Modify: `backend/src/index.ts`

Add Express static middleware to serve the admin app:

```typescript
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const adminDistPath = path.join(__dirname, '../admin-dist');

// Serve admin frontend static files
app.use('/admin', express.static(adminDistPath));
app.get('/admin/*', (_req, res) => {
  res.sendFile(path.join(adminDistPath, 'index.html'));
});
```

The SPA fallback (`/admin/*` → `index.html`) ensures React Router handles client-side routes.

Place this AFTER API routes but BEFORE the catch-all 404 handler.

**Commit:** `feat(backend): serve admin frontend at /admin subpath`

---

### Task 23: Update release.sh for admin build and deploy

**Files:**
- Modify: `scripts/release.sh`
- Modify: Root `package.json` (add `build:admin` script)

Add to root `package.json`:
```json
"build:admin": "npm run build -w admin"
```

Update `release.sh`:
- Step count changes from 8 to 10
- After step 4 (build frontend), add step 5: build admin (`npm run build:admin`)
- After step 7 (deploy backend), add step 8: deploy admin:

```bash
step 8 "Deploying admin to VPS (${VPS_HOST})"
scp -r "$ROOT/admin/dist" "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/admin-dist-new" || fail "SCP admin dist failed"
ssh "${VPS_USER}@${VPS_HOST}" "rm -rf ${VPS_PATH}/admin-dist && mv ${VPS_PATH}/admin-dist-new ${VPS_PATH}/admin-dist"
ok "Admin frontend deployed"
```

Renumber subsequent steps (commit/tag → 9, GitHub release → 10).

Also add `build:admin` to the parallel build step in `npm run build` script.

**Commit:** `feat(deploy): add admin build and deploy to release pipeline`

---

## Phase 9: Polish (Task 24)

### Task 24: Full build verification and smoke test

**Steps:**
1. Run `npm run build` — verify all 5 workspaces compile (shared, backend, frontend, electron, admin)
2. Start backend: `npm run dev -w backend`
3. Start admin: `npm run dev -w admin`
4. Open `http://localhost:5174/admin/` — verify login page renders
5. Login with admin credentials — verify redirect to dashboard
6. Navigate each sidebar link — verify all 11 pages render without errors
7. Check browser console for errors
8. Run `npm run build -w admin` and verify `admin/dist/` is produced with correct asset paths (all prefixed with `/admin/`)

**Commit:** `chore(admin): verify full build and route structure`

---

## Execution Batches

| Batch | Tasks | Milestone |
|-------|-------|-----------|
| 1 | 1-5 | Project scaffolding — workspace builds, stores work |
| 2 | 6-8 | Core layout — sidebar, top bar, login, auth guard, routing |
| 3 | 9-10 | Dashboard — backend endpoint + widget page |
| 4 | 11-13 | Management pages — Users, Schedules, PIREPs |
| 5 | 14-15 | Fleet & finance — Maintenance, Finances |
| 6 | 16-19 | New features — Reports, Notifications, Dispatch Board |
| 7 | 20-21 | System pages — Audit, Settings |
| 8 | 22-24 | Deployment — backend serving, release.sh, smoke test |
