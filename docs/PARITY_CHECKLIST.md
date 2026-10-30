# FemmeFlo Mobile App - Web Parity & Architecture Checklist

This document tracks functional parity between the web frontend (`femmeflo-website`) and the mobile app (`femmeflo-app`), interfacing with the same Express/Prisma backend (`femmeflo-yfa-inventory-server`).

---

## Parity Summary Scorecard

| Category | Total Tracked | Done | Partial | Not Started / Blocker |
| :--- | :---: | :---: | :---: | :---: |
| **Authentication & Session** | 5 | 5 | 0 | 0 |
| **Seller Suite (Field Sales POS & Attendance)** | 19 | 19 | 0 | 0 |
| **Manager Suite (Territory Supervision)** | 7 | 6 | 0 | 1 |
| **Admin Suite (Super Admin Governance)** | 6 | 3 | 3 | 0 |
| **Total Features** | **37** | **33** | **3** | **1** |

- **Done**: 33 (89.2%)
- **Partial**: 3 (8.1%)
- **Not Started / Backend Blocker**: 1 (2.7%)

---

## 1. Authentication & Role Routing

| Feature | Web Frontend (`femmeflo-website`) | Mobile App (`femmeflo-app`) | Backend Endpoint & Evidence | Parity Status |
| :--- | :--- | :--- | :--- | :--- |
| **Single Login Form** | Role alias pages (`/seller/login`, `/manager/login`, `/admin/login`) | Single unified login screen at `/(auth)/login` | `POST /api/v1/auth/login` (`user.routes.ts:39`) | ✅ **Done** |
| **Returned Role Routing** | Client-side cookie / session role redirect | Dynamic routing to `/(seller)`, `/(manager)`, or `/(admin)` based on returned `user.role` | `POST /api/v1/auth/login` (`login.tsx:61-72`) | ✅ **Done** |
| **Dual-Role Switching** | Dual role badge in manager view | Manager with `isSeller: true` has "Switch to Field Sales Mode" toggle | `schema.prisma:78`, `rbac.middleware.ts:93`, `RoleGuard.tsx:44` | ✅ **Done** |
| **Secure Token Storage** | HTTP cookies | Native SecureStore for tokens only (`femmeflo_mobile_auth_token`), separate from AsyncStorage cache | `client.ts:33-65` (`expo-secure-store`) | ✅ **Done** |
| **Session Expiry (401)** | Redirect to login | Global 401 interceptor clears token; preserves in-progress shift and draft orders across re-login | `client.ts:167-175`, `AuthContext.tsx:47-63` | ✅ **Done** |

---

## 2. Point of Sale & Sales Orders (Seller Suite)

| Feature | Web Frontend (`femmeflo-website`) | Mobile App (`femmeflo-app`) | Backend Endpoint & Evidence | Parity Status |
| :--- | :--- | :--- | :--- | :--- |
| **POS Order Form** | Web form with customer select & product table | Native card layout with quick steppers (`±5`), SKU pills, and total calculation | `POST /api/v1/seller/sales` (`sales.controller.ts:10`) | ✅ **Done** |
| **Below-Floor Pricing Alert** | Amber banner, flags `PENDING_APPROVAL` | Warning banner (`#D97706`), submits as `PENDING_APPROVAL`, explains admin review | `POST /api/v1/seller/sales` (`new.tsx:201-210`) | ✅ **Done** |
| **Idempotency Key & Binding** | UUID in body | `expo-crypto` RFC4122 v4 UUID, sent in `requestKey` body field & `X-Idempotency-Key` header; binds to payload hash; rotates on payload edit after submit attempt | `sales.validation.ts:15,21`, `sales.service.ts:66,78-83`, `draftStorage.ts` | ✅ **Done** |
| **Draft Order Storage** | Local component state | Persisted in `@react-native-async-storage/async-storage` keyed by `userId`; cleared on successful sale or logout | `draftStorage.ts`, `new.tsx:103-165` | ✅ **Done** |
| **Payment Modes** | `CASH`, `BANK`, `PENDING` | `CASH`, `BANK`, `PENDING` segmented controls | `sales.validation.ts:14,20` (`createSaleSchema`) | ✅ **Done** |
| **Payment Collection** | Modal dialog to collect pending payment | Native modal with payment mode selector & transaction reference | `PATCH /api/v1/seller/sales/:id/payment` (`[id].tsx:78-115`) | ✅ **Done** |
| **Tax Invoice PDF** | Direct browser download link | Authenticated fetch via Bearer token with caching and native OS share/print dialog | `GET /api/v1/invoices/:id/pdf` (`user.routes.ts:51`) | ✅ **Done** |
| **Sales History & Details** | Paginated table with status pills | Paginated list with pull-to-refresh, status badges, and itemized breakdown | `GET /api/v1/seller/sales` & `GET /api/v1/seller/sales/:id` | ✅ **Done** |

