# FemmeFlo Mobile App - Web Parity & Architecture Checklist

This document tracks functional parity and operational compliance between the web platform (`femmeflo-website`) and the mobile app (`femmeflo-app`), interfacing with the Express/Prisma inventory server (`femmeflo-yfa-inventory-server`).

> **Target Version**: FemmeFlo v1.0.20 (Android `versionCode: 24`)  
> **Mobile Framework**: React Native 0.88.1 / Expo SDK 58 / React 19.3.0 / TypeScript ~6.0.3  
> **Test Coverage**: **356 passing unit & acceptance tests across 42 test suites**

---

## Parity Summary Scorecard

| Functional Category | Total Tracked | Done (Mobile Implemented) | Partial / Deferred | Parity Percentage |
| :--- | :---: | :---: | :---: | :---: |
| **Authentication & Hardware Session** | 6 | 6 | 0 | **100%** |
| **Duty Shift Attendance & Biometrics** | 6 | 6 | 0 | **100%** |
| **Customer Store Onboarding & 4-Card Flow** | 8 | 8 | 0 | **100%** |
| **Point of Sale (Decoupled & Shift Visits)** | 8 | 8 | 0 | **100%** |
| **Multilingual Voice Feedback Translation** | 5 | 5 | 0 | **100%** |
| **Manager Territory Operations & Quick Actions** | 8 | 8 | 0 | **100%** |
| **Super Admin Governance & Actions Command Center** | 8 | 8 | 0 | **100%** |
| **Invoicing, Inward Stock & Offline Resilience** | 6 | 6 | 0 | **100%** |
| **Total Features** | **47** | **47** | **0** | **100%** |

---

## 1. Authentication & Session Security

| Feature | Web Platform (`femmeflo-website`) | Mobile App (`femmeflo-app`) | Backend Contract & Implementation Evidence | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Unified Role Login** | Role-specific login pages (`/seller/login`, etc.) | Single unified login screen at `/(auth)/login` with role pills | `POST /api/v1/auth/login` (`login.tsx:61-95`) | ✅ **Done** |
| **Hardware Token Storage** | Browser HTTP cookies | Native SecureStore for JWT tokens (`femmeflo_mobile_auth_token`), separate from general AsyncStorage | `client.ts:33-65` (`expo-secure-store`) | ✅ **Done** |
| **Session Auto-Restoration** | Cookie validation | Verifies token on startup via `/auth/me`; auto-navigates to user role home | `AuthContext.tsx:32-75` | ✅ **Done** |
| **401 Expiry Interceptor** | Page reload to login | Clears token on 401 Unauthorized while **strictly preserving active shift and order drafts** | `client.ts:167-175`, `AuthContext.tsx` | ✅ **Done** |
| **Dual-Role Switching** | Profile dropdown role badge | One-tap "Switch to Field Sales Mode" toggle for managers with `isSeller: true` | `schema.prisma:78`, `RoleGuard.tsx`, `manager/profile/index.tsx` | ✅ **Done** |
| **Password Rotation** | Account settings modal | Dedicated authenticated password change screen (`/(shared)/change-password`) | `PATCH /api/v1/auth/password` | ✅ **Done** |

---

## 2. Duty Shift Attendance & Biometrics

| Feature | Web Platform (`femmeflo-website`) | Mobile App (`femmeflo-app`) | Backend Contract & Implementation Evidence | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Biometric Shift Authentication** | Web browser button / selfie modal | **Native Fingerprint / Biometric authentication** via `expo-local-authentication` (`ShiftAuthVerificationModal.tsx`) | `POST /api/v1/seller/shifts/start` (`ShiftAuthVerificationModal.tsx:76-233`) | ✅ **Done** |
| **Mobile PIN / Password Fallback** | N/A (Web password prompt) | Dedicated PIN/password fallback tab in `ShiftAuthVerificationModal.tsx` | `ShiftAuthVerificationModal.tsx:236-285` | ✅ **Done** |
| **Backwards-Compatible Telemetry** | Raw selfie base64 string | Maps biometric results to `faceVerified: true`, `facePhoto: biometric_fingerprint_verified`, `faceMethod: FINGERPRINT_BIOMETRIC` | `ShiftAuthVerificationModal.tsx:154-182` | ✅ **Done** |
| **Odometer Tracking & Distance** | Manual form entry | Validates positive start odometer KM and monotonic end odometer (`endKm >= startKm`) | `computeShiftTravelDistance`, `seller/index.tsx:147-235` | ✅ **Done** |
| **Live Duty Elapsed Timer** | Static text display | Live `HH:MM:SS` ticker updating every second from `shift.startTime` | `seller/shift/index.tsx:86-125` | ✅ **Done** |
| **Offline Shift Resilience** | Server-only state | Active shift cached in AsyncStorage (`draftStorage.saveActiveShift`), enabling shift operations during network dropouts | `draftStorage.ts`, `manager_shift_and_sales_resilience.test.ts` | ✅ **Done** |

