# Repository Discovery & Architectural Inventory

## 1. Executive Summary & Repository Map

FemmeFlo is a cross-platform mobile enterprise application built with **React Native (0.88.0)**, **React (19.3.0)**, **Expo SDK 58 (~58.0.19)**, and **Expo Router (~58.0.26)**. The application serves field sales forces, territory managers, and executive headquarters in feminine hygiene and healthcare FMCG supply chains.

The codebase features role-based access control across three primary operational tiers:
1. **SELLER** (Field Sales Officer / Van Distribution)
2. **MANAGER** (Territory / Regional Operations Manager)
3. **SUPER_ADMIN** (Executive Headquarters / National Logistics & Approvals)

### 1.1 Directory Tree Structure

```
femmeflo-app/
├── assets/                       # Static visual assets (icons, splash, backgrounds)
│   └── images/                   # Splash icon, adaptive icons, favicon
├── design-system/                # Design specifications
│   └── femmeflo/
│       └── MASTER.md             # Authoritative design tokens and guidelines
├── docs/                         # Engineering & product architecture specifications
│   ├── API CONTRACTS.md
│   ├── DATABASE SCHEMA.md
│   ├── DEVELOPMENT PHASES.md
│   ├── INFORMATION ARCHITECTURE.md
│   ├── SYSTEM ARCHITECTURE.md
│   ├── product-requirements.md
│   └── mobile/                   # Mobile-specific architecture and traceability
├── src/
│   ├── __tests__/                # Automated test suites
│   │   └── business_rules.test.ts # 15 business-critical scenario tests (Node test runner)
│   ├── api/                      # API integration, client, mock services, and types
│   │   ├── admin.ts              # Executive API endpoints (approvals, warehouse, users)
│   │   ├── auth.ts               # Authentication API (login, passwords, me)
│   │   ├── categories.ts         # Customer category CRUD
│   │   ├── client.ts             # HTTP client with interceptors, token storage & mock fallback
│   │   ├── manager.ts            # Manager API endpoints (territory, sellers, sales)
│   │   ├── mockData.ts           # Offline seed data (products, customers, sales, shifts)
│   │   ├── mockService.ts        # In-memory reactive state engine for offline mode
│   │   ├── notifications.ts      # Activity feed and unread alerts
│   │   ├── seller.ts             # Field officer endpoints (sales, customers, shifts, gps)
│   │   └── types.ts              # Full TypeScript domain and DTO schemas
│   ├── app/                      # Expo Router file-system routes
│   │   ├── _layout.tsx           # Root application shell (SafeArea, AuthProvider, Stack)
│   │   ├── index.tsx             # Startup route (session check & role router)
│   │   ├── (auth)/               # Unauthenticated authentication routes
│   │   │   ├── _layout.tsx       # Auth stack layout
│   │   │   ├── login.tsx         # Role-hinted login screen with offline demo pills
│   │   │   ├── forgot-password.tsx # Password reset request
│   │   │   └── reset-password.tsx  # Reset token verification & new password
│   │   ├── (seller)/             # Field Sales Officer workspace
│   │   │   ├── _layout.tsx       # Seller 5-tab bottom navigation layout
│   │   │   ├── index.tsx         # Seller Dashboard (Shift status, KPIs, Quick actions)
│   │   │   ├── customers/        # Customer directory, onboarding, store ledger
│   │   │   ├── sales/            # Sales history, order creation, tax invoice
│   │   │   ├── inventory/        # Van stock balance & movement ledger
│   │   │   ├── incentives/       # Commission earnings & packet ledger
│   │   │   └── profile/          # Seller profile, shift history & signout
│   │   ├── (manager)/            # Territory Manager workspace
│   │   │   ├── _layout.tsx       # Manager 5-tab bottom navigation layout
│   │   │   ├── index.tsx         # Manager Dashboard (Territory KPIs, performance metrics)
│   │   │   ├── sellers/          # Team roster, performance metrics, onboarding
│   │   │   ├── customers/        # Territory-wide retail store directory
│   │   │   ├── sales/            # Territory sales ledger & status filters
│   │   │   └── profile/          # Manager profile & signout
│   │   ├── (admin)/              # Super Admin / HQ Executive workspace
│   │   │   ├── _layout.tsx       # Admin 5-tab bottom navigation layout
│   │   │   ├── index.tsx         # Executive Overview (National sales, stock, pending alerts)
│   │   │   ├── approvals/        # Below-minimum price approval queue
│   │   │   ├── inventory/        # National warehouse inventory & stock transfers
│   │   │   ├── users/            # User administration (Managers & Sellers directory)
│   │   │   ├── categories/       # Customer category management
│   │   │   └── settings/         # Global business settings & price thresholds
│   │   └── (shared)/             # Shared modal routes across all authenticated roles
│   │       ├── _layout.tsx       # Modal stack layout
│   │       ├── notifications.tsx # Notification center & alert marks
│   │       └── change-password.tsx # In-session credential change
│   ├── components/
│   │   └── ui/                   # Reusable UI component library
│   │       ├── Badge.tsx         # Semantic status pill with dot indicator
│   │       ├── Button.tsx        # Tactile interactive button with variants & sizes
│   │       ├── Card.tsx          # Elevated, outlined, and flat card containers
│   │       ├── EmptyState.tsx    # Illustrative empty state with action trigger
│   │       ├── Header.tsx        # Safe-area responsive top app bar
│   │       ├── Input.tsx         # Form input with floating labels, icons & error states
│   │       └── LoadingSkeleton.tsx # Placeholder skeleton blocks and card layouts
│   ├── constants/
│   │   └── theme.ts              # Design tokens (Colors, Typography, Spacing, Radius, Shadows)
│   ├── context/
│   │   └── AuthContext.tsx       # Authentication provider & reactive session state
│   ├── hooks/
│   │   ├── use-color-scheme.ts   # Platform color scheme hook
│   │   └── use-theme.ts          # Semantic color token resolver
│   └── global.css                # Global CSS variable fallbacks for Web
├── app.json                      # Expo application manifest & native plugin configuration
├── package.json                  # Dependencies & scripts
└── tsconfig.json                 # TypeScript compiler configuration (Path aliases: @/*)
```

