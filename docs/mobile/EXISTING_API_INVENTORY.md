# EXISTING API INVENTORY & BACKEND CONTRACTS

**Baseline API Base URL:** `https://femmeflo-inventory.onrender.com/api/v1`  
**Authentication Scheme:** `Authorization: Bearer <jwt_access_token>`  
**Client Environment Switches:** `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_USE_MOCK_API`  
**Status Key:**
* `VERIFIED_EXISTING`: Fully verified and active in mobile production implementation.
* `PARTIALLY_IMPLEMENTED`: Endpoint exists with platform-specific client handling (e.g., multipart binary uploads, PDF streaming, speech fallback).
* `EXCLUDED`: Web-only routes intentionally excluded from the mobile application.

---

## 1. System & Authentication Endpoints

| Endpoint | Method | Role | Status | Description & Payload | Response Schema |
| :--- | :---: | :---: | :---: | :--- | :--- |
| `/health` | GET | Public | `VERIFIED_EXISTING` | Service health verification. | `{ success: boolean, message: string, data: { status: string, database: string } }` |
| `/ready` | GET | Public | `VERIFIED_EXISTING` | Database connectivity readiness probe. | `{ success: boolean, message: string, data: { database: string } }` |
| `/auth/login` | POST | Public | `VERIFIED_EXISTING` | Unified authentication with role hint.<br>`{ identifier, password, roleHint? }` | `{ token: string, user: PublicUser }` |
| `/seller/auth/login` | POST | Public | `VERIFIED_EXISTING` | Seller-specific login route. | `{ token: string, user: PublicUser }` |
| `/manager/auth/login` | POST | Public | `VERIFIED_EXISTING` | Manager-specific login route. | `{ token: string, user: PublicUser }` |
| `/admin/auth/login` | POST | Public | `VERIFIED_EXISTING` | Super Admin-specific login route. | `{ token: string, user: PublicUser }` |
| `/auth/me` | GET | Any Auth | `VERIFIED_EXISTING` | Fetch current session user with dual-role flags (`isSeller`). | `{ user: PublicUser }` |
| `/auth/password` | PATCH | Any Auth | `VERIFIED_EXISTING` | Change user password.<br>`{ currentPassword, newPassword }` | `{ success: boolean, message: string }` |
| `/auth/forgot-password` | POST | Public | `VERIFIED_EXISTING` | Request password reset token.<br>`{ identifier }` | `{ success: boolean, message: string }` |
| `/auth/reset-password` | POST | Public | `VERIFIED_EXISTING` | Execute password reset.<br>`{ token, newPassword }` | `{ success: boolean, message: string }` |

---

## 2. Field Seller Endpoints (`/seller/*`)

