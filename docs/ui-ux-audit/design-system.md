# FemmeFlo Reconstructed Design System Specification

## 1. Visual Direction & Brand Philosophy

FemmeFlo operates at the intersection of **Feminine Hygiene & Healthcare FMCG** and **Enterprise Field Operations**.
The visual direction combines:
1. **Empathy, Warmth & Dignity:** A warm off-white canvas (`#FAF8F5`) paired with soft berry pink surfaces (`#FFF5F7`) and refined Rose primary actions (`#E61C5D`), conveying human-centered care and hygiene dignity.
2. **Operational Precision & Supply Chain Rigor:** Crisp dark slate text (`#09090B`, `#1E293B`), structured 4dp/8dp spatial rhythm, high-contrast borders (`#E2E8F0`), and clear status semantics (`#156035` forest green, `#D97706` amber, `#B4234D` danger).
3. **Cross-Platform Tactile Realism:** Native gestures, subtle scale and opacity feedback (`Pressable`), and edge-to-edge safe area handling across Android, iOS, and Web.

---

## 2. Design Token Architecture

### 2.1 Color Tokens

#### Brand Colors
```typescript
export const BrandColors = {
  pink: {
    primary: '#E61C5D',     // Primary buttons, active tab indicators, key totals
    pressed: '#C91550',     // Active tactile response
    dark: '#9F2545',        // Super Admin tier accent, deep headers
    deep: '#B4234D',        // Destructive / error text
    vibrant: '#F0006E',     // Highlights & micro-badges
    surface: '#FFF8FA',     // Subtle surface background
    subtle: '#FFF5F7',      // Icon backdrops, highlighted cards
    tint: '#FCE7F3',        // Soft borders, input focus rings
  },
  green: {
    primary: '#156035',     // Manager tier accent, confirmed inventory
    pressed: '#0D4224',     // Manager pressed buttons
    dark: '#0F4626',        // Deep forest headers
    surface: '#EBF6EF',     // Manager subtle surfaces
    light: '#ECFDF5',       // Success / stock available badges
  },
  accent: {
    gold: '#FDE047',
    amber: '#D97706',       // Below-minimum price warning, pending approvals
    amberSurface: '#FFFBEB',// Amber card background
    amberBorder: '#FDE68A', // Amber card stroke
  },
} as const;
```

#### Semantic Theme Tokens (Light & Dark)
```typescript
export const Colors = {
  light: {
    text: '#1E293B',             // WCAG AA 10.4:1 contrast vs #FAF8F5
    heading: '#09090B',          // Screen titles, invoice totals (15.8:1)
    textSecondary: '#64748B',    // Subtitles, labels, metadata (4.6:1 WCAG AA)
    textMuted: '#94A3B8',        // Disabled text, secondary timestamps
    textPlaceholder: '#A1A1AA',  // Form placeholder text
    background: '#FAF8F5',       // Warm off-white app canvas
    surface: '#FFFFFF',          // Base content card surface
    surfaceMuted: '#F8FAFC',     // Inset flat card backgrounds
    backgroundElement: '#F1F5F9',// Subtle chips, divider lines
    backgroundSelected: '#FCE7F3',// Active pill selection
    border: '#E2E8F0',           // Card outlines, tab dividers
    borderSubtle: '#F1F5F9',     // Inner row separators
    primary: '#E61C5D',
    primaryPressed: '#C91550',
    secondary: '#156035',
    success: '#059669',
    successBg: '#ECFDF5',
    successBorder: '#A7F3D0',
    warning: '#D97706',
    warningBg: '#FFFBEB',
    warningBorder: '#FDE68A',
    danger: '#B4234D',
    dangerBg: '#FFF1F2',
    dangerBorder: '#FECDD3',
    info: '#0284C7',
    infoBg: '#F0F9FF',
    infoBorder: '#BAE6FD',
  },
  dark: {
    text: '#F8FAFC',
    heading: '#FFFFFF',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    textPlaceholder: '#71717A',
    background: '#0F172A',
    surface: '#1E293B',
    surfaceMuted: '#334155',
    backgroundElement: '#334155',
    backgroundSelected: '#475569',
    border: '#334155',
    borderSubtle: '#1E293B',
    primary: '#F43F5E',
    primaryPressed: '#E11D48',
    secondary: '#10B981',
    success: '#10B981',
    successBg: '#064E3B',
    successBorder: '#047857',
    warning: '#F59E0B',
    warningBg: '#78350F',
    warningBorder: '#B45309',
    danger: '#F43F5E',
    dangerBg: '#881337',
    dangerBorder: '#BE123C',
    info: '#38BDF8',
    infoBg: '#0C4A6E',
    infoBorder: '#0369A1',
  },
} as const;
```

