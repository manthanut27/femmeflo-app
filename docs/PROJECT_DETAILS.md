# FEMMEFLO MOBILE APPLICATION — COMPREHENSIVE TECHNICAL MANUAL & PROJECT DETAILS

**Target Version:** 1.0.17  
**Framework:** React Native 0.88.1 / Expo SDK 58 (~58.0.23) / React 19.3.0 / TypeScript 6.0.3  
**Architecture:** Expo Router v58 (File-based navigation with route guards)  
**Document Classification:** Engineering Blueprint & Technical System Manual  

---

## 1. What is FemmeFlo App? (Business Domain & Purpose)

**FemmeFlo** is an enterprise-grade mobile field sales, inventory movement, and territory governance application engineered for the healthcare, hygiene, and FMCG retail distribution sector in India.

The application serves three distinct operational tiers:
1. **Field Sales Officers (Sellers):** Frontline personnel operating on delivery vans/two-wheelers who visit village grocers, pharmacies, and general stores to take spot orders, onboard new retailers, and deliver physical sanitary napkin packets from van stock.
2. **Territory Sales Managers (Managers):** Regional supervisors who track daily seller attendance, route kilometers, beat orders, and depot inventory balances, while retaining full dual-role frontline selling authority to book orders directly.
3. **HQ Operations & Leadership (Super Admins):** Central administrators who govern national factory inwards, depot stock transfers, minimum price compliance (₹25 threshold), discount approvals, and commission payouts.

---

## 2. System Architecture & Tech Stack

### 2.1 Complete Tech Stack Breakdown

| Technology | Version / Spec | Purpose in Project |
| :--- | :--- | :--- |
| **Expo SDK** | `~58.0.23` | Application runtime, Continuous Native Generation (CNG), build toolchain |
| **React Native** | `0.88.1` | Mobile core framework compiling to native Android/iOS UI |
| **React** | `19.3.0` | Declarative UI layer, hooks, and Concurrent Mode rendering |
| **TypeScript** | `~6.0.3` | Strict compile-time typing across all domain entities, APIs, and components |
| **Expo Router** | `~58.0.30` | File-based declarative routing (`src/app/`) with nested layouts & stacks |
| **AsyncStorage** | `2.2.0` | Local cache for offline drafts, pending forms, and profile states |
| **Expo SecureStore** | `~58.0.2` | Hardware-backed encrypted storage for JWT bearer auth tokens |
| **Expo Location** | `~58.0.20` | Foreground high-accuracy GPS capture for retailer geo-tagging & shifts |
| **Expo Image Picker** | `~58.0.10` | Camera capture for store KYC photos and selfie face verification |
| **Expo Speech Recognition** | `^58.0.1` | Native microphone audio capture for Hindi and Hinglish voice feedback |
| **Expo File System & Sharing** | `~58.0.11 / 22` | PDF tax invoice downloading and native Android sharing sheet |
| **Vector Icons** | `@expo/vector-icons ^15.0.2` | Ionicons icon set for mobile navigation and visual status |

---

## 3. Directory Layout & File Organization

The project is structured according to modern Expo Router conventions:

