# FemmeFlo Mobile App - Screen Designs & Visual Specifications

This document catalogs the complete screen designs, interactive components, visual tokens, and UX architectures for the FemmeFlo Mobile Expo App (`femmeflo-app`).

> **Application Version**: v1.0.20 (Android `versionCode: 24`)  
> **Target Framework**: React Native 0.88.1 / Expo SDK 58 (~58.0.25) / React 19.3.0 / TypeScript ~6.0.3  
> **Design Philosophy**: High-contrast, village-friendly ergonomics with thumb-zone optimization, rural offline resilience, and fluid safe-area adaptation.

---

## 🎨 Global Design Tokens & Color Palette

- **Primary Brand Color**: Deep Maroon `#881337` / Berry Pink `#E61C5D`
- **Secondary Accent**: Forest Green `#156035` / Emerald Green `#16A34A`
- **Floor Price Warning**: Amber `#D97706` / `#F59E0B`
- **Error / Danger**: Rose Crimson `#DC2626` / `#E11D48`
- **Background Canvas**: Warm Paper `#FAF8F5` / Off-White `#FBF9FA`
- **Surfaces & Cards**: Pure White `#FFFFFF` with soft elevations (`elevation: 2` to `4`, border radius `16` to `20`)
- **Typography Scale**:
  - Headings / KPIs: Space Grotesk (`700` Bold, `-0.3` to `-0.5` letter spacing)
  - Body / Forms: Plus Jakarta Sans (`400` Regular, `500` Medium, `600` SemiBold)

---

## 📱 Comprehensive Screen Inventory

---

### 1. Field Seller Duty Dashboard (`/(seller)/index`)
The operational launchpad for field sales officers.

- **Visual Layout & Key Elements**:
  - **Header Row**: User greeting (*"Welcome back, Officer"*), current date, and notification bell with unread indicator.
  - **Duty Status Banner**: Dynamic card displaying shift status:
    - *OFF DUTY* (slate gray pill): Displays *"Start Shift to Begin Route"* with a prominent Start Shift CTA.
    - *ACTIVE SHIFT* (emerald green pulsing pill): Displays live elapsed timer (`HH:MM:SS`), starting odometer reading, and End Shift CTA.
  - **Shift Start/End Modal Trigger**: Launches `ShiftAuthVerificationModal` requiring Fingerprint/Biometrics or Mobile PIN verification before opening shift.
  - **KPI Metrics Grid**: 4 cards showing Today's Sales (₹), Today's Packets Sold, Monthly Target Achievement (%), and Available Van Stock Balance.
  - **Quick Action Bar**: One-tap access to *New Sale*, *Shops Directory*, *Van Inventory*, and *Incentives*.
  - **Recent Activity Stream**: Itemized feed of the day's submitted orders with settlement tags (`CASH`, `BANK`, `PENDING`).

---

### 2. Duty Shift & Visits Tracker (`/(seller)/shift/index.tsx`)
Comprehensive shift management, vehicle odometer logging, and retail outlet visit tracking.

- **Visual Layout & Key Elements**:
  - **Shift Hero Tile**: Live running duty timer updating every second, starting odometer KM badge, and GPS coordinate pin.
  - **Action Controls**:
    - **Check-in Visit Button**: Opens retail store selector modal with instant search, GPS pin capture, and arrival timestamp.
    - **End Shift Button**: Validates closing odometer KM (`closingKm >= startingKm`), captures closing notes, and launches identity verification.
  - **Active Visit Card**: Displayed when checked into a retailer:
    - Shop name, owner name, check-in elapsed time.
    - **Check-Out Action**: Opens two-branch checkout dialog:
      * *Branch A: No Sale*: Predefined reason chips (*Stock sufficient*, *Owner unavailable*, *Shop closed*, *Payment pending*).
      * *Branch B: Sale Done*: SKU selector, quantity steppers, unit price, and payment mode.
      * Integrated **Voice Feedback Translator** for speech-to-text notes.
  - **Visits Timeline**: Chronological log of visited retail outlets showing arrival time, duration, and visit outcome pill (*Order Placed*, *Follow-up Scheduled*, *Shop Closed*).

---

### 3. Customer Store Onboarding & Directory (`/(seller)/customers`, `new.tsx`, `bulk.tsx`)
Standardized **4-Card Architecture** for registering retail outlets.

