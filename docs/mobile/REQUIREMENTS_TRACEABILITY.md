# REQUIREMENTS TRACEABILITY MATRIX

**Project:** FemmeFlo Mobile Management System (Android)  
**Status Key:**
* `VERIFIED_EXISTING`: Backend and web implementation verified in source code.
* `PARTIALLY_IMPLEMENTED`: Requires mobile adaptation (e.g., native hardware, GPS, file sharing).
* `NEEDS_VERIFICATION`: Requires verification against production environment settings.
* `MISSING`: Backend endpoint does not exist.
* `BLOCKED`: Blocked by dependency.

---

## 1. Authentication & Session Management

### REQ-AUTH-001: Unified Authentication with Role Hint
* **Role:** Super Admin, Manager, Seller
* **Business Requirement:** Shared login screen with role selection as a requested login context, validating email/password against the backend.
* **Intended Mobile Screen:** `(auth)/login` (Role selection hint pills: Seller, Manager, Super Admin)
* **Existing Website Implementation:** `src/app/login/page.tsx`, `src/components/RoleLoginScreen.tsx`
* **Existing Backend Endpoint:**
  * Role contexts: `POST /api/v1/seller/auth/login`, `POST /api/v1/manager/auth/login`, `POST /api/v1/admin/auth/login`, or fallback `POST /api/v1/auth/login`
* **Request & Response:**
  * Request: `{ identifier: "email@example.com", password: "password" }`
  * Response: `{ success: true, data: { token: "jwt", user: { id, name, email, role } } }`
* **Status:** `VERIFIED_EXISTING`
* **Required Mobile Work:** Implement login UI with role hint selector, loading states, error banner, and credentials validation.
* **Security Implications:** Token must be stored in Expo SecureStore. Client-selected role must be validated against `user.role` from server; reject or re-route on mismatch.
* **Acceptance Criteria:** Valid credentials store JWT in SecureStore and navigate to appropriate role root. Invalid credentials show clear error without crashing.
* **Automated Tests:** Unit test role matching validator; integration test login submission and token storage.

---

### REQ-AUTH-002: Session Restoration & Role Guard
* **Role:** All
* **Business Requirement:** App restart restores valid session; expired token prompts re-login.
* **Intended Mobile Screen:** Splash / Startup Gate -> Role Dashboard
* **Existing Website Implementation:** `src/lib/api/client.ts`, `src/components/RoleGuard.tsx`
* **Existing Backend Endpoint:** `GET /api/v1/auth/me`
* **Status:** `VERIFIED_EXISTING`
* **Required Mobile Work:** App launch checks SecureStore for token; calls `/auth/me` to verify validity; boots to role home or login.
* **Security Implications:** Never assume token validity without server handshake. Wipe token on 401.
* **Acceptance Criteria:** App cold boot recovers session within 1.5s on active network; redirect to login if token is expired.
* **Automated Tests:** Mock 401 response and verify token erasure and login redirection.

---

## 2. Seller Operations

### REQ-SEL-001: Seller Dashboard & Shift Duty Status
* **Role:** Seller
* **Business Requirement:** View daily sales metrics, current stock balance, duty shift status, and pending approvals.
* **Intended Mobile Screen:** `(seller)/dashboard`
* **Existing Website Implementation:** `src/app/seller/page.tsx`, `src/components/shifts/SellerShiftWidget.tsx`
* **Existing Backend Endpoint:** `GET /api/v1/seller/dashboard`, `GET /api/v1/seller/shifts/current`
* **Status:** `VERIFIED_EXISTING`
* **Required Mobile Work:** Native dashboard with KPI cards, active shift widget with start/end triggers, and pull-to-refresh.
* **Security Implications:** Only data belonging to the authenticated seller is accessible.
* **Acceptance Criteria:** Displays accurate sales count, packet count, stock balance, and shift status.
* **Automated Tests:** Verify dashboard metrics calculation and empty state handling.

---