---

## 2. Real Application Entry Points & Lifecycle

1. **`src/app/_layout.tsx` (RootLayout)**:
   - Sets up `SafeAreaProvider` for edge-to-edge safe area rendering.
   - Wraps the entire component tree with `AuthProvider`.
   - Controls `expo-splash-screen` hide timing once mounted.
   - Defines the top-level `Stack` navigator with seamless transitions: `index`, `(auth)`, `(seller)`, `(manager)`, `(admin)`, and `(shared)` modal.

2. **`src/app/index.tsx` (StartupScreen)**:
   - Reads `user`, `role`, and `isLoading` from `AuthContext`.
   - Directs unauthenticated users to `/(auth)/login`.
   - Directs authenticated users according to their verified role:
     - `SELLER` -> `/(seller)`
     - `MANAGER` -> `/(manager)`
     - `SUPER_ADMIN` -> `/(admin)`
   - Displays a branded startup splash with spinning indicator while validating session tokens.

3. **`src/context/AuthContext.tsx`**:
   - Manages persistent JWT token storage in `expo-secure-store` (native) or `localStorage` (web).
   - Handles automatic session restoration on app boot.
   - Registers session expiration hooks that wipe local credentials and trigger clean signout redirects upon 401 Unauthorized responses.

---

## 3. Production Code vs Generated & Mock Infrastructure

| Module | Classification | Description & Role |
|--------|----------------|-------------------|
| `src/app/**` | Production UI | All active Expo Router screens and layouts. |
| `src/components/ui/**` | Production UI Library | Reusable design-system components. |
| `src/constants/theme.ts` | Production Foundation | Authoritative token definitions. |
| `src/api/client.ts` | Production Architecture | Axios/Fetch wrapper supporting backend connections with seamless fallback to offline mock service. |
| `src/api/mockData.ts` & `src/api/mockService.ts` | Testing & Offline Engine | Complete in-memory state engine simulating the backend database, business rules, idempotency keys, and shift ledgers for demonstration and offline field testing. |
| `src/__tests__/business_rules.test.ts` | Verification | 15 strict unit tests executing FemmeFlo's master prompt business rules. |