```
femmeflo-app/
├── app.json                     # Expo configuration (permissions, plugins, schemes)
├── package.json                 # Dependencies, test scripts, and engine locks
├── tsconfig.json                # TypeScript compiler configuration (strict mode)
├── eslint.config.js             # ESLint 9 configuration with Expo rules
├── docs/                        # Complete technical specifications & PRDs
│   ├── PRD.md                   # Product Requirements Document (Master)
│   ├── PROJECT_DETAILS.md       # This comprehensive technical manual
│   ├── API CONTRACTS.md         # Full REST API contracts & payloads
│   └── quality/                 # Audit logs, bug reviews, and release reports
├── src/
│   ├── api/                     # Backend communication layer & HTTP client
│   │   ├── client.ts            # Fetch wrapper, JWT injection, 401/403 eviction
│   │   ├── types.ts             # Complete TypeScript interfaces for all entities
│   │   ├── auth.ts              # Authentication endpoints (/auth/login, /auth/me)
│   │   ├── seller.ts            # Seller POS, shifts, customers, van inventory
│   │   ├── manager.ts           # Manager dashboard, team sellers, territory shifts
│   │   ├── admin.ts             # Admin transfers, factory inwards, approvals, pricing
│   │   ├── mockService.ts       # Offline mock data provider for isolated testing
│   │   ├── mockData.ts          # Seed data for offline development
│   │   └── translate.ts         # Server translation endpoint for voice notes
│   ├── app/                     # Expo Router file-based screens
│   │   ├── _layout.tsx          # Root Stack with AuthProvider & SafeAreaProvider
│   │   ├── index.tsx            # Initial session router (redirects by role)
│   │   ├── +not-found.tsx       # 404 fallback screen
│   │   ├── (auth)/              # Authentication screens
│   │   │   └── login.tsx        # Multi-role login with visual role switcher
│   │   ├── (seller)/            # Field Seller portal routes
│   │   │   ├── _layout.tsx      # Seller bottom tabs & role guard
│   │   │   ├── index.tsx        # Seller Home (quick POS, shift status, metrics)
│   │   │   ├── shift/           # Start/end duty shift with selfie & meter
│   │   │   ├── customers/       # Retail store list, onboarding, details
│   │   │   ├── sales/           # POS new cart, past orders, invoice detail
│   │   │   ├── inventory/       # Personal van stock balances
│   │   │   ├── incentives/      # Commission earnings & packet rates
│   │   │   └── profile/         # Profile details, recent shifts, change password
│   │   ├── (manager)/           # Territory Manager portal routes
│   │   │   ├── _layout.tsx      # Manager bottom tabs & role guard
│   │   │   ├── index.tsx        # Manager Dashboard & Dual-Role Sales Hub
│   │   │   ├── sellers/         # Team sellers directory & onboarding
│   │   │   ├── customers/       # Territory customer directory & bulk CSV
│   │   │   ├── sales/           # Daily sales reports & order review
│   │   │   ├── inventory/       # Regional depot stock supervision
│   │   │   ├── shifts/          # Team attendance & route distance audits
│   │   │   ├── incentives/      # Team commission audit
│   │   │   └── profile/         # Manager account details
│   │   ├── (admin)/             # Super Admin executive portal routes
│   │   │   ├── _layout.tsx      # Admin bottom navigation & role guard
│   │   │   ├── index.tsx        # Executive national KPI overview
│   │   │   ├── actions/         # Dedicated Administrative Action Hub
│   │   │   ├── approvals/       # Below-threshold price discount approvals
│   │   │   ├── inventory/       # Modern 3-section Stock Movement Hub
│   │   │   ├── users/           # User account provisioning (Admins, Managers, Sellers)
│   │   │   ├── permissions/     # Granular manager permissions management
│   │   │   ├── products/        # Product catalog & pricing configuration
│   │   │   ├── categories/      # Retail shop category management
│   │   │   ├── incentives/      # Seller commission rates & payouts
│   │   │   ├── reports/         # Financial & geographical sales reports
│   │   │   └── settings/        # System configuration & minimum sale price (₹25)
│   │   └── (shared)/            # Shared modal screens
│   │       ├── notifications.tsx# In-app notification inbox
│   │       └── change-password.tsx# Password update modal
│   ├── components/              # Reusable UI & Business components
│   │   ├── common/              # Common functional widgets
│   │   │   ├── MobileNavigationDrawer.tsx # Left-sliding mobile nav drawer
│   │   │   ├── FaceVerificationModal.tsx  # Biometric selfie verification modal
│   │   │   ├── ShiftRequiredGate.tsx      # Duty shift blocking guard screen
│   │   │   ├── VoiceFeedbackTranslator.tsx# Hindi/Hinglish voice feedback component
│   │   │   └── ISTClock.tsx               # Real-time Indian Standard Time clock
│   │   ├── customers/           # Customer components (Bulk CSV, Photo capture)
│   │   └── ui/                  # Design system primitives (Button, Card, Badge, Input...)
│   ├── constants/               # Design tokens & themes
│   │   └── theme.ts             # Brand colors, typography, spacing, shadows
│   ├── context/                 # Application state contexts
│   │   └── AuthContext.tsx      # Auth state machine & session management
│   ├── utils/                   # Domain helpers & logic engines
│   │   ├── shiftGuard.ts        # requireActiveShift() verification engine
│   │   ├── permissions.ts       # Granular manager permissions evaluation
│   │   ├── toast.ts             # Village-friendly English toast notifications
│   │   ├── distanceUtils.ts     # Haversine distance & odometer fallback
│   │   ├── locationUtils.ts     # OpenStreetMap reverse geocoding
│   │   ├── draftStorage.ts      # Offline draft caching in AsyncStorage
│   │   ├── inventoryMovement.ts # Modern stock movement validations
│   │   └── csvParser.ts         # Client-side RFC CSV parsing for bulk customers
│   └── __tests__/               # 37 Automated Test Suites (302 passing tests)
```

---

## 4. How the Application Works (Core Workflows)

