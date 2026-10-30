# FemmeFlo Mobile Application — Comprehensive Bug Audit and Safe Fixes Report

**Date:** 2026-10-29  
**Application:** FemmeFlo Field Force & Distribution Mobile Application  
**Target Architecture:** Expo SDK ~58.0.19 / React Native 0.88.0 / React 19.3.0 / Expo Router ~58.0.26 / TypeScript 5.9  
**Auditor:** Senior Software Engineer, React Native Specialist & QA Architect  

---

## 1. Executive Summary

Following a comprehensive UI/UX redesign of the FemmeFlo mobile application, an exhaustive, zero-assumption engineering audit and bug repair was conducted across all application layers:
1. **Authentication & Session Management** (SecureStore token handling, session restoration on 401/403, role segregation)
2. **Navigation & Layout Route Guards** (Expo Router `(admin)`, `(manager)`, `(seller)` route protections)
3. **Core Business Logic & Invariants** (Below-minimum sales approval, van inventory deduction, ledger balance, immutable historical commissions, RFC-compliant customer onboarding, payment mode constraints)
4. **API Integration & Network Security** (Idempotency key deduplication, token leak prevention in URLs, strict endpoint routing, synchronous re-entry locks on mutation handlers)
5. **UI & Performance Stability** (Search input debouncing, skeleton loading state coordination, camera permissions, cross-platform PDF handling)

### Verification Summary
* **TypeScript Compiler (`npm run typecheck` / `tsc --noEmit`):** **0 errors** (Exit Code: 0)
* **ESLint Quality Gate (`npm run lint` / `expo lint`):** **0 errors, 0 warnings** (Exit Code: 0)
* **Automated Regression Suite (`npm test` / `node --test src/__tests__/*.test.ts`):** **23/23 tests passing** (Exit Code: 0)
* **Total Defects Discovered & Resolved:** 13 verified issues (2 Critical, 3 High, 5 Medium, 3 Low)

---

## 2. Bug Inventory & Resolution Summary

