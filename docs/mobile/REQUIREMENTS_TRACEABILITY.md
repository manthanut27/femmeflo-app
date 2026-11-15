# REQUIREMENTS TRACEABILITY MATRIX

**Project:** FemmeFlo Mobile Management System (Android / iOS)  
**App Version:** `1.0.20` (Android `versionCode: 24`)  
**Core Framework:** Expo SDK 58 (~58.0.25), React Native 0.88.1, React 19.3.0  
**Quality Status:** **356 / 356 Passing Tests (67 Test Suites)** under Node.js native test runner; 0 TypeScript errors (`tsc --noEmit`); 0 lint errors (`expo lint`).

---

## 1. Traceability Summary by Domain

| Feature Domain | Functional Requirements | Mobile Routes & Components | Automated Test Suites | Verification Status |
| :--- | :--- | :--- | :--- | :---: |
| **Authentication & RBAC** | Role hints, session caching, offline auth resilience, dual-role manager/seller support | `(auth)/login.tsx`, `AuthContext.tsx`, `tokenStorage` | `phase1_preparation.test.ts`, `offline_auth_resilience.test.ts`, `dual_role_persona_acceptance.test.ts`, `manager_permissions_acceptance.test.ts`, `bug_fixes.test.ts` | `VERIFIED_EXISTING` |
| **Customer Onboarding** | 4-card structure (GPS, photo, details, address), locked photo exemption, PIN code auto-lookup | `(seller)/customers/new.tsx`, `(manager)/customers/new.tsx`, `BatchCustomerOnboarding.tsx` | `customer_onboarding_acceptance.test.ts`, `onboarding_backend_payload_safety.test.ts` | `VERIFIED_EXISTING` |
| **Duty Shift Attendance** | Fingerprint biometric + mobile PIN/password fallback, starting/ending KM, resilient local shift | `(seller)/shift/index.tsx`, `ShiftAuthVerificationModal.tsx`, `shiftGuard.ts` | `shift_workflow_acceptance.test.ts`, `shift_start_auth_biometric_password.test.ts`, `odometer_distance_fallback.test.ts`, `seller_recent_shifts_and_page.test.ts` | `VERIFIED_EXISTING` |
| **Direct Sales & POS** | Decoupled direct sale without shift prerequisite, multi-line cart, idempotency keys, draft persistence | `(seller)/sales/new.tsx`, `(seller)/sales/[id].tsx`, `draftStorage.ts` | `phase2_features.test.ts`, `business_rules.test.ts`, `phase6_operations_acceptance.test.ts`, `sales_customer_dropdown.test.ts`, `sales_payment_collection.test.ts`, `seller_sales_pending_redirect.test.ts` | `VERIFIED_EXISTING` |
| **Price Approvals** | Sub-floor price queue, resubmission priority sorting, price revision without re-entry | `(admin)/approvals/index.tsx`, `(seller)/sales/[id].tsx`, `saleSanitizer.ts` | `admin_approvals_view.test.ts`, `rejected_sale_price_reapproval.test.ts` | `VERIFIED_EXISTING` |
| **Voice Translation** | Speech-to-text Hindi/Hinglish to English translation, review, edit modal, and client fallback | `VoiceFeedbackTranslator.tsx`, `voiceUtils.ts`, `translateApi.ts` | `voice_translation_acceptance.test.ts` | `VERIFIED_EXISTING` |
| **Stock & Warehouses** | Crash-proof stock transfer with validated UUIDs, factory receipts, van stock tracking | `(admin)/inventory/transfer.tsx`, `(seller)/inventory/index.tsx` | `stock_transfer_safety.test.ts`, `stock_movement_hub.test.ts` | `VERIFIED_EXISTING` |
| **Admin Command Center** | Centralized 13-action hub, multi-tier geographic filters, territory manager administration | `(admin)/actions/index.tsx`, `(admin)/index.tsx`, `(manager)/quick-actions/index.tsx` | `phase7_admin_acceptance.test.ts`, `admin_actions_navigation.test.ts`, `admin_territory_scope_filters.test.ts`, `daily_reporting_acceptance.test.ts` | `VERIFIED_EXISTING` |
| **Mobile UX & Stability** | Village-friendly toasts, accessibility roles, keyboard-avoiding modal safety, cache & rate limiting | `toast.ts`, `ISTClock.tsx`, `appPermissions.ts`, `responsive.ts` | `phase8_release_readiness.test.ts`, `toast_naming.test.ts`, `accessibility_roles_safety.test.ts`, `responsive_system.test.ts`, `keyboard_avoiding_modals.test.ts`, `app_permissions_management.test.ts` | `VERIFIED_EXISTING` |

---

## 2. Detailed Requirement & Verification Ledger

