# FemmeFlo Mobile App (React Native / Expo Android)

> **Version**: v1.0.20 (Android `versionCode: 24`)  
> **Platform Target**: Android (Expo SDK 58 / React Native 0.88.1 / React 19.3.0 / TypeScript)  
> **Architecture**: Offline-resilient field operations client interfacing with the FemmeFlo Express/Prisma inventory server.

Production-grade Android mobile application for the **FemmeFlo Seller, Manager & Super Admin Management System**. Designed for high-reliability rural and semi-urban distribution operations with biometric authentication, dynamic customer onboarding, decoupled direct point-of-sale, and automated multilingual field feedback translation.

---

## 🌟 Core Feature Highlights

### 1. 🏪 Customer Onboarding & Verification (4-Card Architecture)
Located at `/(seller)/customers/new` and `/(manager)/customers/new`:
- **Current Location GPS Card**: Real-time foreground GPS coordinate acquisition (`latitude`, `longitude`, `accuracy` in meters). Displays detected district and state with a manual re-acquire / 'Change' button and graceful fallback.
- **Storefront Photo & Exemption Verification Card**:
  - Storefront entrance/signboard camera capture or gallery picker with JPEG compression.
  - **Automatic Exemption Locking**: When a storefront photo is captured, the *"Reason for not adding shopkeeper photo"* dropdown is automatically disabled and locked (`Storefront photo captured • Exemption not required`) with a green security badge.
  - **Exemption Dropdown (Photo Absent)**: Standardized reasons including *Poor network connectivity*, *Customer refused photo*, *Shopkeeper not present / closed*, *Camera / device malfunction*, and *Indoor shop / poor lighting*.
- **Shop Information Card**: Mandatory shop/store name (`*`), owner name (`*`), mobile number (`*` with `+91` prefix, 10 digits), and optional email address.
- **Account Assignment & Trade Category Card**:
  - **Strictly Dynamic Manager Dropdown**: Zero hardcoded manager strings. Dynamically queries `adminApi.listManagers` / `managerApi.listSellers` with automatic fallback to the active authenticated user. Search modal with real-time filtering.
  - **Trade Category Selector**: Dynamically populated category modal for assigning retail outlet trade classification.
- **Address Details Card**:
  - **6-Digit PIN Code Auto-Lookup**: Typing a 6-digit PIN code automatically triggers postal API reverse-lookup to populate District, State, and Locality.
  - Inputs for street address/landmark (`*`), village/locality, district (`*`), state (`*`).
  - Interactive **Mini Map Address Preview** visualization tile.
- **Post-Submission Confirmation**: Dedicated `SaveConfirmationCard` displaying saved retail outlet credentials, server creation timestamp, GPS coordinates, photo status, and batch entry shortcut.

---

### 2. 🔐 Native Biometric & Mobile Password Shift Authentication
Located in `src/components/common/ShiftAuthVerificationModal.tsx`:
- **Replaced Face Selfie Attendance**: Native Android Fingerprint / Biometric authentication powered by `expo-local-authentication` (`hasHardwareAsync`, `isEnrolledAsync`) with tactile pulsing radar animations.
- **Mobile PIN / Password Fallback**: Direct fallback tab allowing field officers to verify shift start and end using their mobile security PIN or account password.
- **Backwards-Compatible Telemetry**: Translates authentication events into backwards-compatible fields (`faceVerified: true`, `facePhoto: biometric_fingerprint_verified`, `faceConfidence: 0.99`, `faceMethod: FINGERPRINT_BIOMETRIC` or `MOBILE_PASSWORD`), guaranteeing seamless interoperability with legacy backend attendance schemas.
- **Odometer Validation**: Validates starting odometer KM (non-negative) and closing odometer KM (`closingKm >= startingKm`).

---

### 3. 💳 Decoupled Direct POS Sales & Shift Visit Sales Flows
Located at `/(seller)/sales/new` and `/(seller)/shift`:
- **Decoupled Direct Sales Flow**: Field sellers and dual-role managers can record sales directly at any time without a blocking active duty shift prerequisite, eliminating field order bottlenecks.
- **Integrated Duty Shift Visit Sales**: Full support for checking into retail stores during active duty shifts, logging visit outcomes, and attaching sales directly to specific store visit records.
- **POS Terminal Capabilities**:
  - Customer selection with searchable modal directory.
  - Multi-line item SKU cart with fast increment/decrement steppers and custom unit pricing.
  - Real-time van stock balance validation preventing accidental overselling.
  - Below-floor price detection with amber banner alerts (`#D97706`) routing special pricing to the Super Admin approval queue.
  - Payment modes: Exactly `CASH`, `BANK`, or `PENDING`.
  - **Idempotency Protection**: Cryptographic UUID v4 `requestKey` bound to order payload hash, auto-rotating when payload edits occur after a submission attempt.
  - Local order draft auto-save and recovery via `@react-native-async-storage/async-storage`.

---

