# Admin Visual Parity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the admin frontend visually identical to the pilot frontend's design system — pure black backgrounds, transparent border-only cards, neutral borders, matched accent color.

**Architecture:** Token-first approach. ~90% of changes cascade from updating `tokens.css` and `globals.css`. Remaining 10% is hardcoded colors in a handful of components.

**Tech Stack:** CSS custom properties, Tailwind CSS, React (no new dependencies)

---

### Task 1: Update tokens.css — Surface & Text Colors

**Files:**
- Modify: `admin/src/styles/tokens.css:6-17`

Update surface and text tokens to match pilot frontend values:

```css
/* Surface Colors */
--surface-0: #000000;                    /* was #05060d */
--surface-1: #050505;                    /* was #060812 */
--surface-2: transparent;                /* was rgba(15, 19, 36, 0.5) */
--surface-3: #111111;                    /* was #1c2230 */

/* Text Hierarchy */
--text-primary: #f0f0f0;                /* was #eceef5 */
--text-secondary: #7a7a7a;              /* was #8793a1 */
--text-tertiary: #4a4a4a;               /* was #566270 */
--text-quaternary: #3a3a3a;             /* was #3a4250 */
```

**Verify:** Admin login page background changes from navy to pure black.

---

### Task 2: Update tokens.css — Accent, Border, Input Colors

**Files:**
- Modify: `admin/src/styles/tokens.css:19-50`

```css
/* Accent Blue */
--accent-blue: #3b5bdb;                 /* was #3950ed */
--accent-blue-bright: #6b8aff;          /* was #8ca4fa */
--accent-blue-dim: rgba(59, 91, 219, 0.13);   /* was rgba(57, 86, 237, 0.13) */
--accent-blue-bg: rgba(59, 91, 219, 0.12);    /* was rgba(57, 86, 237, 0.12) */
--accent-blue-ring: rgba(59, 91, 219, 0.25);  /* was rgba(57, 86, 237, 0.25) */

/* Border System */
--border-primary: rgba(255, 255, 255, 0.06);  /* was rgba(27, 31, 53, 0.5) */
--border-secondary: rgba(255, 255, 255, 0.08); /* was #2a3040 */
--border-hover: rgba(255, 255, 255, 0.12);    /* was #3a4050 */

/* Input System */
--input-bg: #111111;                     /* was #0d121f */
--input-border: rgba(255, 255, 255, 0.08);    /* was #1b2336 */
--divider: rgba(255, 255, 255, 0.06);   /* was #172230 */
```

Semantic colors (emerald, amber, red, cyan) stay unchanged — already consistent.

**Verify:** Cards should now be transparent with subtle white borders.

---

### Task 3: Update globals.css — shadcn HSL Variables

**Files:**
- Modify: `admin/src/styles/globals.css:20-57`

Update the `.dark` block to match new token values:

```css
.dark {
  --background: 0 0% 0%;              /* #000000 */
  --foreground: 0 0% 94%;             /* #f0f0f0 */
  --card: 0 0% 2%;                    /* #050505 */
  --card-foreground: 0 0% 94%;
  --popover: 0 0% 7%;                 /* #111111 */
  --popover-foreground: 0 0% 94%;

  --primary: 227 68% 54%;             /* #3b5bdb */
  --primary-foreground: 0 0% 100%;

  --secondary: 0 0% 7%;               /* #111111 */
  --secondary-foreground: 0 0% 94%;

  --muted: 0 0% 7%;
  --muted-foreground: 0 0% 29%;       /* #4a4a4a */

  --accent: 0 0% 7%;
  --accent-foreground: 0 0% 94%;

  --destructive: 0 90% 65%;
  --destructive-foreground: 0 0% 100%;

  --border: 0 0% 100% / 0.06;         /* rgba(255,255,255,0.06) */
  --input: 0 0% 7%;                   /* #111111 */
  --ring: 227 68% 54%;                /* #3b5bdb */

  /* Sidebar */
  --sidebar-background: 0 0% 2%;
  --sidebar-foreground: 0 0% 94%;
  --sidebar-primary: 227 68% 54%;
  --sidebar-primary-foreground: 0 0% 100%;
  --sidebar-accent: 227 68% 54% / 0.13;
  --sidebar-accent-foreground: 227 68% 75%;  /* #6b8aff */
  --sidebar-border: 0 0% 100% / 0.06;
  --sidebar-ring: 227 68% 54%;
}
```

