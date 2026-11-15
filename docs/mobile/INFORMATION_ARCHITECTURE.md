# INFORMATION ARCHITECTURE & SCREEN SPECIFICATIONS

**Mobile Platform:** Android (React Native 0.88.1 + Expo SDK 58 (~58.0.25) + Expo Router v58)  
**Target Roles:** Field Seller (`SELLER`), Territory Manager (`MANAGER`), Super Administrator (`SUPER_ADMIN`)

---

## 1. Application Routing & File Structure (`src/app/`)

The application implements a file-based routing architecture utilizing **Expo Router 58**. Navigators are organized by role layout groups with declarative access guards and safe-area insets:

```text
src/app/
├── +not-found.tsx                     # 404 Catch-All Fallback Route
├── index.tsx                           # Initial Splash & Session Resolver Route
├── _layout.tsx                         # Global Root Provider Shell (Auth, Toast, Fonts, SystemUI)
│
├── (auth)/                             # Public Authentication Stack
│   ├── _layout.tsx                     # Auth Stack Navigator Shell
│   ├── login.tsx                       # Role-Context Login Screen (SH-001)
│   ├── forgot-password.tsx             # Password Recovery Request (SH-002)
│   └── reset-password.tsx              # Password Reset Execution (SH-003)
│
├── (seller)/                           # Field Officer Navigation & Operational Hub
│   ├── _layout.tsx                     # Seller Bottom Tabs Shell (Dashboard, Customers, Sales, Stock, Profile)
│   ├── index.tsx                       # Seller Operational Dashboard (SEL-001)
│   ├── shift/
│   │   └── index.tsx                   # Duty Shift Attendance & Route Management (SEL-002)
│   ├── customers/
│   │   ├── _layout.tsx                 # Customers Sub-Stack Navigator
│   │   ├── index.tsx                   # Customer Directory & Search (SEL-003)
│   │   ├── new.tsx                     # 4-Card Customer Onboarding with GPS & Photo (SEL-004)
│   │   ├── bulk.tsx                    # Bulk Customer Table Import (SEL-005)
│   │   └── [id].tsx                    # Customer Detail, Location Map & Order History (SEL-006)
│   ├── sales/
│   │   ├── _layout.tsx                 # Sales Sub-Stack Navigator
│   │   ├── index.tsx                   # Sales Ledger & Order Status Stream (SEL-007)
│   │   ├── new.tsx                     # Decoupled Direct POS New Sale + Minimum Price Check (SEL-008)
│   │   ├── pending.tsx                 # Sub-Floor Pending Approval Sales Queue (SEL-009)
│   │   └── [id].tsx                    # Sale Details, Price Revision & Payment Collect (SEL-010)
│   ├── inventory/
│   │   └── index.tsx                   # Personal Van Inventory & Movement Ledger (SEL-011)
│   ├── incentives/
│   │   └── index.tsx                   # Commission Tracker & Payout History (SEL-012)
│   └── profile/
│       ├── _layout.tsx                 # Profile Sub-Stack Navigator
│       ├── index.tsx                   # Seller Profile & Performance Settings (SEL-013)
│       ├── permissions.tsx             # Granted Permissions Audit (SEL-014)
│       └── shifts.tsx                  # Historical Duty Shift Log (SEL-015)
│
├── (manager)/                          # Territory Manager Supervisory Hub
│   ├── _layout.tsx                     # Manager Bottom Tabs Shell (Dashboard, Team, Customers, Sales, Quick Actions)
│   ├── index.tsx                       # Territory KPI & Performance Dashboard (MGR-001)
│   ├── quick-actions/
│   │   └── index.tsx                   # Quick Actions Operational Hub (MGR-002)
│   ├── sellers/
│   │   ├── _layout.tsx                 # Sellers Sub-Stack Navigator
│   │   ├── index.tsx                   # Supervised Field Officers List (MGR-003)
│   │   └── new.tsx                     # Onboard New Field Officer (MGR-004)
│   ├── customers/
│   │   ├── _layout.tsx                 # Territory Customers Sub-Stack Navigator
│   │   ├── index.tsx                   # Territory Retail Stores Directory (MGR-005)
│   │   ├── new.tsx                     # Onboard Territory Customer (MGR-006)
│   │   └── bulk.tsx                    # Territory Bulk Customer Import (MGR-007)
│   ├── sales/
│   │   └── index.tsx                   # Territory Sales Stream & Dual-Role Sales Fallback (MGR-008)
│   ├── inventory/
│   │   └── index.tsx                   # Territory Van & Depot Stock Oversight (MGR-009)
│   ├── shifts/
│   │   └── index.tsx                   # Live Seller Shift Tracking & Route Oversight (MGR-010)
│   ├── incentives/
│   │   └── index.tsx                   # Team Commission Rollup (MGR-011)
│   └── profile/
│       ├── index.tsx                   # Manager Profile & Territory Boundaries (MGR-012)
│       └── permissions.tsx             # Manager Authority & Permissions Audit (MGR-013)
│
├── (admin)/                            # Super Administrator National Command Center
│   ├── _layout.tsx                     # Admin Bottom Navigation Shell (Dashboard, Approvals, Inventory, Actions)
│   ├── index.tsx                       # National Executive Dashboard (ADM-001)
│   ├── actions/
│   │   └── index.tsx                   # Centralized 13-Action Command Hub (ADM-002)
│   ├── approvals/
│   │   └── index.tsx                   # Sub-Floor Price Approvals Queue (Priority Resubmissions) (ADM-003)
│   ├── categories/
│   │   └── index.tsx                   # Trade Category Management (ADM-004)
│   ├── customers/
│   │   ├── index.tsx                   # National Retail Customer Database (ADM-005)
│   │   └── bulk.tsx                    # National Bulk Customer Ingestion (ADM-006)
│   ├── inventory/
│   │   ├── index.tsx                   # National Warehouses Stock Valuation (ADM-007)
│   │   └── transfer.tsx                # Factory Receipts & Inter-Warehouse/Van Transfer (ADM-008)
│   ├── reports/
│   │   ├── index.tsx                   # Executive Reports Hub (ADM-009)
│   │   ├── sales.tsx                   # National Sales Performance & Trend Analysis (ADM-010)
│   │   └── inventory.tsx               # Stock Velocity & Depletion Analytics (ADM-011)
│   ├── settings/
│   │   ├── index.tsx                   # Business Settings & Price Floor Config (ADM-012)
│   │   ├── password.tsx                # Master Password Configuration (ADM-013)
│   │   └── permissions.tsx             # Role-Based Permission Matrix (ADM-014)
│   ├── shifts/
│   │   └── index.tsx                   # Master Shift Tracking & Attendance Audit (ADM-015)
│   └── users/
│       ├── index.tsx                   # Managers & Sellers Master Directory (ADM-016)
│       └── new.tsx                     # Create Territory Manager or Field Officer (ADM-017)
│
└── (shared)/                           # Universal Modal & Shared Routes
    ├── _layout.tsx                     # Shared Stack Navigator Shell
    ├── notifications.tsx               # In-App Notification Center (SH-004)
    ├── change-password.tsx             # Change Password Screen (SH-005)
    └── permissions.tsx                 # Hardware & App Permissions Diagnostics (SH-006)
```

