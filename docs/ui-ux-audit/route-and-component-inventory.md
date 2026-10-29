# Complete Route and Component Inventory

## 1. Application Route Inventory

Below is the exhaustive inventory of all 22 active routes within the FemmeFlo mobile application.

---

### 1.1 Startup & Authentication Flow

#### Route 1: `/`
1. **Route Path:** `/`
2. **Page Name:** Startup / Session Verification Screen
3. **Main Component:** `StartupScreen` (`src/app/index.tsx`)
4. **Layout Used:** Root Stack (`src/app/_layout.tsx`)
5. **User Role:** Public (Unauthenticated / Bootstrapping)
6. **Primary User Goal:** Validate existing authentication tokens and route the user to their designated role workspace or login screen.
7. **Major UI Components:** Centered brand badge, app title, subtitle, `ActivityIndicator`, status text.
8. **Data Dependencies:** `useAuth().restoreSession()`, `tokenStorage.getToken()`.
9. **Loading Behavior:** Displays a branded splash state with spinner while inspecting storage.
10. **Error Behavior:** Catches corrupted tokens, wipes credentials, and falls back to login.
11. **Empty-state Behavior:** N/A (transitory screen).
12. **Responsive Behavior:** Centered flex container; scales effortlessly from 375px to 1440px.
13. **Accessibility Concerns:** Logo badge used an emoji 🌸 without accessibility label.
14. **Visual Design Issues:** Hardcoded hex values for backgrounds and fonts; emoji branding lacks crisp vector rendering.
15. **Recommended Improvements:** Replace emoji with vector floral emblem (`flower` icon from Ionicons in tinted circular container); bind styles to semantic design tokens.
16. **Implementation Priority:** P1

---

#### Route 2: `/(auth)/login`
1. **Route Path:** `/(auth)/login`
2. **Page Name:** Role-Guided Authentication Screen
3. **Main Component:** `LoginScreen` (`src/app/(auth)/login.tsx`)
4. **Layout Used:** Auth Stack (`src/app/(auth)/_layout.tsx`)
5. **User Role:** Public / Unauthenticated
6. **Primary User Goal:** Sign in using email or phone number and password with role-tailored presets.
7. **Major UI Components:** Logo header, Offline UI testing banner, 3-way Role Selector tabs (`Seller`, `Manager`, `Super Admin`), email input, password input with show/hide toggle, forgot password link, sign in button, error/info alert banners.
8. **Data Dependencies:** `authApi.login()`, `useAuth().login`.
9. **Loading Behavior:** Button transitions to loading state (`isSubmitting = true`), disabling duplicate clicks.
10. **Error Behavior:** Red inline alert banner with `alert-circle` icon and specific field error messages.
11. **Empty-state Behavior:** Pre-populates demo credentials upon selecting role tabs for effortless evaluation.
12. **Responsive Behavior:** `KeyboardAvoidingView` on iOS; content centered with `MaxContentWidth: 440` on tablet/desktop.
13. **Accessibility Concerns:** Role tabs need clear `accessibilityRole="tab"` and `accessibilityState={{ selected }}`; input labels properly linked to inputs.
14. **Visual Design Issues:** Role selector tabs could have smoother active background transitions; brand pink vs green vs dark theme accents should strictly match role identity.
15. **Recommended Improvements:** Enhance role tab contrast, add subtle micro-animations on role switch, ensure all colors use `BrandColors` and `Colors.light`.
16. **Implementation Priority:** P1

---

#### Route 3: `/(auth)/forgot-password`
1. **Route Path:** `/(auth)/forgot-password`
2. **Page Name:** Forgot Password Request Screen
3. **Main Component:** `ForgotPasswordScreen` (`src/app/(auth)/forgot-password.tsx`)
4. **Layout Used:** Auth Stack (`src/app/(auth)/_layout.tsx`)
5. **User Role:** Public / Unauthenticated
6. **Primary User Goal:** Request a password reset email token.
7. **Major UI Components:** Back button, header with instructions, email `Input`, submit `Button`, success confirmation banner with shortcut to enter token.
8. **Data Dependencies:** `authApi.forgotPassword()`.
9. **Loading Behavior:** Submission button loading spinner.
10. **Error Behavior:** Banner showing validation error or server failure.
11. **Empty-state Behavior:** Clean input form ready for email entry.
12. **Responsive Behavior:** Centered container with keyboard-avoiding scroll.
13. **Accessibility Concerns:** Ensure success and error banners have `accessibilityRole="alert"`.
14. **Visual Design Issues:** Spacing around back button and card can be harmonized with `Spacing.lg`.
15. **Recommended Improvements:** Unify typography with `Typography.h1` and `Typography.body`.
16. **Implementation Priority:** P2

