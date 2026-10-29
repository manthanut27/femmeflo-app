# INFORMATION ARCHITECTURE & SCREEN SPECIFICATIONS

**Mobile Platform:** Android (React Native + Expo SDK 58 + Expo Router)  
**Target Roles:** Super Admin, Manager, Seller

---

## 1. Application Lifecycle & Routing Structure

```text
femmeflo-app/src/app/
├── _layout.tsx                     # Global Root Layout (Fonts, Theme, Session Provider, Toast)
├── index.tsx                       # Initial Splash & Session Resolver Route
├── (auth)/
│   ├── _layout.tsx                 # Auth Stack Layout
│   ├── login.tsx                   # Role-Aware Login Screen (SH-001)
│   ├── forgot-password.tsx         # Password Recovery Request (SH-002)
│   └── reset-password.tsx          # Password Reset Execution (SH-003)
├── (seller)/
│   ├── _layout.tsx                 # Seller Tab Navigation Shell
│   ├── index.tsx                   # Seller Operational Dashboard (SEL-001)
│   ├── customers/
│   │   ├── index.tsx               # Customer Directory & Search (SEL-002)
│   │   ├── new.tsx                 # Add Customer + GPS Onboarding (SEL-003)
│   │   └── [id].tsx                # Customer Profile & Sale History (SEL-004)
│   ├── sales/
│   │   ├── index.tsx               # Sales Orders Ledger (SEL-005)
│   │   ├── new.tsx                 # POS New Sale + Minimum Price Check (SEL-006)
│   │   └── [id].tsx                # Sale Order Details & Payment Collect (SEL-007)
│   ├── inventory/
│   │   └── index.tsx               # Personal Stock Balances & Transactions (SEL-008)
│   ├── incentives/
│   │   └── index.tsx               # Commission Tracker & Rate History (SEL-009)
│   └── profile/
│       └── index.tsx               # Seller Profile & Duty Attendance (SEL-010)
├── (manager)/
│   ├── _layout.tsx                 # Manager Tab Navigation Shell
│   ├── index.tsx                   # Territory KPI Dashboard (MGR-001)
│   ├── sellers/
│   │   ├── index.tsx               # Supervised Field Officers List (MGR-002)
│   │   ├── new.tsx                 # Onboard Field Officer (MGR-003)
│   │   └── [id].tsx                # Seller Activity & Performance (MGR-004)
│   ├── customers/
│   │   └── index.tsx               # Territory Retail Stores (MGR-005)
│   ├── sales/
│   │   └── index.tsx               # Territory Sales Stream (MGR-006)
│   └── inventory/
│       └── index.tsx               # Territory Warehouse & Van Stock (MGR-007)
├── (admin)/
│   ├── _layout.tsx                 # Super Admin Navigation Shell
│   ├── index.tsx                   # National Executive Dashboard (ADM-001)
│   ├── approvals/
│   │   └── index.tsx               # Below-Minimum Price Approvals Queue (ADM-002)
│   ├── inventory/
│   │   ├── index.tsx               # National Warehouses Stock Valuation (ADM-003)
│   │   └── transfer.tsx            # Factory Receipts & Stock Transfer (ADM-004)
│   ├── users/
│   │   ├── index.tsx               # Managers & Sellers Master Directory (ADM-005)
│   │   ├── manager-new.tsx         # Create Territory Manager (ADM-006)
│   │   └── seller-new.tsx          # Create Field Officer (ADM-007)
│   ├── settings/
│   │   └── index.tsx               # Minimum Sale Price & Config (ADM-008)
│   └── categories/
│       └── index.tsx               # Customer Categories Management (ADM-009)
└── (shared)/
    ├── notifications.tsx           # In-App Notification Center (SH-004)
    └── change-password.tsx         # Change Password Modal (SH-005)
```

---

## 2. Exhaustive Screen Specifications

### SH-001: Role-Aware Login Screen
* **Screen ID:** `SH-001`
* **Display Name:** Sign In
* **User Role:** Public (All roles entry)
* **Route:** `/(auth)/login`
* **Entry Points:** App launch (if unauthenticated), session expiration redirect, logout.
* **Required Permissions:** None (Public)
* **API Dependencies:** `POST /api/v1/auth/login` (with role-specific endpoint hints `seller/auth/login`, `manager/auth/login`, `admin/auth/login`), `GET /api/v1/auth/me`
* **Loading State:** Disabled button with activity indicator spinner; input fields disabled.
* **Empty State:** Blank email and password inputs with field placeholders and role pills.
* **Error State:** Top alert banner with specific backend message (e.g., "Invalid credentials").
* **Important Actions:**
  * Select role hint pill (Seller, Manager, Super Admin).
  * Enter identifier (email/phone) and password.
  * Tap "Sign In" to authenticate.
  * Tap "Forgot Password?" to open recovery.