### 4.1 Authentication & Multi-Role Architecture
1. **Startup Routing (`src/app/index.tsx`):**
   - On launch, the startup screen boots `AuthProvider`.
   - Checks `tokenStorage.getToken()` from encrypted SecureStore.
   - If token is present, issues a verification request to `GET /auth/me`.
   - If verified, routes user directly to their role portal:
     - `SUPER_ADMIN` -> `/(admin)`
     - `MANAGER` -> `/(manager)`
     - `SELLER` -> `/(seller)`
   - If no token or if the server returns HTTP 401/403, immediately clears token and redirects to `/(auth)/login`.

2. **Role-Based Guards (`_layout.tsx` files):**
   - Every layout in `(admin)`, `(manager)`, and `(seller)` monitors `user?.role`.
   - Unauthorized attempts to deep-link into another role's routes trigger an immediate redirect back to the user's authorized home workspace.

---

### 4.2 Shift & Attendance Workflow (Face Verification + Meter KM)
The attendance system prevents attendance fraud in rural distribution:
1. **Shift Gate (`requireActiveShift`):**
   - When a seller or manager attempts to create a POS sale, onboard a customer, or check in to a shop, `requireActiveShift(userId)` is triggered.
   - If no shift is active, a dialog prompts: *"Duty Shift Required: You must start your daily duty shift with selfie verification before you can record field sales"*, and automatically routes to `/(seller)/shift`.
2. **Clock-In Sequence:**
   - Seller enters starting vehicle odometer KM reading (e.g., `45,210`).
   - App requests camera access and opens `FaceVerificationModal`.
   - Front camera captures live selfie image with face confidence scoring.
   - `expo-location` acquires high-accuracy GPS coordinates.
   - Dispatches `POST /seller/shifts/start` with odometer, selfie, and coordinates.
   - Active shift state is persisted in live storage and cached locally in `draftStorage`.
3. **During Shift:**
   - Seller checks into retail stores, records sales, and captures feedback.
4. **Clock-Out Sequence:**
   - Seller enters final odometer reading (e.g., `45,268`).
   - Final selfie verification is captured.
   - App computes total distance travelled using Haversine formula on GPS points, with fallback to `(endOdometer - startOdometer)` if GPS coverage was intermittent in rural areas.
   - Dispatches `POST /seller/shifts/end`.

---

### 4.3 Multi-SKU Point of Sale (POS) & The ₹25 Price Rule
1. **Cart Creation (`/(seller)/sales/new`):**
   - Seller selects an onboarded retail customer from a searchable modal.
   - Adds product packets to the multi-SKU cart.
   - Quantity is validated against the seller's active vehicle van inventory.
2. **Pricing Policy Check (Invariant):**
   - Standard minimum sale price is ₹25.00 (2,500 paise) per packet.
   - If the seller enters a discounted price (e.g., ₹22.00):
     - The POS automatically flags the transaction as `PENDING_APPROVAL`.
     - Prompts seller for an approval remark explaining the retailer discount.
     - Does **NOT** deduct van stock yet.
     - Submits order via `POST /seller/sales` with a unique `X-Idempotency-Key`.
3. **Super Admin Approval:**
   - Super Admin views the order in `/(admin)/approvals`.
   - When Admin taps **Approve**:
     - Status updates to `CONFIRMED`.
     - Seller's van inventory is atomically decremented.
     - Sold packet count is incremented.
     - A `SALE` ledger entry is appended to the inventory transaction history.
     - Sequential Tax Invoice is automatically generated.
4. **Payment Collection:**
   - Seller marks payment mode: `CASH`, `BANK` (with reference/UTR), or `PENDING`.

---

### 4.4 Dual-Role Persona for Territory Managers
Territory Managers are equipped with frontline sales authority:
1. **Manager as Seller (`src/app/(seller)/_layout.tsx`):**
   - Access to seller routes is granted to both `role === 'SELLER'` and `role === 'MANAGER'`.
2. **Dashboard Dual-Role Hub (`src/app/(manager)/index.tsx`):**
   - Features a **Field Sales & Attendance** hub card.
   - Provides direct 1-tap buttons:
     - `New Field Sale` (checks shift prerequisite and opens POS).
     - `My Duty Shift` (navigates to personal shift punch-in).
3. **Dedicated Van Stock:**
   - Stock transfers in `Stock Movement Hub` recognize dual-role managers as valid van stock destinations with a distinct `VAN STOCK` badge.

---

### 4.5 Modern 3-Section Stock Movement Hub
Re-architected to enterprise standard in `src/app/(admin)/inventory/index.tsx`:
1. **Segmented Navigation:** Exactly 3 primary buttons: `[ Stock Transfer ] [ Stock Inward ] [ History ]`.
2. **Section 1: Stock Transfer:**
   - Source Location: Central HQ or Regional Warehouse (loads real packet balance).
   - Destination Location: Eligible Regional Depot or Field Seller / Dual-Role Manager Van.
   - Products & Quantities: SKU selection with real-time balance validation.
   - Submits `POST /admin/inventory/transfers` atomically.
