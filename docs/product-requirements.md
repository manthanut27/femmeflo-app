# PRODUCT REQUIREMENTS DOCUMENT

## 1. Document Control

* **Product**: FemmeFlo Seller, Manager & Super Admin Management System
* **Mobile Platform**: Android (Physical devices, Emulators, Internal APK distribution)
* **Mobile Framework**: React Native 0.88.1 with Expo SDK 58 (~58.0.25), React 19.3.0, TypeScript ~6.0.3, Expo Router ~58.0.31
* **App Version**: v1.0.20 (`versionCode: 24`)
* **Existing Backend**: Express 5.2.1, Prisma ORM 7.10, PostgreSQL on Supabase (`femmeflo-yfa-inventory-server`)
* **Distribution Strategy**: Internal Android APK via Expo Application Services (EAS) and local Gradle prebuild
* **Interface Language**: English (UI and generated records), with automated Hindi & Hinglish multilingual speech-to-text translation for field observations
* **Operating Mode**: Online-first for transactional business operations with local offline draft preservation and idempotency guarantees

---

## 2. Product Objective

Build a resilient, production-ready Android mobile application for FemmeFlo field sales officers (Sellers), territory supervisors (Managers), and executive administrators (Super Admins). The system streamlines sanitary product distribution, retail store onboarding, mobile point-of-sale transactions, vehicle inventory tracking, price approval workflows, tax invoicing, and territory reporting.

The mobile client is strictly aligned with the backend source of truth, enforcing business-critical constraints, secure hardware credential storage, offline draft recovery, and village-friendly field workflows.

---

## 3. User Roles & Capabilities

### 3.1 Field Seller (`/seller`)

A Field Seller can:
* **Duty Shift Authentication**: Start and end shifts using native Android Fingerprint / Biometric authentication with a Mobile PIN / password fallback (`ShiftAuthVerificationModal.tsx`).
* **Vehicle Odometer Tracking**: Record starting and closing odometer KM readings with monotonic distance validation.
* **Customer Store Onboarding**: Register new retail outlets using a standardized **4-Card Architecture**:
  1. *Current Location GPS Card*: Foreground GPS coordinates with accuracy indicator, detected district/state, and manual re-acquire option.
  2. *Storefront Photo & Exemption Verification Card*: Camera/gallery photo capture with JPEG compression. When a photo is uploaded, the exemption reason dropdown is **automatically locked and disabled**. If a photo is absent, a standardized exemption reason must be chosen.
  3. *Shop Information Card*: Mandatory shop name, owner name, mobile number (+91 prefix, 10 digits), and optional email address.
  4. *Account Assignment & Trade Category Card*: Strictly dynamic manager searchable dropdown (zero hardcoded strings, dynamically populated from backend) and single trade category dropdown.
  5. *Address Details Card*: 6-digit PIN code auto-lookup for District, State, and Locality, with street address, village, and interactive mini map preview.
* **Decoupled Direct POS Sales**: Record sales directly at any time (`/(seller)/sales/new`) without requiring an active duty shift, eliminating field blockers.
* **Duty Shift Visit Sales**: Check in to assigned retail outlets during duty shifts (`/(seller)/shift`), log visit notes, and record visit-linked sales orders upon checkout.
* **Multilingual Voice Feedback Translation**: Speak naturally in Hindi or Hinglish; speech is automatically transcribed and translated into concise, professional English field notes (`VoiceFeedbackTranslator.tsx`).
* **Van Stock Inventory Ledger**: Check mobile vehicle inventory balances in real time to prevent overselling.
* **Pricing Floor Alerts**: Receive real-time amber badge warnings (`#D97706`) for below-minimum price sales and submit them to the Super Admin approval queue.
* **Payment Recording**: Select payment modes (`CASH`, `BANK`, or `PENDING`) with idempotency key protection (`requestKey` UUID v4).
* **Tax Invoices**: Download and share authenticated GST tax invoice PDFs via native Android share sheet.
* **Incentives & Commissions**: Review monthly commission summaries and historical rate ledgers.

A Field Seller must not:
* Approve their own below-minimum price sales.
* Bypass the server-enforced minimum price.
* View another seller's private territory records without authorization.
* Directly alter central warehouse stock balances.

---

### 3.2 Territory Manager (`/manager`)

A Territory Manager can:
* **Territory Overview**: Monitor territory sales revenue, active field officer counts, store numbers, and packet volumes.
* **Manager Quick Actions Hub (`/(manager)/quick-actions/index.tsx`)**:
  - Safe area insets aligned operational launchpad.
  - One-tap hero card for **New Sale** (`/(seller)/sales/new`).
  - 5 rapid action cards: *Daily Shift*, *Check Van Stock*, *Add New Shop*, *Manage Sellers*, and *All Sales*.
  - Direct operational support access (helpline dialer `tel:18001234567` and email `support@femmeflo.com`).
