# REPOSITORY AUDIT: FEMMEFLO MOBILE & WEB ARCHITECTURE

**Audit Timestamp:** 2026-10-27  
**Auditor:** Senior Mobile & Systems Integration Architect  
**Workspace Root:** `c:\Users\manthan\Desktop\dev projects\hitesh ka project`  
**Target Repository Units:**
1. `femmeflo-website` (Next.js 16 Web Application & Operational Portal)
2. `femmeflo-app` (Expo SDK 58 / React Native 0.88 Android Mobile Application)
3. Live Backend Service (`https://femmeflo-inventory.onrender.com/api/v1`)

---

## 1. Executive Summary

This repository audit establishes the technical baseline, architecture, code assets, and operational constraints for extending the FemmeFlo ecosystem with a production-grade Expo Android application.

The ecosystem manages feminine hygiene product distribution across India, operating a multi-tier hierarchy:
* **Super Admin:** Executive oversight, HQ warehouse operations, stock transfers, pricing approval, user lifecycle, and reporting.
* **Manager:** Territory oversight, assigned seller supervision, customer monitoring, and shift/attendance reviews.
* **Seller:** Field operations, retail shop onboarding with GPS, product sales (single and multi-line), price check against configured minimums, cash/bank/pending payment collection, duty shifts, and commission/incentive tracking.

The web application (`femmeflo-website`) is fully operational on Next.js 16.2.11 and communicates with a centralized REST backend deployed at `https://femmeflo-inventory.onrender.com/api/v1`. The mobile project (`femmeflo-app`) is initialized with Expo SDK 58, React 19.3.0, React Native 0.88.0, and Expo Router ~58.0.26.

---

## 2. Git Status & Repository Baseline

### 2.1 Workspace Structure
```text
c:\Users\manthan\Desktop\dev projects\hitesh ka project/
├── femmeflo-app/                # Mobile application root (Expo SDK 58)
│   ├── assets/                  # Icons and splash screens
│   ├── docs/                    # Architecture, PRD, and contract documents
│   │   ├── mobile/              # Detailed mobile delivery specifications (new)
│   │   ├── API CONTRACTS.md
│   │   ├── DATABASE SCHEMA.md
│   │   ├── ENGINEERING SCOPE DEFINITION.md
│   │   ├── product-requirements.md
│   │   └── ...
│   ├── src/                     # Application source
│   ├── app.json                 # Expo configuration
│   ├── package.json             # Mobile dependencies
│   └── tsconfig.json            # TypeScript configuration
├── femmeflo-website/            # Existing Next.js web application
│   ├── docs/                    # Audit & review documentation
│   │   ├── audit/               # Inventory, architecture, tokens
│   │   └── audit-review/        # Factcheck, scope, gap analysis
│   ├── src/
│   │   ├── app/                 # Next.js App Router routes
│   │   ├── components/          # Reusable web components
│   │   └── lib/api/             # Typed API clients (admin, manager, seller, auth)
│   ├── .env.example
│   ├── .env.local               # Configured to live backend
│   └── package.json
└── graphify-out/                # Knowledge Graph & AST index (2,224 nodes, 4,966 edges)
```

### 2.2 Git Branches & Uncommitted State
* **`femmeflo-website`**: Active branch `main`. Up to date with `origin/main`. Untracked files: `docs.zip`, `docs/`.
* **`femmeflo-app`**: Active branch `master`. Untracked files: `docs/`.
* **Preservation Rule**: Neither repository shall have its existing history rewritten or modified destructively. The web portal code must remain functional and untouched during mobile application construction.

---

## 3. Technology Stack & Dependencies

### 3.1 Website Stack (`femmeflo-website`)
* **Framework:** Next.js 16.2.11 (React 19.2.4, React DOM 19.2.4)
* **Styling:** Tailwind CSS v4, PostCSS, Lucide React 1.27.0
* **Animation & Motion:** GSAP 3.15.0, Framer Motion 12.42.2, Lenis 1.3.25
* **Utility & Mail:** Nodemailer 9.0.5
* **Package Manager:** npm (package-lock.json present)
* **Baseline Checks:** Linting reveals 155 pre-existing errors (mostly `@typescript-eslint/no-explicit-any` and React 19 `useEffect` setState cascading warnings). These are documented baseline findings and will not be touched.

### 3.2 Mobile Stack (`femmeflo-app`)
* **Framework:** React Native 0.88.0, Expo SDK 58 (~58.0.19)
* **Routing:** Expo Router ~58.0.26 (file-based navigation)
* **Runtime:** React 19.3.0
* **Graphics & UI:** `react-native-reanimated` 4.7.1, `react-native-gesture-handler` ~3.3.0, `react-native-safe-area-context` ~5.10.1, `react-native-screens` ~4.30.0
* **Required Additional Native Libraries for Production:**
  * Secure Storage: `expo-secure-store`
  * Foreground GPS: `expo-location`
  * Photo/Camera: `expo-image-picker`
  * File System & Sharing: `expo-file-system`, `expo-sharing`
  * Network Connectivity: `@react-native-community/netinfo`
  * Vector Icons: `@expo/vector-icons`

---

## 4. Backend & API Integration Architecture

### 4.1 Authoritative Service Details
* **Base URL:** `https://femmeflo-inventory.onrender.com/api/v1`
* **Health Endpoint:** `GET /health` -> `{ success: true, message: "API is running", data: { status: "ok", database: "configured" } }` (Verified live)
* **Readiness Endpoint:** `GET /ready` -> `{ success: true, message: "API is ready", data: { database: "connected" } }` (Verified live)
* **Session Lifecycle:** JWT Bearer Token in HTTP Authorization Header (`Authorization: Bearer <token>`). Tokens expire after a server-determined duration.
* **Role Verification:** Authenticated user response provides authoritative role (`SUPER_ADMIN`, `MANAGER`, `SELLER`).
* **Multi-Product Support:** Confirmed supported in API schema (`seller/sales` accepts `items: [{ productId, quantity, unitPricePaise }]`).

### 4.2 Security Architecture
1. **Token Persistence:** The mobile app must use `Expo SecureStore` (hardware-backed Android Keystore), replacing web `localStorage`.
2. **Role Verification:** Client role-selector sets login request context. Authorization is strictly dictated by the backend JWT claim and user record returned by `/auth/me`. Mismatched roles trigger safe re-routing or rejection.
3. **No Service Keys:** Mobile app holds zero server secrets or privileged keys.

---

## 5. Architectural Findings & Gap Analysis

1. **Monorepo Strategy:** The project currently exists as sibling directories (`femmeflo-website` and `femmeflo-app`). In accordance with Section 7 of `MONOREPO STRUCTURE.md`, we will keep `femmeflo-app` as an isolated, standalone Expo application consuming the live backend API. This avoids breaking the website build, package manager, or deployment pipelines.
2. **Shared API Logic:** The API client structure from `femmeflo-website/src/lib/api/` (`client.ts`, `types.ts`, `auth.ts`, `seller.ts`, `manager.ts`, `admin.ts`, `categories.ts`, `notifications.ts`) serves as the verified reference contract. For mobile, this logic is adapted to use `expo-secure-store` for native token persistence, native network state detection, and Android-compatible file downloads.
3. **Offline Policy:** Strictly online-only. Offline orders or background sync are not permitted by business requirements. Clear network error indicators and retry triggers must be provided.
4. **Communication:** WhatsApp integration is completely excluded. Email delivery is managed server-side.
