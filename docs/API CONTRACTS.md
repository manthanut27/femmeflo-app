# API CONTRACTS — FemmeFlo Mobile Application

## 1. Specification Overview & Base Configuration

This document specifies the authoritative HTTP REST API contracts for the FemmeFlo mobile application across Field Sellers, Territory Managers, and Super Administrators.

* **Base URL:** `https://femmeflo-inventory.onrender.com/api/v1` (Configured via `EXPO_PUBLIC_API_URL` in `.env`)
* **Mock Simulation Mode:** Controlled via `EXPO_PUBLIC_USE_MOCK_API=true|false` (falls back to relational in-memory client mock engine in offline or demo modes).
* **Transport:** HTTPS with JSON payloads (Multipart Form-Data for binary storefront image uploads, binary stream for tax invoice PDF downloads).
* **Authentication:** Bearer JWT tokens passed in the standard `Authorization` header.

### Common Request Headers
```http
Accept: application/json
Content-Type: application/json
Authorization: Bearer <jwt_access_token>
X-Request-ID: <uuid-v4>
X-Idempotency-Key: <uuid-v4> (Required for sales creation and financial mutations)
```

### Standard API Response Envelope
```typescript
interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string | {
    code?: string;
    message?: string;
    fieldErrors?: Record<string, string>;
  };
}
```

---

## 2. Authentication & Session APIs

### 2.1 Unified & Role-Context Login
* **Endpoints:**
  * `POST /auth/login` (Unified entry point)
  * `POST /seller/auth/login` (Role hint: Seller)
  * `POST /manager/auth/login` (Role hint: Manager)
  * `POST /admin/auth/login` (Role hint: Super Admin)