* **Field Seller Administration**: Supervise field officers in assigned territory, monitor shift attendance, and onboard new sellers (`/(manager)/sellers/new`).
* **Territory Customers & Sales**: View master store accounts, onboard stores using the 4-card flow, and review the territory-wide sales order stream.
* **Dual-Role Execution**: For managers with `isSeller: true`, toggle immediately to Field Sales Mode to conduct direct sales, run shifts, and handle van stock.

---

### 3.3 Super Admin (`/admin`)

A Super Admin can:
* **Executive Command Center (`/(admin)/index`)**: High-level national metrics including total revenue, packet volume, central warehouse balances, and active field officers.
* **Administrative Actions Hub (`/(admin)/actions/index.tsx`)**: Comprehensive command center covering all 13 core operational modules across 6 functional categories:
  1. *Sales & Reports*: Daily Sales & Reports, GST Tax Invoices, Sales Orders, Incentives & Payouts.
  2. *Approvals*: Real-time Price Approvals queue with dynamic pending count badge (`#DC2626` alert) and live event synchronization.
  3. *Products & Stock*: Products & Prices, Stock Movement (Transfer, Inward, History), Regional Warehouses.
  4. *Field Team*: Staff Shifts & Routes, Shops & Customers.
  5. *Team & Access*: Manager Permissions, Managers & Sellers lifecycle administration.
  6. *Settings*: Shop Categories, Company & Invoice Settings.
* **Price Approvals Queue (`/(admin)/approvals`)**: Side-by-side review of requested price vs minimum price with one-tap Approve and Reject actions.
* **Stock Movement Hub (`/(admin)/inventory/transfer`)**: Multi-warehouse stock movement, factory inward receipts, and vehicle van allocations.

---

## 4. Functional Requirements

### FR-AUTH: Authentication and Session Management
* **FR-AUTH-001**: Single unified mobile login (`/(auth)/login`) with role-selection pills (`Seller`, `Manager`, `Super Admin`).
* **FR-AUTH-002**: Validate user credentials against backend `POST /api/v1/auth/login`.
* **FR-AUTH-003**: Store JWT tokens in hardware-backed secure storage via `expo-secure-store` (`femmeflo_mobile_auth_token`).
* **FR-AUTH-004**: Auto-restore sessions on app restart by verifying token against `GET /api/v1/auth/me`.
* **FR-AUTH-005**: On 401 Unauthorized, purge invalid session tokens while strictly preserving active duty shift state and unsubmitted order drafts.
* **FR-AUTH-006**: Support in-app password rotation (`/(shared)/change-password`).

### FR-SHIFT: Duty Shift & Biometric Attendance
* **FR-SHIFT-001**: Implement native Android Fingerprint / Biometric authentication via `expo-local-authentication` for starting and ending shifts (`ShiftAuthVerificationModal.tsx`).
* **FR-SHIFT-002**: Provide Mobile PIN / Password fallback verification tab.
* **FR-SHIFT-003**: Require starting vehicle odometer KM reading (non-negative integer).
* **FR-SHIFT-004**: Enforce closing odometer reading validation (`endOdometerKm >= startOdometerKm`).
* **FR-SHIFT-005**: Acquire foreground GPS coordinates upon shift start and shift end.
* **FR-SHIFT-006**: Map biometric verification outputs to backwards-compatible backend shift telemetry (`faceVerified: true`, `facePhoto: biometric_fingerprint_verified`, `faceConfidence: 0.99`, `faceMethod: FINGERPRINT_BIOMETRIC`).
* **FR-SHIFT-007**: Store active shift state locally in AsyncStorage (`draftStorage.saveActiveShift`), enabling recovery across app reboots or transient network drops.

### FR-CUST: Customer Onboarding & Verification
* **FR-CUST-001**: Implement the standardized 4-card customer onboarding structure at `/(seller)/customers/new` and `/(manager)/customers/new`.
* **FR-CUST-002**: Acquire foreground GPS coordinates with real-time status indication, accuracy in meters, and manual re-acquire capability.
* **FR-CUST-003**: Storefront photo capture via camera or gallery with automatic JPEG compression.
* **FR-CUST-004**: Automatically disable and lock the exemption reason dropdown when a storefront photo is attached (`Storefront photo captured • Exemption not required`).
* **FR-CUST-005**: Require selecting a standardized exemption reason when a storefront photo is absent.
* **FR-CUST-006**: Require Shop Name, Owner Name, and 10-digit Mobile Number (+91 prefix). Validate optional email format.
* **FR-CUST-007**: Populate the Assigned Manager dropdown dynamically from backend APIs (`adminApi.listManagers` / `managerApi.listSellers`); prohibit hardcoded manager names.
* **FR-CUST-008**: Provide 6-digit PIN code auto-lookup to auto-populate District, State, and Locality.
* **FR-CUST-009**: Display interactive Mini Map Address Preview tile.
* **FR-CUST-010**: Display `SaveConfirmationCard` post-submission with retailer credentials, server timestamp, GPS coordinates, and batch entry shortcut.
* **FR-CUST-011**: Autosave unsubmitted customer onboarding form drafts locally.

