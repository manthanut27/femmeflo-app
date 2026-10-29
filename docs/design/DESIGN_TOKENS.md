# FemmeFlo Mobile Design System Tokens

> **Branding & Visual Direction:** FemmeFlo Mobile (React Native / NativeWind / Expo)  
> **Brand Identity:** Feminine Hygiene FMCG & Field Operations  
> **Target:** Field Sales Officers & Mobile Workforce  

---

## 1. Color Palette

The color system mirrors the web platform's brand identity: empathetic healthcare warmth combined with the high-contrast clarity of enterprise field logistics.

| Role | Hex Code | Token / NativeWind | Description |
|------|----------|-------------------|-------------|
| **Brand Primary (Berry Pink)** | `#E61C5D` | `brand-pink` / `primary` | Primary action buttons, active tab indicators, key totals |
| **Primary Pressed** | `#C91550` | `brand-pink-pressed` | Active tactile pressed state feedback |
| **Primary Subtle / Tint** | `#FFF5F7` | `brand-pink-subtle` | Icon backdrops, highlighted cards, soft badges |
| **Brand Secondary (Forest Green)**| `#156035` | `brand-green` / `secondary` | Manager role accent, confirmed inventory, positive metrics |
| **Secondary Surface** | `#ECFDF5` | `brand-green-surface` | Stock available badges, success banners |
| **Warm Canvas Background** | `#FAF8F5` | `canvas` / `background` | Warm paper off-white canvas reducing glare in bright outdoor sunlight |
| **Card / Elevated Surface** | `#FFFFFF` | `surface` / `card` | Elevated cards, bottom sheets, form input fields |
| **Text Primary (Heading)** | `#09090B` | `text-primary` | Deep near-black for headings, shop names, prices (15.8:1 contrast) |
| **Text Secondary (Muted)** | `#64748B` | `text-secondary` | Timestamps, subtitles, helper text (4.6:1 WCAG AA contrast) |
| **Border Neutral** | `#E2E8F0` | `border-neutral` | Card strokes, input outlines, list dividers |
| **Amber Warning (Below Min Price)**| `#D97706` | `warning` | Below-minimum price floor alert, pending approvals |
| **Amber Warning Surface** | `#FFFBEB` | `warning-surface` | Amber banner background |
| **Error / Destructive** | `#B4234D` | `danger` | Rejected sales, end duty shift, validation error messages |

---

## 2. Typography Scale

Based on system-native geometric sans-serif fonts (Roboto on Android, San Francisco on iOS):

| Token | Size | Line Height | Weight | Usage |
|-------|------|-------------|--------|-------|
| `display` | 28px | 34px | 800 (Bold) | Dashboard revenue, shift timer |
| `h1` | 22px | 28px | 700 (Bold) | Screen headers, modal titles |
| `h2` | 18px | 24px | 700 (Bold) | Section headings, group cards |
| `h3` | 16px | 22px | 600 (Semibold) | Customer shop names, product SKU titles |
| `body` | 15px | 22px | 400 (Regular) | Form fields, descriptive text |
| `bodyMedium` | 14px | 20px | 600 (Semibold) | Action buttons, table values, chips |
| `caption` | 12px | 16px | 500 (Medium) | Metadata, GPS coordinates, timestamps |
| `overline` | 11px | 14px | 700 (Bold) | Uppercase category tags, status badges |

---

## 3. Spatial System (4dp / 8dp Grid)

- `xs` (`4dp`): Badge padding, icon-text gap
- `sm` (`8dp`): Chip spacing, input gap, helper text margins
- `md` (`12dp`): Card inner gutters, button vertical padding
- `lg` (`16dp`): Standard screen horizontal margins, card padding
- `xl` (`20dp`): Modal interior padding, section separators
- `xxl` (`24dp`): Hero margins, large card paddings
- `huge` (`32dp`–`48dp`): Bottom safe clearance above tab navigation

---

## 4. Mobile UX Principles
1. **Thumb-Zone Optimization**: Primary kinetic actions (e.g., "Start Duty Shift", "Confirm POS Sale", "Check-in to Store") sit within the bottom 35% of the screen.
2. **Accessible Touch Targets**: All interactive controls have a minimum touch target envelope of 48x48dp (with `hitSlop` on compact icons).
3. **Multi-State Feedback**: Every data screen features explicit Loading Skeletons, Empty States (with vector graphics and clear calls-to-action), and Error Banners with retry triggers.
4. **Idempotency Persisted in Draft**: Order creation drafts generate an `X-Idempotency-Key` at creation time, preserving it across draft edits and retries.

