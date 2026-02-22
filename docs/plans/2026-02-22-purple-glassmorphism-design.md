# Purple Glassmorphism UI Overhaul

## Summary
Shift the SMA ACARS frontend from cyan-accented flat dark panels to a purple/violet glassmorphism aesthetic inspired by modern fintech dashboards. No functionality changes.

## Decisions
- **Primary accent**: Cyan (#00cece) → Purple/Violet (#a855f7)
- **Glass intensity**: Subtle — soft frosted borders, slight transparency, gentle glow
- **Scope**: All pages via token-first approach (Approach A)
- **Method**: Update CSS tokens + shared component classes; sweep hardcoded hex values

## Color Token Changes
| Token | Old | New |
|-------|-----|-----|
| `--bg-app` | `#0c0d12` | `#09090f` |
| `--bg-panel` | `#14161c` | `#12121e` |
| `--bg-input` | `#1d1f27` | `#1a1a2e` |
| `--cyan` | `#00cece` | `#a855f7` |
| `--cyan-dark` | `#1b2b3d` | `#1e1331` |
| `--cyan-rgb` | `0,206,206` | `168,85,247` |
| `--border-panel` | `#252830` | `rgba(255,255,255,0.06)` |

## Panel Glassmorphism
- `border-radius: 12px`
- `background: rgba(18,18,30,0.7)` + `backdrop-filter: blur(12px)`
- `border: 1px solid rgba(255,255,255,0.06)`
- Subtle box-shadow for depth

## Buttons
- `.btn-primary`: Purple gradient, rounded-lg
- All buttons: `rounded-sm` → `rounded-lg`

## Badges
- All badges: `rounded-full` (pill shape)

## Stat Cards
- Remove left border stripe
- Add subtle gradient icon boxes
- Increase padding

## Hardcoded Color Sweep
Replace `bg-[#0e1014]`, `bg-[#1e2028]`, `hover:bg-[#171a1e]` etc. with token-based classes.