**Verify:** shadcn components (dialogs, dropdowns, sheets) use correct dark colors.

---

### Task 4: Update globals.css — Hardcoded RGBA Values

**Files:**
- Modify: `admin/src/styles/globals.css:72-93`

Update hardcoded `rgba(57, 80, 237, ...)` and `rgba(57, 86, 237, ...)` to use the new accent:

```css
/* card-interactive hover */
box-shadow: 0 4px 20px rgba(59, 91, 219, 0.06), 0 0 0 1px rgba(59, 91, 219, 0.08);

/* row-interactive hover */
background-color: rgba(59, 91, 219, 0.04);

/* btn-glow hover */
background-color: rgba(59, 91, 219, 0.15);
border-color: rgba(59, 91, 219, 0.3);

/* nav-item-hover */
background-color: rgba(59, 91, 219, 0.12);

/* input-glow focus */
box-shadow: 0 0 0 2px rgba(59, 91, 219, 0.15);
```

**Verify:** Hover states on cards, nav items, and inputs use correct blue.

---

### Task 5: Update globals.css — Scrollbar

**Files:**
- Modify: `admin/src/styles/globals.css:230-236`

Match pilot frontend scrollbar style:

```css
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.06);  /* was var(--border-secondary) */
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.12);  /* was var(--border-hover) */
}
```

---

### Task 6: Update AppSidebar — Font Family

**Files:**
- Modify: `admin/src/components/layout/AppSidebar.tsx`

Three changes:
1. Line 134: `fontFamily: 'Inter, sans-serif'` → `fontFamily: 'var(--font-sans)'`
2. Line 154: `fontFamily: 'Inter, sans-serif'` → `fontFamily: 'var(--font-sans)'`
3. Line 195: `fontFamily: 'Inter, sans-serif'` → `fontFamily: 'var(--font-sans)'`

---

### Task 7: Update TopBar — Font Family + Avatar Glow

**Files:**
- Modify: `admin/src/components/layout/TopBar.tsx`

Three changes:
1. Line 50: `fontFamily: 'Inter, sans-serif'` → `fontFamily: 'var(--font-sans)'`
2. Line 96: `fontFamily: 'Inter, sans-serif'` → `fontFamily: 'var(--font-sans)'`
3. Line 99: `rgba(57, 80, 237, 0.3)` → `rgba(59, 91, 219, 0.3)`
4. Line 109: `fontFamily: 'Inter, sans-serif'` → `fontFamily: 'var(--font-sans)'`

---

### Task 8: Update FinancesPage + ReportsPage — Hardcoded Constants

**Files:**
- Modify: `admin/src/pages/FinancesPage.tsx:132`
- Modify: `admin/src/pages/ReportsPage.tsx:75`

In both files, update:
```typescript
const ACCENT_BLUE = '#3b5bdb';    // was '#3950ed'
```

The other constants (emerald, amber, red, cyan) are already correct.

---

### Task 9: Update SchedulesPage — Hardcoded Colors

**Files:**
- Modify: `admin/src/pages/SchedulesPage.tsx`

Replace all instances:
- `'#0d121f'` → `'var(--input-bg)'` (lines ~1528, ~1589)
- `rgba(57,86,237,0.13)` → `rgba(59,91,219,0.13)` (all occurrences)

---

### Task 10: Visual Verification + Build

**Steps:**
1. Run `npm run build -w admin` to verify no build errors
2. Open admin at localhost:5177/admin/ and verify:
   - Login page: pure black background, transparent card with subtle border
   - Dashboard: cards are transparent border-only, no navy tint
   - Sidebar: near-black background, blue accent on active nav
   - TopBar: neutral border, correct search input styling
   - Data tables: neutral borders, correct hover states
3. Compare side-by-side with pilot frontend dashboard

---

### Task 11: Commit

```bash
git add admin/src/styles/tokens.css admin/src/styles/globals.css \
  admin/src/components/layout/AppSidebar.tsx admin/src/components/layout/TopBar.tsx \
  admin/src/pages/FinancesPage.tsx admin/src/pages/ReportsPage.tsx \
  admin/src/pages/SchedulesPage.tsx
git commit -m "style(admin): visual parity with pilot frontend design system"
```