### REQ-AUTH-001: Unified Authentication & Role Guards
* **Role:** Field Seller, Territory Manager, Super Admin
* **Business Requirement:** Role-aware login with role pills (`SELLER`, `MANAGER`, `SUPER_ADMIN`), verifying credentials with server-authoritative role matching and token storage in Expo SecureStore.
* **Mobile Implementation:** `src/app/(auth)/login.tsx`, `src/context/AuthContext.tsx`
* **Backend Endpoint:** `POST /api/v1/auth/login`, `GET /api/v1/auth/me`
* **Test Suite Verification:** `src/__tests__/phase1_preparation.test.ts`, `src/__tests__/bug_fixes.test.ts`
* **Status:** `VERIFIED_EXISTING` (Passing)

### REQ-AUTH-002: Offline Authentication Resilience & Dual-Role Support
* **Role:** All Roles (Special handling for Managers who also act as Field Sellers)
* **Business Requirement:** If backend is unreachable or returns 5xx error, restore authenticated profile from encrypted local cache without role alteration. Support dual-role managers (`isSeller: true`) allowing access to field sales tools.
* **Mobile Implementation:** `src/context/AuthContext.tsx`, `src/api/client.ts` (`tokenStorage.getCachedUser()`)
* **Test Suite Verification:** `src/__tests__/offline_auth_resilience.test.ts`, `src/__tests__/dual_role_persona_acceptance.test.ts`, `src/__tests__/manager_permissions_acceptance.test.ts`
* **Status:** `VERIFIED_EXISTING` (Passing)

### REQ-CUST-001: 4-Card Customer Onboarding with GPS Auto-Capture
* **Role:** Field Seller, Territory Manager
* **Business Requirement:** Register retail customers with:
  1. Auto-acquired GPS coordinates (`latitude`, `longitude`, `accuracy`) via `expo-location`.
  2. Mandatory Shop Name, Owner Name, Contact Phone, and mandatory Email (RFC-compliant regex).
  3. Dynamic Category selector and Dynamic Manager searchable dropdown.
  4. Address Card with 6-digit PIN code auto-lookup populating State, District, and Village list.
* **Mobile Implementation:** `src/app/(seller)/customers/new.tsx`, `src/app/(manager)/customers/new.tsx`, `src/api/seller.ts`
* **Backend Endpoint:** `POST /api/v1/seller/customers`, `GET /api/v1/seller/customers/pincode/:pincode`
* **Test Suite Verification:** `src/__tests__/customer_onboarding_acceptance.test.ts`, `src/__tests__/onboarding_backend_payload_safety.test.ts`
* **Status:** `VERIFIED_EXISTING` (Passing)

### REQ-CUST-002: Storefront Photo Upload with Exemption Locking
* **Role:** Field Seller, Territory Manager
* **Business Requirement:** Capture or pick retail storefront photo. When a photo is selected, the exemption reason dropdown must be **automatically locked and disabled**. If no photo is selected, an exemption reason must be provided.
* **Mobile Implementation:** `src/app/(seller)/customers/new.tsx`, `src/api/seller.ts` (`uploadCustomerPhoto`)
* **Backend Endpoint:** `POST /api/v1/seller/customers/:id/photo` (Multipart Form-Data)
* **Test Suite Verification:** `src/__tests__/customer_onboarding_acceptance.test.ts`
* **Status:** `VERIFIED_EXISTING` (Passing)

### REQ-SHFT-001: Duty Shift Attendance via Biometrics with Password Fallback
* **Role:** Field Seller, Territory Manager
* **Business Requirement:** Replace legacy face selfies with native **Fingerprint / Biometric authentication** (`expo-local-authentication`) and **Mobile PIN/Password fallback**. Maintain backwards-compatible payload parameters (`faceVerified: true`, `faceConfidence: 0.99`, `faceMethod`).
* **Mobile Implementation:** `src/components/common/ShiftAuthVerificationModal.tsx`, `src/app/(seller)/shift/index.tsx`
* **Backend Endpoint:** `POST /api/v1/seller/shifts/start`, `POST /api/v1/seller/shifts/end`
* **Test Suite Verification:** `src/__tests__/shift_start_auth_biometric_password.test.ts`, `src/__tests__/shift_workflow_acceptance.test.ts`
* **Status:** `VERIFIED_EXISTING` (Passing)

### REQ-SHFT-002: Odometer Distance Tracking & Resilient Offline Shifts
* **Role:** Field Seller
* **Business Requirement:** Capture starting and ending odometer KM. If backend fails or is offline, create a resilient local active shift (`shift_local_<timestamp>`) in `draftStorage` to avoid blocking daily route visits.
* **Mobile Implementation:** `src/utils/draftStorage.ts`, `src/utils/shiftGuard.ts`, `src/api/seller.ts`
* **Test Suite Verification:** `src/__tests__/odometer_distance_fallback.test.ts`, `src/__tests__/seller_recent_shifts_and_page.test.ts`
* **Status:** `VERIFIED_EXISTING` (Passing)