* **Request Payload:**
```json
{
  "identifier": "user@femmeflo.com",
  "password": "userPassword123",
  "roleHint": "seller"
}
```
* **Success Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "usr_94e5b412-1b1e-45fa-8f83-e02cfd2948bb",
    "name": "Pooja Sharma",
    "email": "pooja.sharma@femmeflo.com",
    "phone": "+919876543210",
    "role": "SELLER",
    "isSeller": true,
    "active": true,
    "state": "Madhya Pradesh",
    "district": "Indore",
    "village": "Rau",
    "territory": "MP-West",
    "managerId": "usr_mgr_88192",
    "employeeCode": "FF-SLR-104",
    "permissions": ["CREATE_SALES", "ONBOARD_CUSTOMERS", "VIEW_VAN_STOCK"]
  }
}
```
* **Session Lifecycle Rules:**
  * Returned token is stored securely via `expo-secure-store` / sandboxed `tokenStorage`.
  * The user profile is cached in `tokenStorage.setCachedUser()` for offline resilience.
  * Explicit HTTP 401/403 responses immediately evict the stored token and transition state to `SESSION_EXPIRED`.
  * Network dropouts or 5xx errors transition the app to `OFFLINE_AUTHENTICATED`, restoring cached user state without interrupting fieldwork.

### 2.2 Get Current User Profile (`GET /auth/me`)
* **Headers:** `Authorization: Bearer <token>`
* **Success Response (200 OK):** Returns `{ user: PublicUser }`. Supports dual-role checking where `user.role === 'MANAGER'` and `user.isSeller === true`.

### 2.3 Password Management & Recovery
* **PATCH `/auth/password`:** `{ "currentPassword": "...", "newPassword": "..." }`
* **POST `/auth/forgot-password`:** `{ "identifier": "user@femmeflo.com" }`
* **POST `/auth/reset-password`:** `{ "token": "reset_token_xyz", "newPassword": "..." }`

---

## 3. Customer Onboarding & Lifecycle APIs

### 3.1 Onboard Retail Customer (`POST /seller/customers`, `POST /manager/customers`, `POST /admin/customers`)
The customer onboarding form follows a structured 4-card workflow (GPS Card, Storefront Photo Card, Shop Details Card, Address & Territory Card):

* **CreateCustomerPayload:**
```json
{
  "shopName": "Gupta Medical & General Store",
  "contactName": "Ramesh Gupta",
  "ownerName": "Ramesh Gupta",
  "phone": "+919876543210",
  "email": "ramesh.gupta@gmail.com",
  "categoryId": "cat_48190-chemist-medical",
  "sellerId": "usr_slr_28190",
  "address": "Shop No. 4, Main Market, AB Road",
  "pincode": "453331",
  "state": "Madhya Pradesh",
  "district": "Indore",
  "village": "Rau",
  "latitude": 22.63412,
  "longitude": 75.81924,
  "accuracy": 14.5,
  "noPhotoReason": "Storefront photo captured",
  "photoPath": "file:///data/user/0/com.femmeflo.app/cache/photo_123.jpg"
}
```
* **Validation & Business Invariants:**
  * `shopName` (string, 2–200 chars, mandatory).
  * `phone` (normalized to E.164: `+91XXXXXXXXXX`).
  * `email` (strict RFC-compliant regex, mandatory).
  * `categoryId` (must match an active backend Category UUID).
  * `sellerId` (mandatory when submitted by Manager or Admin).
  * `noPhotoReason` (conditional: automatically locked/disabled when a photo is uploaded; required if photo is skipped).
* **Success Response (201 Created):**
```json
{
  "customer": {
    "id": "cust_e738192a-84b2-4d51-9f20-91a82f349c11",
    "shopName": "Gupta Medical & General Store",
    "ownerName": "Ramesh Gupta",
    "email": "ramesh.gupta@gmail.com",
    "phone": "+919876543210",
    "categoryId": "cat_48190-chemist-medical",
    "address": "Shop No. 4, Main Market, AB Road",
    "pincode": "453331",
    "state": "Madhya Pradesh",
    "district": "Indore",
    "village": "Rau",
    "latitude": 22.63412,
    "longitude": 75.81924,
    "photoUrl": "https://femmeflo-inventory.onrender.com/uploads/customers/cust_e738.jpg",
    "active": true,
    "createdAt": "2026-11-15T09:15:30.000Z"
  }
}
```

### 3.2 Storefront Photo Upload (`POST /seller/customers/:id/photo`)
* **Content-Type:** `multipart/form-data`
* **Form Field:** `photo` (binary JPEG/PNG image, compressed client-side to <2MB)
* **Success Response (200 OK):**
```json
{
  "photoUrl": "https://femmeflo-inventory.onrender.com/uploads/customers/cust_e738.jpg"
}
```

### 3.3 PIN Code Auto-Lookup (`GET /seller/customers/pincode/:pincode`)
* **Success Response (200 OK):**
```json
{
  "pincode": "453331",
  "state": "Madhya Pradesh",
  "district": "Indore",
  "village": "Rau",
  "villages": ["Rau", "Pithampur", "Mhow", "Hatod", "Sanwer", "Indore City"]
}
```
* **Fallback Behavior:** If the internal backend route is offline, client automatically resolves against India Postal API (`https://api.postalpincode.in/pincode/:pincode`) or offline MP/UP dictionary.

### 3.4 Bulk Customer Onboarding (`POST /seller/customers/bulk`, `POST /manager/customers/bulk`, `POST /admin/customers/bulk`)
* **Payload:** `{ customers: BulkCustomerRow[], defaultSellerId?, defaultCategoryId?, defaultState?, defaultDistrict? }`
* **Success Response (200 OK):** `{ count: 12, insertedCount: 12, failedCount: 0, customers: [...] }`

---

## 4. Duty Shift & Attendance APIs

Duty shifts record field officer attendance, mileage, retail check-ins, and checkout feedback. The shift workflow supports native **Fingerprint / Biometric authentication** with **Mobile PIN/Password fallback**, completely replacing legacy face selfies while maintaining backwards-compatible payload parameters.

### 4.1 Current Active Shift (`GET /seller/shifts/current`)
* **Success Response (200 OK):** Returns `{ shift: Shift | null }`.

