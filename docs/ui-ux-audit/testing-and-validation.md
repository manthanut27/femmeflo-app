# Testing, Quality Gates & Validation Strategy

## 1. Automated Quality Verification Gates

To ensure zero technical regression throughout and after the redesign, three automated test suites serve as continuous quality gates:

### Gate 1: TypeScript Compiler Typecheck
```bash
npm run typecheck
# Executed command: tsc --noEmit
```
* **Objective:** Verify 100% type safety across all React components, navigation params, props, and API schemas.
* **Acceptance Threshold:** 0 errors.

### Gate 2: Business Logic & Critical Scenario Tests
```bash
npm test
# Executed command: node --test src/__tests__/*.test.ts
```
* **Objective:** Verify all 15 business-critical scenarios defined in Master Prompt Section 12:
  1. Sale below minimum price becomes PENDING when approval is required.
  2. Pending sale does not cause client-side stock deduction or incentive credit.
  3. Approved sale reflects server-confirmed result and updates stock/incentives.
  4. Rejected sale remains visible in history with REJECTED status.
  5. Rejected sale does not cause client-side stock deduction.
  6. Idempotency Key prevents duplicate sales on network retry/timeout.
  7. Seller cannot perform Super Admin actions.
  8. Manager cannot exceed territory permissions.
  9. Expired session clears token and triggers signout redirect.
  10. Historical incentive is immutable when seller rate changes.
  11. Final invoice is not issued for an unconfirmed sale.
  12. Payment options exclude partial payments; exactly CASH, BANK, PENDING.
  13. Customer email is strictly required for customer onboarding.
  14. Denied GPS permission does not crash onboarding (manual fallback).
  15. Network failure does not discard entered form data.
* **Acceptance Threshold:** 15 / 15 tests passing (0 failures).

### Gate 3: Expo Linter
```bash
npm run lint
# Executed command: expo lint
```
* **Objective:** Ensure compliance with ESLint rules and Expo mobile best practices.

---

## 2. Visual & Responsive Validation Matrix

| Viewport Tier | Target Devices | Visual Inspection Criteria | Verification Status |
|---------------|----------------|----------------------------|:-------------------:|
| **375 px** | iPhone SE, small Android handsets | No horizontal scroll leaks, header titles truncated cleanly, 2-column KPI cards render without clipping numbers. | Required Gate |
| **390 px** | iPhone 14/15/16, Pixel 7/8 | Primary mobile benchmark: touch targets ≥ 48dp, button padding balanced, card gutters at 16dp. | Primary Benchmark |
| **768 px** | iPad Mini, Galaxy Tab | MaxContentWidth (800dp) constraint active, content centered, cards do not stretch distortedly. | Required Gate |
| **1024 px** | iPad Pro, tablet landscape | Grid layout expands cleanly, navigation bar positioned with appropriate insets. | Required Gate |
| **1440 px** | Desktop Browser Testing | Framed app container against warm off-white canvas `#FAF8F5`, keyboard interactions operational. | Web Verification |

---

## 3. WCAG 2.2 AA Accessibility Quality Gate

Every redesigned component and screen must fulfill the following verifiable accessibility criteria:

1. **Color Contrast Minimums:**
   - Text Primary (`#1E293B`) vs Canvas (`#FAF8F5`): **10.4:1** (WCAG AA requirement: ≥ 4.5:1).
   - Text Heading (`#09090B`) vs Surface (`#FFFFFF`): **15.8:1**.
   - Text Muted (`#64748B`) vs Surface (`#FFFFFF`): **4.6:1**.
   - Primary Action (`#E61C5D`) vs White (`#FFFFFF`): **4.6:1**.
2. **Touch Targets:**
   - Minimum 48x48dp on Android, 44x44pt on iOS.
   - All compact action icons provide `hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}`.
3. **Semantic Roles & State Announcements:**
   - Buttons: `accessibilityRole="button"`, `accessibilityState={{ disabled, busy }}`.
   - Inputs: `accessibilityLabel`, `accessibilityHint`, `aria-invalid`.
   - Tabs: `accessibilityRole="tab"`, `accessibilityState={{ selected }}`.
   - Alerts: `accessibilityRole="alert"`.
4. **No Structural Emojis:**
   - All visual indicators use vector icons (`@expo/vector-icons`).
5. **Color Independence:**
   - Badges pair color with explicit text labels (`APPROVED`, `PENDING`, `REJECTED`, `CONFIRMED`).

---

## 4. Manual Verification Matrix for User Journeys

| Journey ID | Workflow Name | Critical Checkpoints |
|------------|---------------|----------------------|
| **J1** | Authentication & Role Switch | Switch Seller/Manager/Admin role tabs; verify correct demo credentials; test signout and session clear. |
| **J2** | Seller Daily Shift Start | Tap "Start Daily Shift"; enter odometer (km); verify GPS acquisition; verify shift card displays active status. |
| **J3** | Customer Onboarding | Type 6-digit pincode; verify state/district auto-fill; deny GPS to test manual address entry; capture storefront photo. |
| **J4** | Sales Order Creation | Enter unit price below ₹25.00; verify amber warning appears; submit order; verify status is PENDING and no stock deducted. |
| **J5** | Tax Invoice Generation | Open confirmed sale; tap "Download Tax Invoice"; verify invoice generated; test unconfirmed sale to verify blocked state. |
| **J6** | Manager Supervision | View territory metrics; browse seller team roster; onboard a new seller with temporary credentials. |
| **J7** | Super Admin Approval | View pending special price orders; click "Confirm Approval"; verify order confirms, stock deducts, and queue updates. |