### REQ-SEL-002: Customer Onboarding with Foreground GPS
* **Role:** Seller
* **Business Requirement:** Onboard retail store with shop name, owner name, required email, phone, category, address, and foreground GPS coordinates with manual review.
* **Intended Mobile Screen:** `(seller)/customers/new`
* **Existing Website Implementation:** `src/app/seller/customers/new/page.tsx`
* **Existing Backend Endpoint:** `POST /api/v1/seller/customers`
* **Request & Response:**
  * Request: `{ shopName, ownerName, email, phone, categoryId, address, pincode, state, district, village, latitude, longitude }`
  * Response: `{ success: true, data: { customer: CustomerItem } }`
* **Status:** `PARTIALLY_IMPLEMENTED` (Mobile requires `expo-location` native module)
* **Required Mobile Work:** Multi-field onboarding form with GPS coordinate acquisition, manual retry, pincode auto-fill lookup, and email validation.
* **Security Implications:** Foreground location only. Explain permission rationale. Fall back gracefully if GPS is disabled.
* **Acceptance Criteria:** Customer record created; coordinates captured; email mandatory; form retains entered values on recoverable network failure.
* **Automated Tests:** Test validation schema (email required, phone regex); test location permission denial fallback.

---

### REQ-SEL-003: Customer Store Photo Capture
* **Role:** Seller
* **Business Requirement:** Optional photograph of the retail storefront or owner.
* **Intended Mobile Screen:** `(seller)/customers/new`, `(seller)/customers/[id]`
* **Existing Website Implementation:** `src/app/seller/customers/new/page.tsx`
* **Existing Backend Endpoint:** `POST /api/v1/seller/customers/{id}/photo` (Multipart Form-Data)
* **Status:** `PARTIALLY_IMPLEMENTED` (Mobile requires `expo-image-picker`)
* **Required Mobile Work:** Image picker with camera/gallery choice, image compression, preview, and multipart upload.
* **Security Implications:** Validate file size (<5MB) and mime type before upload. Do not log binary file paths.
* **Acceptance Criteria:** Upload succeeds; photo thumbnail renders; failure does not block customer creation.
* **Automated Tests:** Verify image upload multipart construction.

---

### REQ-SEL-004: Point-of-Sale Sale Creation & Minimum Price Enforcement
* **Role:** Seller
* **Business Requirement:** Select customer, products, quantities, and unit price. If price is below the configured minimum (₹25 default or backend setting), mark sale as PENDING approval without deducting stock.
* **Intended Mobile Screen:** `(seller)/sales/new`
* **Existing Website Implementation:** `src/app/seller/sales/new/page.tsx`
* **Existing Backend Endpoint:** `POST /api/v1/seller/sales`
* **Request & Response:**
  * Request: `{ customerId, paymentMode: "CASH" | "BANK" | "PENDING", items: [{ productId, quantity, unitPricePaise }] }`
  * Response: `{ success: true, data: { sale: SaleItem } }`
* **Status:** `VERIFIED_EXISTING`
* **Required Mobile Work:** POS screen with SKU selector, price calculator, minimum price warning banner, duplicate submission protection, and payment selector.
* **Security Implications:** Price check must be authoritative on backend. Mobile warning is UX-only.
* **Acceptance Criteria:**
  1. Price >= minimum: Sale confirmed immediately, stock deducted on server.
  2. Price < minimum: Sale created with status `PENDING`, zero stock deducted, zero commission credit.
* **Automated Tests:** Test price validation logic; test pending approval state display; test multi-product payload structure.

---

### REQ-SEL-005: Payment Mode Selection & Collection
* **Role:** Seller
* **Business Requirement:** Payment options restricted exactly to Cash, Bank, Pending. Collect outstanding payment on pending sales. No partial payments.
* **Intended Mobile Screen:** `(seller)/sales/new`, `(seller)/sales/[id]`
* **Existing Website Implementation:** `src/app/seller/sales/page.tsx`
* **Existing Backend Endpoint:** `PATCH /api/v1/seller/sales/{id}/payment`
* **Status:** `VERIFIED_EXISTING`
* **Required Mobile Work:** Segmented control for Cash / Bank / Pending; payment collection modal for Pending sales.
* **Security Implications:** No client-side override of payment status.
* **Acceptance Criteria:** Only Cash, Bank, and Pending available. Collecting payment updates backend status to confirmed.
* **Automated Tests:** Validate payment mode enum values.