---

## 2. Tab Navigation & Bottom Shell Structure

### 2.1 Field Seller Tab Navigation (`/(seller)/_layout.tsx`)
1. **Dashboard Tab (`index`):** Active duty shift widget, daily sales revenue and packet counters, van stock balance, quick action buttons.
2. **Customers Tab (`customers`):** Searchable customer directory with category chips, 4-card customer onboarding FAB.
3. **Sales Tab (`sales`):** POS sales ledger, new decoupled direct sale creation, sub-floor pending approval list.
4. **Inventory Tab (`inventory`):** Allocated van stock per SKU, inward transfer history ledger.
5. **Profile Tab (`profile`):** Officer credentials, attendance history, permissions diagnostics.

### 2.2 Territory Manager Tab Navigation (`/(manager)/_layout.tsx`)
1. **Dashboard Tab (`index`):** Territory KPI summary, active sellers count, monthly packet volume, revenue metrics.
2. **Team Tab (`sellers`):** Supervised field officers list, individual seller activity, seller creation.
3. **Customers Tab (`customers`):** Territory retail stores directory, new store onboarding, bulk CSV import.
4. **Sales Tab (`sales`):** Territory sales order stream with automatic fallback to `/seller/sales` for dual-role field sales.
5. **Quick Actions Tab (`quick-actions`):** Rapid operational hub for customer onboarding, team onboarding, shift tracking, and stock view.

### 2.3 Super Administrator Navigation (`/(admin)/_layout.tsx`)
1. **Executive Dashboard (`index`):** National metrics (gross revenue, total packets, warehouse inventory, active sellers), multi-tier geographic filters (state, district, village, manager, seller).
2. **Price Approvals (`approvals`):** Queue of sub-floor orders with prioritized resubmitted sales, one-tap approve/reject dialogs.
3. **Inventory Hub (`inventory`):** HQ central depot valuation, factory stock receipts, crash-proof inter-warehouse/van transfers.
4. **Actions Hub (`actions`):** Centralized command center providing direct navigation across all 13 administrative capabilities.