| Bug ID | Severity | Root Cause | Fix | Regression Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **CRIT-01** | **CRITICAL** | Route layouts `(admin)`, `(manager)`, and `(seller)` lacked authentication and role-based guards, allowing direct deep-link or tab navigation by unauthorized users. | Added `useAuth()` guards with loading spinner and role-aware redirects (`/(auth)/login` or role workspace) in all 3 layout route files. | `CRIT-01` in `bug_fixes.test.ts` & Scenarios 7, 8 in `business_rules.test.ts` | **FIXED** |
| **CRIT-02** | **CRITICAL** | In `AuthContext.tsx`, `restoreSession()` unconditionally fell back to cached offline user data even when `authApi.me()` returned HTTP 401 Unauthorized or 403 Forbidden. | Added status code inspection; HTTP 401/403 explicitly clears tokens, cached storage, and resets auth state to unauthenticated. | `BUG-001` in `bug_fixes.test.ts` & Scenario 9 in `business_rules.test.ts` | **FIXED** |
| **HIGH-01** | **HIGH** | `sellerApi.getInvoicePdfUrl` and `sales/[id].tsx` appended the sensitive JWT bearer token directly into URL query parameters (`?token=...`), risking credential exposure in web server logs, proxy caches, and browser histories. | Stripped `token` query parameter from URL generation and passed JWT in standard `Authorization: Bearer <token>` header in `FileSystem.downloadAsync`. | `HIGH-01` in `bug_fixes.test.ts` | **FIXED** |
| **HIGH-02** | **HIGH** | In `mockService.ts`, Super Admin approval of below-threshold sales marked orders `APPROVED` without deducting van inventory or logging transactions. Moreover, `sales/[id].tsx` strictly required `CONFIRMED`, blocking tax invoice download. | In `mockService.ts`, approval transitions sale to `CONFIRMED`, deducts stock, increments sold packets, and appends a `SALE` transaction. In `[id].tsx`, tax invoices allow both `CONFIRMED` and `APPROVED`. | `BUG-002` in `bug_fixes.test.ts` & Scenarios 1–5, 11 in `business_rules.test.ts` | **FIXED** |
| **HIGH-03** | **HIGH** | POS order submission lacked an idempotency key contract, making mobile checkouts vulnerable to duplicate order placement and multiple stock deductions during network retries. | Added `idempotencyKey` state (`ff_pos_<uuid>`) to `CreateSalePayload`, forwarded `X-Idempotency-Key` HTTP header in `sellerApi.createSale`, and added deduplication tracking in the mock service. | `HIGH-03` in `bug_fixes.test.ts` & Scenario 6 in `business_rules.test.ts` | **FIXED** |
| **MED-01** | **MEDIUM** | Mutation handlers lacked synchronous re-entry locks (`if (isSubmitting) return;`), allowing rapid double-tapping on mobile touchscreens to dispatch concurrent duplicate requests before React re-rendered button disabled states. | Implemented synchronous re-entry locks on all form submissions, payment collections, approval actions, category creations, notifications, and password resets. | `BUG-003` in `bug_fixes.test.ts` | **FIXED** |
| **MED-02** | **MEDIUM** | Form email validations used simple `!email.includes('@')`, permitting malformed email strings (e.g., `user@domain` or `store@`) lacking a valid top-level domain. | Replaced with strict RFC regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` in domain rules, customer onboarding, seller onboarding, and password reset flows. | `BUG-004` in `bug_fixes.test.ts` & Scenario 13 in `business_rules.test.ts` | **FIXED** |
| **MED-03** | **MEDIUM** | Search inputs in manager and admin screens fired on every single keystroke without debouncing, hammering the API client and causing flickering list skeletons. | Introduced 300ms `useDebounce` hook across seller, customer, and admin user directories, keeping current lists visible while filtering. | Tested in Manager/Admin UI verification | **FIXED** |
| **MED-04** | **MEDIUM** | In `(auth)/login.tsx`, unmounted component navigation timers were invoked without unmount cleanup, causing potential memory leaks and state updates on unmounted screens. | Replaced timer-based delay with direct synchronous navigation on matching role; stored mismatched role fallback navigation timer in `useRef` with cleanup. | Verified in `login.tsx` | **FIXED** |
| **MED-05** | **MEDIUM** | In `mockService.ts`, endpoint routing used loose substring matching `cleanEndpoint.includes('/approve')`, risking collision with unintended endpoints. | Replaced with strict `startsWith` and `endsWith` path matching logic. | `BUG-006` in `bug_fixes.test.ts` | **FIXED** |
| **LOW-01** | **LOW** | In `(admin)/approvals/index.tsx`, the threshold warning hardcoded `2500` paise (₹25), failing to reflect server-configured minimum thresholds dynamically. | Updated UI to dynamically read and format `item.minimumPricePaise ?? 2500` via `formatRupees`. | Verified in Approvals UI | **FIXED** |
| **LOW-02** | **LOW** | `app.json` was missing `cameraPermission` description in the `expo-image-picker` plugin configuration, causing potential iOS submission warnings or runtime camera permission prompts to lack explanation. | Added explicit `"cameraPermission": "FemmeFlo requires camera access to capture customer store photos and document receipts."` to `app.json`. | Verified in `app.json` | **FIXED** |
| **LOW-03** | **LOW** | Several route links contained trailing slashes (e.g., `/(admin)/users/`), risking subtle route resolution discrepancies under Expo Router. | Normalized all routes to standard slash format across seller, manager, and admin screens. | Verified in navigation routes | **FIXED** |

---

## 3. Deep Dive: Root Causes & Safe Fixes

### 3.1. CRIT-01: Client-Side Route Protection & Role-Based Access Control
* **Files Modified:**
  - `src/app/(admin)/_layout.tsx`
  - `src/app/(manager)/_layout.tsx`
  - `src/app/(seller)/_layout.tsx`
* **Root Cause:**
  The layout components rendered `<Stack>` directly without verifying the authenticated user or their role. If an unauthenticated user or a Seller opened a deep link to an admin path (e.g., `femmeflo://(admin)/users`), the screen rendered unauthorized views.
* **Fix Applied:**
  In each role layout, `useAuth()` checks `isLoading`, `isAuthenticated`, and `user?.role`. While loading, an accessible full-screen spinner is displayed. If not authenticated, the user is redirected to `/(auth)/login`. If an authenticated user attempts to access an unauthorized section (e.g., Seller attempting to view Manager or Admin routes), they are redirected to their respective role's home workspace.

### 3.2. CRIT-02: Session Restoration Bypass on HTTP 401/403
* **Files Modified:**
  - `src/context/AuthContext.tsx`
* **Root Cause:**
  In `restoreSession()`, `authApi.me()` was called to validate the stored token. When the backend or mock server responded with HTTP 401 Unauthorized or 403 Forbidden, the generic catch block fell back to `await tokenStorage.getCachedUser()`. This re-authenticated an expired, invalidated, or revoked user session offline.
* **Fix Applied:**
  The catch block now inspects `err?.statusCode` and `err?.status`. If 401 or 403, it immediately executes `tokenStorage.clearToken()`, wipes cached state (`user = null`, `token = null`), and aborts restoration. Cached user restoration is strictly reserved for genuine offline network errors (`err.isNetworkError`).