---

## 3. Customer Store Onboarding & 4-Card Architecture

| Feature | Web Platform (`femmeflo-website`) | Mobile App (`femmeflo-app`) | Backend Contract & Implementation Evidence | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Card 1: GPS Location Card** | Browser HTML5 Geolocation | Foreground GPS capture with status badge (`acquiring`, `acquired`, `error`), accuracy in meters, and "Change" re-acquire button | `acquireGpsCoordinates` (`locationUtils.ts`, `customers/new.tsx:530-557`) | ✅ **Done** |
| **Card 2: Storefront Photo Upload** | Browser file picker | Camera capture or gallery select via `expo-image-picker` with JPEG compression | `pickPhoto` (`customers/new.tsx:559-614`) | ✅ **Done** |
| **Card 2: Auto Exemption Locking** | Manual radio toggle | **Automatically locks and disables exemption dropdown** when photo is captured (`Storefront photo captured • Exemption not required`) | `customers/new.tsx:615-732`, `customer_onboarding_acceptance.test.ts` | ✅ **Done** |
| **Card 3: Shop Information** | Web input form | Mandatory Shop Name (`*`), Owner Name (`*`), Mobile Number (`*` with `+91` prefix, 10 digits), and optional Email | `customers/new.tsx:734-835` | ✅ **Done** |
| **Card 4: Dynamic Manager Assignment** | Web dropdown | **Strictly dynamic manager searchable dropdown**; queries `adminApi.listManagers` / `managerApi.listSellers` with zero hardcoding | `customers/new.tsx:837-890`, `adminApi.listManagers` | ✅ **Done** |
| **Card 4: Trade Category Selector** | Category select | Dynamic category dropdown populated from `categoriesApi.listCategories` | `customers/new.tsx:891-922` | ✅ **Done** |
| **Card 5: PIN Code Auto-Lookup** | Manual address fields | 6-digit PIN code triggers automated postal API reverse-lookup for District, State, and Locality | `api.postalpincode.in`, `customers/new.tsx:936-962` | ✅ **Done** |
| **Post-Submission Confirmation** | Redirect to table | Dedicated `SaveConfirmationCard` with summary details, server timestamp, GPS coordinates, and batch entry shortcut | `SaveConfirmationCard.tsx`, `customers/new.tsx:446-473` | ✅ **Done** |

---

## 4. Point of Sale & Sales Orders (Decoupled & Shift Visits)

