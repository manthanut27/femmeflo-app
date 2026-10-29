# Complete UI/UX Redesign Implementation Plan

## 1. Baseline Safety & Starting Point

* **Git Branch:** `master`
* **Baseline TypeScript Check:** `npm run typecheck` (`tsc --noEmit`) -> **PASS (0 errors)**
* **Baseline Scenario Tests:** `npm test` -> **PASS (15 / 15 tests passed)**
* **Preservation Rule:** Zero modification to business logic, API signatures, DTOs, or scenario assertions. The redesign is strictly focused on UI presentation, usability, accessibility, design token integration, and responsive composition.

---

## 2. Implementation Sequence by Stage

```
┌────────────────────────────────────────────────────────┐
│ STAGE A: Design Foundation                             │
│   • Expand semantic tokens in src/constants/theme.ts   │
│   • Refine role-specific color bindings                │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ STAGE B: Shared UI Component Reconstruction            │
│   • Create src/components/ui/StatCard.tsx              │
│   • Create src/components/ui/SegmentedTabs.tsx         │
│   • Enhance Button.tsx, Input.tsx, Card.tsx, Badge.tsx │
│   • Polish Header.tsx, EmptyState.tsx, LoadingSkeleton │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ STAGE C: Global Layouts & Shell Navigation             │
│   • Polish RootLayout & StartupScreen (replace emoji)  │
│   • Refine Seller Tabs Layout (safe area insets)       │
│   • Refine Manager Tabs Layout (forest green accents)  │
│   • Refine Admin Tabs Layout (deep rose accents)       │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ STAGE D: Core Screen Redesigns                         │
│   • D1: Auth Flow (Login, Forgot Password, Reset)      │
│   • D2: Seller Operations (Dashboard, Customer new/[id]│
│         Sales new/[id], Inventory, Incentives, Profile)│
│   • D3: Manager Operations (Dashboard, Team, Onboard)  │
│   • D4: Admin HQ (Dashboard, Approvals queue, Transfer)│
│   • D5: Shared Dialogs (Notifications, Change Password)│
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ STAGE E: Interaction Polish & Micro-Feedback           │
│   • Tactile press states (scale 0.99, opacity 0.92)    │
│   • Focused border highlights on all text inputs       │
│   • Status pill contrast validation (≥ 4.5:1 WCAG AA)  │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ STAGE F: Final Consistency & Quality Verification      │
│   • Full typecheck (tsc --noEmit)                      │
│   • Full business scenario suite (npm test - 15 tests) │
│   • Lint validation (expo lint)                        │
└────────────────────────────────────────────────────────┘
```

---

## 3. Detailed File-Level Implementation Plan

### Stage A — Design Foundation & Tokens
* **Files Affected:** `src/constants/theme.ts`
* **Changes:**
  * Add explicit role theme constants (`RoleThemes.seller`, `RoleThemes.manager`, `RoleThemes.admin`).
  * Ensure all contrast ratios on text and borders exceed WCAG AA.
  * Add helper styles for metric values and tabular numbers.
* **Potential Regressions:** None; purely additive and semantic.

### Stage B — Shared UI Components
1. **`src/components/ui/StatCard.tsx` (New Component):**
   * Displays KPI metrics with vector icon circle, title, large value, optional change badge, and accent tint.
2. **`src/components/ui/SegmentedTabs.tsx` (New Component):**
   * Displays accessible horizontal filter tabs with pill selection, smooth background indicator, and `accessibilityRole="tab"`.
3. **`src/components/ui/Button.tsx` (Enhanced):**
   * Refined tactile press scale (`0.99`), verified WCAG AA contrast on all variants, seamless icon spacing.
4. **`src/components/ui/Input.tsx` (Enhanced):**
   * Refined active focus border (`#E61C5D`), vector error icon display, clean padding.
5. **`src/components/ui/Card.tsx` (Enhanced):**
   * Clean semantic border token binding (`Colors.light.borderSubtle`), refined elevation shadow.
6. **`src/components/ui/Badge.tsx` (Enhanced):**
   * Enforced minimum 4.5:1 text contrast on all variants (`CONFIRMED`, `PENDING`, `APPROVED`, `REJECTED`, `ACTIVE`, `INACTIVE`, `CASH`, `BANK`).
7. **`src/components/ui/Header.tsx` (Enhanced):**
   * Safe area top inset handling, long title ellipsis, crisp unread notification badge.

### Stage C — Global Layouts & Shell Navigation
1. **`src/app/index.tsx` (StartupScreen):**
   * Replace structural emoji `🌸` with `@expo/vector-icons` `flower-outline` in tinted badge.
   * Bind all styles to `Colors.light` tokens.
2. **`src/app/(seller)/_layout.tsx`:**
   * Bottom tab navigation with Android safe insets (80dp height, 10dp bottom padding), active Berry Pink indicator.
3. **`src/app/(manager)/_layout.tsx`:**
   * Bottom tab navigation with active Forest Green (`#156035`) indicator.