---

### REQ-SEL-006: Personal Inventory & Stock Transactions
* **Role:** Seller
* **Business Requirement:** View allocated van inventory by SKU and transaction ledger. Sellers cannot mutate inventory directly.
* **Intended Mobile Screen:** `(seller)/inventory`
* **Existing Website Implementation:** `src/app/seller/inventory/page.tsx`
* **Existing Backend Endpoint:** `GET /api/v1/seller/inventory`, `GET /api/v1/seller/inventory/transactions`
* **Status:** `VERIFIED_EXISTING`
* **Required Mobile Work:** Product balance list with remaining/assigned/sold counts, transaction history list with pull-to-refresh.
* **Security Implications:** Read-only access for sellers.
* **Acceptance Criteria:** Balances match server inventory record.
* **Automated Tests:** Inventory data mapping and pagination parsing.

---

### REQ-SEL-007: Seller Incentives & Commission Tracking
* **Role:** Seller
* **Business Requirement:** View commission earnings based on confirmed sales. Historical rate snapshots must remain immutable.
* **Intended Mobile Screen:** `(seller)/incentives`
* **Existing Website Implementation:** `src/app/seller/incentive/page.tsx`
* **Existing Backend Endpoint:** `GET /api/v1/seller/incentives`
* **Status:** `VERIFIED_EXISTING`
* **Required Mobile Work:** Monthly earnings card, per-packet commission rate badge, breakdown of earned vs pending payout.
* **Security Implications:** Calculations performed exclusively on backend.
* **Acceptance Criteria:** Confirmed sales calculate earnings; pending sales show ₹0 incentive.
* **Automated Tests:** Verify incentive card formatting and currency formatting (₹).

---

### REQ-SEL-008: Tax Invoice Download & Sharing
* **Role:** Seller, Super Admin
* **Business Requirement:** Download and share PDF tax invoice for confirmed sales. Pending sales have no final invoice.
* **Intended Mobile Screen:** `(seller)/sales/[id]`
* **Existing Website Implementation:** `src/lib/api/seller.ts` (`downloadInvoicePdf`)
* **Existing Backend Endpoint:** `GET /api/v1/invoices/{id}/pdf?download=true`
* **Status:** `PARTIALLY_IMPLEMENTED` (Mobile requires `expo-file-system` and `expo-sharing`)
* **Required Mobile Work:** Native PDF download using FileSystem.downloadAsync, followed by Android native share sheet (`expo-sharing`).
* **Security Implications:** Pass authorization token securely in request header or secure signed query param.
* **Acceptance Criteria:** Confirmed sale opens native Android share sheet with invoice PDF. Unconfirmed sale disables invoice download.
* **Automated Tests:** Unit test invoice button enable/disable based on sale status.

---

## 3. Manager Operations

### REQ-MGR-001: Territory Dashboard & Team Oversight
* **Role:** Manager
* **Business Requirement:** KPI overview of assigned sellers, territory sales volume, and customer reach.
* **Intended Mobile Screen:** `(manager)/dashboard`
* **Existing Website Implementation:** `src/app/manager/page.tsx`
* **Existing Backend Endpoint:** `GET /api/v1/manager/dashboard`
* **Status:** `VERIFIED_EXISTING`
* **Required Mobile Work:** Manager dashboard cards, team activity summary, and territory filter.
* **Security Implications:** Scoped strictly to the manager's assigned territory and sellers.
* **Acceptance Criteria:** Renders aggregate metrics for assigned sellers only.
* **Automated Tests:** Manager dashboard data parsing and empty state verification.

---

