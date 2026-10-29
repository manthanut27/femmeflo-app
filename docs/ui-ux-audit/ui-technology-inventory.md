# UI/UX Technology & Architecture Inventory

## 1. Overview of Technologies

This inventory documents all interface technologies, styling engines, component patterns, and supporting infrastructure used across FemmeFlo Mobile.

---

## 2. Technology Inventory Breakdown

### 2.1 Frontend Framework and Rendering
* **Framework:** React 19.3.0, React Native 0.88.0, Expo SDK 58 (~58.0.19)
* **Routing System:** Expo Router (~58.0.26) with file-system route hierarchy (`src/app/`)
* **Rendering Strategy:** Native client-side rendering with Hermes JS engine; React Native Web (~0.21.4) support for desktop browser testing.
* **Layout Architecture:**
  * Root `Stack` navigator in `src/app/_layout.tsx`.
  * Role-segmented bottom tab navigators (`Tabs`) for Seller, Manager, and Admin workspaces.
  * Shared modal presentation stack (`presentation: 'modal'`) for system-wide dialogs (Notifications, Password Change).
* **Evaluation:** Retain and optimize. The routing architecture is clean, idiomatic, and conforms strictly to Expo Router conventions.

### 2.2 Styling and Design Tokens
* **Methodology:** React Native `StyleSheet.create` with central token consumption from `src/constants/theme.ts`.
* **Design Token Architecture:**
  * `BrandColors`: Pink (`#E61C5D`, `#C91550`, `#FFF5F7`), Green (`#156035`, `#ECFDF5`), Amber (`#D97706`, `#FFFBEB`).
  * `Colors`: Semantic light & dark themes (`Colors.light`, `Colors.dark`).
  * `Typography`: Strict 10-level scale (`display`, `h1`, `h2`, `h3`, `bodyLarge`, `body`, `bodyMedium`, `bodySmall`, `caption`, `overline`).
  * `Spacing`: 4dp / 8dp rhythm (`none`, `xxs`: 2, `xs`: 4, `sm`: 8, `md`: 12, `lg`: 16, `xl`: 20, `xxl`: 24, `xxxl`: 32, `huge`: 48).
  * `Radius`: Geometric rounding tokens (`xs`: 4, `sm`: 8, `md`: 12, `lg`: 16, `xl`: 24, `full`: 9999).
  * `Shadows`: Multi-level elevation (`none`, `sm`, `md`, `lg`) combining iOS shadow properties with Android `elevation`.
  * `HitSlop`: Generous hit targets (`sm`: 8, `md`: 12, `lg`: 16) for touch accessibility.
  * `MaxContentWidth`: 800dp container ceiling to prevent uncontrolled horizontal stretching on web and tablets.
* **Observed Styling Deficiencies:**
  * Multiple screens still contain hard-coded hex colors (e.g. `#FAF8F5`, `#09090B`, `#64748B`, `#E2E8F0`, `#FFFFFF`, `#B4234D`) rather than consuming semantic tokens from `Colors.light` or `useTheme()`.
  * Dark theme tokens exist in `src/constants/theme.ts`, but dynamic dark mode adaptation is inconsistent across sub-screens.
  * Need systematic normalization to enforce token usage throughout all components.

### 2.3 Component Libraries and Reusable UI
The application uses custom lightweight primitives located in `src/components/ui/`:

| Component | File Location | Purpose & Features | Assessment & Redesign Opportunities |
|-----------|---------------|-------------------|--------------------------------------|
| `Button` | `src/components/ui/Button.tsx` | Variants: `primary`, `secondary`, `outline`, `danger`, `ghost`. Sizes: `sm`, `md`, `lg`. Supports loading indicators, icons, tactile feedback, and `HitSlop`. | Excellent accessibility foundation. Can be enhanced with subtle haptic response and refined pressed opacity. |
| `Input` | `src/components/ui/Input.tsx` | Floating/labeled text inputs with left/right icons, password toggle, error messaging, and focused border states. | Needs enhanced keyboard type customization and clear-field button affordance. |
| `Card` | `src/components/ui/Card.tsx` | Card surface container with variants: `elevated`, `outlined`, `flat`. Handles optional `onPress` with tactile scale feedback. | Solid container. Needs consistent semantic background token binding. |
| `Badge` | `src/components/ui/Badge.tsx` | Status pill with dot indicator supporting domain statuses (`CONFIRMED`, `APPROVED`, `PENDING`, `REJECTED`, `ACTIVE`, `INACTIVE`, `CASH`, `BANK`). | High readability. Ensure contrast exceeds 4.5:1 on all variants. |
| `Header` | `src/components/ui/Header.tsx` | Safe-area aware top navigation bar with back button, unread notification counter badge, and right action slot. | Clean implementation. Needs consistent title-truncation handling on small 375px screens. |
| `EmptyState` | `src/components/ui/EmptyState.tsx` | Empty container placeholder with vector icon, headline, subtitle, and primary action button. | High visual quality. Ensure icon color uses theme token. |
| `LoadingSkeleton` | `src/components/ui/LoadingSkeleton.tsx` | Placeholder shimmer skeleton shapes and pre-built `CardSkeleton`. | Effective for layout stability. Add pulse animation where performance permits. |