4. **`src/app/(admin)/_layout.tsx`:**
   * Bottom tab navigation with active Deep Rose (`#9F2545`) indicator.

### Stage D — Screen-by-Screen Redesigns

#### D1: Authentication Screens
* **`src/app/(auth)/login.tsx`:**
  * Replace custom role pills with `SegmentedTabs` or polished accessible role tabs.
  * Harmonize demo mode banner with soft green styling (`#ECFDF5`).
  * Bind all background and text colors to semantic tokens.
* **`src/app/(auth)/forgot-password.tsx` & `reset-password.tsx`:**
  * Clean form layouts with token-driven typography and feedback banners.

#### D2: Seller Operations Screens
* **`src/app/(seller)/index.tsx` (Seller Dashboard):**
  * Replace inline metric cards with `StatCard` components.
  * Elevate Active Duty Shift card with clear status indicator and Start/End Shift modal dialogs.
* **`src/app/(seller)/customers/index.tsx`:**
  * Polished search bar with vector icon and clear action.
  * Category filter chips using `SegmentedTabs` or horizontal pill list.
  * Customer cards with shop avatar initials and location badges.
* **`src/app/(seller)/customers/new.tsx`:**
  * Visual GPS status widget (`Acquiring`, `GPS Locked`, `Manual Entry Enabled`).
  * Pincode auto-lookup card with inline loading indicator.
  * Storefront photo upload card with preview framing.
* **`src/app/(seller)/customers/[id].tsx`:**
  * Store header card with direct phone/email/maps action buttons.
  * Recent orders ledger with status badges.
* **`src/app/(seller)/sales/index.tsx`:**
  * Status filter pills using `SegmentedTabs`.
  * Order cards with date, shop name, packet count, total rupees, and status badge.
* **`src/app/(seller)/sales/new.tsx` (Critical Path):**
  * Customer selector card with pre-selection.
  * SKU selection with real-time van stock balance indicator.
  * Quantity and price per packet inputs with real-time total calculation.
  * Contextual Amber Warning Banner when unit price is below `minimumPricePaise` (Scenario 1 & 2).
  * Payment mode selector (`CASH`, `BANK`, `PENDING` only - Scenario 12).
* **`src/app/(seller)/sales/[id].tsx` (Critical Path):**
  * Tax invoice card with formal FMCG layout.
  * "Download Tax Invoice" button with strict gate: enabled exclusively for `CONFIRMED` sales (Scenario 11).
  * Payment collection modal for pending orders.
* **`src/app/(seller)/inventory/index.tsx`:**
  * Van stock health cards and chronological transaction ledger.
* **`src/app/(seller)/incentives/index.tsx`:**
  * Commission hero card, packets sold meter, current rate per packet, and order-by-order commission history.
* **`src/app/(seller)/profile/index.tsx`:**
  * Profile card with initials avatar, account menu items, shift history list, and signout confirmation.

#### D3: Manager Operations Screens
* **`src/app/(manager)/index.tsx` (Manager Dashboard):**
  * Forest green accents, 4-metric `StatCard` grid (Revenue, Packets, Sellers, Stores).
* **`src/app/(manager)/sellers/index.tsx` & `new.tsx`:**
  * Team roster cards with contact actions and field officer onboarding form.

#### D4: Admin HQ Screens
* **`src/app/(admin)/index.tsx` (Executive Overview):**
  * Prominent Pending Approvals Alert Banner leading directly to queue.
  * National KPI grid (`StatCard`).
* **`src/app/(admin)/approvals/index.tsx` (Critical Path):**
  * Special price approval cards showing requested price vs minimum price threshold.
  * Dual decision buttons: "Confirm Approval" (green) and "Reject Order" (destructive) with confirmation dialogs.
* **`src/app/(admin)/inventory/index.tsx` & `transfer.tsx`:**
  * Segmented control for Stock Inward Receipt vs Warehouse Transfer.
  * Destination location picker and packet quantity form.
* **`src/app/(admin)/settings/index.tsx`:**
  * Global price invariant setting card with clear threshold explanation.

#### D5: Shared Modals
* **`src/app/(shared)/notifications.tsx`:**
  * Unread alert indicator dots, "Mark all read" header action, clean card list.
* **`src/app/(shared)/change-password.tsx`:**
  * Secure password update form with validation.

---

## 4. Acceptance Criteria & Quality Gates

1. **TypeScript Typecheck:** `npm run typecheck` (`tsc --noEmit`) passes with 0 errors.
2. **Business Scenario Tests:** `npm test` passes all 15 business scenarios without regressions.
3. **Design System Adherence:** Zero structural emojis; all colors consume semantic tokens or `BrandColors`; consistent 4dp/8dp spacing rhythm.
4. **Accessibility:** All interactive elements provide accessible labels, roles, and satisfy minimum touch targets (48x48dp Android, 44x44pt iOS).
5. **Responsiveness:** Flawless rendering verified on compact mobile (375px), standard mobile (390px), and tablet/web (768px - 1440px).