---

## 3. Exhaustive Screen Specifications

### SH-001: Role-Aware Login Screen
* **Route:** `/(auth)/login`
* **Access:** Public
* **API Dependencies:** `POST /api/v1/auth/login`, `POST /api/v1/seller/auth/login`, `POST /api/v1/manager/auth/login`, `POST /api/v1/admin/auth/login`, `GET /api/v1/auth/me`
* **Key Features:**
  * Role selection hint pills: Field Officer (`SELLER`), Territory Manager (`MANAGER`), Super Admin (`SUPER_ADMIN`).
  * Email / Mobile number identifier input and secure password input with toggleable visibility.
  * Synchronous submission lock (`isSubmitting`) preventing duplicate login requests.
  * Stores Bearer JWT in `expo-secure-store` and caches user profile in `draftStorage`.
  * Verifies server-returned `user.role` against role hint, redirecting to the correct role root.

---

### SEL-002: Duty Shift Attendance & Route Management
* **Route:** `/(seller)/shift/index`
* **Access:** `role === 'SELLER'`
* **API Dependencies:** `GET /api/v1/seller/shifts/current`, `POST /api/v1/seller/shifts/start`, `POST /api/v1/seller/shifts/check-in`, `POST /api/v1/seller/shifts/check-out`, `POST /api/v1/seller/shifts/end`
* **Key Features:**
  * **Starting Shift:** Prompts for starting vehicle odometer KM and triggers `ShiftAuthVerificationModal`.
  * **Biometric & Password Verification:** Authenticates attendance via fingerprint scan (`expo-local-authentication`) or mobile password fallback.
  * **Resilient Offline Shift Creation:** When offline or when the backend returns a timeout/500, creates a local active shift (`shift_local_<timestamp>`) in `draftStorage` to avoid blocking daily work.
  * **Active Route Widget:** Displays elapsed shift duration, starting odometer KM, check-in button with customer dropdown, and ending shift trigger with ending KM and summary notes.

---

### SEL-004: 4-Card Customer Onboarding with GPS & Photo
* **Route:** `/(seller)/customers/new`
* **Access:** `role === 'SELLER'` (Also available at `/(manager)/customers/new`)
* **API Dependencies:** `POST /api/v1/seller/customers`, `POST /api/v1/seller/customers/:id/photo`, `GET /api/v1/seller/customers/pincode/:pincode`, `GET /api/v1/categories`
* **Card Structure:**
  1. **Card 1: Current Location (GPS):** Auto-fetches foreground GPS coordinates (`latitude`, `longitude`, `accuracy`) via `expo-location`. Denied permission displays a non-blocking recovery banner.
  2. **Card 2: Retail Storefront Photo:** Camera / Gallery image picker. Capturing a photo **automatically locks and disables the exemption reason dropdown**. If no photo is captured, the exemption reason dropdown is unlocked and required.
  3. **Card 3: Shop Details:** Mandatory Shop Name, Owner Name, Contact Mobile (validated to 10 digits), and mandatory Customer Email (strict RFC regex). Dynamic Category searchable dropdown. Dynamic Manager searchable dropdown (no hardcoded manager names).
  4. **Card 4: Address Details:** 6-digit Pincode input with automatic lookup populating State, District, and Village list. Manual street address input.
* **Form Preservation:** Preserves all user-entered form data in `draftStorage` on network failure.

---

### SEL-008: Decoupled Direct POS New Sale Creation
* **Route:** `/(seller)/sales/new`
* **Access:** `role === 'SELLER'`
* **API Dependencies:** `POST /api/v1/seller/sales`, `GET /api/v1/seller/products`, `GET /api/v1/seller/customers`, `GET /api/v1/seller/inventory`
* **Key Features:**
  * **Decoupled Direct Sale:** Field officers and managers can record sales directly at any time without an active duty shift prerequisite.
  * **Searchable Customer Dropdown:** Fast search by shop name or owner name with dedicated selection modal.
  * **Multi-Line Order Cart:** Add multiple SKU lines with real-time stock balance display, quantity controls, and negotiated unit price in rupees.
  * **Price Floor Thresholding:** Compares unit price against minimum allowable floor (₹25.00). If sub-floor, shows an amber warning indicating that the sale will be queued for Super Admin approval.
  * **Payment Mode Segmented Selector:** Restricted strictly to Cash, Bank, or Pending (no partial payments allowed).
  * **Integrated Voice Feedback:** Embedded `VoiceFeedbackTranslator` allowing speech-to-text Hindi/Hinglish customer observations translated into English field notes.
  * **Idempotency Guarantee:** Automatically generates an RFC4122 v4 UUID header (`X-Idempotency-Key`) bound to payload hash to eliminate duplicate orders.

