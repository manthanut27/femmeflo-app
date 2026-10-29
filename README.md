# FemmeFlo Mobile App (React Native / Expo Android)

Production-ready Android mobile application for the **FemmeFlo Seller, Manager & Super Admin Management System**, built with React Native, Expo SDK 58, and TypeScript.

---

## 📱 Features by Role

### 1. 🛍️ Seller Role (`/seller`)
- **Dashboard**: Real-time sales metrics, available van stock balance, quick POS access, and Duty Shift manager (Start/End shift with vehicle odometer KM tracking & foreground GPS).
- **Customer Directory**: Searchable list with category filters and pagination.
- **Customer Onboarding**: Foreground GPS coordinate capture with manual retry fallback, 6-digit PIN code auto-fill, category selection, required customer email validation, and optional storefront photo capture via camera/gallery.
- **Customer Details**: Store ledger, past order history, phone call, email, and Google Maps direction shortcuts.
- **POS / Sale Creation**: SKU selection, live van stock verification, price validation against configured minimum price (e.g. ₹25), amber badge warning for below-minimum price sales requiring Super Admin approval, payment mode selection (exactly `CASH`, `BANK`, `PENDING`), and idempotency protection against duplicate submissions.
- **Order Details & Tax Invoices**: Order status timeline (`PENDING`, `APPROVED`, `CONFIRMED`, `REJECTED`), outstanding payment collection for pending orders, and tax invoice PDF download & native Android share sheet via `expo-sharing`.
- **Inventory Ledger**: Van stock balances by product SKU and inventory movement transaction history.
- **Incentives & Commissions**: Monthly commission earnings, per-packet rates, and immutable historical ledger preserving past rates.
- **Profile & Shifts**: Duty shift history (odometer KM logs, timestamps) and session sign-out.

### 2. 👔 Manager Role (`/manager`)
- **Executive Territory Dashboard**: Supervised field sellers count, monthly territory revenue, customer store count, and sanitary packet volume.
- **Seller Management**: Directory of field officers in the manager's assigned territory with active status, performance stats, and onboarding new sellers.
- **Territory Customer Directory**: Master store accounts across the territory.
- **Territory Sales Stream**: Territory-wide order feed with status badges and collection tracking.

### 3. 🛡️ Super Admin Role (`/admin`)
- **Executive Overview**: Total revenue, packets sold, central warehouse stock, active field force count, and pending approvals counter.
- **Low-Price Sale Approvals Queue**: Live queue of sales submitted below the minimum price. Side-by-side comparison of requested price vs minimum price with one-tap Approve / Reject actions enforced authoritatively on the backend.
- **HQ Warehouse Inventory**: Central warehouse balances, stock ledger, factory inward stock receipt form, and warehouse-to-seller stock transfer dispatch.
- **User Lifecycle Management**: Central directory of Managers and Sellers with status management and access administration.
- **Global Settings & Price Thresholds**: Real-time configuration of the system minimum sale price (e.g. ₹25) and low stock alert thresholds.
- **Category Management**: Customer store category creation, activation, and management.

### 4. 🔔 Shared Features (`/shared`)
- **Unified Login**: Single entry point with role-selection pills (`Seller`, `Manager`, `Super Admin`), secure hardware-backed token storage via `expo-secure-store`, role mismatch detection, and session auto-restoration.
- **In-App Notification Center**: Unread indicators, mark-as-read, and mark-all-read.
- **Change Password**: In-app password rotation.

---

## 🛠️ Tech Stack & Architecture

- **Framework**: React Native 0.88, Expo SDK 58, Expo Router (file-based routing)
- **Language**: TypeScript with strict mode
- **State & Auth**: `AuthContext` with hardware-backed native persistence via `expo-secure-store`
- **Network / API**: Centralized typed client with Render 45s cold-start timeout handling, session expiration hooks, and idempotency headers
- **Styling**: Vanilla React Native StyleSheet using FemmeFlo design tokens (`#E61C5D` Berry Pink, `#156035` Forest Green, `#FAF8F5` Warm Canvas)
- **Testing**: Built-in Node test runner (`node --test`) covering 15 business-critical scenarios

---

## 🚀 Running the App Locally

### Prerequisites
- Node.js v20+ or v24+
- Android Studio / Android Emulator OR a physical Android phone with Expo Go

### 1. Install Dependencies
```bash
cd femmeflo-app
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
> **Note on Web CORS**: The backend at `femmeflo-inventory.onrender.com` is configured with a CORS whitelist that explicitly permits `http://localhost:3000`. Using `npm run web` runs Expo on port 3000 so browser requests succeed without CORS preflight blocks.

---

## 🧪 Testing & Verification

### 1. Run All Automated Unit & Scenario Tests
Executes the comprehensive test suite covering all 15 business-critical scenarios (Master Prompt Section 12):
```bash
npm test
```

### 2. TypeScript Typecheck
Verifies zero TypeScript compilation errors across all screens, layouts, and components:
```bash
npm run typecheck
```

---

## 📦 Building an Internal APK (Android)

### Prerequisites for EAS Build
Install the EAS CLI:
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