---

## 3. Duty Shift & Visits Tracking (Seller Suite)

| Feature | Web Frontend (`femmeflo-website`) | Mobile App (`femmeflo-app`) | Backend Endpoint & Evidence | Parity Status |
| :--- | :--- | :--- | :--- | :--- |
| **Duty Attendance Dashboard** | Modal on seller dashboard | Dedicated `Duty Shift & Visits Tracker` screen (`/(seller)/shift`) | `POST /api/v1/seller/shifts/start` (`shift/index.tsx`) | ✅ **Done** |
| **Shift Source of Truth** | Server state | `GET /seller/shifts/current` is authoritative; local cache in AsyncStorage is non-blocking fallback keyed by `userId` | `user.routes.ts:178`, `shift/index.tsx:57-79` | ✅ **Done** |
| **Live Elapsed Timer** | Static text display | Live `HH:MM:SS` ticker updating every second from `shift.startTime` | Calculated from `shift.startTime` (`shift/index.tsx:86-111`) | ✅ **Done** |
| **Check-in Store Visit** | Check-in button | Modal with outlet selector, notes, and foreground GPS pin capture | `POST /api/v1/seller/shifts/check-in` (`shift/index.tsx:162-201`) | ✅ **Done** |
| **Check-out Store Visit** | Check-out button | Visit completion with outcome badge & timestamp | `POST /api/v1/seller/shifts/check-out` | ✅ **Done** |
| **End Duty Shift** | End shift modal with odometer | Modal enforcing `closingOdometer >= startingOdometer` with notes | `POST /api/v1/seller/shifts/end` (`shift/index.tsx:203-252`) | ✅ **Done** |
| **Point Geolocation Events** | Browser Geolocation API | Foreground-only point capture (`expo-location`), no background tracking or periodic pinging | `shift/index.tsx:132-137,175-180,220-225` | ✅ **Done** |

---

## 4. Retailer Customer Directory & Onboarding (Seller Suite)

| Feature | Web Frontend (`femmeflo-website`) | Mobile App (`femmeflo-app`) | Backend Endpoint & Evidence | Parity Status |
| :--- | :--- | :--- | :--- | :--- |
| **Customer Directory** | Searchable table with credit tags | Native card directory with phone dialer trigger, credit badge, and search filter | `GET /api/v1/seller/customers` | ✅ **Done** |
| **PIN Code Auto-lookup** | Postal API / server lookup | 6-digit PIN code triggers automated State, District, and Village lookup | `api.postalpincode.in` & `seller.ts:95-122` | ✅ **Done** |
| **Storefront Photo Upload** | Browser file input | Camera capture or gallery select via `expo-image-picker` with JPEG compression, submitted via `multipart/form-data` with field name `photo` | `POST /api/v1/seller/customers` & `POST /seller/customers/:id/photo` (`seller.ts:124-139`) | ✅ **Done** |
| **Direct Supabase Storage Bypass** | Not used on client | Bypassed; mobile uploads directly to server Multer handler which processes and stores via backend service key | Multer `uploadCustomerPhotoMiddleware` in server | ✅ **Done** |

---

## 5. Territory Management (Manager Suite)