### 3.3. HIGH-01: JWT Auth Token Exposure in URLs
* **Files Modified:**
  - `src/api/seller.ts`
  - `src/app/(seller)/sales/[id].tsx`
* **Root Cause:**
  `sellerApi.getInvoicePdfUrl(saleId)` generated URLs like `${API_BASE_URL}/seller/sales/${saleId}/invoice.pdf?token=${encodeURIComponent(token)}`. Placing bearer tokens in URL query strings violates OWASP and API security standards because URLs are stored in plain text in browser histories, proxy logs, and HTTP server access logs.
* **Fix Applied:**
  - Removed `&token=` from `getInvoicePdfUrl`.
  - Updated `handleDownloadInvoice` in `[id].tsx` to pass the token securely in the `Authorization: Bearer <token>` header via `FileSystem.downloadAsync(url, targetUri, { headers: { Authorization: ... } })`.
  - Added web-platform safety (`Platform.OS === 'web'` downloads using blob URLs).

### 3.4. HIGH-02: Below-Minimum Sale Approval Inventory & Invoice Integrity
* **Files Modified:**
  - `src/api/mockService.ts`
  - `src/app/(seller)/sales/[id].tsx`
* **Root Cause:**
  When a Super Admin approved a sale below the ₹25 threshold, `mockService.ts` set `sale.status = 'APPROVED'` without deducting van stock (`mockDb.inventory.balance`), without updating `soldPackets`, and without recording a `SALE` entry in `mockDb.transactions`. In addition, `sales/[id].tsx` blocked invoice downloads unless `status === 'CONFIRMED'`.
* **Fix Applied:**
  - In `mockService.ts`, approving a sale transitions its status to `'CONFIRMED'`, decrements seller stock balance by `packetCount`, increments `soldPackets`, and appends an immutable `SALE` stock transaction.
  - In `sales/[id].tsx`, `isConfirmed` checks `sale.status === 'CONFIRMED' || sale.status === 'APPROVED'`.

### 3.5. HIGH-03: POS Checkout Idempotency Key Deduplication
* **Files Modified:**
  - `src/api/types.ts`
  - `src/api/seller.ts`
  - `src/api/mockService.ts`
  - `src/app/(seller)/sales/new.tsx`
* **Root Cause:**
  In flaky cellular environments, if an HTTP response timed out after the server created an order, a seller retrying the sale caused a second order to be placed and inventory to be deducted twice.
* **Fix Applied:**
  - Initialized a unique `idempotencyKey` (`ff_pos_<random>`) when the POS screen mounts.
  - Forwarded `idempotencyKey` in the payload and as an `X-Idempotency-Key` header in `sellerApi.createSale`.
  - In `mockService.ts`, processed keys are stored in a deduplication map; retrying a request with an existing key immediately returns the previously created order without re-deducting inventory.

### 3.6. MED-01: Synchronous Re-Entry Locks
* **Files Modified:**
  - `src/app/(seller)/sales/new.tsx`
  - `src/app/(seller)/sales/[id].tsx`
  - `src/app/(seller)/customers/new.tsx`
  - `src/app/(manager)/sellers/new.tsx`
  - `src/app/(admin)/approvals/index.tsx`
  - `src/app/(admin)/categories/index.tsx`
  - `src/app/(admin)/inventory/transfer.tsx`
  - `src/app/(admin)/settings/index.tsx`
  - `src/app/(shared)/change-password.tsx`
  - `src/app/(auth)/forgot-password.tsx`
  - `src/app/(auth)/reset-password.tsx`
  - `src/app/(shared)/notifications.tsx`
  - `src/app/(seller)/index.tsx`
* **Root Cause:**
  Mobile touchscreen double-taps can dispatch multiple events before React completes state rendering to disable the action buttons.
* **Fix Applied:**
  Added immediate synchronous checks (`if (isSubmitting) return;`, `if (isCollecting) return;`, `if (actionId) return;`) at the first line of mutation event handlers.

---

## 4. Verification & Validation Evidence

### A. TypeScript Typecheck
```bash
> femmeflo-app@1.0.0 typecheck
> tsc --noEmit

# Output: 0 errors (Exit code 0)
```

### B. ESLint Static Analysis
```bash
> femmeflo-app@1.0.0 lint
> expo lint

env: load .env
env: export EXPO_PUBLIC_API_URL EXPO_PUBLIC_USE_MOCK_API

# Output: 0 problems (0 errors, 0 warnings) (Exit code 0)
```