---

### ADM-002: Centralized 13-Action Administrative Command Hub
* **Route:** `/(admin)/actions/index`
* **Access:** `role === 'SUPER_ADMIN'`
* **Key Features:**
  * Clean, responsive grid of all 13 core administrative operations:
    1. **Price Approvals:** Review sub-floor discounted orders.
    2. **Stock Movements & Transfers:** Factory receipts and van transfers.
    3. **Warehouse Depots:** Central HQ and regional depots.
    4. **Team & Sellers:** Nationwide field officer management.
    5. **Territory Managers:** Manager creation and territory assignments.
    6. **Customer Directory:** Master nationwide customer base.
    7. **Bulk Customer Ingestion:** Batch CSV customer uploads.
    8. **Product Catalog:** SKU definitions, base and minimum prices.
    9. **Trade Categories:** Retailer, chemist, and general store categories.
    10. **Sales Ledger:** Nationwide sales stream.
    11. **Shift Tracking:** Master officer attendance and route audits.
    12. **Sales & Revenue Reports:** Geographic trend analysis.
    13. **Business Settings:** Price floor configurations.

---

### ADM-003: Sub-Floor Price Approvals Queue
* **Route:** `/(admin)/approvals/index`
* **Access:** `role === 'SUPER_ADMIN'`
* **API Dependencies:** `GET /api/v1/admin/approvals`, `POST /api/v1/admin/approvals/:id/approve`, `POST /api/v1/admin/approvals/:id/reject`
* **Key Features:**
  * Normalized list of orders requiring approval with seller name, customer name, requested price vs minimum price floor.
  * **Resubmission Priority Sorting:** Orders that were revised and resubmitted by managers/sellers are automatically floated to the top of the queue with visual revision badges.
  * **One-Tap Actions:** "Approve" confirms sale and deducts stock; "Reject" retains sale audit without deducting stock.

---

### MGR-002: Manager Quick Actions Hub
* **Route:** `/(manager)/quick-actions/index`
* **Access:** `role === 'MANAGER'`
* **Key Features:**
  * Optimized quick-access view with safe-area insets and status bar alignment.
  * Shortcuts for rapid operational workflows: Onboard Field Officer, Onboard Retail Store, View Territory Stock, Track Active Shifts, and Record Field Sale.

---

## 4. Modal & Interactive Overlay Specifications

### MOD-001: ShiftAuthVerificationModal
* **Component:** `src/components/common/ShiftAuthVerificationModal.tsx`
* **Trigger:** Initiating or ending a duty shift.
* **Modes:** `START` (Starting Odometer KM), `END` (Ending Odometer KM).
* **Interface Tabs:**
  1. **Fingerprint Tab:** Pulse-animated biometric sensor button. Invokes native `LocalAuthentication.authenticateAsync` for hardware fingerprint matching.
  2. **Mobile Password Tab:** Masked password/PIN input with eye toggle. Invokes `authApi.login` to verify credentials against live backend or cached offline session.
* **Backwards Compatibility:** Returns payload flags (`faceVerified: true`, `faceConfidence: 0.99`, `faceMethod: 'FINGERPRINT_BIOMETRIC' | 'MOBILE_PASSWORD'`) to maintain compatibility with legacy backend shift schemas.

---

### MOD-002: VoiceFeedbackTranslator
* **Component:** `src/components/common/VoiceFeedbackTranslator.tsx`
* **Trigger:** Microphone icon inside POS order creation, customer onboarding, or shift checkout.
* **Key Features:**
  * **Spoken Language Selector:** Toggle between Hindi/Hinglish (`hi-IN`) and Indian English (`en-IN`).
  * **Real-Time Speech Recognition:** Pulsing microphone recording indicator powered by `expo-speech-recognition`.
  * **AI Translation Review Card:** Displays original Devanagari/Romanized Hindi transcript alongside professional English translation.
  * **Review & Undo Controls:** "Accept Translation", "Edit" (opens inline wording modal), "Clear", and "Undo" actions.
  * **Quick Retail Chips:** Tapping village-friendly retail phrases (e.g., *"Dukaan band thi owner gaon gaya hai"*) instantly populates and translates the observation.
  * **Resilient Offline Fallback:** When the translation microservice is offline, the client fallback engine translates common retail terms and preserves the original spoken transcript.