| Feature | Web Frontend (`femmeflo-website`) | Mobile App (`femmeflo-app`) | Backend Endpoint & Evidence | Parity Status |
| :--- | :--- | :--- | :--- | :--- |
| **Territory Dashboard** | Aggregated territory stats & seller cards | Native dashboard with revenue, active sellers, and beat attendance cards | `GET /api/v1/manager/dashboard` (`manager/index.tsx`) | ✅ **Done** |
| **Field Sellers Directory** | Table of assigned sellers | List of field sellers with active shifts, today's sales, and contact actions | `GET /api/v1/manager/sellers` (`manager/sellers/index.tsx`) | ✅ **Done** |
| **Onboard Field Seller** | Form for adding seller | Mobile onboarding form with employee code, phone, territory, and password | `POST /api/v1/manager/sellers` (`manager/sellers/new.tsx`) | ✅ **Done** |
| **Territory Customers** | Territory customer table | Searchable list of retailers mapped to territory sellers | `GET /api/v1/manager/customers` (`manager/customers/index.tsx`) | ✅ **Done** |
| **Territory Sales Orders** | Territory order ledger | Filterable sales history across all assigned territory sellers | `GET /api/v1/manager/sales` (`manager/sales/index.tsx`) | ✅ **Done** |
| **Manager Profile & Dual Role** | Profile settings | Profile view with "Switch to Field Sales Mode" toggle for dual-role managers | `GET /api/v1/auth/me` (`manager/profile/index.tsx`) | ✅ **Done** |
| **Manager Approvals** | Super Admin only on server | **Backend Blocker**: Server only mounts `/admin/approvals` for `SUPER_ADMIN`. Managers cannot approve low-price sales. | `user.routes.ts:151` (`requireRole("SUPER_ADMIN")`) | ⚠️ **Backend Blocker** |

---

## 6. Super Admin Governance (Admin Suite - Reduced Scope)

| Feature | Web Frontend (`femmeflo-website`) | Mobile App (`femmeflo-app`) | Backend Endpoint & Evidence | Parity Status |
| :--- | :--- | :--- | :--- | :--- |
| **Executive Overview** | Full web admin dashboard | High-level metrics: total revenue, active beats, pending approvals (`/(admin)/index`) | `GET /api/v1/admin/dashboard` (`admin/index.tsx`) | ✅ **Done** |
| **Low-Price Approvals** | Web approval queue with line-item review | Card queue with retailer info, floor vs requested price, and one-tap Approve/Reject dialog | `GET /api/v1/admin/approvals`, `POST /admin/approvals/:id/approve`, `POST /reject` (`approvals/index.tsx`) | ✅ **Done** |
| **Warehouse Stock Transfer** | Full inventory management module | Van stock transfer screen (`/(admin)/inventory/transfer`) | `POST /api/v1/admin/inventory/transfer` (`transfer.tsx`) | ✅ **Done** |
| **Invoices List** | Filterable table of all invoices | PDF viewable per order from `GET /invoices/:id/pdf`; standalone admin invoice table not yet built | `GET /api/v1/admin/invoices` (`admin/invoice.routes.ts:10`) | 🟡 **Partial** |
| **Reports Export (Sales & Stock)** | Web CSV export triggers | Backend endpoints exist (`GET /admin/reports/sales`, `GET /admin/reports/inventory`), mobile export UI not yet built | `admin/report.routes.ts:11-12` | 🟡 **Partial** |
| **Incentive Settings** | Web business settings page | Screen exists (`/(admin)/settings/index`); backend only provides `/admin/incentives/settings` | `admin/incentive.routes.ts:11-12` | 🟡 **Partial** |

---

## 7. Status Legend

- ✅ **Done**: Full functional parity implemented in mobile app, verified against server controllers and validators.
- 🟡 **Partial**: Backend endpoint exists; mobile implements core flow (e.g. per-sale invoice PDF) but secondary index/export screen remains.
- ⚠️ **Backend Blocker**: Requirement blocked by server constraint (e.g., manager approval forbidden by server RBAC).
