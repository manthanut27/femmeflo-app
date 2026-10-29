# OPEN QUESTIONS & ARCHITECTURAL DECISIONS

**Date:** 2026-10-27  
**Auditor:** Senior Mobile Architect & Systems Integration Engineer  
**Project:** FemmeFlo Expo Android Application

---

## 1. Duty Shift & Attendance Feature Scope

### Current Evidence
1. **Source Code Inspection:**
   * Backend endpoints exist and are active:
     * `GET /api/v1/seller/shifts/current`
     * `POST /api/v1/seller/shifts/start`
     * `POST /api/v1/seller/shifts/check-in`
     * `POST /api/v1/seller/shifts/check-out`
     * `POST /api/v1/seller/shifts/end`
     * `GET /api/v1/seller/shifts/history`
     * `GET /api/v1/admin/shifts`
     * `GET /api/v1/manager/shifts`
   * Web Portal: `SellerShiftWidget.tsx` is prominently featured on the Seller dashboard (`src/app/seller/page.tsx`).
   * Field Officers use this feature for daily odometer logging, store visit check-ins, and shift duration tracking.

### Boundary Decision for Mobile v1
* **Scope Decision:** Fully supported. The mobile client will provide the active shift widget on the Seller Dashboard, enabling daily shift start (with start KM and GPS check-in) and shift checkout.
* **Location Model:** Foreground location only. Location is recorded at distinct operational events (Shift Start, Shop Visit Check-In, Shift End). **No continuous background GPS tracking** is implemented, avoiding severe Android battery drain and invasive OS permission audits.

---

## 2. Backend Hosting & Render Cold Start Mitigation

### Current Evidence
* Live API Base URL: `https://femmeflo-inventory.onrender.com/api/v1`.
* Render Free/Standard instances spin down after inactivity, causing initial cold-start delays of up to 45-50 seconds.

### Mobile Architectural Mitigation
1. **Extended Handshake Timeout:** Initial `/health` and authentication requests use a 45-second timeout window instead of default 10s.
2. **Warm-up Ping on App Launch:** The initial splash resolver calls `GET /health` in parallel with local SecureStore token reading.
3. **Transparent Recovery Banner:** If cold start is detected, the UI displays a gentle "Waking up server..." notice rather than a jarring generic network crash error.

---

## 3. Customer Photo Storage & Upload Strategy

### Current Evidence
* Backend exposes `POST /api/v1/seller/customers/{id}/photo` accepting multipart form-data.
* Web app permits optional storefront photography.

### Mobile Architectural Decision
* Customer creation will happen in two safe sequential steps:
  1. `POST /api/v1/seller/customers` creates the verified customer record.
  2. If the user attached a storefront photo, `POST /api/v1/seller/customers/{id}/photo` uploads the compressed JPEG (<2MB).
* If photo upload fails (e.g. timeout on 2G/3G network in rural areas), the customer creation remains valid and confirmed, preventing data loss. The user is notified that the photo can be retried later.

---

## 4. Push Notifications vs. Persistent In-App Notifications

### Current Evidence
* The backend exposes `/api/v1/notifications` storing notification items in the database with read flags.
* No Google Firebase Cloud Messaging (FCM) credentials or Push Tokens are configured on the backend.

### Mobile Architectural Decision
* **Mobile v1:** In-app notification center backed by `GET /api/v1/notifications`, polling periodically or upon navigation focus.
* Local badges reflect unread counts.
* No external FCM / APNS push services will be silently invented until backend push infrastructure is commissioned.

---

## 5. Offline Capabilities vs. Online-Only Invariant

### Current Evidence
* The Master Prompt explicitly commands:
  * "Business operations require an online backend connection."
  * "Do not implement an offline transaction queue."
  * "Never report a transaction as successful until the backend confirms it."

### Mobile Architectural Decision
* Online-only operation strictly enforced.
* Form data is cached in component memory during active entry so network dropouts do not wipe user input.
* Retry mechanisms let the user resubmit without retyping.
