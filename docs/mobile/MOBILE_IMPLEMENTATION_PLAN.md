# MOBILE IMPLEMENTATION PLAN: FEMMEFLO EXPO ANDROID APP

**Architecture:** React Native 0.88 + Expo SDK 58 + Expo Router  
**Target:** Android APK / Internal Release  
**Working Directory:** `c:\Users\manthan\Desktop\dev projects\hitesh ka project\femmeflo-app`

---

## Phase Breakdown & Milestone Schedule

### Phase 2: Expo Foundation & Core Utilities
* **Goal:** Install required native dependencies, establish the mobile design tokens, configure environment variables, create typed API client with Expo SecureStore, and fix initial TypeScript/starter glitches.
* **Tasks:**
  1. Install `expo-secure-store`, `expo-location`, `expo-image-picker`, `expo-sharing`, `expo-file-system`, `@expo/vector-icons`, and `@react-native-community/netinfo`.
  2. Implement `src/constants/theme.ts` adhering to the brand design system (Berry Pink `#E61C5D`, Forest Green `#156035`, Warm Canvas `#FAF8F5`).
  3. Create typed API client in `src/api/client.ts` replicating website endpoints with SecureStore token persistence, 45s cold-start timeout handling, and structured error boundaries.
  4. Create UI primitives: `Button`, `Input`, `Card`, `Badge`, `Header`, `EmptyState`, `LoadingSkeleton`.
  5. Validate clean TypeScript compilation (`npx tsc --noEmit`).

---

### Phase 3: Shared Authentication & Session Lifecycle
* **Goal:** Implement the universal entry point with role-selection hint, secure credential authentication, session restoration, and role routing.
* **Tasks:**
  1. Build `src/app/index.tsx` session resolver: Reads token from SecureStore, calls `/auth/me`, routes to `(seller)`, `(manager)`, or `(admin)`.
  2. Build `src/app/(auth)/login.tsx`:
     * Role selection pills (Seller, Manager, Super Admin).
     * Email / Password inputs with visibility toggle.
     * Authenticates with selected role context.
     * Validates returned user role against requested role.
     * Safely stores JWT in SecureStore.
  3. Build `src/app/(auth)/forgot-password.tsx` & `reset-password.tsx`.
  4. Build Session Expired and Logout handlers.

---

### Phase 4: Seller Workflows (POS, Customers, Shifts, Stock)
* **Goal:** Full field sales capabilities.
* **Tasks:**
  1. **Dashboard (`src/app/(seller)/index.tsx`):**
     * Daily sales amount (₹) & packet count.
     * Personal stock balance counter.
     * Duty Shift status card (Start Shift / Check In / End Shift).
  2. **Customer Management:**
     * `src/app/(seller)/customers/index.tsx`: Searchable retail customer directory.
     * `src/app/(seller)/customers/new.tsx`: Onboard retail shop with foreground GPS, Pincode auto-lookup, category picker, and optional storefront photo.
     * `src/app/(seller)/customers/[id].tsx`: Store profile and past order ledger.
  3. **Point of Sale & Orders:**
     * `src/app/(seller)/sales/new.tsx`: POS cart, product SKU selection, quantity, and price calculation.
     * Minimum price enforcement: Prices below configured minimum trigger amber banner and submit as `PENDING` approval.
     * Payment Mode: Cash, Bank, or Pending.
     * Duplicate submission guard.
     * `src/app/(seller)/sales/index.tsx`: Order ledger with status pills (`PENDING`, `APPROVED`, `CONFIRMED`, `REJECTED`).
     * `src/app/(seller)/sales/[id].tsx`: Order details, pending payment collection trigger, and tax invoice download/share.
  4. **Inventory & Incentives:**
     * `src/app/(seller)/inventory/index.tsx`: Personal van stock by SKU, transaction history.
     * `src/app/(seller)/incentives/index.tsx`: Monthly commission summary, per-packet rate breakdown.

---

### Phase 5: Manager Workflows (Territory Supervision)
* **Goal:** Supervised team performance and territory monitoring.
* **Tasks:**
  1. **Dashboard (`src/app/(manager)/index.tsx`):** Territory KPI summary, active sellers count, territory sales volume.
  2. **Seller Oversight:** `src/app/(manager)/sellers/index.tsx`: List of supervised field officers, active shift indicator, and new seller onboarding.
  3. **Customer & Sales Stream:** `src/app/(manager)/customers/index.tsx` and `sales/index.tsx`: Master view of territory customers and sales orders.
  4. **Territory Inventory:** `src/app/(manager)/inventory/index.tsx`: Stock balances across territory sellers and regional warehouses.

---

### Phase 6: Super Admin Workflows (Executive Control)
* **Goal:** Full administration, inventory transfers, and low-price approvals.
* **Tasks:**
  1. **Dashboard (`src/app/(admin)/index.tsx`):** National sales revenue, stock valuation, and active user stats with multi-filter drawer.
  2. **Price Approvals Queue (`src/app/(admin)/approvals/index.tsx`):**
     * Pending low-price sales list.
     * Review requested price vs minimum price.
     * One-tap Approve (confirms sale, reserves stock, generates invoice).
     * One-tap Reject (marks rejected, retains audit history, zero stock deducted).
  3. **HQ Inventory & Transfers (`src/app/(admin)/inventory/index.tsx` & `transfer.tsx`):**
     * Factory Inward Stock Receipt.
     * Stock Transfers from HQ to regional warehouses/sellers.
     * Stock movement transaction ledger.
  4. **User & Category Administration:**
     * `src/app/(admin)/users/index.tsx`: Manager & Seller master directories.
     * `src/app/(admin)/categories/index.tsx`: Add/edit customer classifications.
     * `src/app/(admin)/settings/index.tsx`: Global minimum sale price configuration.

---

### Phase 7: Performance, Usability & Network Hardening
* **Tasks:**
  1. Debounced search on all list endpoints (300ms).
  2. Pull-to-refresh on all primary dashboard and list screens.
  3. KeyboardAvoidingView on all multi-field forms.
  4. Android hardware back-button handling.
  5. In-app notification center in `(shared)/notifications.tsx` with unread badge counter.

---

### Phase 8: Testing, Verification & Safety Audit
* **Tasks:**
  1. Unit tests:
     * Authentication role matcher.
     * POS minimum price validator.
     * Payment mode validator.
     * Incentive calculations.
  2. Integration tests:
     * Full login and role dispatch flow.
     * Pending sale creation and approval lifecycle.
     * In-memory form persistence during network dropout.
  3. Verification against live API: Verify real data responses on `https://femmeflo-inventory.onrender.com/api/v1`.
  4. Verify website integrity: Ensure `femmeflo-website` remains unaffected.

---

### Phase 9: Build Preparation & Android Configuration
* **Tasks:**
  1. Configure `app.json`: Android package identifier `com.femmeflo.app`, orientation, permissions (Location foreground, Camera, Storage).
  2. Create `.env.example` with non-secret API URL placeholders.
  3. Document internal APK build process via EAS CLI (`eas build -p android --profile preview`).