---

#### Route 4: `/(auth)/reset-password`
1. **Route Path:** `/(auth)/reset-password`
2. **Page Name:** Reset Password Screen
3. **Main Component:** `ResetPasswordScreen` (`src/app/(auth)/reset-password.tsx`)
4. **Layout Used:** Auth Stack (`src/app/(auth)/_layout.tsx`)
5. **User Role:** Public / Unauthenticated
6. **Primary User Goal:** Submit the received verification code along with new password.
7. **Major UI Components:** Header, reset token input, new password input, confirm password input, submit button.
8. **Data Dependencies:** `authApi.resetPassword()`.
9. **Loading Behavior:** Button busy state.
10. **Error Behavior:** Inline validation errors for password length and mismatch.
11. **Empty-state Behavior:** Default inputs.
12. **Responsive Behavior:** Centered bounded container.
13. **Accessibility Concerns:** Inputs have show/hide accessibility labels.
14. **Visual Design Issues:** Card shadow and border radius need token alignment.
15. **Recommended Improvements:** Polish feedback banners and input focus rings.
16. **Implementation Priority:** P2

---

### 1.2 Seller Flow (Field Sales Force)

#### Route 5: `/(seller)`
1. **Route Path:** `/(seller)` (Index)
2. **Page Name:** Seller Field Operations Dashboard
3. **Main Component:** `SellerDashboardScreen` (`src/app/(seller)/index.tsx`)
4. **Layout Used:** Seller Tabs (`src/app/(seller)/_layout.tsx`)
5. **User Role:** `SELLER`
6. **Primary User Goal:** View daily sales metrics, current stock balance, duty shift status (start/end shift with GPS & odometer), and access quick operational shortcuts.
7. **Major UI Components:** `Header` with notification bell, Active Shift status card, KPI metric grid (Today's Sales, Packets Sold, Van Stock, Pending Approvals), Quick Action buttons (New Sale, Add Customer, Start/End Shift), Start/End Shift modal dialogs.
8. **Data Dependencies:** `sellerApi.getDashboard()`, `sellerApi.getCurrentShift()`.
9. **Loading Behavior:** `CardSkeleton` displays during initial load; pull-to-refresh (`RefreshControl`) for on-demand updates.
10. **Error Behavior:** Graceful fallback to zeros with console warning; does not crash if network drops.
11. **Empty-state Behavior:** When no shift is active, prominent "Start Daily Shift" prompt appears.
12. **Responsive Behavior:** 2-column KPI grid on mobile; expands to 4-column layout on wider screens.
13. **Accessibility Concerns:** Modal dialogs need accessible headers and dismiss gestures.
14. **Visual Design Issues:** Metric cards have varying internal paddings; shift badge contrast needs verification.
15. **Recommended Improvements:** Introduce standardized `StatCard` component; elevate active shift status visual prominence.
16. **Implementation Priority:** P0

---

#### Route 6: `/(seller)/customers`
1. **Route Path:** `/(seller)/customers`
2. **Page Name:** Retail Customer & Store Directory
3. **Main Component:** `CustomerListScreen` (`src/app/(seller)/customers/index.tsx`)
4. **Layout Used:** Seller Tabs (`src/app/(seller)/_layout.tsx`)
5. **User Role:** `SELLER`
6. **Primary User Goal:** Search, filter by category, and browse retail stores and clinics in the seller's territory.
7. **Major UI Components:** Search input with 300ms debounce, horizontal category filter chips, customer store cards with shop name, owner name, category badge, phone and location, floating "Add Customer" button.
8. **Data Dependencies:** `sellerApi.listCustomers()`, `categoriesApi.listCategories()`.
9. **Loading Behavior:** Skeleton cards during initial fetch; `ActivityIndicator` on pagination end reach.
10. **Error Behavior:** Shows warning toast/alert and retains existing customer cache.
11. **Empty-state Behavior:** Illustrative `EmptyState` component with "Onboard First Customer" CTA.
12. **Responsive Behavior:** List items bounded to `MaxContentWidth: 800`.
13. **Accessibility Concerns:** Filter chips need `accessibilityRole="tab"` and `accessibilityState={{ selected }}`.
14. **Visual Design Issues:** Category filter bar needs enhanced horizontal scroll indicators and active chip styling.
15. **Recommended Improvements:** Refine category chip contrast, add shop avatar initials badge.
16. **Implementation Priority:** P1

---

#### Route 7: `/(seller)/customers/new`
1. **Route Path:** `/(seller)/customers/new`
2. **Page Name:** Retail Customer Onboarding Screen
3. **Main Component:** `AddCustomerScreen` (`src/app/(seller)/customers/new.tsx`)
4. **Layout Used:** Stack within `(seller)`
5. **User Role:** `SELLER`
6. **Primary User Goal:** Onboard a new retail shop or clinic with GPS coordinates, postal code auto-lookup, and optional storefront photo.
7. **Major UI Components:** Multi-field form (Shop Name, Owner Name, Email, Phone, Category picker, Address, 6-digit Pincode with auto-lookup for State/District/Village, GPS Coordinate status widget, Storefront photo capture widget, Submit button).
8. **Data Dependencies:** `categoriesApi.listCategories()`, `sellerApi.lookupPincode()`, `sellerApi.createCustomer()`, `expo-location`, `expo-image-picker`.
9. **Loading Behavior:** Pincode lookup shows inline spinner; submission shows button loader.
10. **Error Behavior:** Field-level error validation messages; handles GPS permission denial gracefully by enabling manual address entry.
11. **Empty-state Behavior:** Fresh blank form with category pre-selected.
12. **Responsive Behavior:** Stacked form inputs with keyboard-aware scrolling.
13. **Accessibility Concerns:** GPS widget states (`acquiring`, `acquired`, `denied`, `failed`) need explicit screen-reader announcements.
14. **Visual Design Issues:** Photo capture container looks plain; GPS indicator could use clearer status badges.
15. **Recommended Improvements:** Elevate photo capture preview card; provide clear visual badge for GPS lock status.
16. **Implementation Priority:** P0

---

#### Route 8: `/(seller)/customers/[id]`
1. **Route Path:** `/(seller)/customers/[id]`
2. **Page Name:** Customer Detail & Store Ledger Screen
3. **Main Component:** `CustomerDetailScreen` (`src/app/(seller)/customers/[id].tsx`)
4. **Layout Used:** Stack within `(seller)`
5. **User Role:** `SELLER`
6. **Primary User Goal:** View retail customer profile, contact information with direct phone/email/maps action buttons, and recent order history.
7. **Major UI Components:** Store profile card, Quick action bar (Call, Email, Open Google Maps, Create Sale), order history list.
8. **Data Dependencies:** `sellerApi.getCustomer(id)`, `sellerApi.listSales({ customerId })`.
9. **Loading Behavior:** Full-screen loader.
10. **Error Behavior:** Not found error screen with back navigation.
11. **Empty-state Behavior:** "No prior sales" message when customer has no order history.
12. **Responsive Behavior:** Bounded container with horizontal action row.
13. **Accessibility Concerns:** Action icons need accessible labels (`Call shop`, `Open Google Maps`).
14. **Visual Design Issues:** Action buttons row can be made more tactile and prominent.
15. **Recommended Improvements:** Add prominent "New Sale for this Store" primary action; style order summary cards.
16. **Implementation Priority:** P1

---

#### Route 9: `/(seller)/sales`
1. **Route Path:** `/(seller)/sales`
2. **Page Name:** Sales Order History Screen
3. **Main Component:** `SalesListScreen` (`src/app/(seller)/sales/index.tsx`)
4. **Layout Used:** Seller Tabs (`src/app/(seller)/_layout.tsx`)
5. **User Role:** `SELLER`
6. **Primary User Goal:** Browse historical sales, filter by status (`CONFIRMED`, `PENDING`, `APPROVED`, `REJECTED`), and review order amounts.
7. **Major UI Components:** Status filter pill tabs, order cards with date, customer name, packet count, total amount, status badge, and payment mode badge.
8. **Data Dependencies:** `sellerApi.listSales()`.
9. **Loading Behavior:** Card skeletons; infinite scroll pagination.
10. **Error Behavior:** Preserves list state and displays error notice.
11. **Empty-state Behavior:** Shows contextual empty state based on selected status filter.
12. **Responsive Behavior:** Clean card list fitting mobile and tablet widths.
13. **Accessibility Concerns:** Order card provides comprehensive `accessibilityLabel` summarizing all order attributes.
14. **Visual Design Issues:** Status filter bar needs refined active states.
15. **Recommended Improvements:** Harmonize status badge colors with `BrandColors` and `MASTER.md` tokens.
16. **Implementation Priority:** P1

---

#### Route 10: `/(seller)/sales/new`
1. **Route Path:** `/(seller)/sales/new`
2. **Page Name:** Create New Sale / Order Entry Screen
3. **Main Component:** `NewSaleScreen` (`src/app/(seller)/sales/new.tsx`)
4. **Layout Used:** Stack within `(seller)`
5. **User Role:** `SELLER`
6. **Primary User Goal:** Enter a new sale with customer selection, product SKU, packet quantity, negotiated unit price, and payment mode.
7. **Major UI Components:** Customer selector card, Product SKU cards with van stock indicators, Quantity counter/input, Unit price input, Real-time total calculation box, Below-minimum price warning banner, Payment mode selector (`CASH`, `BANK`), Submit order button.
8. **Data Dependencies:** `sellerApi.listCustomers()`, `sellerApi.listProducts()`, `sellerApi.getInventory()`, `sellerApi.createSale()`.
9. **Loading Behavior:** Initial data loading spinner.
10. **Error Behavior:** Comprehensive field validation; displays alert if insufficient stock or invalid quantity.
11. **Empty-state Behavior:** Pre-selects first available customer and product.
12. **Responsive Behavior:** Vertical form with prominent sticky bottom summary.
13. **Accessibility Concerns:** Warning banner for special price approval must have `accessibilityRole="alert"`.
14. **Visual Design Issues:** Below-minimum price banner needs clear amber warning styling (`Colors.light.warningBg`, `Colors.light.warning`).
15. **Recommended Improvements:** Make price-per-packet calculations crystal clear; elevate stock balance indicators.
16. **Implementation Priority:** P0

---

#### Route 11: `/(seller)/sales/[id]`
1. **Route Path:** `/(seller)/sales/[id]`
2. **Page Name:** Order Details & Tax Invoice Screen
3. **Main Component:** `SaleDetailScreen` (`src/app/(seller)/sales/[id].tsx`)
4. **Layout Used:** Stack within `(seller)`
5. **User Role:** `SELLER`
6. **Primary User Goal:** Review order line items, payment status, record payment collection if pending, and download/share the official Tax Invoice.
7. **Major UI Components:** Order status card, Line items breakdown table, Tax and totals calculation card, Payment status card with "Collect Payment" trigger, Collect Payment modal, "Download Tax Invoice" button.
8. **Data Dependencies:** `sellerApi.getSale(id)`, `sellerApi.collectPayment()`, `sellerApi.downloadInvoice()`.
9. **Loading Behavior:** Centered loader while fetching sale details.
10. **Error Behavior:** Alerts if invoice cannot be downloaded (e.g. for pending/unapproved sales).
11. **Empty-state Behavior:** N/A.
12. **Responsive Behavior:** Clean invoice layout that prints or exports crisply.
13. **Accessibility Concerns:** Invoice table rows must be accessible to screen readers.
14. **Visual Design Issues:** Invoice card should look like an authentic professional FMCG tax invoice.
15. **Recommended Improvements:** Enhance invoice styling with crisp borders, clear tax breakdown, and prominent download button.
16. **Implementation Priority:** P0

---

#### Route 12: `/(seller)/inventory`
1. **Route Path:** `/(seller)/inventory`
2. **Page Name:** Van Stock & Stock Movement Ledger Screen
3. **Main Component:** `SellerInventoryScreen` (`src/app/(seller)/inventory/index.tsx`)
4. **Layout Used:** Seller Tabs (`src/app/(seller)/_layout.tsx`)
5. **User Role:** `SELLER`
6. **Primary User Goal:** Check personal van stock balance, assigned packets, sold packets, and review chronological stock inward/outward transactions.
7. **Major UI Components:** Van stock summary card, Product-wise breakdown, Stock movement transaction list with `+` / `-` packet indicators.
8. **Data Dependencies:** `sellerApi.getInventory()`, `sellerApi.listTransactions()`.
9. **Loading Behavior:** Card skeletons during fetch; pull-to-refresh.
10. **Error Behavior:** Retains cached stock numbers on connection failure.
11. **Empty-state Behavior:** Empty state if no transactions recorded yet.
12. **Responsive Behavior:** Bounded container; clear vertical timeline.
13. **Accessibility Concerns:** Transaction badges pair color with `+`/`-` text signs.
14. **Visual Design Issues:** Stock card numbers could have higher visual prominence.
15. **Recommended Improvements:** Add prominent visual stock health meters (Low stock vs Healthy stock).
16. **Implementation Priority:** P1

---

#### Route 13: `/(seller)/incentives`
1. **Route Path:** `/(seller)/incentives`
2. **Page Name:** Seller Earnings & Commission Ledger Screen
3. **Main Component:** `SellerIncentivesScreen` (`src/app/(seller)/incentives/index.tsx`)
4. **Layout Used:** Seller navigation (accessed from Profile/Dashboard)
5. **User Role:** `SELLER`
6. **Primary User Goal:** Monitor current month commission earnings, packet sales volume, commission rate per packet, and pending payouts.
7. **Major UI Components:** Commission hero card, KPI triple card (Packets sold, Current rate, Pending payout), Historical sales commission ledger with order numbers and earned amounts.
8. **Data Dependencies:** `sellerApi.getIncentives()`.
9. **Loading Behavior:** Spinner during calculation.
10. **Error Behavior:** Fallback to ₹0 with retry prompt.
11. **Empty-state Behavior:** Encouraging empty state when sales have not yet begun.
12. **Responsive Behavior:** 3-column stats card that wraps gracefully.
13. **Accessibility Concerns:** Currency numbers formatted with full accessible labels.
14. **Visual Design Issues:** Earnings hero card needs rich brand pink gradient or subtle surface styling.
15. **Recommended Improvements:** Elevate the financial metric presentation with crisp typography and subtle background warmth.
16. **Implementation Priority:** P1

---

#### Route 14: `/(seller)/profile`
1. **Route Path:** `/(seller)/profile`
2. **Page Name:** Seller Profile & Shift History Screen
3. **Main Component:** `SellerProfileScreen` (`src/app/(seller)/profile/index.tsx`)
4. **Layout Used:** Seller Tabs (`src/app/(seller)/_layout.tsx`)
5. **User Role:** `SELLER`
6. **Primary User Goal:** Manage account details, review shift history (odometer & GPS logs), access incentives, notifications, security settings, and sign out.
7. **Major UI Components:** User profile card with initials avatar, Territory badge, Account menu items (Incentives, Notifications, Change Password), Shift history list, Sign Out button.
8. **Data Dependencies:** `useAuth().user`, `sellerApi.getShiftHistory()`.
9. **Loading Behavior:** Shift history loads asynchronously.
10. **Error Behavior:** Handles logout error gracefully.
11. **Empty-state Behavior:** Displays "No recent shifts" if newly registered.
12. **Responsive Behavior:** Standard settings list format.
13. **Accessibility Concerns:** Destructive signout button requires confirmation dialog.
14. **Visual Design Issues:** Menu items can be polished with consistent chevron and icon colors.
15. **Recommended Improvements:** Add quick summary of current shift status directly in profile.
16. **Implementation Priority:** P2

---

### 1.3 Manager Flow (Territory Operations)

#### Route 15: `/(manager)`
1. **Route Path:** `/(manager)` (Index)
2. **Page Name:** Territory Operations Dashboard
3. **Main Component:** `ManagerDashboardScreen` (`src/app/(manager)/index.tsx`)
4. **Layout Used:** Manager Tabs (`src/app/(manager)/_layout.tsx`)
5. **User Role:** `MANAGER`
6. **Primary User Goal:** Monitor territory performance, monthly revenue, packets sold, active seller headcount, and retail customer reach.
7. **Major UI Components:** Header with territory badge, Territory info card, 4-metric KPI grid (Monthly Revenue, Packets Sold, Active Sellers, Total Stores), Quick shortcuts (Manage Sellers, Territory Sales).
8. **Data Dependencies:** `managerApi.getDashboard()`.
9. **Loading Behavior:** Skeletons and pull-to-refresh.
10. **Error Behavior:** Displays cached metrics.
11. **Empty-state Behavior:** Zero-state placeholder cards.
12. **Responsive Behavior:** 2-column mobile to 4-column desktop layout.
13. **Accessibility Concerns:** All metric cards have accessible labels.
14. **Visual Design Issues:** Brand forest green accents should be applied consistently to reflect manager tier.
15. **Recommended Improvements:** Use `StatCard` with forest green theme accents.
16. **Implementation Priority:** P1

---

#### Route 16: `/(manager)/sellers`
1. **Route Path:** `/(manager)/sellers`
2. **Page Name:** Field Force Team Directory Screen
3. **Main Component:** `ManagerSellersScreen` (`src/app/(manager)/sellers/index.tsx`)
4. **Layout Used:** Manager Tabs (`src/app/(manager)/_layout.tsx`)
5. **User Role:** `MANAGER`
6. **Primary User Goal:** Review assigned field sales officers, active duty status, contact info, and onboard new sellers.
7. **Major UI Components:** Search input, Seller cards with name, email, phone, territory, active status badge, "Onboard Seller" button.
8. **Data Dependencies:** `managerApi.listSellers()`.
9. **Loading Behavior:** Skeleton cards.
10. **Error Behavior:** Retains seller roster.
11. **Empty-state Behavior:** Empty state with "Add First Seller" action.
12. **Responsive Behavior:** Clean card list.
13. **Accessibility Concerns:** Status badge paired with accessible label.
14. **Visual Design Issues:** Add button in header needs clear contrast.
15. **Recommended Improvements:** Add avatar initials badge for each seller.
16. **Implementation Priority:** P1

---

#### Route 17: `/(manager)/sellers/new`
1. **Route Path:** `/(manager)/sellers/new`
2. **Page Name:** Onboard Field Officer Screen
3. **Main Component:** `CreateSellerScreen` (`src/app/(manager)/sellers/new.tsx`)
4. **Layout Used:** Stack within `(manager)`
5. **User Role:** `MANAGER`
6. **Primary User Goal:** Create a new seller account within the manager's authorized territory.
7. **Major UI Components:** Form fields (Full Name, Email, Phone, Temporary Password, State, District), Submit button.
8. **Data Dependencies:** `managerApi.createSeller()`.
9. **Loading Behavior:** Submission button loader.
10. **Error Behavior:** Form field validation errors.
11. **Empty-state Behavior:** Fresh form.
12. **Responsive Behavior:** Bounded form container.
13. **Accessibility Concerns:** Standard input accessibility.
14. **Visual Design Issues:** Spacing between input groups.
15. **Recommended Improvements:** Harmonize styling with customer onboarding form.
16. **Implementation Priority:** P1

---

### 1.4 Admin Flow (Super Admin / Executive HQ)

#### Route 18: `/(admin)`
1. **Route Path:** `/(admin)` (Index)
2. **Page Name:** Executive Overview & National Operations Screen
3. **Main Component:** `AdminDashboardScreen` (`src/app/(admin)/index.tsx`)
4. **Layout Used:** Admin Tabs (`src/app/(admin)/_layout.tsx`)
5. **User Role:** `SUPER_ADMIN`
6. **Primary User Goal:** Review national distribution health, gross revenue, warehouse stock balances, and pending price approval alerts.
7. **Major UI Components:** National banner, Pending Price Approvals Alert banner (with direct CTA to review), National KPI grid (Revenue, Packets, Warehouses, Active Sellers), Quick action shortcuts.
8. **Data Dependencies:** `adminApi.getDashboard()`.
9. **Loading Behavior:** Skeletons and pull-to-refresh.
10. **Error Behavior:** Retains data.
11. **Empty-state Behavior:** Default cards.
12. **Responsive Behavior:** Responsive grid.
13. **Accessibility Concerns:** Alert banner must announce pending count.
14. **Visual Design Issues:** Pending approval alert needs high-contrast amber styling.
15. **Recommended Improvements:** Ensure alert banner immediately draws executive attention.
16. **Implementation Priority:** P0

---

#### Route 19: `/(admin)/approvals`
1. **Route Path:** `/(admin)/approvals`
2. **Page Name:** Below-Minimum Price Approval Queue Screen
3. **Main Component:** `AdminApprovalsScreen` (`src/app/(admin)/approvals/index.tsx`)
4. **Layout Used:** Admin Tabs (`src/app/(admin)/_layout.tsx`)
5. **User Role:** `SUPER_ADMIN`
6. **Primary User Goal:** Inspect special price orders requested by sellers and execute binding Approve or Reject decisions.
7. **Major UI Components:** Approval order cards with customer name, seller name, requested unit price, minimum price threshold, total value, and dual action buttons: "Confirm Approval" (green) and "Reject Order" (destructive).
8. **Data Dependencies:** `adminApi.listApprovals()`, `adminApi.approveSale()`, `adminApi.rejectSale()`.
9. **Loading Behavior:** Skeletons and button spinners during decision execution.
10. **Error Behavior:** Error alert dialog with clear failure reason.
11. **Empty-state Behavior:** Empty state: "All price requests reviewed. No pending approvals."
12. **Responsive Behavior:** Card list.
13. **Accessibility Concerns:** Confirmation dialogs before destructive rejection.
14. **Visual Design Issues:** Comparison between requested price and minimum price needs crisp visual contrast.
15. **Recommended Improvements:** Highlight the price variance (e.g. "₹22.00 vs ₹25.00 min threshold").
16. **Implementation Priority:** P0

---

#### Route 20: `/(admin)/inventory` & `transfer`
1. **Route Path:** `/(admin)/inventory` & `/(admin)/inventory/transfer`
2. **Page Name:** National Warehouses & Stock Transfer Screen
3. **Main Component:** `AdminInventoryScreen` & `StockTransferScreen`
4. **Layout Used:** Admin Tabs & Stack
5. **User Role:** `SUPER_ADMIN`
6. **Primary User Goal:** View national warehouse capacities and execute stock inward receipts or transfers from HQ to seller vans.
7. **Major UI Components:** Warehouse list, Stock Inward / Transfer mode toggle, Source warehouse picker, Destination picker, SKU selector, Quantity, Batch number.
8. **Data Dependencies:** `adminApi.getWarehouses()`, `adminApi.recordStockReceipt()`, `adminApi.transferStock()`.
9. **Loading Behavior:** Skeletons and submit loaders.
10. **Error Behavior:** Validation alerts for missing selections.
11. **Empty-state Behavior:** Default facility list.
12. **Responsive Behavior:** Form container.
13. **Accessibility Concerns:** Mode toggle accessibility roles.
14. **Visual Design Issues:** Mode selector pill bar needs polish.
15. **Recommended Improvements:** Clean segmented control for Receipt vs Transfer.
16. **Implementation Priority:** P1

---

#### Route 21: `/(admin)/settings`
1. **Route Path:** `/(admin)/settings`
2. **Page Name:** Global Business Configuration & Governance Screen
3. **Main Component:** `AdminSettingsScreen` (`src/app/(admin)/settings/index.tsx`)
4. **Layout Used:** Admin Tabs (`src/app/(admin)/_layout.tsx`)
5. **User Role:** `SUPER_ADMIN`
6. **Primary User Goal:** Configure enterprise price floor invariants (`minimumSalePricePaise`) and warehouse low stock alert thresholds.
7. **Major UI Components:** Price invariant card, Low stock threshold card, Executive sign out button.
8. **Data Dependencies:** `adminApi.getBusinessSettings()`, `adminApi.updateBusinessSettings()`.
9. **Loading Behavior:** Initial load spinner.
10. **Error Behavior:** Validation checks preventing negative prices.
11. **Empty-state Behavior:** Defaults populated.
12. **Responsive Behavior:** Centered form card.
13. **Accessibility Concerns:** Standard input labels.
14. **Visual Design Issues:** Form button styling.
15. **Recommended Improvements:** Provide explanatory callout on how price thresholds affect seller approval triggers.
16. **Implementation Priority:** P1

---

### 1.5 Shared Flow

#### Route 22: `/(shared)/notifications`
1. **Route Path:** `/(shared)/notifications`
2. **Page Name:** Activity & Alert Notifications Center
3. **Main Component:** `NotificationsScreen` (`src/app/(shared)/notifications.tsx`)
4. **Layout Used:** Shared Modal Stack (`src/app/(shared)/_layout.tsx`)
5. **User Role:** Authenticated (`SELLER`, `MANAGER`, `SUPER_ADMIN`)
6. **Primary User Goal:** Review unread system alerts, shift events, and approval notifications; mark alerts as read.
7. **Major UI Components:** Header with unread count and "Mark all read" button, Notification cards with unread dot indicator, title, timestamp, and message body.
8. **Data Dependencies:** `notificationsApi.listNotifications()`, `notificationsApi.markAsRead()`, `notificationsApi.markAllAsRead()`.
9. **Loading Behavior:** Skeleton list.
10. **Error Behavior:** Preserves notifications.
11. **Empty-state Behavior:** "No notifications" placeholder.
12. **Responsive Behavior:** Clean modal presentation.
13. **Accessibility Concerns:** Unread state explicitly indicated via `accessibilityLabel`.
14. **Visual Design Issues:** Unread card accent border can be enhanced with `BrandColors.pink.tint`.
15. **Recommended Improvements:** Elevate unread indicator styling.
16. **Implementation Priority:** P1

---

## 2. Shared Component Inventory & Redesign Opportunities

| Component | Current File | Current Usage | Redesign Plan & Target Enhancements |
|-----------|--------------|---------------|-------------------------------------|
| `Button` | `src/components/ui/Button.tsx` | All forms, dialogs, headers, and action bars. | Retain API. Enhance pressed tactile state (`opacity: 0.92`, `transform: [{ scale: 0.99 }]`), ensure WCAG AA contrast on all 5 variants (`primary`, `secondary`, `outline`, `danger`, `ghost`). |
| `Input` | `src/components/ui/Input.tsx` | All forms across Auth, Customer onboarding, Sales, Transfers. | Add support for `clearButtonMode`, enhance focus border transition with `BrandColors.pink.primary`, ensure error feedback includes vector icon + label. |
| `Card` | `src/components/ui/Card.tsx` | Container for list items, dashboard widgets, forms. | Add subtle depth with `Shadows.sm`, ensure border uses semantic token `Colors.light.borderSubtle`, provide smooth pressed state when `onPress` is passed. |
| `Badge` | `src/components/ui/Badge.tsx` | Status indicators across all screens (`APPROVED`, `PENDING`, `REJECTED`, etc.). | Ensure background and text colors exceed 4.5:1 contrast ratio; standardize dot indicator. |
| `Header` | `src/components/ui/Header.tsx` | Top navigation bar for all screens. | Add safe-area insets calculation, handle long title truncation gracefully, style unread counter badge. |
| `EmptyState` | `src/components/ui/EmptyState.tsx` | Displayed when lists are empty. | Provide centered icon circle with `BrandColors.pink.subtle`, clear title, subtitle, and primary action button. |
| `LoadingSkeleton` | `src/components/ui/LoadingSkeleton.tsx` | Used across lists and dashboards. | Standardize shimmer block dimensions for list rows and card previews. |
| `StatCard` *(New)* | `src/components/ui/StatCard.tsx` | To be used across Seller, Manager, and Admin dashboards. | Dedicated component displaying metric value, title, icon badge, trend indicator, and optional comparison label. |
| `SegmentedTabs` *(New)* | `src/components/ui/SegmentedTabs.tsx` | For status filtering in sales, user role switching, and stock transfer mode. | High-accessibility tab container with smooth pill indicator and keyboard/touch navigation. |