| Endpoint | Method | Role | Status | Description & Payload | Response Schema |
| :--- | :---: | :---: | :---: | :--- | :--- |
| `/seller/dashboard` | GET | Seller | `VERIFIED_EXISTING` | Today's sales (paise & packets), stock remaining, active shift, pending approvals. | `{ todaySalesPaise, stockBalance, activeShift, metrics, recentSales }` |
| `/seller/customers` | GET | Seller | `VERIFIED_EXISTING` | Paginated assigned customers.<br>Params: `page, pageSize, search, categoryId, active, state, district` | `{ items: CustomerItem[], pagination: PaginationMeta }` |
| `/seller/customers/{id}` | GET | Seller | `VERIFIED_EXISTING` | Single customer details and storefront photo. | `{ customer: CustomerItem }` |
| `/seller/customers` | POST | Seller | `VERIFIED_EXISTING` | Onboard customer via 4-card structure (GPS, photo, details, address).<br>`CreateCustomerPayload` | `{ customer: CustomerItem }` |
| `/seller/customers/{id}/photo` | POST | Seller | `VERIFIED_EXISTING` | Upload storefront photo (Multipart Form-Data: `photo`). | `{ photoUrl: string }` |
| `/seller/customers/pincode/{pincode}` | GET | Seller | `VERIFIED_EXISTING` | Auto-populate State, District, and Village list from 6-digit PIN code. | `PincodeLookupResponse` |
| `/seller/customers/bulk` | POST | Seller | `VERIFIED_EXISTING` | Upload batch customers in CSV/table format. | `BulkCustomerResponse` |
| `/seller/products` | GET | Seller | `VERIFIED_EXISTING` | Product catalog with base and minimum price floors. | `{ items: ProductItem[] }` |
| `/seller/inventory` | GET | Seller | `VERIFIED_EXISTING` | Van inventory balance per SKU (assigned, sold, remaining). | `SellerInventoryData` |
| `/seller/inventory/transactions` | GET | Seller | `VERIFIED_EXISTING` | Inward receipts and transfer transaction ledger. | `{ items: StockTransactionItem[], pagination }` |
| `/seller/sales` | POST | Seller | `VERIFIED_EXISTING` | Create POS sale (decoupled direct sale supported; idempotency header `X-Idempotency-Key`). | `{ sale: SaleItem }` |
| `/seller/sales` | GET | Seller | `VERIFIED_EXISTING` | Sales ledger with status filter (`CONFIRMED`, `PENDING_APPROVAL`, `REJECTED`). | `{ items: SaleItem[], pagination }` |
| `/seller/sales/{id}` | GET | Seller | `VERIFIED_EXISTING` | Single sale detail, line items, and invoice status. | `{ sale: SaleItem }` |
| `/seller/sales/{id}` | PATCH | Seller | `VERIFIED_EXISTING` | Revise unit price and resubmit rejected sale for approval.<br>`UpdateSalePayload` | `{ sale: SaleItem }` |
| `/seller/sales/{id}/payment` | PATCH | Seller | `VERIFIED_EXISTING` | Collect outstanding payment.<br>`{ mode: "CASH" \| "BANK", paymentReference? }` | `{ sale: SaleItem }` |
| `/invoices/{id}/pdf` | GET | Any Auth | `VERIFIED_EXISTING` | Stream tax invoice PDF (Bearer token authenticated). | Binary PDF stream |
| `/seller/shifts/current` | GET | Seller | `VERIFIED_EXISTING` | Retrieve current active duty shift. | `{ shift: Shift \| null }` |
| `/seller/shifts/start` | POST | Seller | `VERIFIED_EXISTING` | Start shift with fingerprint/biometric auth, starting KM, and GPS.<br>`StartShiftPayload` | `{ shift: Shift }` |
| `/seller/shifts/check-in` | POST | Seller | `VERIFIED_EXISTING` | Check in at retail store location with GPS.<br>`CheckInPayload` | `{ visit: ShiftVisit }` |
| `/seller/shifts/check-out` | POST | Seller | `VERIFIED_EXISTING` | Check out of retail store with customer feedback and voice notes.<br>`CheckOutPayload` | `{ visit: ShiftVisit }` |
| `/seller/shifts/end` | POST | Seller | `VERIFIED_EXISTING` | End shift with biometric auth, ending KM, and summary.<br>`EndShiftPayload` | `{ shift: Shift }` |
| `/seller/shifts/history` | GET | Seller | `VERIFIED_EXISTING` | Attendance logs and historical shift routes. | `{ items: Shift[], pagination }` |
| `/seller/incentives` | GET | Seller | `VERIFIED_EXISTING` | Monthly earned commission, packet counts, and payout status. | `SellerIncentiveData` |
| `/seller/profile` | PATCH | Seller | `VERIFIED_EXISTING` | Update profile information. | `{ user: PublicUser }` |

---

## 3. Territory Manager Endpoints (`/manager/*`)