### 4.2 Start Duty Shift (`POST /seller/shifts/start`)
* **Client Request Payload:**
```json
{
  "latitude": 22.7196,
  "longitude": 75.8577,
  "startLatitude": 22.7196,
  "startLongitude": 75.8577,
  "address": "FemmeFlo Depot, AB Road, Indore",
  "startOdometerKm": 12450,
  "faceVerified": true,
  "facePhoto": "biometric_fingerprint_verified",
  "faceConfidence": 0.99,
  "faceMethod": "FINGERPRINT_BIOMETRIC",
  "notes": "Duty shift started via fingerprint scan"
}
```
* **Backend Invariant Handling:** Strict backend schemas accept `{ latitude, longitude, address? }`. The client normalizes the payload to avoid schema rejections while persisting `startOdometerKm` and biometric credentials into `draftStorage`. If an active shift already exists, it is returned without triggering duplicate 500 errors.
* **Offline Fallback:** If network fails, client creates a resilient local shift (`shift_local_<timestamp>`) in `draftStorage` to avoid blocking field officers.

### 4.3 Retail Visit Check-In (`POST /seller/shifts/check-in`)
* **Request Payload:**
```json
{
  "latitude": 22.6341,
  "longitude": 75.8192,
  "shopName": "Gupta Medical Store",
  "customerId": "cust_e738192a-84b2-4d51-9f20-91a82f349c11",
  "shiftId": "shift_8921a-uuid",
  "notes": "Regular restock visit"
}
```
* **Success Response (200 OK):** Returns `{ visit: ShiftVisit }` with `checkInTime`.

### 4.4 Retail Visit Check-Out (`POST /seller/shifts/check-out`)
* **Request Payload:**
```json
{
  "visitId": "visit_19283-uuid",
  "latitude": 22.6342,
  "longitude": 75.8193,
  "saleDone": true,
  "saleId": "sale_48192-uuid",
  "customerFeedback": "Shopkeeper requested 15 additional packs of XL pads next Tuesday.",
  "notes": "Store well stocked, payment received via UPI"
}
```
* **Success Response (200 OK):** Returns `{ visit: ShiftVisit }` with `checkOutTime`, `durationMins`, and confirmed `saleDone`.

### 4.5 End Duty Shift (`POST /seller/shifts/end`)
* **Request Payload:**
```json
{
  "latitude": 22.7198,
  "longitude": 75.8579,
  "endOdometerKm": 12515,
  "address": "Indore Main Depot",
  "faceVerified": true,
  "facePhoto": "biometric_fingerprint_verified",
  "notes": "Total 65 KM route completed, 8 shops visited"
}
```
* **Success Response (200 OK):** Returns `{ shift: { status: "COMPLETED", durationMins: 480, totalDistanceKm: 65 } }`.

### 4.6 Shift History & Supervisory Oversight
* `GET /seller/shifts/history?page=1&pageSize=20` (Personal shift logs)
* `GET /manager/shifts?page=1&pageSize=20&sellerId=...` (Territory seller attendance tracking)
* `GET /admin/shifts?page=1&pageSize=20&status=...` (National attendance audit)

---

## 5. Sales & Point-of-Sale (POS) APIs

The application supports a **Decoupled Direct Sales Flow**, enabling field officers and managers to record POS sales at any time without requiring an active duty shift. In addition, sales booked during an active shift visit are linked to that visit.

### 5.1 Create Point-of-Sale Sale (`POST /seller/sales`)
* **Required Headers:**
  * `X-Idempotency-Key`: UUID v4 (Unique per submission attempt)