### 4. ⚡ Manager Quick Actions Hub
Located at `/(manager)/quick-actions/index.tsx`:
- **Safe Area Insets & Alignment**: Pixel-perfect top safe area insets via `useSafeAreaInsets` (`Math.max(insets.top, Platform.OS === 'ios' ? 14 : 20) + 6`), ensuring seamless integration across notched and punch-hole Android devices.
- **Hero Action Card**: Prominent one-tap shortcut to **New Sale** (`/(seller)/sales/new`).
- **Operational Action Grid**:
  1. **Daily Shift**: Punch-in / Route management (`/(seller)/shift`).
  2. **Check Van Stock**: Mobile stock balances (`/(manager)/inventory`).
  3. **Add New Shop**: Retail customer onboarding (`/(manager)/customers/new`).
  4. **Manage Sellers**: Field officer roster and onboarding (`/(manager)/sellers`).
  5. **All Sales**: Comprehensive sales history stream (`/(manager)/sales`).
- **Support Hub**: Dedicated operational support card with one-touch direct phone dialer (`tel:18001234567`) and pre-filled email support (`support@femmeflo.com`).
- **Visual Design**: Indian architectural monument skyline vector silhouette and fluid maroon wave accent in the footer.

---

### 5. 🏛️ Administrative Actions Command Center (13 Modules)
Located at `/(admin)/actions/index.tsx`:
- Centralized executive navigation grid organizing all 13 core administrative capabilities into clear operational categories:
  - **Sales & Reports**: Daily Sales & Reports, GST Tax Invoices, Sales Orders, Incentives & Payouts.
  - **Approvals**: Real-time Price Approvals queue with dynamic pending count badge (`#DC2626` alert) and live synchronization via `DeviceEventEmitter` (`APPROVAL_STATUS_CHANGED`).
  - **Products & Stock**: Products & Prices, Stock Movement (Transfer, Inward, History), Regional Warehouses.
  - **Field Team**: Staff Shifts & Routes, Shops & Customers directory.
  - **Team & Access**: Manager Permissions, Managers & Sellers lifecycle administration.
  - **Settings**: Shop Categories, Company & Invoice Settings.

---

### 6. 🎙️ Multilingual Voice Feedback Translation (Hindi/Hinglish to English)
Located in `src/components/common/VoiceFeedbackTranslator.tsx`:
- **Real-Time Speech-to-Text**: Powered by `expo-speech-recognition` and web speech fallback.
- **Hindi & Hinglish Translation**: Automatically recognizes spoken Hindi (Devanagari) and romanized Hinglish field jargon, translating them into crisp, professional English field notes (`src/api/translate.ts`).
- **Audio Visualizer**: Live pulsing microphone recording indicator with clear error feedback on permission denial.
- **Translation Audit & Inline Editing**: Modal displaying original spoken transcript side-by-side with translated English, allowing field officers to review and edit text before applying.
- **Quick-Tap Field Chips**: Pre-built phrases for common village field situations (*"Dukaan band thi owner gaon gaya hai"*, *"Payment kal aayega sample de diya hai"*, etc.).
- Integrated directly into POS sales creation and shift store visit checkout notes.

---

## 📱 Features by Role

### 1. 🛍️ Field Seller Role (`/(seller)`)
- **Dashboard (`/(seller)/index`)**: Real-time sales metrics, available van stock balance, quick POS trigger, and Duty Shift manager with Biometric/PIN authentication modal.
- **Customer Directory & Onboarding (`/(seller)/customers`)**: Searchable customer list, category filters, 4-card onboarding flow with PIN lookup, GPS capture, and photo exemption locking.
- **POS / Sale Creation (`/(seller)/sales/new`)**: Decoupled sales entry, multi-product line items, live van stock checking, floor price validation, Voice Feedback Translator, and idempotency protection.
- **Order Details & Tax Invoices (`/(seller)/sales/[id]`)**: Status timeline (`PENDING`, `APPROVED`, `CONFIRMED`, `REJECTED`), outstanding payment collection modal, and tax invoice PDF download via `expo-file-system` with native sharing via `expo-sharing`.
- **Van Stock Inventory (`/(seller)/inventory`)**: Van stock balances by SKU and transaction ledger.
- **Incentives & Commissions (`/(seller)/incentives`)**: Monthly commission earnings, per-packet rate breakdown, and historical rate preservation.
- **Profile & Shifts (`/(seller)/profile`)**: Duty shift logs, vehicle odometer readings, and session sign-out.

### 2. 👔 Territory Manager Role (`/(manager)`)
- **Executive Territory Dashboard (`/(manager)/index`)**: Supervised field sellers count, monthly territory revenue, customer store count, and packet volume.
- **Quick Actions Hub (`/(manager)/quick-actions/index`)**: Safe-area aligned operational launchpad for rapid sales, shift tracking, stock checks, and support helpline.
- **Seller Management (`/(manager)/sellers`)**: Directory of field officers with active status, performance telemetry, and seller onboarding form (`new.tsx`).
- **Territory Customer Directory (`/(manager)/customers`)**: Master store accounts across territory with full 4-card onboarding support.
- **Territory Sales Stream (`/(manager)/sales`)**: Territory-wide order feed with status badges and collection tracking.
- **Dual-Role Switching**: Instant toggle between Manager and Field Seller modes for accounts with `isSeller: true`.