| Feature | Web Platform (`femmeflo-website`) | Mobile App (`femmeflo-app`) | Backend Contract & Implementation Evidence | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Decoupled Direct POS Sales** | Shift not required on web | **Direct sales entry decoupled from shift requirement** (`/(seller)/sales/new`); sellers can record sales directly at any time | `sales/new.tsx`, `seller_shift_prerequisite.test.ts` | ✅ **Done** |
| **Duty Shift Visit Sales** | Web visits ledger | Check into retail outlets during duty shifts (`/(seller)/shift`), logging visit outcomes and checkout sales | `POST /seller/shifts/check-in`, `POST /check-out` (`shift/index.tsx`) | ✅ **Done** |
| **Searchable Customer Picker** | Dropdown select | Native searchable modal with account balance badges and live filtering | `SearchableDropdownModal.tsx`, `sales/new.tsx:72-74` | ✅ **Done** |
| **Multi-Product Cart** | Dynamic line items table | Native card layout with fast increment/decrement steppers (`±1`, `±5`) and custom unit pricing | `sales/new.tsx:307-375` | ✅ **Done** |
| **Live Van Stock Validation** | Real-time inventory check | Validates requested quantities against available mobile van stock balance, blocking oversell attempts | `sales/new.tsx:283-305` | ✅ **Done** |
| **Price Floor Alert Banner** | Amber alert on below-floor price | Amber warning pill (`#D97706`), flags `PENDING_APPROVAL`, explains Super Admin review requirement | `sales/new.tsx:273-281`, `sales.validation.ts:15` | ✅ **Done** |
| **Idempotency Protection** | UUID in body | Cryptographic RFC4122 v4 UUID `requestKey` bound to payload hash; auto-rotates on cart edit after submit attempt | `draftStorage.ts:computePayloadHash`, `sales/new.tsx:211-260` | ✅ **Done** |
| **Payment Modes & Collection** | `CASH`, `BANK`, `PENDING` | Exactly `CASH`, `BANK` (with transaction ref), and `PENDING`; outstanding credit collection modal | `sales/new.tsx:77-78`, `sales/[id].tsx:78-115` | ✅ **Done** |

---

## 5. Multilingual Voice Feedback Translation

| Feature | Web Platform (`femmeflo-website`) | Mobile App (`femmeflo-app`) | Backend Contract & Implementation Evidence | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Speech Recognition Engine** | N/A (Web text typing only) | `expo-speech-recognition` with browser web speech fallback (`SpeechRecognizer` utility) | `voiceUtils.ts`, `VoiceFeedbackTranslator.tsx:33-36` | ✅ **Done** |
| **Hindi & Hinglish Translation** | N/A | Transcribes spoken Hindi Devanagari and phonetic Hinglish, translating to professional English | `translateHindiOrHinglishToEnglish` (`src/api/translate.ts`) | ✅ **Done** |
| **Pulsing Audio Visualizer** | N/A | Real-time animated pulsing microphone recording indicator | `VoiceFeedbackTranslator.tsx:89-117` | ✅ **Done** |
| **Translation Audit & Editing** | N/A | Modal displaying original transcript side-by-side with translated English, allowing manual edits before saving | `VoiceFeedbackTranslator.tsx:74-77` | ✅ **Done** |
| **Pre-Built Village Field Chips** | N/A | One-tap chips for common village distribution scenarios (*"Dukaan band thi"*, *"Payment kal aayega"*, etc.) | `VoiceFeedbackTranslator.tsx:56-63` | ✅ **Done** |

---

## 6. Territory Management & Quick Actions Hub

| Feature | Web Platform (`femmeflo-website`) | Mobile App (`femmeflo-app`) | Backend Contract & Implementation Evidence | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Manager Quick Actions Hub** | Navigation sidebar | Dedicated quick actions screen with safe area insets via `useSafeAreaInsets` and status bar alignment | `quick-actions/index.tsx:48-73` | ✅ **Done** |
| **Hero Card: New Sale** | Top action button | Prominent maroon card linking directly to `/(seller)/sales/new` | `quick-actions/index.tsx:79-95` | ✅ **Done** |
| **Rapid Action Grid** | Sidebar links | 5 cards: Daily Shift, Check Van Stock, Add New Shop, Manage Sellers, All Sales | `quick-actions/index.tsx:97-186` | ✅ **Done** |
| **Operational Helpline Support** | Footer text | Direct phone dialer (`tel:18001234567`) and pre-filled email support (`support@femmeflo.com`) | `quick-actions/index.tsx:26-45, 187-210` | ✅ **Done** |
| **Field Sellers Directory** | Table of assigned sellers | Native directory with active shift indicators, performance stats, and seller onboarding form | `GET /api/v1/manager/sellers` (`manager/sellers/index.tsx`) | ✅ **Done** |
| **Territory Customers** | Territory customer table | Searchable list of retailers with 4-card onboarding support | `GET /api/v1/manager/customers` (`manager/customers/index.tsx`) | ✅ **Done** |
| **Territory Sales Stream** | Sales ledger table | Territory order feed with status badges and payment collection tracking | `GET /api/v1/manager/sales` (`manager/sales/index.tsx`) | ✅ **Done** |
| **Dual-Role Persona Switching** | Role toggle | Seamless switching between Manager and Field Sales modes for users with `isSeller: true` | `RoleGuard.tsx`, `manager/profile/index.tsx` | ✅ **Done** |