| Endpoint | Method | Role | Status | Description & Payload | Response Schema |
| :--- | :---: | :---: | :---: | :--- | :--- |
| `/manager/dashboard` | GET | Manager | `VERIFIED_EXISTING` | Territory KPI metrics, active field officers, monthly revenue. | `ManagerDashboardData` |
| `/manager/sellers` | GET | Manager | `VERIFIED_EXISTING` | List supervised field officers with activity status. | `{ items: ManagerSellerItem[], pagination }` |
| `/manager/sellers/{id}` | GET | Manager | `VERIFIED_EXISTING` | Detailed performance record for supervised seller. | `{ seller: ManagerSellerItem }` |
| `/manager/sellers` | POST | Manager | `VERIFIED_EXISTING` | Onboard new field officer in assigned territory. | `{ seller: ManagerSellerItem }` |
| `/manager/sellers/{id}` | PATCH | Manager | `VERIFIED_EXISTING` | Update seller territory parameters or active status. | `{ seller: ManagerSellerItem }` |
| `/manager/customers` | GET | Manager | `VERIFIED_EXISTING` | Territory retail stores across all assigned sellers. | `{ items: CustomerItem[], pagination }` |
| `/manager/customers/{id}` | GET | Manager | `VERIFIED_EXISTING` | Territory customer profile. | `{ customer: CustomerItem }` |
| `/manager/customers` | POST | Manager | `VERIFIED_EXISTING` | Onboard customer directly under a territory seller. | `{ customer: CustomerItem }` |
| `/manager/customers/{id}/photo` | POST | Manager | `VERIFIED_EXISTING` | Upload storefront photo for territory customer. | `{ photoUrl: string }` |
| `/manager/customers/bulk` | POST | Manager | `VERIFIED_EXISTING` | Bulk customer upload in territory. | `BulkCustomerResponse` |
| `/manager/sales` | GET | Manager | `VERIFIED_EXISTING` | Territory sales orders stream (falls back to `/seller/sales` for dual-role field sales). | `{ items: SaleItem[], pagination }` |
| `/manager/sales/{id}` | PATCH | Manager | `VERIFIED_EXISTING` | Revise order details or price. | `{ sale: SaleItem }` |
| `/manager/inventory` | GET | Manager | `VERIFIED_EXISTING` | Territory inventory balances across supervised sellers. | `ManagerInventoryData` |
| `/manager/shifts` | GET | Manager | `VERIFIED_EXISTING` | Real-time shift tracking for territory sellers. | `{ items: Shift[], pagination }` |
| `/manager/incentives` | GET | Manager | `VERIFIED_EXISTING` | Territory team commission summaries. | `ManagerIncentiveData` |
| `/manager/products` | GET | Manager | `VERIFIED_EXISTING` | Product catalog with territory pricing. | `{ items: ProductItem[] }` |
| `/manager/profile` | PATCH | Manager | `VERIFIED_EXISTING` | Update manager contact information. | `{ user: PublicUser }` |

---

## 4. Super Administrator Endpoints (`/admin/*`)