### REQ-MGR-002: Assigned Seller Supervision & Onboarding
* **Role:** Manager
* **Business Requirement:** View supervised sellers and onboard new field officers in territory.
* **Intended Mobile Screen:** `(manager)/sellers`, `(manager)/sellers/new`
* **Existing Website Implementation:** `src/app/manager/sellers/page.tsx`
* **Existing Backend Endpoint:** `GET /api/v1/manager/sellers`, `POST /api/v1/manager/sellers`
* **Status:** `VERIFIED_EXISTING`
* **Required Mobile Work:** Seller list with active duty status pill, search, and new seller onboarding form.
* **Security Implications:** Onboarding automatically binds seller to manager's territory.
* **Acceptance Criteria:** Seller list displays assigned officers; new seller created with manager's ID.
* **Automated Tests:** Seller creation validation tests.

---

### REQ-MGR-003: Territory Sales & Inventory Monitoring
* **Role:** Manager
* **Business Requirement:** View sales orders stream and stock balances across territory sellers.
* **Intended Mobile Screen:** `(manager)/sales`, `(manager)/inventory`
* **Existing Website Implementation:** `src/app/manager/sales/page.tsx`, `src/app/manager/inventory/page.tsx`
* **Existing Backend Endpoint:** `GET /api/v1/manager/sales`, `GET /api/v1/manager/inventory`
* **Status:** `VERIFIED_EXISTING`
* **Required Mobile Work:** Filterable sales list by seller and customer; inventory stock balance view.
* **Security Implications:** Read-only access to territory operational data.
* **Acceptance Criteria:** Manager sees all sales in territory with live status.
* **Automated Tests:** Territory sales filter logic.

---

## 4. Super Admin Operations

### REQ-ADM-001: National Executive Dashboard
* **Role:** Super Admin
* **Business Requirement:** National overview of revenue, sales volume, warehouse stock, and active users with multi-dimensional filtering.
* **Intended Mobile Screen:** `(admin)/dashboard`
* **Existing Website Implementation:** `src/app/admin/page.tsx`
* **Existing Backend Endpoint:** `GET /api/v1/admin/dashboard`, `GET /api/v1/admin/dashboard/filters`
* **Status:** `VERIFIED_EXISTING`
* **Required Mobile Work:** Executive dashboard with filter drawer (State, District, Manager, Seller, Category).
* **Security Implications:** Full system access. Super Admin role strictly enforced.
* **Acceptance Criteria:** Dashboard updates dynamically when filter criteria are applied.
* **Automated Tests:** Dashboard filter query parameter builder.

---

### REQ-ADM-002: Low-Price Sale Approvals & Rejections
* **Role:** Super Admin
* **Business Requirement:** Review sales submitted below minimum price. Approving confirms the sale, deducts warehouse stock, and enables invoicing. Rejecting marks the sale REJECTED without stock deduction.
* **Intended Mobile Screen:** `(admin)/approvals`
* **Existing Website Implementation:** `src/app/admin/approvals/page.tsx`
* **Existing Backend Endpoint:** `GET /api/v1/admin/approvals`, `POST /api/v1/admin/approvals/{id}/approve`, `POST /api/v1/admin/approvals/{id}/reject`
* **Status:** `VERIFIED_EXISTING`
* **Required Mobile Work:** Approval card list with requested price vs minimum price comparison, reason display, and native confirmation dialogs for Approve / Reject actions.
* **Security Implications:** Transactional execution on backend. Super Admin only.
* **Acceptance Criteria:**
  1. Approve: Backend confirms sale, stock is deducted, status becomes `CONFIRMED`.
  2. Reject: Backend updates status to `REJECTED`, zero stock deducted, historical record preserved.
* **Automated Tests:** Verify approval action handling and optimistic status updates with server rollback on failure.

---

### REQ-ADM-003: HQ Warehouse Inventory & Stock Transfers
* **Role:** Super Admin
* **Business Requirement:** Record inward factory stock receipts to HQ warehouse and transfer stock from HQ to regional warehouses or field sellers.
* **Intended Mobile Screen:** `(admin)/inventory`, `(admin)/inventory/transfer`
* **Existing Website Implementation:** `src/app/admin/inventory/page.tsx`, `src/app/admin/inventory/transfers/page.tsx`
* **Existing Backend Endpoint:**
  * Receipts: `POST /api/v1/admin/inventory/receipts`
  * Transfers: `POST /api/v1/admin/inventory/transfers`
  * Summary: `GET /api/v1/admin/inventory/summary`
