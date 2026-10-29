# FemmeFlo Design System (Master)

> **LOGIC:** Authoritative design tokens and interaction guidelines for the FemmeFlo Mobile & Tablet applications (React Native / Expo SDK 58).
> Follows the **UI UX Pro Max** system requirements for accessibility (WCAG AA), typography rhythm, 4/8dp spatial grid, tactile interaction states, and contrast minimums.

---

**Project:** FemmeFlo (Field Sales, Territory Management & Executive Distribution)  
**Platform:** React Native / Expo (Android first-class, iOS & Responsive Web compatible)  
**Brand Identity:** Feminine Hygiene & Healthcare FMCG Operations  

---

## 1. Brand Tokens & Color Palette

The color system combines the warmth and empathy of healthcare with the rigor of enterprise supply chain & point-of-sale systems.

| Role | Hex | Token Name | Usage | Contrast vs Background |
|------|-----|------------|-------|-----------------------|
| **Brand Primary (Berry Pink)** | `#E61C5D` | `BrandColors.pink.primary` | Primary action buttons, active tab indicators, key totals | ≥ 4.5:1 against #FAF8F5 |
| **Brand Primary Pressed** | `#C91550` | `BrandColors.pink.pressed` | Pressed feedback state on primary controls | Active tactile response |
| **Brand Primary Surface** | `#FFF5F7` | `BrandColors.pink.subtle` | Icon backdrops, highlighted cards, soft badges | Soft warmth |
| **Brand Secondary (Forest Green)**| `#156035` | `BrandColors.green.primary` | Manager role accent, confirmed inventory, positive metrics | ≥ 4.5:1 against light canvas |
| **Brand Secondary Light** | `#ECFDF5` | `BrandColors.green.surface` | Stock available badges, success banners | Crisp emerald badge surface |
| **Canvas Background** | `#FAF8F5` | `Colors.light.background` | App-wide screen canvas (warm off-white) | Base surface |
| **Card / Elevated Surface** | `#FFFFFF` | `Colors.light.surface` | Cards, modals, elevated sheets, input fields | Base content surface |
| **Text Primary (Heading)** | `#09090B` | `Colors.light.heading` | Screen titles, invoice totals, customer names | 15.8:1 contrast |
| **Text Body** | `#1E293B` | `Colors.light.text` | Field values, paragraph copy, list items | 10.4:1 contrast |
| **Text Secondary (Muted)** | `#64748B` | `Colors.light.textSecondary` | Subtitles, labels, timestamps, metadata | 4.6:1 contrast (WCAG AA) |
| **Border Neutral** | `#E2E8F0` | `Colors.light.border` | Card outlines, tab dividers, input strokes | Clear edge definition |
| **Border Subtle** | `#F1F5F9` | `Colors.light.borderSubtle` | Inner row separators, subtle item divides | Visual grouping |
| **Amber Warning** | `#D97706` | `Colors.light.warning` | Below-minimum price warning, pending approvals | ≥ 4.5:1 against #FFFBEB |
| **Warning Surface** | `#FFFBEB` | `Colors.light.warningBg` | Low stock alerts, special price queues | Soft amber card |
| **Destructive / Error** | `#B4234D` | `Colors.light.danger` | Error banners, rejected sales, end shift | High legibility |

---

## 2. Typography & Hierarchy Scale

Based on system native high-readability sans fonts (Roboto on Android, San Francisco on iOS, system fallback on Web).

| Style | Size | Weight | Line Height | Tracking | Usage |
|-------|------|--------|-------------|----------|-------|
| `display` | `28px` | `800` | `34px` | `-0.5px` | Auth hero titles, key metric numbers |
| `h1` | `22px` | `700` | `28px` | `-0.3px` | Screen titles in Header, modal headlines |
| `h2` | `18px` | `700` | `24px` | `-0.2px` | Card group titles, major section headings |
| `h3` | `16px` | `600` | `22px` | `0px` | Customer shop name, product SKU title |
| `body` | `15px` | `400` | `22px` | `0px` | Form input values, detailed list descriptions |
| `bodyMedium`| `14px` | `600` | `20px` | `0.1px` | Button text, table values, action links |
| `caption` | `12px` | `500` | `16px` | `0.2px` | Subtitles, helper text, timestamps, odometer |
| `overline` | `11px` | `700` | `14px` | `0.8px` | Uppercase category badges, section tags |

---

## 3. Spatial System (4dp / 8dp Rhythm)

- `xs` (`4dp`): micro badge paddings, icon-text horizontal spacing
- `sm` (`8dp`): chip spacing, input gap, helper text margins
- `md` (`12dp`): card inner gutters, button vertical padding
- `lg` (`16dp`): standard screen horizontal gutters, card padding
- `xl` (`20dp`): modal interior padding, section separators
- `xxl` (`24dp`): auth screen hero margins
- `huge` (`32dp`–`48dp`): scroll bottom safe clearance

---

## 4. Touch Targets & Accessibility Guidelines (WCAG AA)

1. **Touch Targets**: Minimum 44x44pt on iOS, 48x48dp on Android. All small interactive icons and compact chips MUST supply generous `hitSlop` (`{ top: 10, bottom: 10, left: 10, right: 10 }`).
2. **Accessible Semantics**:
   - Buttons: `accessibilityRole="button"`, `accessibilityState={{ disabled, busy }}`.
   - Inputs: `accessibilityLabel`, `accessibilityHint`, `accessibilityInvalid`.
   - Cards with `onPress`: `accessibilityRole="button"`.
   - Role Selectors / Tabs: `accessibilityRole="tab"`, `accessibilityState={{ selected }}`.
3. **No Structural Emojis**: Replace emoji icons (e.g., 🌸, ⚡, 🛍️) with vector icons (`@expo/vector-icons` / Ionicons) to guarantee crisp cross-platform rendering and support for high-contrast accessibility.
4. **Color Independence**: Indicators must never rely solely on color. Status badges must pair color with unambiguous text labels (`APPROVED`, `PENDING`, `REJECTED`, `CONFIRMED`).
5. **Responsive Layouts**:
   - Bounded container width (`maxWidth: 800`, `alignSelf: 'center'`) on web and tablet views.
   - Safe area handling on top app bars and bottom tab navigation bars to prevent collision with Android navigation gestures and camera cutouts.