* **Request Payload:**
```json
{
  "customerId": "cust_e738192a-84b2-4d51-9f20-91a82f349c11",
  "paymentMode": "CASH",
  "paymentReference": "CASH-REC-1049",
  "requestKey": "0d20ef42-1849-41ef-bb60-c3501a4f0012",
  "customerFeedback": "Customer took 2 cartons of Regular pads and 1 carton of XL.",
  "items": [
    {
      "productId": "prod_pad_regular_240mm",
      "quantity": 20,
      "unitPricePaise": 2800
    },
    {
      "productId": "prod_pad_xl_280mm",
      "quantity": 10,
      "unitPricePaise": 3500
    }
  ]
}
```
* **Price Floor & Status Invariants:**
  1. **Normal Sale (All `unitPricePaise` >= Minimum Price Floor, e.g. ₹25.00):**
     * Created with `status: "CONFIRMED"`.
     * Stock is immediately and atomically deducted from the seller's van balance.
     * Commission is credited at the active rate.
     * Tax invoice PDF is immediately generated and downloadable.
  2. **Below-Floor Sale (Any `unitPricePaise` < Minimum Price Floor):**
     * Created with `status: "PENDING_APPROVAL"`.
     * Zero stock is deducted from van balance.
     * Zero commission is earned or credited.
     * Invoice generation is locked.
     * Sale is routed to the Super Admin `adminApi.listApprovals` queue.

### 5.2 List Sales (`GET /seller/sales`, `GET /manager/sales`, `GET /admin/sales`)
* **Query Parameters:** `page`, `pageSize`, `status` (`CONFIRMED`, `PENDING_APPROVAL`, `REJECTED`), `paymentMode` (`CASH`, `BANK`, `PENDING`), `search`, `customerId`, `sellerId`, `period` (`all`, `this_month`, `last_month`).
* **Success Response (200 OK):** `{ items: SaleItem[], pagination: PaginationMeta }`

### 5.3 Resubmit / Revise Price for Rejected Sale (`PATCH /seller/sales/:id`, `PATCH /manager/sales/:id`)
When an administrator rejects a low-price sale, the seller or manager can revise the unit price and resubmit for approval without retyping the entire order:
* **Payload:** `{ "quantity": 20, "unitPricePaise": 2600, "paymentMode": "CASH", "customerFeedback": "Manager Price Revised" }`
* **Sanitization:** Cleaned via `sanitizeUpdateSalePayload` to strip read-only server fields.
* **Success Response (200 OK):** Returns `{ sale: SaleItem }` with `status: "PENDING_APPROVAL"` and `isResubmitted: true`.

### 5.4 Collect Outstanding Payment (`PATCH /seller/sales/:id/payment`)
* **Request Payload:** `{ "mode": "CASH" }` or `{ "mode": "BANK", "paymentReference": "NEFT1928301" }`
* **Success Response (200 OK):** Updates sale payment mode to `CASH` or `BANK` and records `paidAt` timestamp.

### 5.5 Download Tax Invoice PDF (`GET /invoices/:id/pdf?download=true|false`)
* **Headers:** `Authorization: Bearer <token>`
* **Response:** Binary PDF stream (`Content-Type: application/pdf`).

---

## 6. Super Admin Price Approvals APIs

### 6.1 List Price Approvals Queue (`GET /admin/approvals`)
* **Query Parameters:** `page`, `pageSize`, `status` (`PENDING_APPROVAL`)
* **Behavior:** Returns pending sub-floor sales. Automatically sorted with **resubmitted/revised sales at the top of the queue**, highlighting revision history.
* **Response Item Schema (`PendingApprovalItem`):**
```json
{
  "id": "sale_9410-uuid",
  "saleNumber": "#SL-9410",
  "customerId": "cust_e738-uuid",
  "customer": { "shopName": "Gupta Medical Store", "ownerName": "Ramesh Gupta" },
  "seller": { "name": "Pooja Sharma", "phone": "+919876543210" },
  "totalAmountPaise": 52000,
  "packetCount": 20,
  "unitPricePaise": 2200,
  "requestedUnitPricePaise": 2200,
  "minimumPricePaise": 2500,
  "status": "PENDING_APPROVAL",
  "isResubmitted": true,
  "resubmittedAt": "2026-11-15T11:45:00.000Z",
  "customerFeedback": "Price Revised: Re-negotiated with owner for bulk trial",
  "createdAt": "2026-11-15T10:00:00.000Z"
}
```

### 6.2 Approve Low-Price Sale (`POST /admin/approvals/:id/approve`)
* **Request Payload:** `{ "notes": "Approved for rural expansion trial order" }`
* **Transactional Effects:**
  * Sale transitions to `CONFIRMED`.
  * Physical stock is deducted from the seller's inventory.
  * Commission is credited.
  * Invoice PDF is unlocked for download.