### REQ-SALE-001: Decoupled Direct POS Sales Flow & Idempotency
* **Role:** Field Seller, Territory Manager
* **Business Requirement:** Field officers can record new sales directly without mandatory active shift prerequisite. Bind every submission to an RFC4122 v4 UUID (`X-Idempotency-Key`) and deterministic payload hash to prevent duplicate orders.
* **Mobile Implementation:** `src/app/(seller)/sales/new.tsx`, `src/utils/draftStorage.ts`, `src/api/seller.ts`
* **Backend Endpoint:** `POST /api/v1/seller/sales`
* **Test Suite Verification:** `src/__tests__/phase2_features.test.ts`, `src/__tests__/phase6_operations_acceptance.test.ts`, `src/__tests__/seller_shift_prerequisite.test.ts`
* **Status:** `VERIFIED_EXISTING` (Passing)

### REQ-SALE-002: Minimum Price Floor Enforcement & Reapproval Workflow
* **Role:** Field Seller, Super Admin
* **Business Requirement:** If line-item unit price < ₹25.00, flag sale as `PENDING_APPROVAL` with zero stock deduction and zero commission. When rejected, seller can revise price and resubmit for approval without retyping order. Resubmitted sales are prioritized at the top of the admin approvals queue.
* **Mobile Implementation:** `src/app/(admin)/approvals/index.tsx`, `src/app/(seller)/sales/[id].tsx`, `src/utils/saleSanitizer.ts`
* **Backend Endpoint:** `GET /api/v1/admin/approvals`, `POST /api/v1/admin/approvals/:id/approve`, `POST /api/v1/admin/approvals/:id/reject`, `PATCH /api/v1/seller/sales/:id`
* **Test Suite Verification:** `src/__tests__/business_rules.test.ts`, `src/__tests__/admin_approvals_view.test.ts`, `src/__tests__/rejected_sale_price_reapproval.test.ts`
* **Status:** `VERIFIED_EXISTING` (Passing)

### REQ-VOIC-001: Real-Time Hindi/Hinglish Voice Feedback Translation
* **Role:** Field Seller, Territory Manager
* **Business Requirement:** Record spoken observations in Hindi or Hinglish via `expo-speech-recognition`, translate into structured English, and provide review, edit, undo, and quick-chip insertion before appending to field visit records.
* **Mobile Implementation:** `src/components/common/VoiceFeedbackTranslator.tsx`, `src/utils/voiceUtils.ts`, `src/api/translate.ts`
* **Backend Endpoint:** `POST /api/v1/translate` (with client fallback engine)
* **Test Suite Verification:** `src/__tests__/voice_translation_acceptance.test.ts`
* **Status:** `VERIFIED_EXISTING` (Passing)

### REQ-STCK-001: Crash-Proof Stock Transfers & Logistics
* **Role:** Super Admin
* **Business Requirement:** Inter-warehouse and van transfers must resolve valid StockLocation UUIDs from inventory summaries, preventing malformed payload exceptions or unhandled rejections.
* **Mobile Implementation:** `src/app/(admin)/inventory/transfer.tsx`, `src/api/admin.ts`
* **Backend Endpoint:** `POST /api/v1/admin/inventory/transfers`, `POST /api/v1/admin/inventory/receipts`
* **Test Suite Verification:** `src/__tests__/stock_transfer_safety.test.ts`, `src/__tests__/stock_movement_hub.test.ts`
* **Status:** `VERIFIED_EXISTING` (Passing)

### REQ-ADMN-001: Centralized 13-Action Command Center
* **Role:** Super Admin
* **Business Requirement:** Provide a centralized hub linking all 13 administrative capabilities with status bar and safe-area alignment.
* **Mobile Implementation:** `src/app/(admin)/actions/index.tsx`
* **Test Suite Verification:** `src/__tests__/admin_actions_navigation.test.ts`, `src/__tests__/phase7_admin_acceptance.test.ts`
* **Status:** `VERIFIED_EXISTING` (Passing)

### REQ-UX-001: Village-Friendly Messaging & UI Safety
* **Role:** All Roles
* **Business Requirement:** Toast messages and prompts must use simple, everyday terminology without confusing jargon. Modals must avoid keyboard clipping and enforce proper accessibility roles.
* **Mobile Implementation:** `src/utils/toast.ts`, `src/components/common/ISTClock.tsx`
* **Test Suite Verification:** `src/__tests__/toast_naming.test.ts`, `src/__tests__/keyboard_avoiding_modals.test.ts`, `src/__tests__/accessibility_roles_safety.test.ts`, `src/__tests__/phase8_release_readiness.test.ts`
* **Status:** `VERIFIED_EXISTING` (Passing)