3. **Section 2: Stock Inward:**
   - Dedicated flow for receiving verified factory inventory directly into Central Reserve.
   - Warehouse dropdown is intentionally omitted because the backend automatically routes inwards to Central HQ.
   - Submits `POST /admin/inventory/receipts` using independent UUID idempotency keys.
4. **Section 3: Auditable Ledger History:**
   - Fetches `GET /admin/inventory/transactions`.
   - Interactive type filter pills: `All`, `Inward`, `Transfer`, `Sales`.
   - Cards display Transaction Type, Product Name, SKU, Packet Quantity, Source, Destination, Date, Time, and Actor.
5. **Quick Add Warehouse:**
   - Clean modal to provision regional depots by name.

---

### 4.6 Voice Feedback & Vernacular Translation
Designed specifically for rural field operations in `src/components/common/VoiceFeedbackTranslator.tsx`:
1. Uses `expo-speech-recognition` to listen to shop owners speaking in Hindi or Hinglish.
2. Sends speech transcript to server translation service `POST /translate/speech`.
3. AI model translates colloquial village feedback (e.g. *"mal jaldi bhejo, pichla stock khatam ho gaya"*) into professional English field notes (*"Retailer requests urgent replenishment; previous sanitary stock completely sold out"*).
4. Seller can review, adjust, or undo before saving into the shop visit report.

---

### 4.7 Mobile Navigation Drawer
Implemented in `src/components/common/MobileNavigationDrawer.tsx`:
- Slides out smoothly from the left with an accessible backdrop.
- **Closed by default** (`visible = false`) when opening the app.
- Triggered by the hamburger menu icon in `Header.tsx` (`showMenu={true}`).
- Displays:
  - User identity, role badge, and assigned district.
  - Live Duty Shift status indicator with 1-tap start/stop link.
  - Quick action links for Dashboard, New Field Sale, Duty Shift, Territory Sales, Team Sellers, Retail Stores, Depot Stock, Profile, and Sign Out.

---

## 5. Design System & Tokens (`src/constants/theme.ts`)

The visual design language is tailored for readability in bright sunlight and on budget Android screens:

```typescript
// Brand Colors
BrandColors.pink.primary  = '#E61C5D' // Primary brand pink/rose (Healthcare FMCG)
BrandColors.pink.dark     = '#9F2545' // Deep rose for executive headings
BrandColors.pink.subtle   = '#FFF5F7' // Gentle card highlight background
BrandColors.green.primary = '#156035' // Deep forest green (Supply chain & success)
BrandColors.green.surface = '#EBF6EF' // Subtle green container fill
Colors.light.background   = '#FAF8F5' // Warm off-white canvas (prevents screen glare)
Colors.light.heading      = '#09090B' // High contrast text
Colors.light.border       = '#E2E8F0' // Clean divider lines
```

---

## 6. Testing & Quality Assurance

The codebase features an exhaustive automated test suite running on Node.js's native test runner (`node --test`), completing in **~8 seconds** without third-party test framework overhead:

```bash
# Run all 37 test suites (302 tests)
npm test

# Run TypeScript strict typecheck
npx tsc --noEmit

# Run Expo / ESLint analysis
npx expo lint
```

### Verified Test Suites Breakdown:
1. **Core Business Rules:** `business_rules.test.ts` (14 scenarios: ₹25 price floor, atomic inventory, invoice freeze)
2. **Dual-Role Persona:** `dual_role_persona_acceptance.test.ts` (Manager selling, shift prerequisites, drawer states)
3. **Duty Shift & Attendance:** `shift_workflow_acceptance.test.ts`, `odometer_distance_fallback.test.ts`
4. **Customer Onboarding:** `customer_onboarding_acceptance.test.ts`, `onboarding_backend_payload_safety.test.ts`
5. **Stock Movement Hub:** `stock_movement_hub.test.ts`, `stock_transfer_safety.test.ts`
6. **Voice Translation:** `voice_translation_acceptance.test.ts` (11 scenarios)
7. **Village Toast Naming:** `toast_naming.test.ts` (Plain English without confusing jargon)
8. **Permissions & Security:** `manager_permissions_acceptance.test.ts`, `offline_auth_resilience.test.ts`

---

## 7. How to Run & Build

### 7.1 Development Server
```bash
# Install dependencies
npm install

# Start Expo development server
npx expo start

# Run on connected Android device/emulator
npx expo run:android
```

### 7.2 Building Production APK with EAS
```bash
# Login to EAS
npx eas-cli login

# Build internal standalone Android APK
npx eas-cli build --platform android --profile preview
```