### FR-SALE: Decoupled Direct POS Sales & Shift Visit Sales
* **FR-SALE-001**: Decouple direct POS sales (`/(seller)/sales/new`) from the duty shift prerequisite; permit recording sales directly without an active shift.
* **FR-SALE-002**: Support shift-based shop visit sales during active duty shifts (`/(seller)/shift`), logging visit notes and checkout outcomes.
* **FR-SALE-003**: Provide a searchable customer picker modal with customer account balance tags.
* **FR-SALE-004**: Support multi-line item product carts with stepper controls (`±1`, `±5`) and custom unit price input.
* **FR-SALE-005**: Validate cart quantities against live vehicle van stock balances to prevent overselling.
* **FR-SALE-006**: Warn with an amber badge (`#D97706`) when unit prices fall below the configured minimum price and route order to Super Admin approval.
* **FR-SALE-007**: Support exact payment modes: `CASH`, `BANK` (with reference), and `PENDING`.
* **FR-SALE-008**: Bind each order draft to an RFC4122 v4 UUID `requestKey` and payload hash; auto-rotate `requestKey` if items or prices are edited after submit attempt.
* **FR-SALE-009**: Autosave unsubmitted order drafts locally in AsyncStorage keyed by user ID.

### FR-VOICE: Multilingual Voice Feedback Translation
* **FR-VOICE-001**: Implement real-time speech-to-text in `VoiceFeedbackTranslator.tsx` using `expo-speech-recognition` with web speech fallback.
* **FR-VOICE-002**: Support spoken Hindi (Devanagari), Indian English (`en-IN`), and romanized Hinglish.
* **FR-VOICE-003**: Automatically translate spoken Hindi/Hinglish transcripts into concise, professional English field notes via `translateHindiOrHinglishToEnglish`.
* **FR-VOICE-004**: Provide a pulsing audio visualizer during recording.
* **FR-VOICE-005**: Present a side-by-side translation audit modal with editable English text before saving to field notes.
* **FR-VOICE-006**: Provide one-tap village field scenario chips for rapid note entry.
* **FR-VOICE-007**: Integrate voice translation directly into POS sales creation and shift store visit checkout.

### FR-MGR: Manager Quick Actions Hub
* **FR-MGR-001**: Implement the Manager Quick Actions Hub (`/(manager)/quick-actions/index.tsx`) with safe area insets via `useSafeAreaInsets`.
* **FR-MGR-002**: Provide a prominent Hero card linking to New Sale.
* **FR-MGR-003**: Provide 5 operational action cards: *Daily Shift*, *Check Van Stock*, *Add New Shop*, *Manage Sellers*, and *All Sales*.
* **FR-MGR-004**: Provide an operational support section with direct phone dialer (`18001234567`) and pre-addressed email support (`support@femmeflo.com`).
* **FR-MGR-005**: Feature stylized Indian architectural monument skyline vector silhouette and maroon wave footer design.

### FR-ADMIN: Administrative Actions Hub & Governance
* **FR-ADMIN-001**: Centralize all 13 operational capabilities in `/(admin)/actions/index.tsx` across 6 functional categories.
* **FR-ADMIN-002**: Real-time synchronization of the Price Approvals badge with `DeviceEventEmitter` (`APPROVAL_STATUS_CHANGED`).
* **FR-ADMIN-003**: Low-price approvals queue with side-by-side floor vs requested price inspection and one-tap Approve/Reject mutations.
* **FR-ADMIN-004**: Stock Movement Hub supporting multi-warehouse transfers, factory inward receipts, and van stock allocations.

### FR-INVCE: GST Invoices
* **FR-INVCE-001**: Stream authenticated tax invoice PDFs via `GET /api/v1/invoices/:id/pdf` using `expo-file-system`.
* **FR-INVCE-002**: Trigger native Android share sheet via `expo-sharing`.

---

## 5. Non-Functional Requirements

* **Performance**: Sub-100ms UI response times for cart calculations, debounced search (300ms) on customer and manager dropdowns, optimized image manipulation.
* **Reliability & Offline Drafts**: Critical form inputs (customer onboarding, sales orders, active duty shifts) are autosaved locally to prevent data loss.
* **Security**: Authentication tokens stored in hardware-backed `expo-secure-store`. Zero hardcoded credentials or backend secrets in the bundle.
* **Accessibility**: Proper accessibility roles (`button`, `combobox`, `search`), minimum 44x44pt touch targets, and high-contrast color tokens.
* **Compatibility**: Strict compatibility with React Native 0.88.1, React 19.3.0, and Expo SDK 58.

---

## 6. Release Acceptance Gate

The v1.0.20 release is verified against:
* **TypeScript Strict Compilation**: Zero compilation errors across all screens, layouts, and components (`npm run typecheck`).
* **Automated Test Suite**: **356 passing unit and acceptance tests across 42 suites** (`npm test`).
* **Verification Criteria**:
  - Biometric & Password Shift Auth verified.
  - 4-Card Customer Onboarding with exemption locking verified.
  - Decoupled Direct Sales flow verified.
  - Manager Quick Actions Hub verified.
  - Administrative Actions Hub verified.
  - Multilingual Voice Feedback Translation verified.