---

## 7. Super Admin Governance & Administrative Actions Hub

| Feature | Web Platform (`femmeflo-website`) | Mobile App (`femmeflo-app`) | Backend Contract & Implementation Evidence | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Administrative Actions Hub** | Admin sidebar menu | Centralized command center organizing **all 13 core operational modules** across 6 functional categories | `admin/actions/index.tsx:170-330` | ✅ **Done** |
| **Real-Time Approval Telemetry** | Web polling | Real-time synchronization of pending approvals counter via `DeviceEventEmitter` (`APPROVAL_STATUS_CHANGED`) | `admin/actions/index.tsx:71-91` | ✅ **Done** |
| **Price Approvals Queue** | Approval table with modal | Side-by-side comparison of requested price vs minimum price with one-tap Approve/Reject mutations | `GET /api/v1/admin/approvals`, `POST /approve`, `POST /reject` (`approvals/index.tsx`) | ✅ **Done** |
| **Stock Movement Hub** | Inventory management tab | Central warehouse transfers, factory inward receipts, and vehicle allocations | `POST /api/v1/admin/inventory/transfer` (`transfer.tsx`) | ✅ **Done** |
| **User Lifecycle Management** | User table with actions | Directory of Managers and Sellers with status management and access administration | `GET /api/v1/admin/users`, `POST /users` (`admin/users/index.tsx`) | ✅ **Done** |
| **Global Settings & Price Thresholds** | Settings page | Real-time configuration of system minimum sale price (e.g. ₹25) and stock alert thresholds | `PATCH /api/v1/admin/settings` (`admin/settings/index.tsx`) | ✅ **Done** |
| **Shop Category Management** | Category management table | Retail outlet category creation, activation, and management | `GET /api/v1/admin/categories` (`admin/categories/index.tsx`) | ✅ **Done** |
| **GST Tax Invoices & Reports** | Report exports | Invoices stream and sales/inventory telemetry views | `GET /api/v1/admin/invoices`, `GET /admin/reports` | ✅ **Done** |

---

## 8. Invoicing, Inward Stock & Offline Resilience

| Feature | Web Platform (`femmeflo-website`) | Mobile App (`femmeflo-app`) | Backend Contract & Implementation Evidence | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Tax Invoice PDF Streaming** | Direct browser download link | Authenticated fetch via Bearer token with caching and native OS share/print dialog | `GET /api/v1/invoices/:id/pdf` (`expo-file-system`, `expo-sharing`) | ✅ **Done** |
| **Offline Order Drafts** | Lost on refresh | Persisted in AsyncStorage keyed by `userId`; automatically restored on POS terminal launch | `draftStorage.ts`, `sales/new.tsx:103-165` | ✅ **Done** |
| **Offline Customer Drafts** | Lost on refresh | Customer onboarding form state autosaved and restored | `draftStorage.getCustomerDraft` (`customers/new.tsx:148-155`) | ✅ **Done** |
| **Offline Active Shift Caching** | Server-only state | Active shift cached locally; protects field officers against 500 errors during remote shift start/end | `draftStorage.getActiveShift`, `manager_shift_and_sales_resilience.test.ts` | ✅ **Done** |
| **In-App Notification Center** | Bell popover | Persistent in-app notification center with unread indicators, mark-as-read, and mark-all-read | `GET /api/v1/notifications`, `PATCH /read` (`notifications/index.tsx`) | ✅ **Done** |
| **Zero Regressions & Unit Verification** | Jest web suite | **356 passing unit & scenario tests across 42 suites** | Built-in Node test runner (`node --test`) | ✅ **Done** |