* **Acceptance Criteria:**
  1. Authenticates against selected role context.
  2. Saves JWT into Expo SecureStore.
  3. Verifies `user.role` from server response; handles role mismatches gracefully.
  4. Transitions seamlessly to appropriate role root.

---

### SEL-001: Seller Operational Dashboard
* **Screen ID:** `SEL-001`
* **Display Name:** Seller Dashboard
* **User Role:** Seller
* **Route:** `/(seller)/`
* **Entry Points:** Seller sign-in, bottom tab "Dashboard".
* **Required Permissions:** `role === 'SELLER'`
* **API Dependencies:** `GET /api/v1/seller/dashboard`, `GET /api/v1/seller/shifts/current`
* **Loading State:** Skeleton cards for sales metrics, stock counters, and shift widget.
* **Empty State:** Metrics show ₹0.00, 0 packets sold with encouragement to begin sales.
* **Error State:** Error banner with pull-to-refresh and "Tap to retry" button.
* **Important Actions:**
  * View Today's Sales (Amount in ₹, Packet Count).
  * View Remaining Stock balance.
  * Start Shift / Check-In at customer / End Shift.
  * Quick-actions: "New Sale", "Add Customer".
* **Acceptance Criteria:** Accurate metrics rendered; pull-to-refresh updates live state; duty status transitions reactively.

---

### SEL-002: Customer Directory & Search
* **Screen ID:** `SEL-002`
* **Display Name:** Customers
* **User Role:** Seller
* **Route:** `/(seller)/customers/`
* **Entry Points:** Bottom tab "Customers", Dashboard "View All Customers".
* **Required Permissions:** `role === 'SELLER'`
* **API Dependencies:** `GET /api/v1/seller/customers`, `GET /api/v1/categories`
* **Loading State:** Skeleton list rows.
* **Empty State:** Illustration with "No customers found. Onboard your first retail shop!".
* **Error State:** Inline error with retry trigger.
* **Important Actions:**
  * Debounced search bar by Shop Name, Owner, or Phone.
  * Filter by Category pill chips.
  * Tap customer card to open detail.
  * Floating action button (FAB) "+" to navigate to `new.tsx`.
* **Acceptance Criteria:** Debounced search triggers request after 300ms; pagination loads next page on scroll end.

---

### SEL-003: Customer Onboarding with GPS & Photo
* **Screen ID:** `SEL-003`
* **Display Name:** Onboard Customer
* **User Role:** Seller
* **Route:** `/(seller)/customers/new`
* **Entry Points:** Customers list FAB, Dashboard quick action.
* **Required Permissions:** `role === 'SELLER'`
* **API Dependencies:** `POST /api/v1/seller/customers`, `POST /api/v1/seller/customers/{id}/photo`, `GET /api/v1/seller/customers/pincode/{pincode}`, `GET /api/v1/categories`
* **Loading State:** Coordinate acquisition spinner; submission progress overlay.
* **Empty State:** Blank onboarding form with pre-fetched GPS coordinates.
* **Error State:** Field-level validation messages; location permission warning dialog.
* **Important Actions:**
  * Acquire foreground GPS coordinates automatically on mount.
  * Tap "Refresh Location" to re-poll GPS.
  * Enter 6-digit Pincode to auto-populate State, District, and Villages.
  * Enter required Shop Name, Owner Name, Email, and Phone.
  * Select Category from backend dropdown.
  * Optional: Take or select storefront photo.
  * Submit customer form.
* **Acceptance Criteria:**
  1. Email is strictly required.
  2. Denied GPS permission displays non-blocking recovery banner allowing manual entry.
  3. Form fields are preserved if submission encounters a network error.

---