### 6.3 Reject Low-Price Sale (`POST /admin/approvals/:id/reject`)
* **Request Payload:** `{ "reason": "Price is below allowable margin of ₹23.00" }`
* **Transactional Effects:**
  * Sale transitions to `REJECTED`.
  * Zero stock is deducted; inventory remains unchanged.
  * Zero commission is awarded.
  * Seller is notified with the rejection reason.

---

## 7. Inventory & Warehouse Logistics APIs

### 7.1 National & Regional Warehouses (`GET /admin/warehouses`, `POST /admin/warehouses`)
* **Create Warehouse Payload:** `{ "name": "Indore Regional Depot", "code": "WH-IND-01", "state": "Madhya Pradesh", "district": "Indore", "type": "WAREHOUSE" }`

### 7.2 Inward Factory Stock Receipt (`POST /admin/inventory/receipts`)
* **Request Payload:**
```json
{
  "warehouseId": "wh_hq_central",
  "items": [
    { "productId": "prod_pad_regular_240mm", "quantity": 10000 },
    { "productId": "prod_pad_xl_280mm", "quantity": 5000 }
  ],
  "requestKey": "rcpt_1731671920_ab819"
}
```

### 7.3 Inter-Warehouse & Van Stock Transfer (`POST /admin/inventory/transfers`)
To prevent backend crashes and schema rejections, the client automatically resolves `sourceId` and `destinationId` to validated StockLocation UUIDs from `adminApi.getInventorySummary()`:
* **Request Payload:**
```json
{
  "sourceId": "loc_hq_central_uuid",
  "destinationId": "loc_seller_pooja_sharma_uuid",
  "items": [
    { "productId": "prod_pad_regular_240mm", "quantity": 200 }
  ],
  "requestKey": "trf_1731671950_xk918"
}
```

### 7.4 Inventory Transactions Ledger (`GET /seller/inventory/transactions`, `GET /admin/inventory/transactions`)
* **Query Parameters:** `page`, `pageSize`, `type` (`RECEIPT`, `TRANSFER_IN`, `TRANSFER_OUT`, `SALE_DEDUCTION`, `REVERT`)
* **Success Response (200 OK):** `{ items: StockTransactionItem[], pagination: PaginationMeta }`

---

## 8. Voice Feedback & Translation APIs

The application integrates real-time speech recognition for rural retail feedback, allowing field officers to speak naturally in **Hindi** or **Hinglish** and translating their observations into professional English for CRM logging.

### 8.1 Speech Translation (`POST /translate`)
* **Request Payload:**
```json
{
  "text": "Dukaan band thi owner gaon gaya hai, parso aane ko bola hai",
  "sourceLanguage": "hi",
  "targetLanguage": "en"
}
```
* **Success Response (200 OK):**
```json
{
  "translatedText": "The shop was closed as the owner has gone to his village; he requested a revisit the day after tomorrow.",
  "originalText": "Dukaan band thi owner gaon gaya hai, parso aane ko bola hai",
  "confidence": 0.98
}
```
* **Resilient Client Fallback Engine (`translateApi.ts`):**
  If the backend translation microservice is unavailable (HTTP 404/500/timeout), the client fallback engine engages instantly:
  * Translates common field retail phrases (Hindi/Hinglish keywords -> English).
  * Always preserves the exact spoken original transcript so observations are never lost.
  * Allows the user to review, edit, accept, or undo the translation before appending it to field notes.

---

## 9. Notification & Audit APIs

* **GET `/notifications`:** In-app inbox (`{ items: NotificationItem[], unreadCount: number }`).
* **PATCH `/notifications/:id/read`:** Mark single notification as read.
* **POST `/notifications/read-all`:** Mark all notifications as read.
* **GET `/admin/dashboard/filters`:** Returns valid multi-tier filter dropdowns (`states`, `districts`, `villages`, `managers`, `sellers`, `categories`).