* **Missing Reusable Primitives to Add:**
  * `StatCard` / `MetricTile`: Standardized KPI card for dashboards (revenue, packets, stock, team metrics).
  * `SegmentedTabs` / `FilterPillBar`: Accessible tabbed filtering component for status and role switching.
  * `NoticeBanner`: Reusable dismissible or persistent inline callout (info, warning, error, success).

### 2.4 Typography and Icons
* **Typography:** System fonts (Roboto on Android, San Francisco on iOS, system sans-serif on Web). Hierarchy defined in `Typography` constant.
* **Icon Library:** `@expo/vector-icons` (`Ionicons`).
* **Icon Audit Finding:**
  * The startup screen (`src/app/index.tsx`) previously used a structural emoji `🌸` instead of a crisp vector icon.
  * Vector icons (`Ionicons`) provide superior scalability, color tinting, and accessibility compatibility. All structural emojis must be replaced with vector iconography.

### 2.5 Images, Illustrations, and Media
* **Engines:** `expo-image` (~58.0.17) for high-performance cached image rendering, `expo-image-picker` (~58.0.10) for storefront photo capture.
* **Assets:** App icons, adaptive icons, and splash icon stored in `assets/images/`.
* **Media Handling:** Customer onboarding supports capturing storefront photos with camera/gallery permissions and base64 preview caching.

### 2.6 Animation and Interaction
* **Libraries:** `react-native-reanimated` (4.7.1), `react-native-gesture-handler` (~3.3.0), `react-native-worklets` (0.13.0).
* **Feedback States:** Tactile micro-interactions on `Pressable` (`opacity: 0.92`, `scale: 0.995`) providing immediate physical touch feedback without introducing jarring layout shifts.
* **Animation Philosophy:** Strictly functional, purposeful animations (fade transitions, smooth pull-to-refresh, skeleton placeholders) adhering to reduced-motion guidelines.

### 2.7 Forms and User Input
* **Form Architectures:**
  * Controlled React state with explicit field validation maps (`errors: Record<string, string>`).
  * Inline validation with error icon (`alert-circle`) and assistive error text.
  * Pincode auto-lookup: typing 6 digits immediately triggers async postal directory lookup to populate State, District, and Village.
  * GPS Location capture: automatic foreground coordinate acquisition with graceful fallback to manual entry if permissions are denied.
  * Sales creation: real-time computation of packets * unit price, immediate threshold comparison against `minimumPricePaise`, and contextual warning banner when an order requires manager/admin approval.

### 2.8 State, Data, and Backend Integration
* **Session State:** `AuthContext.tsx` providing reactive `user`, `role`, `token`, `login()`, `logout()`, `refreshUser()`.
* **API Architecture (`src/api/client.ts`):**
  * Configurable base URL with JWT authorization headers.
  * 401 Unauthorized interceptor invoking `setSessionExpiredHandler` to clear local state.
  * Dual-mode architecture: attempts remote API communication; seamlessly engages local `mockService` if offline or unconfigured.
  * In-memory mock service maintains complete reactive relational integrity (customers, products, sales, stock transactions, shifts, notifications).

### 2.9 Accessibility and Responsive Design
* **Touch Targets:** Buttons and interactive cards satisfy the 48x48dp Android / 44x44pt iOS minimums; `hitSlop` is applied to all compact icon buttons.
* **Semantics:** Explicit `accessibilityRole="button" | "tab" | "summary" | "alert" | "text"`, `accessibilityState={{ disabled, busy, selected }}`, and `aria-invalid` on text inputs.
* **Responsive Layout:**
  * Uses `SafeAreaProvider` and `useSafeAreaInsets` on all scroll views and headers.
  * Outer containers wrapped with `MaxContentWidth: 800` and `alignSelf: 'center'` ensuring flawless presentation on tablets and desktop browsers without ultra-wide distortion.

### 2.10 Testing and Verification Quality Tools
* **Unit & Integration Tests:** `npm test` runs 15 scenarios verifying Master Prompt Section 12 business invariants.
* **Type Safety:** `npm run typecheck` (`tsc --noEmit`) passes with 0 errors.
* **Code Linting:** `expo lint` (`eslint .`) configured with `eslint-config-expo`.

---

## 3. MCP Tools Status & Operational Strategy

### 3.1 21st.dev and Google Stitch MCP Server Status
* **Inspection Result:** Neither `21st.dev` nor `Google Stitch` MCP servers are exposed as active tool declarations in the current agent environment.
* **Required Configuration for Connection:**
  * To enable 21st.dev MCP: Add MCP configuration in Antigravity settings or `mcp_servers.json` pointing to `@21st-dev/mcp-server`.
  * To enable Google Stitch MCP: Register the Stitch endpoint/binary in MCP client configurations.
* **Design Strategy & Fallback Engine:**
  * Full utilization of the installed and verified **UI UX Pro Max** skill (`.agents/skills/ui-ux-pro-max/`), which provides an extensive local repository of 79 design styles, 192 product palettes, 74 font pairings, 119 UX guidelines, 22 stack rulebooks, and WCAG AA accessibility matrices.
  * Application of the authoritative **FemmeFlo Master Design System** (`design-system/femmeflo/MASTER.md`).
  * Direct implementation in production-quality React Native / Expo components with clean styling architecture.