| Endpoint | Method | Role | Status | Description & Payload | Response Schema |
| :--- | :---: | :---: | :---: | :--- | :--- |
| `/admin/dashboard` | GET | Admin | `VERIFIED_EXISTING` | National executive dashboard (revenue, volume, stock, sellers). | `AdminDashboardData` |
| `/admin/dashboard/filters` | GET | Admin | `VERIFIED_EXISTING` | Master dropdown filters (States, Districts, Villages, Managers, Sellers). | Multi-tier filter object |
| `/admin/approvals` | GET | Admin | `VERIFIED_EXISTING` | Sub-floor price approvals queue (resubmitted sales prioritized). | `{ items: PendingApprovalItem[], pagination }` |
| `/admin/approvals/{id}/approve` | POST | Admin | `VERIFIED_EXISTING` | Authorize low-price sale (confirms sale, deducts stock, issues invoice). | `{ sale: SaleItem }` |
| `/admin/approvals/{id}/reject` | POST | Admin | `VERIFIED_EXISTING` | Reject low-price sale (zero stock deducted, zero commission). | `{ sale: SaleItem }` |
| `/admin/inventory` | GET | Admin | `VERIFIED_EXISTING` | National inventory valuation and location balances. | `InventorySummaryData` |
| `/admin/inventory/receipts` | POST | Admin | `VERIFIED_EXISTING` | Record inward factory stock receipt to HQ warehouse. | `{ success: boolean, message?: string }` |
| `/admin/inventory/transfers` | POST | Admin | `VERIFIED_EXISTING` | Dispatch stock transfer (resolves valid source & destination UUIDs). | `{ success: boolean, message?: string }` |
| `/admin/inventory/transactions` | GET | Admin | `VERIFIED_EXISTING` | National stock movement audit ledger. | `{ items: AdminInventoryTransactionItem[], pagination }` |
| `/admin/warehouses` | GET | Admin | `VERIFIED_EXISTING` | List central HQ and regional warehouse depots. | `{ items: WarehouseItem[] }` |
| `/admin/warehouses` | POST | Admin | `VERIFIED_EXISTING` | Create new regional warehouse depot. | `{ success: boolean, warehouse: WarehouseItem }` |
| `/admin/managers` | GET | Admin | `VERIFIED_EXISTING` | Directory of territory managers with team counts. | `{ items: PublicUser[], pagination }` |
| `/admin/managers` | POST | Admin | `VERIFIED_EXISTING` | Create manager with territory & permissions.<br>`CreateManagerPayload` | `{ manager: PublicUser }` |
| `/admin/managers/{id}` | PATCH | Admin | `VERIFIED_EXISTING` | Update manager territory assignments or active status. | `{ manager: PublicUser }` |
| `/admin/sellers` | GET | Admin | `VERIFIED_EXISTING` | Nationwide directory of field sellers. | `{ items: PublicUser[], pagination }` |
| `/admin/sellers` | POST | Admin | `VERIFIED_EXISTING` | Create field seller with dynamic manager assignment. | `{ seller: PublicUser }` |
| `/admin/sellers/{id}` | PATCH | Admin | `VERIFIED_EXISTING` | Update seller record or targets. | `{ seller: PublicUser }` |
| `/admin/customers` | GET | Admin | `VERIFIED_EXISTING` | Master retail customer database nationwide. | `{ items: CustomerItem[], pagination }` |
| `/admin/customers` | POST | Admin | `VERIFIED_EXISTING` | Create customer record with mandatory email and GPS. | `{ customer: CustomerItem }` |
| `/admin/customers/{id}/photo` | POST | Admin | `VERIFIED_EXISTING` | Upload storefront photo. | `{ photoUrl: string }` |
| `/admin/customers/bulk` | POST | Admin | `VERIFIED_EXISTING` | Master bulk customer ingestion. | `BulkCustomerResponse` |
| `/admin/products` | GET | Admin | `VERIFIED_EXISTING` | Master SKU catalog with pricing floors. | `{ items: ProductItem[] }` |
| `/admin/products` | POST | Admin | `VERIFIED_EXISTING` | Create SKU with base price and minimum allowable price. | `{ product: ProductItem }` |
| `/admin/products/{id}` | PATCH | Admin | `VERIFIED_EXISTING` | Update SKU pricing or active flag. | `{ product: ProductItem }` |
| `/admin/sales` | GET | Admin | `VERIFIED_EXISTING` | Nationwide sales ledger with multi-tier filters. | `{ items: SaleItem[], pagination }` |
| `/admin/shifts` | GET | Admin | `VERIFIED_EXISTING` | Master shift tracking and attendance audit. | `{ items: Shift[], pagination }` |
| `/admin/incentives` | GET | Admin | `VERIFIED_EXISTING` | National commission ledger and employee totals. | `AdminIncentiveListResponse` |
| `/admin/incentives/payouts` | POST | Admin | `VERIFIED_EXISTING` | Record commission payout.<br>`CreatePayoutPayload` | `{ success: boolean }` |
| `/admin/reports/sales` | GET | Admin | `VERIFIED_EXISTING` | Aggregated revenue trends and geographic performance. | `SalesReportData` |

---

## 5. Voice Feedback, Categories & Notification Endpoints

| Endpoint | Method | Role | Status | Description & Payload | Response Schema |
| :--- | :---: | :---: | :---: | :--- | :--- |
| `/translate` | POST | Any Auth | `PARTIALLY_IMPLEMENTED` | Server-side translation of spoken Hindi/Hinglish to English.<br>`{ text, sourceLanguage?, targetLanguage? }` | `{ translatedText: string, originalText: string, confidence: number }` (Engages client fallback engine on 404/500/timeout) |
| `/categories` | GET | Any Auth | `VERIFIED_EXISTING` | List customer trade categories (Retailer, Chemist, General Store, etc.). | `{ items: CategoryItem[] }` |
| `/admin/categories` | POST | Admin | `VERIFIED_EXISTING` | Create trade category.<br>`{ name: string }` | `{ category: CategoryItem }` |
| `/notifications` | GET | Any Auth | `VERIFIED_EXISTING` | In-app notification center inbox. | `{ items: NotificationItem[] }` |
| `/notifications/{id}/read` | PATCH | Any Auth | `VERIFIED_EXISTING` | Mark single notification as read. | `{ success: boolean }` |
| `/notifications/read-all` | POST | Any Auth | `VERIFIED_EXISTING` | Mark all notifications as read. | `{ success: boolean }` |

---

## 6. Endpoints Excluded from Mobile App
* `/api/contact` — Web-only nodemailer SMTP enquiry handler.
* `/api/chat` — Web-only customer enquiry proxy.