### 3. 🛡️ Super Admin Role (`/(admin)`)
- **Executive Command Center (`/(admin)/index`)**: Total revenue, packets sold, central warehouse stock, active field force count, and pending approvals counter.
- **Administrative Actions Hub (`/(admin)/actions/index`)**: 13 operational modules across Sales, Approvals, Stock, Team, and Settings.
- **Low-Price Approvals Queue (`/(admin)/approvals`)**: Side-by-side comparison of requested price vs minimum price with one-tap Approve / Reject actions enforced authoritatively on the backend.
- **Stock Movement Hub (`/(admin)/inventory/transfer`)**: Multi-warehouse stock movement, factory inward stock receipt, and warehouse-to-seller vehicle transfers.
- **User Lifecycle Management (`/(admin)/users`)**: Central directory of Managers and Sellers with status management and access administration.
- **Global Settings & Price Thresholds (`/(admin)/settings`)**: Real-time configuration of the system minimum sale price (e.g. ₹25) and low stock alert thresholds.
- **Category Management (`/(admin)/categories`)**: Retail store category creation, activation, and management.

### 4. 🔔 Shared Features (`/(auth)` & Common)
- **Unified Login (`/(auth)/login`)**: Role selection pills (`Seller`, `Manager`, `Super Admin`), secure hardware-backed token storage via `expo-secure-store`, role mismatch verification, and session auto-restoration.
- **In-App Notification Center (`/(shared)/notifications`)**: Persistent notification inbox with unread badges, mark-as-read, and mark-all-read.
- **Change Password (`/(shared)/change-password`)**: Authenticated password rotation.

---

## 🛠️ Tech Stack & Specifications

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Mobile Framework** | React Native 0.88.1 / Expo SDK 58 (~58.0.25) | File-based routing via `expo-router` ~58.0.31 |
| **Language & Engine** | TypeScript ~6.0.3 / React 19.3.0 | Strict typechecking with React 19 compiler compliance |
| **Authentication & Tokens**| `expo-secure-store` ~58.0.3 | Hardware-backed keystore persistence, JWT preservation |
| **Biometrics** | `expo-local-authentication` ~58.0.3 | Native fingerprint / biometric recognition with PIN fallback |
| **Speech Recognition** | `expo-speech-recognition` ^58.0.1 | Multilingual Hindi/Hinglish speech recognition |
| **Location & Geo** | `expo-location` ~58.0.22 | Foreground GPS point-event capture (no invasive background pings) |
| **Camera & Imaging** | `expo-image-picker` ~58.0.10 | JPEG compression standardizing cross-platform photo capture |
| **File Sharing** | `expo-file-system` / `expo-sharing` | Authenticated invoice streaming and native Android share sheet |
| **Design System** | FemmeFlo Tokens | `#881337` Deep Maroon, `#E61C5D` Berry Pink, `#156035` Forest Green, `#FBF9FA` Canvas |
| **Automated Testing** | Built-in Node test runner (`node --test`) | **356 passing unit and acceptance tests across 42 suites** |

---

## 🚀 Running the App Locally

### Prerequisites
- Node.js v20+ or v24+
- Android Studio / Android Emulator OR physical Android phone with Expo Go

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default API Base URL points to the live backend:
```env
EXPO_PUBLIC_API_URL=https://femmeflo-inventory.onrender.com/api/v1
```

### 3. Start Development Server

**For Android (Target Platform):**
```bash
npm run android
```
- Or run `npm start` and press `a` to open in Android Emulator, or scan the QR code with **Expo Go** on a physical Android device. Native Android network requests are not subject to browser CORS.

**For Web Browser Preview (Port 3000):**
```bash
npm run web
```
> **Note on Web CORS**: The backend at `femmeflo-inventory.onrender.com` explicitly permits `http://localhost:3000`. Running `npm run web` operates Expo on port 3000 so browser requests succeed without CORS preflight blocks.

---

## 🧪 Testing & Verification

### 1. Run All Automated Unit & Acceptance Tests
Executes the comprehensive test suite covering all 356 business-critical scenarios:
```bash
npm test
```

### 2. TypeScript Strict Typecheck
Verifies zero TypeScript compilation errors across all screens, layouts, and components:
```bash
npm run typecheck
```

---

## 📦 Building an Internal APK (Android)

### Prerequisites for EAS Build
Install the EAS CLI and sign in:
```bash
npm install -g eas-cli
eas login
```

### 1. Configure EAS Build
```bash
eas build:configure
```

### 2. Generate Internal Preview APK
Add the preview profile to `eas.json`:
```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {}
  }
}
```
Run the APK build:
```bash
eas build -p android --profile preview
```
Once complete, EAS provides a direct download link for the internal `.apk` file ready to install on Android devices.

### 3. Local Native Build (Alternative without Cloud EAS)
Generate native Android Gradle project:
```bash
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```
The resulting APK will be located at:
`android/app/build/outputs/apk/release/app-release.apk`