```
┌────────────────────────────────────────────────────────┐
│ Onboard Customer (Header)           [Batch Entry Pill] │
├────────────────────────────────────────────────────────┤
│ 📍 CURRENT LOCATION GPS CARD                           │
│   • GPS State: [Acquired ✓] (Accuracy: 12m)            │
│   • Detected: Thane, Maharashtra             [Change]  │
├────────────────────────────────────────────────────────┤
│ 📷 STOREFRONT PHOTO & VERIFICATION CARD                │
│   • Dashed Photo Capture Box (Camera / Gallery Picker) │
│   • [Preview Thumb | Retake | Remove]                  │
│   • Reason for not adding shopkeeper photo Dropdown    │
│     -> AUTOMATICALLY DISABLED & LOCKED WHEN PHOTO IS   │
│        UPLOADED: "Storefront photo captured •          │
│        Exemption not required" [Lock Icon]             │
├────────────────────────────────────────────────────────┤
│ 🏪 SHOP INFORMATION CARD                               │
│   • Shop / Store Name *                                │
│   • Owner Name *                                       │
│   • Mobile Number * (+91 [10 Digits])                  │
│   • Email Address (Optional badge, RFC format check)   │
├────────────────────────────────────────────────────────┤
│ 🛡️ ACCOUNT ASSIGNMENT & TRADE CATEGORY CARD             │
│   • Assigned Manager * (Strictly dynamic search modal, │
│     zero hardcoded strings, loads from backend API)    │
│   • Trade Category * (Single category dropdown)        │
├────────────────────────────────────────────────────────┤
│ 📍 ADDRESS DETAILS CARD                                │
│   • PIN Code * [Auto-detecting... reverse postal API]  │
│   • Street Address / Landmark *                        │
│   • Village / Locality                                 │
│   • District * & State * (Auto-filled from PIN)        │
│   • Mini Map Address Preview Box (Pin + Address text)  │
├────────────────────────────────────────────────────────┤
│ [ Save Customer & Onboard Store ]                      │
└────────────────────────────────────────────────────────┘
```

- **Post-Submission Confirmation (`SaveConfirmationCard.tsx`)**:
  - Full-screen summary card confirming retail outlet registration.
  - Displays customer name, unique ID, GPS coordinates, photo capture status, and creation timestamp.
  - Actions: *Onboard Another Store* (resets form and re-acquires GPS) or *Done* (returns to directory).
- **Batch Entry Mode (`bulk.tsx`)**: Rapid tabular store registration for high-density market visits.

---

### 4. Decoupled Direct POS Sales Terminal (`/(seller)/sales/new.tsx`)
High-speed point-of-sale interface for booking retail store orders.

- **Visual Layout & Key Elements**:
  - **Decoupled Architecture**: Can be launched and submitted directly at any time without requiring an active duty shift.
  - **Top Bar**: Screen title, draft autosave status indicator, and dynamic Idempotency Key badge (`#UUID`).
  - **Customer Selector Box**: Tap-to-open searchable customer modal displaying shop name, owner name, and outstanding credit balance.
  - **Product Line Items List**:
    - SKU thumbnail, product name, and available mobile van stock badge.
    - Quantity steppers (`-` / `+` by 1 and 5) with direct numeric text input.
    - Custom unit price input in Rupees with base price indicator.
    - **Live Stock Error Banner**: Triggers red alert if requested quantity exceeds vehicle van stock balance.
    - **Price Floor Warning Banner**: Amber alert banner (`#D97706`) appearing if custom unit price is below the minimum price threshold (e.g. ₹25), indicating that the order will require Super Admin approval.
    - Add SKU button for multi-product orders.
  - **Payment Mode Segmented Control**: Exactly three business modes: `CASH`, `BANK` (with transaction ref input), and `PENDING`.
  - **Multilingual Voice Feedback Translator**: Integrated recording interface allowing field officers to speak customer observations in Hindi or Hinglish, translating to English.
  - **Order Summary Footer**: Item count, total packets, calculated total in ₹, and docked primary submit CTA.

---

### 5. Order Details & GST Tax Invoice (`/(seller)/sales/[id].tsx`)
Itemized order view, payment settlement, and tax invoice generation.

- **Visual Layout & Key Elements**:
  - **Status Header**: Order number (`SL-2026-XXXX`), order date, and status timeline pill (`PENDING_APPROVAL`, `APPROVED`, `CONFIRMED`, `REJECTED`).
  - **Customer Card**: Store name, owner name, billing address, and contact shortcuts (phone call and email).
  - **Line Items Table**: Product SKU, quantity, applied unit price, GST tax breakdown, and gross total.
  - **Payment Collection Modal**: For orders with payment status `PENDING`, allows field officers to collect outstanding balance via Cash or Bank transfer.
  - **Download Tax Invoice PDF CTA**: Triggers authenticated download via `expo-file-system` and displays native Android share sheet (`expo-sharing`) for WhatsApp, email, or wireless printing.