### C. Automated Test Runner (`node --test`)
```bash
> femmeflo-app@1.0.0 test
> node --test src/__tests__/*.test.ts

▶ FemmeFlo Bug Audit & Safe Fixes Regression Suite
  ✔ BUG-001: Session restoration rejects cached user on HTTP 401/403 and clears storage (1.55ms)
  ✔ BUG-002: Admin approval updates stock balance, adds stock ledger transaction, and enables tax invoice (2.12ms)
  ✔ BUG-003: Re-entry guard prevents concurrent double submission (63.38ms)
  ✔ BUG-004: Strict customer email validation rejects malformed email strings (0.56ms)
  ✔ BUG-006: Endpoint matching requires strict path prefix and suffix (0.21ms)
  ✔ CRIT-01: Role permissions strictly prohibit Seller and Manager from executive actions (0.16ms)
  ✔ HIGH-01: Invoice PDF URL generation does not append sensitive token into query string (0.21ms)
  ✔ HIGH-03: Duplicate sale submissions with the same idempotency key are safely deduplicated (0.18ms)
✔ FemmeFlo Bug Audit & Safe Fixes Regression Suite (69.80ms)

▶ FemmeFlo Business-Critical Scenarios (Master Prompt Section 12)
  ✔ Scenario 1: A sale below the minimum price becomes pending when approval is required (1.20ms)
  ✔ Scenario 2: A pending sale does not cause client-side stock deductions or incentive credit (0.21ms)
  ✔ Scenario 3: An approved sale reflects the server-confirmed result and updates stock/incentives (0.17ms)
  ✔ Scenario 4: A rejected sale remains visible in history with REJECTED status (0.21ms)
  ✔ Scenario 5: A rejected sale does not cause a client-side stock deduction (0.43ms)
  ✔ Scenario 6: Retrying after an uncertain sale timeout does not create duplicate sales (Idempotency Key) (0.27ms)
  ✔ Scenario 7: A seller cannot perform Super Admin actions (0.19ms)
  ✔ Scenario 8: A manager cannot exceed manager permissions (0.22ms)
  ✔ Scenario 9: An expired session clears local token and triggers signout redirect (0.28ms)
  ✔ Scenario 10: A historical incentive does not change when the current seller incentive rate changes (0.40ms)
  ✔ Scenario 11: A final invoice is not shown as issued for an unconfirmed sale (0.28ms)
  ✔ Scenario 12: Payment options exclude partial payment methods and support exactly CASH, BANK, PENDING (0.17ms)
  ✔ Scenario 13: Customer email is required for customer onboarding (0.59ms)
  ✔ Scenario 14: A denied GPS permission does not crash customer onboarding (manual entry fallback) (0.36ms)
  ✔ Scenario 15: Network failure does not silently discard entered form data (0.28ms)
✔ FemmeFlo Business-Critical Scenarios (Master Prompt Section 12) (6.85ms)

ℹ tests 23
ℹ suites 2
ℹ pass 23
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 253.46
```

---

## 5. Domain Rules & Business Invariants Checklist

All 10 core business requirements from Master Prompt A Section 12 were validated against the codebase:

1. **Sales Approval Thresholds:** Configured at ₹25 (2,500 paise). Sales at or above ₹25 are automatically `CONFIRMED`; sales below ₹25 require Super Admin approval and stay `PENDING`. Verified in `validateSalePrice` and `approvals/index.tsx`.
2. **Stock Deductions:** Stock is deducted exclusively upon sale confirmation (either at order creation for standard sales or upon Super Admin approval for below-threshold sales). Pending and rejected sales do not decrement stock balances.
3. **Commission Calculations:** Historical commissions and incentive records are stored as immutable snapshots (`ratePerPacket`, `amountRupees`). Altering a seller's base incentive rate never recalculates past earnings.
4. **Tax Invoice Generation:** Tax invoices are gated strictly to `CONFIRMED` or `APPROVED` sales. Unconfirmed, pending, or rejected orders are blocked from generating tax invoices.
5. **Payment Modes:** Strictly constrained to `CASH`, `BANK`, and `PENDING`. Partial payment options and unapproved modes are rejected.
6. **Customer Onboarding Validation:** Enforces non-empty store names, owner names, valid phone numbers, and RFC-compliant email addresses.
7. **GPS Permissions & Fallback:** If GPS location permission is denied by the user, onboarding gracefully prompts for manual address, city, and pincode entry without crashing or blocking form completion.
8. **Offline Form State Preservation:** Network errors during submission retain user inputs, allowing retry without losing entered information.
9. **Authentication & Token Expiry:** 401/403 responses immediately clear SecureStore credentials, reset authentication context, and redirect to the login screen.
10. **Role-Based Access Control:** Separate layouts and route guards enforce that unauthorized roles are strictly blocked from accessing other workspaces or executive actions, while eligible managers with dual-role permissions (`isSeller === true`) may switch between manager and seller views.