---

### 2.2 Typography Scale

The typographic scale uses native platform sans fonts (Roboto on Android, San Francisco on iOS, system fallback on Web):

| Token | Size | Line Height | Weight | Letter Spacing | Purpose |
|-------|------|-------------|--------|----------------|---------|
| `Typography.display` | 28px | 34px | 800 | -0.5px | Hero titles, primary financial totals |
| `Typography.h1` | 22px | 28px | 700 | -0.3px | Screen titles in Header, modal headlines |
| `Typography.h2` | 18px | 24px | 700 | -0.2px | Card group titles, major section headings |
| `Typography.h3` | 16px | 22px | 600 | 0.0px | Customer shop name, product SKU title |
| `Typography.bodyLarge` | 16px | 24px | 400 | 0.0px | Form labels, emphasized descriptions |
| `Typography.body` | 15px | 22px | 400 | 0.0px | Form input values, detailed list descriptions |
| `Typography.bodyMedium` | 14px | 20px | 600 | 0.1px | Button text, table values, action links |
| `Typography.bodySmall` | 13px | 18px | 400 | 0.0px | Helper text, secondary addresses |
| `Typography.caption` | 12px | 16px | 500 | 0.2px | Subtitles, timestamps, odometer readings |
| `Typography.overline` | 11px | 14px | 700 | 0.8px | Uppercase category badges, section tags |

---

### 2.3 Spatial Scale (4dp / 8dp Grid)

```typescript
export const Spacing = {
  none: 0,
  xxs: 2,     // Fine divider gaps
  xs: 4,      // Micro badge padding, icon-text gap
  sm: 8,      // Chip spacing, input gap, helper text margins
  md: 12,     // Card inner gutters, button vertical padding
  lg: 16,     // Screen horizontal margins, standard card padding
  xl: 20,     // Modal interior padding, section separators
  xxl: 24,    // Auth screen hero margins
  xxxl: 32,   // Section vertical breaks
  huge: 48,   // Safe scroll bottom clearance
} as const;
```

---

### 2.4 Border Radius & Shadows

```typescript
export const Radius = {
  xs: 4,      // Subtle badge corners
  sm: 8,      // Inner input strokes, small chips
  md: 12,     // Buttons, form inputs, dialogs
  lg: 16,     // Primary cards, bottom sheets
  xl: 24,     // Hero cards, modal dialogs
  full: 9999, // Circular badges, avatar circles, pill tabs
} as const;

export const Shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;
```

---

### 2.5 Component Design Specifications

1. **Button:**
   - Heights: `sm` (38dp), `md` (48dp), `lg` (54dp).
   - Variants:
     - `primary`: Background `#E61C5D`, text `#FFFFFF`, pressed `#C91550`.
     - `secondary`: Background `#156035`, text `#FFFFFF`, pressed `#0D4224`.
     - `outline`: Border `#E2E8F0`, text `#1E293B`, pressed `#FFF5F7`.
     - `danger`: Background `#B4234D`, text `#FFFFFF`, pressed `#881337`.
     - `ghost`: Transparent, text `#E61C5D`, pressed `#FFF5F7`.
   - Feedback: `opacity: 0.92`, `transform: [{ scale: 0.99 }]` on interactive press.

2. **Input:**
   - Height: 50dp.
   - States: Default (Border `#E2E8F0`), Focused (Border `#E61C5D`, background `#FFFFFF`), Error (Border `#B4234D`, background `#FFF1F2`).
   - Accessible labels, floating helper text, vector icons, show/hide password toggle.

3. **Card:**
   - Variants: `elevated` (Background `#FFFFFF`, Border `#F1F5F9`, `Shadows.sm`), `outlined` (Border `#E2E8F0`), `flat` (Background `#F8FAFC`).
   - Padding: 16dp. Rounded: 16dp (`Radius.lg`).

4. **Badge:**
   - Rounding: Pill (`Radius.full`). Height: 24dp (`sm`), 28dp (`md`).
   - Dot indicator: 6dp colored circular bullet.
   - High contrast pairing (e.g. `success`: text `#065F46`, bg `#ECFDF5`, border `#A7F3D0`).

5. **StatCard (New):**
   - KPI metrics display: Icon circle, Title label, Large numerical value, Optional unit / trend badge.
   - Flex layout: adapts between 2 columns (mobile) and 4 columns (tablet/desktop).

6. **SegmentedTabs (New):**
   - Horizontal tablist with pill indicators for filtering.
   - Accessible roles (`tablist`, `tab`), active state indicator, generous touch targets.