---

### 6. Van Stock Inventory & Ledger (`/(seller)/inventory/index.tsx`)
Vehicle mobile warehouse tracking.

- **Visual Layout & Key Elements**:
  - **Van Stock Hero**: Total packets currently allocated to the vehicle.
  - **SKU Inventory Cards**: Per-product balance showing Allocated, Sold Today, and Remaining Packets.
  - **Low Stock Alerts**: Highlighted red pill when remaining stock falls below configured threshold.
  - **Transaction History Ledger**: Chronological log of stock transfers from central warehouse and deductions from confirmed sales.

---

### 7. Commission & Incentive Ledger (`/(seller)/incentives/index.tsx`)
Monthly earnings and commission transparency.

- **Visual Layout & Key Elements**:
  - **Commission Hero**: Earned commission in Rupees for current month, payout status badge (*Calculated*, *Approved*, *Disbursed*).
  - **Per-Packet Commission Breakdown**: Tiered rate display (e.g. ₹2.50 per standard packet sold).
  - **Historical Rate Notice**: Reassures sellers that past confirmed orders maintain their historical commission rate even if rates change globally.
  - **Monthly Settlement Archives**: Historical list of past months' earnings and disbursement references.

---

### 8. Territory Manager Dashboard (`/(manager)/index.tsx`)
Territory supervision and executive telemetry.

- **Visual Layout & Key Elements**:
  - **Territory Metric Cards**: Total territory revenue (₹), supervised field officers count, active shifts today, and total retail outlets onboarded.
  - **Dual-Role Mode Toggle**: Prominent toggle pill in the header for managers with `isSeller: true` to switch instantly into Field Sales Mode.
  - **Field Officers Beat Overview**: List of supervised sellers showing active shift status, last known GPS checkpoint, and today's sales totals.
  - **Quick Action Pill Bar**: Direct shortcut to the **Manager Quick Actions Hub**.

---

### 9. Manager Quick Actions Hub (`/(manager)/quick-actions/index.tsx`)
Dedicated rapid operational view engineered for territory managers.

```
┌────────────────────────────────────────────────────────┐
│ [←] Quick Actions                     (Safe Inset Top) │
│     Choose what you want to do                         │
├────────────────────────────────────────────────────────┤
│ 🛒 NEW SALE HERO CARD (Deep Maroon #881337)            │
│    • Icon: Cart                                        │
│    • Title: New Sale                                   │
│    • Subtitle: Record a new sale               [ → ]   │
├────────────────────────────────────────────────────────┤
│ 🕒 Daily Shift (Punch-In / Route)               [ > ]  │
│ 📦 Check Van Stock (View stock in van)          [ > ]  │
│ 🏪 Add New Shop (Register a new shop)           [ > ]  │
│ 👥 Manage Sellers (View & manage sellers)       [ > ]  │
│ 📊 All Sales (Check sales history)              [ > ]  │
├────────────────────────────────────────────────────────┤
│ ✦ Need Support?                                        │
│   🎧 Contact Support (We're here to help)       [ > ]  │
│      -> Helpline: 18001234567                          │
│      -> Email: support@femmeflo.com                    │
├────────────────────────────────────────────────────────┤
│ 🏛️ Indian Monument Skyline Silhouette (Vector)         │
│ 🌊 Fluid Maroon Wave Banner (Footer Accent)            │
└────────────────────────────────────────────────────────┘
```

- **Visual & Safe Area Architecture**:
  - `useSafeAreaInsets` dynamic top padding calculation:
    `Math.max(insets.top, Platform.OS === 'ios' ? 14 : 20) + 6`
  - Prevents top clipping on notched and camera punch-hole Android displays.
  - Prominent Hero card for **New Sale** linking directly to `/(seller)/sales/new`.
  - 5 rapid action cards with clean icons and subtitle descriptions.
  - Support card launching native phone dialer (`tel:18001234567`) or pre-addressed email client (`support@femmeflo.com`).
  - Stylized cultural aesthetic featuring an Indian architectural monument skyline and fluid maroon wave vector banner.

---

### 10. Super Admin Command Center (`/(admin)/index.tsx`)
Executive national administration overview.

- **Visual Layout & Key Elements**:
  - **National Telemetry KPIs**: Total platform revenue (₹), total packets sold, central warehouse stock count, and active field officers.
  - **Pending Approvals Alert Banner**: Red alert pill indicating orders waiting for price approval.
  - **Direct Launchpad**: Prominent button leading to the **Administrative Actions Hub**.