* **Status:** `VERIFIED_EXISTING`
* **Required Mobile Work:** Stock balance overview by warehouse, Inward Stock form, Stock Transfer modal with destination selector and quantity check.
* **Security Implications:** Authoritative stock calculation is server-only. Prevent negative balances.
* **Acceptance Criteria:** Stock transfer validates available source balance and dispatches transfer transaction.
* **Automated Tests:** Validate transfer payload builder and quantity input constraints.

---

### REQ-ADM-004: Minimum Sale Price & Business Configuration
* **Role:** Super Admin
* **Business Requirement:** Configure the global minimum sale price in paise and low-stock alert thresholds.
* **Intended Mobile Screen:** `(admin)/settings`
* **Existing Website Implementation:** `src/app/admin/settings/page.tsx`
* **Existing Backend Endpoint:** `GET /api/v1/admin/settings`, `PATCH /api/v1/admin/settings`
* **Status:** `VERIFIED_EXISTING`
* **Required Mobile Work:** Settings screen with currency input, validation, and update trigger.
* **Security Implications:** High-impact configuration change. Requires Super Admin privileges.
* **Acceptance Criteria:** Updated minimum price is persisted and immediately influences new POS sale validation rules.
* **Automated Tests:** Validate settings payload conversion (rupees to paise).

---

### REQ-ADM-005: User Lifecycle & Role Administration
* **Role:** Super Admin
* **Business Requirement:** Create, view, update, activate, and deactivate Managers and Sellers.
* **Intended Mobile Screen:** `(admin)/users`, `(admin)/managers/new`, `(admin)/sellers/new`
* **Existing Website Implementation:** `src/app/admin/managers/page.tsx`, `src/app/admin/sellers/page.tsx`
* **Existing Backend Endpoint:** `GET/POST/PATCH /api/v1/admin/managers`, `GET/POST/PATCH /api/v1/admin/sellers`
* **Status:** `VERIFIED_EXISTING`
* **Required Mobile Work:** Tabbed user directory, search, status toggle, and registration forms.
* **Security Implications:** Only Super Admin can promote or deactivate users.
* **Acceptance Criteria:** Deactivated users cannot authenticate; newly created users appear in directory.
* **Automated Tests:** Test user form validation.

---

### REQ-ADM-006: Customer Category Management
* **Role:** Super Admin
* **Business Requirement:** Manage customer business classifications (e.g., General Merchant, Chemist, Beauty Parlour).
* **Intended Mobile Screen:** `(admin)/categories`
* **Existing Website Implementation:** `src/app/admin/categories/page.tsx`
* **Existing Backend Endpoint:** `GET/POST/PATCH /api/v1/categories`
* **Status:** `VERIFIED_EXISTING`
* **Required Mobile Work:** Category list, add category modal, and activate/deactivate toggle.
* **Security Implications:** Read access for all roles; mutation for Super Admin only.
* **Acceptance Criteria:** Categories created by admin are instantly available in Seller customer onboarding dropdown.
* **Automated Tests:** Verify category CRUD interactions.

---

## 5. In-App Notifications

### REQ-NOTIF-001: Real-time In-App Notification Center
* **Role:** All
* **Business Requirement:** View backend-synchronized notifications for shift alerts, low-price approvals, and stock receipts. Mark individual or all as read.
* **Intended Mobile Screen:** `(shared)/notifications`
* **Existing Website Implementation:** `src/app/seller/notifications/page.tsx`, `src/lib/api/notifications.ts`
* **Existing Backend Endpoint:** `GET /api/v1/notifications`, `PATCH /api/v1/notifications/{id}/read`, `POST /api/v1/notifications/read-all`
* **Status:** `VERIFIED_EXISTING`
* **Required Mobile Work:** Notification bell with badge counter in header, inbox list with unread highlights, and "Mark all read" action.
* **Security Implications:** Scoped to the authenticated user ID.
* **Acceptance Criteria:** Unread count displays correctly; marking read updates badge immediately.
* **Automated Tests:** Notification list state updates and read-status mutation.