### SEL-006: Point-of-Sale Sale Creation (POS)
* **Screen ID:** `SEL-006`
* **Display Name:** New Sale (POS)
* **User Role:** Seller
* **Route:** `/(seller)/sales/new`
* **Entry Points:** Sales list FAB, Dashboard "New Sale".
* **Required Permissions:** `role === 'SELLER'`
* **API Dependencies:** `POST /api/v1/seller/sales`, `GET /api/v1/seller/products`, `GET /api/v1/seller/customers`, `GET /api/v1/seller/inventory`
* **Loading State:** Skeletons for customer & SKU selectors; modal spinner on submission.
* **Empty State:** Product selector with quantity `0`.
* **Error State:** Insufficient stock warning; below-minimum price notification.
* **Important Actions:**
  * Select customer.
  * Select product SKU and enter packet quantity.
  * View product current stock balance.
  * Enter unit price (rupees).
  * If price < minimum price (e.g. ₹25), an amber warning banner highlights that sale will be submitted as `PENDING` approval.
  * Select Payment Mode: Cash, Bank, or Pending.
  * Tap "Confirm & Record Sale".
* **Acceptance Criteria:**
  1. Prevents duplicate submissions by disabling button upon tap.
  2. When price < minimum, creates sale as `PENDING`. Stock is not deducted on client.
  3. When price >= minimum, creates sale as `CONFIRMED`.
  4. Unconfirmed sales do not generate downloadable tax invoices.

---

### ADM-002: Below-Minimum Price Sale Approvals Queue
* **Screen ID:** `ADM-002`
* **Display Name:** Price Approvals
* **User Role:** Super Admin
* **Route:** `/(admin)/approvals/`
* **Entry Points:** Super Admin tab "Approvals", Executive dashboard alert.
* **Required Permissions:** `role === 'SUPER_ADMIN'`
* **API Dependencies:** `GET /api/v1/admin/approvals`, `POST /api/v1/admin/approvals/{id}/approve`, `POST /api/v1/admin/approvals/{id}/reject`
* **Loading State:** Skeleton approval cards.
* **Empty State:** Checkmark illustration with "All low-price sales reviewed! No pending requests."
* **Error State:** Retryable error state banner.
* **Important Actions:**
  * View pending sale card showing Seller name, Customer, Requested Unit Price vs Minimum Price, and Total Discount.
  * Tap "Approve" -> Confirmation dialog -> Sale confirmed, stock deducted.
  * Tap "Reject" -> Confirmation dialog with optional reason -> Sale rejected without deducting stock.
* **Acceptance Criteria:**
  1. Super Admin action immediately calls backend approval endpoint.
  2. Approved sale status reflects `CONFIRMED`.
  3. Rejected sale status reflects `REJECTED` and remains in audit history.

---

### ADM-004: HQ Inventory Receipts & Transfers
* **Screen ID:** `ADM-004`
* **Display Name:** Stock Movements
* **User Role:** Super Admin
* **Route:** `/(admin)/inventory/transfer`
* **Entry Points:** Admin Inventory screen "New Movement" button.
* **Required Permissions:** `role === 'SUPER_ADMIN'`
* **API Dependencies:** `POST /api/v1/admin/inventory/receipts`, `POST /api/v1/admin/inventory/transfers`, `GET /api/v1/admin/warehouses`, `GET /api/v1/admin/sellers`, `GET /api/v1/admin/products`
* **Loading State:** Warehouse list loading spinner; submission loading overlay.
* **Empty State:** Blank transfer form.
* **Error State:** Insufficient source warehouse balance alert.
* **Important Actions:**
  * Select Movement Type: "Inward Factory Receipt" vs "Stock Transfer to Seller/Warehouse".
  * For Transfer: Select Source Warehouse, Destination (Seller or Warehouse), Product SKU, and Quantity.
  * Submit transfer.
* **Acceptance Criteria:** Validates source balance before sending; authoritative balance updated on server.

---

### SH-004: In-App Notification Center
* **Screen ID:** `SH-004`
* **Display Name:** Notifications
* **User Role:** All Authenticated Roles
* **Route:** `/(shared)/notifications`
* **Entry Points:** Header Bell Icon.
* **Required Permissions:** Authenticated session.
* **API Dependencies:** `GET /api/v1/notifications`, `PATCH /api/v1/notifications/{id}/read`, `POST /api/v1/notifications/read-all`
* **Loading State:** Skeleton notification items.
* **Empty State:** Bell icon with "No new notifications".
* **Error State:** Network error banner.
* **Important Actions:**
  * Tap single notification to mark as read and navigate to referenced entity.
  * Tap "Mark all read" in header.
* **Acceptance Criteria:** Unread count in header bell updates reactively; read status persists across sessions.