---

### 11. Administrative Actions Command Center (`/(admin)/actions/index.tsx`)
Centralized command hub covering all 13 core operational modules.

- **Categorized Action Grid**:
  1. **Sales & Reports**:
     - *Daily Sales & Reports* (`/(admin)/reports`)
     - *GST Tax Invoices* (`/(admin)/invoices`)
     - *Sales Orders* (`/(admin)/sales`)
     - *Incentives & Payouts* (`/(admin)/incentives`)
  2. **Approvals**:
     - *Price Approvals* (`/(admin)/approvals`): Displays live red pending count badge (`#DC2626`). Automatically synchronizes via `DeviceEventEmitter` (`APPROVAL_STATUS_CHANGED`).
  3. **Products & Stock**:
     - *Products & Prices* (`/(admin)/products`)
     - *Stock Movement Hub* (`/(admin)/inventory/transfer`)
     - *Regional Warehouses* (`/(admin)/inventory/new`)
  4. **Field Team**:
     - *Staff Shifts & Routes* (`/(admin)/shifts`)
     - *Shops & Customers* (`/(admin)/customers`)
  5. **Team & Access**:
     - *Manager Permissions* (`/(admin)/permissions`)
     - *Managers & Sellers* (`/(admin)/users`)
  6. **Settings**:
     - *Shop Categories* (`/(admin)/categories`)
     - *Company & Invoice Settings* (`/(admin)/settings`)

---

### 12. Low-Price Approvals Queue (`/(admin)/approvals/index.tsx`)
Real-time pricing governance queue.

- **Visual Layout & Key Elements**:
  - **Pending Queue Counter**: Live tally of orders submitted below minimum floor price.
  - **Order Comparison Card**:
    - Retail store name, location, and submitting field seller name.
    - Side-by-side comparison: Configured Minimum Price (₹) vs Requested Selling Price (₹).
    - Calculated total order value and requested margin discount.
  - **Action Dialogs**:
    - **Approve Button**: Instantly confirms order on backend, releases stock, and generates invoice.
    - **Reject Button**: Opens rejection modal requiring mandatory reason text (e.g. *"Price below permissible margin"*).

---

### 13. Stock Movement Hub (`/(admin)/inventory/transfer.tsx`)
Warehouse and vehicle inventory allocation.

- **Visual Layout & Key Elements**:
  - **Source & Destination Selectors**: Central Warehouse, Regional Depots, or Field Seller Vehicles.
  - **Product SKU & Quantity**: Stepper and manual entry with live available balance check.
  - **Movement Types**: Warehouse Transfer, Factory Inward Receipt, or Van Restock Dispatch.
  - **Transfer Confirmation**: Submits strict backend payload without redundant keys, ensuring zero schema rejection errors.

---

## 🧩 Specialized Common Components

### 1. Shift Authentication Verification Modal (`ShiftAuthVerificationModal.tsx`)
Native biometric and password identity verification.

- **Fingerprint Tab**:
  - Hardware check via `expo-local-authentication`.
  - Animated pulsing radar concentric circles around the fingerprint icon.
  - Tactile prompt to touch device fingerprint sensor.
- **Mobile Password Tab**:
  - Clean text input with password toggle for entering mobile security PIN or password.
  - Validates credentials against backend authentication.
- **Success State**:
  - Spring-animated green checkmark badge confirming verified identity.
  - Emits backwards-compatible payload for seamless server schema acceptance.

---

### 2. Multilingual Voice Feedback Translator (`VoiceFeedbackTranslator.tsx`)
Speech-to-text with Hindi/Hinglish to English translation.

- **Audio Visualizer**:
  - Pulsing animated microphone ring during active speech capture.
- **Translation Engine**:
  - Converts spoken Hindi or Hinglish dialect into concise, professional English field notes.
- **Translation Audit Modal**:
  - Displays original spoken transcript side-by-side with translated English.
  - Allows field officers to review, correct, or refine notes before saving.
- **Pre-Built Village Field Chips**:
  - One-tap quick buttons for common field scenarios (*"Dukaan band thi"*, *"Payment kal aayega"*, etc.).

---

### 3. Searchable Dropdown Modal (`SearchableDropdownModal.tsx`)
Zero-error searchable selection modal for customers, managers, categories, and warehouses.

- Dynamic search filter with debouncing.
- Guaranteed unique key generator preventing React duplicate key warnings.
- Subtitle and metadata support for store owner names and phone numbers.
