# User Journey Mapping & Critical Workflow Analysis

## 1. Overview of Key User Journeys

This document maps the primary end-to-end user journeys in FemmeFlo across field sales operations, territory management, and executive headquarters. Each journey is analyzed to ensure usability, accessibility, and strict preservation of business invariants (Scenarios 1–15).

---

## 2. Detailed User Journey Maps

### Journey 1: App Launch, Session Verification & Role Authentication
* **Entry Point:** App Icon tap / Cold launch (`src/app/index.tsx`)
* **User Intent:** Launch the application and securely enter the designated operational workspace.
* **Sequence of Screens:**
  1. `StartupScreen` (`/`) -> Verifies stored JWT token.
  2. If unauthenticated -> `LoginScreen` (`/(auth)/login`).
  3. Role Selection -> User selects Seller, Manager, or Admin tab (pre-populating demo credentials in offline mode).
  4. Credential Submission -> Authenticates with server/mockService.
  5. Authoritative Redirect -> Routes to `/ (seller)`, `/ (manager)`, or `/ (admin)`.
* **Important Decisions:**
  - Whether to continue an existing valid session or prompt for login.
  - Server-authoritative role check (Scenario 7 & 8: a seller cannot access Super Admin views; a manager cannot exceed territory boundaries).
* **Required Inputs:** Email / Phone identifier, Password.
* **Loading States:** Startup spinner with "Verifying secure session..."; Button busy spinner during sign-in.
* **Error Conditions:** Invalid credentials, empty fields, expired token (Scenario 9: triggers automatic signout redirect).
* **Success Conditions:** Authoritative JWT stored in `expo-secure-store`, cached user profile written, navigation to role dashboard.
* **Navigation Behavior:** Replaces startup route (`router.replace`) to prevent back-navigation into startup.
* **Accessibility Concerns:** Role tabs announce selected status; error banner announces message via `accessibilityRole="alert"`.

---

### Journey 2: Seller Daily Shift Start & Field Operations Check-in
* **Entry Point:** Seller Dashboard (`/(seller)`)
* **User Intent:** Begin the field sales shift by recording initial odometer reading and capturing verified GPS starting coordinates.
* **Sequence of Screens:**
  1. `SellerDashboardScreen` (`/(seller)`).
  2. Active Shift Card -> Displays "No active duty shift".
  3. Tap "Start Daily Shift" -> Opens Start Shift Modal.
  4. Odometer Input & GPS check -> Seller enters odometer reading (km).
  5. Submit -> Calls `sellerApi.startShift()`.
  6. Dashboard Update -> Shift card transitions to active duty state showing start time, start km, and GPS status.
* **Important Decisions:**
  - Whether location permissions are granted; if denied, seller can proceed with manual odometer entry without app crash (Scenario 14).
* **Required Inputs:** Starting odometer reading (number, km), optional remarks.
* **Loading States:** Button loading spinner while requesting GPS coordinates.
* **Error Conditions:** Negative or invalid odometer input, network interruption.
* **Success Conditions:** Shift record persisted, shift ID stored, dashboard displays active duty banner.
* **Accessibility Concerns:** Modal dialog traps focus; dismiss button has clear hitSlop.

---

### Journey 3: Retail Customer Onboarding
* **Entry Point:** Seller Customer List (`/(seller)/customers`) or Dashboard Quick Action
* **User Intent:** Register a new retail shop, medical pharmacy, or FMCG outlet with location coordinates, postal code auto-lookup, and storefront photo.
* **Sequence of Screens:**
  1. `CustomerListScreen` -> Tap floating "+" or "Add Customer" button.
  2. `AddCustomerScreen` (`/(seller)/customers/new`).
  3. Foreground GPS -> App automatically acquires latitude/longitude.
  4. Enter Shop & Owner Details -> Shop Name, Owner Name, Email (Scenario 13: customer email strictly required), Phone.
  5. Select Retail Category -> General Store, Medical Store, Beauty & Hygiene, Clinic.
  6. Postal Code Lookup -> Typing 6 digits immediately resolves State, District, and Village.
  7. Storefront Photo -> Captures photo with camera or photo library.
  8. Submit Onboarding -> Calls `sellerApi.createCustomer()`.
  9. Redirect -> Returns to Customer List with new customer instantly available.
* **Important Decisions:**
  - Handling denied GPS permission: falls back gracefully to manual address entry (Scenario 14).
  - Network disconnection: entered form state is preserved so seller does not lose input (Scenario 15).
* **Required Inputs:** Shop Name, Owner Name, Email (required), Phone, Category ID, Address, 6-digit Pincode, State, District.
* **Loading States:** Pincode lookup spinner; form submission loader.
* **Error Conditions:** Missing required fields, invalid 6-digit pincode, duplicate email.
* **Success Conditions:** Customer created with unique ID; customer cache updated.
* **Accessibility Concerns:** GPS status widget provides clear text states (`Acquiring`, `GPS Locked`, `Manual Fallback`).

---

### Journey 4: Sales Order Entry & Price Boundary Validation
* **Entry Point:** Seller Sales List (`/(seller)/sales`) or Customer Detail ("New Sale")
* **User Intent:** Sell sanitary hygiene packets to a retail customer, negotiate unit price, and record the sale.
* **Sequence of Screens:**
  1. `NewSaleScreen` (`/(seller)/sales/new`).
  2. Customer Selection -> Pre-selected or chosen from territory directory.
  3. SKU Selection -> Pack of 10 Regular, Pack of 10 XL, Maternity Pads.
  4. Stock Validation -> Displays available van stock balance.
  5. Quantity & Unit Price -> Enters packets to sell and negotiated price per packet.
  6. Price Threshold Evaluation:
     - If `unitPricePaise >= minimumPricePaise`: Confirmed sale! Local stock deducted immediately upon server confirmation (Scenario 3).
     - If `unitPricePaise < minimumPricePaise`: Special Price Request! Order becomes `PENDING`. No local stock or incentive credited until approved (Scenario 1 & 2).
  7. Payment Mode Selection -> `CASH`, `BANK`, or `PENDING` (Scenario 12: exactly these 3 options; partial payments excluded).
  8. Submit Order -> Calls `sellerApi.createSale()`.
  9. Result Dialog -> Shows confirmation message or "Submitted for Super Admin Approval" alert.
  10. Navigation -> Navigates to Sale Details (`/(seller)/sales/[id]`).
* **Important Decisions:**
  - Real-time warning banner when price is below minimum threshold.
  - Idempotency key generation: retrying an uncertain timeout does not create duplicate orders (Scenario 6).
* **Required Inputs:** Customer ID, Product ID, Quantity (>= 1), Unit Price (> 0), Payment Mode.
* **Loading States:** Button loading state; disables duplicate submissions.
* **Error Conditions:** Quantity exceeds van stock; invalid price format.
* **Success Conditions:** Order created with unique `saleNumber`; status set to `CONFIRMED` or `PENDING`.
* **Accessibility Concerns:** Warning banner has `accessibilityRole="alert"`.

---

### Journey 5: Payment Collection & Tax Invoice Generation
* **Entry Point:** Sale Detail Screen (`/(seller)/sales/[id]`)
* **User Intent:** Collect outstanding payment for an order and download/share the formal FMCG Tax Invoice.
* **Sequence of Screens:**
  1. `SaleDetailScreen` -> Reviews line items, unit price, and payment status.
  2. If payment is `PENDING` -> Tap "Collect Payment".
  3. Payment Collection Modal -> Select `CASH` or `BANK`, enter reference, and confirm.
  4. Tax Invoice Action -> Tap "Download Tax Invoice".
  5. Invoice Verification:
     - If `CONFIRMED`: Generates formal tax invoice document and triggers native sharing (`expo-sharing`) (Scenario 11).
     - If `PENDING` or `REJECTED`: Action is blocked with explanatory alert stating tax invoices are only issued for confirmed sales.
* **Important Decisions:**
  - Strict preservation of Scenario 11 (invoices issued exclusively for confirmed sales).
* **Required Inputs:** Payment mode (`CASH` or `BANK`), optional bank transaction reference.
* **Loading States:** Downloading spinner on invoice button.
* **Error Conditions:** Attempting to download invoice on unapproved order.
* **Success Conditions:** File written to cache and native share dialog opened.
* **Accessibility Concerns:** Line item breakdown rendered in accessible table cards.

---

### Journey 6: Manager Territory & Field Team Supervision
* **Entry Point:** Manager Dashboard (`/(manager)`)
* **User Intent:** Monitor territory performance, inspect team member activity, and onboard new field officers.
* **Sequence of Screens:**
  1. `ManagerDashboardScreen` -> Inspects monthly revenue, packets sold, active sellers, and retail customer reach.
  2. Team Directory (`/(manager)/sellers`) -> Browses assigned field sales officers and duty statuses.
  3. Onboard Seller (`/(manager)/sellers/new`) -> Enters seller name, contact info, and temporary credentials.
  4. Submit -> Seller is assigned to manager's authorized territory district.
* **Important Decisions:**
  - Manager cannot access super admin approvals or reassign global settings (Scenario 8).
* **Required Inputs:** Seller Name, Email, Phone, District, State.
* **Loading States:** Roster skeletons; form submit loader.
* **Success Conditions:** New seller appears in team roster and can log in immediately.
* **Accessibility Concerns:** Search bar with accessible label and debounce.

---

### Journey 7: Super Admin Below-Minimum Price Approval Queue
* **Entry Point:** Admin Executive Dashboard (`/(admin)`)
* **User Intent:** Review all below-minimum price orders submitted by field sellers and execute binding approval or rejection decisions.
* **Sequence of Screens:**
  1. `AdminDashboardScreen` -> Alert banner displays "X orders awaiting special price approval". Tap banner.
  2. `AdminApprovalsScreen` (`/(admin)/approvals`) -> Shows list of pending orders with requested price vs minimum price threshold.
  3. Action Decision:
     - **Approve:** Tap "Confirm Approval" -> Prompts confirmation dialog -> Calls `adminApi.approveSale()` -> Order status transitions to `CONFIRMED`; stock deducted from seller van and seller incentive credited (Scenario 3).
     - **Reject:** Tap "Reject Order" -> Prompts confirmation dialog -> Calls `adminApi.rejectSale()` -> Order status transitions to `REJECTED`; remains visible in history with zero stock deduction and zero incentive credit (Scenario 4 & 5).
* **Important Decisions:**
  - Irreversible decision execution with native confirmation dialog.
* **Loading States:** Button busy spinner on specific action card.
* **Error Conditions:** Network failure during approval execution.
* **Success Conditions:** Order status updated, queue refreshed, seller receives notification.
* **Accessibility Concerns:** Destructive reject action uses `style: 'destructive'` on iOS and prominent danger styling on Android.

