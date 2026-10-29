# EXISTING API INVENTORY & BACKEND CONTRACTS

**Baseline API Base URL:** `https://femmeflo-inventory.onrender.com/api/v1`  
**Authentication Scheme:** `Authorization: Bearer <jwt_access_token>`  
**Status Key:**
* `VERIFIED_EXISTING`: Endpoint verified in active website implementation and active backend routes.
* `PARTIALLY_IMPLEMENTED`: Endpoint exists but has platform-specific variations (e.g. file upload or PDF download).
* `NEEDS_VERIFICATION`: Documented in PRD/audit but requires verification against live runtime.
* `MISSING`: Not present on backend.
* `BLOCKED`: Blocked by unresolved requirement or infrastructure.

---

## 1. System & Authentication Endpoints

| Endpoint | Method | Role | Status | Description & Payload | Response Schema |
| :--- | :---: | :---: | :---: | :--- | :--- |
| `/health` | GET | Public | `VERIFIED_EXISTING` | Health verification. No body. | `{ success: boolean, message: string, data: { status: string, database: string } }` |
| `/ready` | GET | Public | `VERIFIED_EXISTING` | Database connectivity check. No body. | `{ success: boolean, message: string, data: { database: string } }` |
| `/auth/login` | POST | Public | `VERIFIED_EXISTING` | Unified authentication.<br>`{ identifier, password }` | `{ success: boolean, data: { token: string, user: PublicUser } }` |
| `/admin/auth/login` | POST | Public | `VERIFIED_EXISTING` | Role-specific Super Admin login context.<br>`{ identifier, password }` | `{ success: boolean, data: { token: string, user: PublicUser } }` |
| `/manager/auth/login` | POST | Public | `VERIFIED_EXISTING` | Role-specific Manager login context.<br>`{ identifier, password }` | `{ success: boolean, data: { token: string, user: PublicUser } }` |
| `/seller/auth/login` | POST | Public | `VERIFIED_EXISTING` | Role-specific Seller login context.<br>`{ identifier, password }` | `{ success: boolean, data: { token: string, user: PublicUser } }` |
| `/auth/me` | GET | Any Auth | `VERIFIED_EXISTING` | Fetch current authenticated user record and role. | `{ success: boolean, data: { user: PublicUser } }` |
| `/auth/password` | PATCH | Any Auth | `VERIFIED_EXISTING` | Change user password.<br>`{ currentPassword, newPassword }` | `{ success: boolean, message: string }` |
| `/auth/forgot-password` | POST | Public | `VERIFIED_EXISTING` | Request password reset email.<br>`{ email }` | `{ success: boolean, message: string }` |
| `/auth/reset-password` | POST | Public | `VERIFIED_EXISTING` | Reset password using emailed token.<br>`{ token, newPassword }` | `{ success: boolean, message: string }` |

---

## 2. Seller Operations Endpoints (`/seller/*`)

| Endpoint | Method | Role | Status | Description & Payload | Response Schema |
| :--- | :---: | :---: | :---: | :--- | :--- |
| `/seller/dashboard` | GET | Seller | `VERIFIED_EXISTING` | Today's sales, stock remaining, active shift, pending approvals. | `{ success: boolean, data: SellerDashboardData }` |
| `/seller/customers` | GET | Seller | `VERIFIED_EXISTING` | List assigned customers with search & pagination.<br>Params: `page, pageSize, search, categoryId, active, state, district` | `{ success: boolean, data: { items: CustomerItem[], pagination: PaginationMeta } }` |
| `/seller/customers/{id}` | GET | Seller | `VERIFIED_EXISTING` | Get single customer detail. | `{ success: boolean, data: { customer: CustomerItem } }` |
| `/seller/customers` | POST | Seller | `VERIFIED_EXISTING` | Onboard new customer. Email required, location captured.<br>`{ shopName, ownerName, email, phone, categoryId, address, pincode, state, district, village, latitude, longitude }` | `{ success: boolean, data: { customer: CustomerItem } }` |
| `/seller/customers/{id}` | PATCH | Seller | `VERIFIED_EXISTING` | Update customer details. | `{ success: boolean, data: { customer: CustomerItem } }` |
| `/seller/customers/{id}/photo` | POST | Seller | `PARTIALLY_IMPLEMENTED` | Upload customer store photo (Multipart form-data: `photo`). | `{ success: boolean, data: { photoUrl: string } }` |
| `/seller/customers/pincode/{pincode}` | GET | Seller | `VERIFIED_EXISTING` | Auto-resolve Indian State, District, and Villages from Pincode. | `{ success: boolean, data: PincodeLookupResponse }` |
| `/seller/products` | GET | Seller | `VERIFIED_EXISTING` | List available products with base price and minimum allowable price. | `{ success: boolean, data: { items: ProductItem[] } }` |
| `/seller/inventory` | GET | Seller | `VERIFIED_EXISTING` | Personal/van inventory balance (assigned, sold, remaining packets per SKU). | `{ success: boolean, data: { balance: number, products: ProductStockItem[] } }` |
| `/seller/inventory/transactions` | GET | Seller | `VERIFIED_EXISTING` | Stock receipts and transfer history. | `{ success: boolean, data: { items: StockTransactionItem[], pagination } }` |
| `/seller/sales` | POST | Seller | `VERIFIED_EXISTING` | Create POS sale. Supports single or multi-line products.<br>`{ customerId, paymentMode, items: [{ productId, quantity, unitPricePaise }], paymentReference? }` | `{ success: boolean, data: { sale: SaleItem } }` |
| `/seller/sales` | GET | Seller | `VERIFIED_EXISTING` | List sale history with status filter (`PENDING`, `APPROVED`, `CONFIRMED`, `REJECTED`). | `{ success: boolean, data: { items: SaleItem[], pagination } }` |
| `/seller/sales/{id}` | GET | Seller | `VERIFIED_EXISTING` | Single sale order details with items and status history. | `{ success: boolean, data: { sale: SaleItem } }` |
| `/seller/sales/{id}/payment` | PATCH | Seller | `VERIFIED_EXISTING` | Collect outstanding payment for PENDING payment sale.<br>`{ paymentMode: "CASH" \| "BANK", paymentReference? }` | `{ success: boolean, data: { sale: SaleItem } }` |
| `/seller/incentives` | GET | Seller | `VERIFIED_EXISTING` | Current month incentive summary, confirmed commission, rate breakdown. | `{ success: boolean, data: SellerIncentiveData }` |
| `/seller/profile` | GET | Seller | `VERIFIED_EXISTING` | Seller profile and assigned manager details. | `{ success: boolean, data: { user: PublicUser } }` |
| `/seller/profile` | PATCH | Seller | `VERIFIED_EXISTING` | Update personal phone or display name. | `{ success: boolean, data: { user: PublicUser } }` |
| `/invoices/{id}/pdf` | GET | Seller / All | `PARTIALLY_IMPLEMENTED` | Download tax invoice PDF for confirmed sales. | PDF binary stream |
| `/seller/shifts/current` | GET | Seller | `VERIFIED_EXISTING` | Current active duty shift status. | `{ success: boolean, data: { shift: Shift \| null } }` |
| `/seller/shifts/start` | POST | Seller | `VERIFIED_EXISTING` | Start daily shift with GPS & start KM.<br>`{ startOdometerKm, startLatitude, startLongitude }` | `{ success: boolean, data: { shift: Shift } }` |
| `/seller/shifts/check-in` | POST | Seller | `VERIFIED_EXISTING` | Check in at retail customer location with GPS.<br>`{ customerId, latitude, longitude }` | `{ success: boolean, data: { visit: ShiftVisit } }` |
| `/seller/shifts/check-out` | POST | Seller | `VERIFIED_EXISTING` | Check out of retail customer location.<br>`{ visitId, summary?, orderPlaced? }` | `{ success: boolean, data: { visit: ShiftVisit } }` |
| `/seller/shifts/end` | POST | Seller | `VERIFIED_EXISTING` | End daily duty shift with end KM & summary.<br>`{ endOdometerKm, endLatitude, endLongitude, remarks? }` | `{ success: boolean, data: { shift: Shift } }` |
| `/seller/shifts/history` | GET | Seller | `VERIFIED_EXISTING` | Historical duty shifts and attendance logs. | `{ success: boolean, data: { items: Shift[], pagination } }` |

---

## 3. Manager Operations Endpoints (`/manager/*`)

| Endpoint | Method | Role | Status | Description & Payload | Response Schema |
| :--- | :---: | :---: | :---: | :--- | :--- |
| `/manager/dashboard` | GET | Manager | `VERIFIED_EXISTING` | Territory KPI summary, active sellers, monthly sales volume. | `{ success: boolean, data: ManagerDashboardData }` |
| `/manager/sellers` | GET | Manager | `VERIFIED_EXISTING` | List assigned sellers within territory with activity status. | `{ success: boolean, data: { items: SellerItem[], pagination } }` |
| `/manager/sellers/{id}` | GET | Manager | `VERIFIED_EXISTING` | Single seller detail and performance summary. | `{ success: boolean, data: { seller: SellerItem } }` |
| `/manager/sellers` | POST | Manager | `VERIFIED_EXISTING` | Onboard new seller in assigned territory.<br>`{ name, email, phone, state, district, village? }` | `{ success: boolean, data: { seller: SellerItem } }` |
| `/manager/sellers/{id}` | PATCH | Manager | `VERIFIED_EXISTING` | Update seller profile details or status. | `{ success: boolean, data: { seller: SellerItem } }` |
| `/manager/customers` | GET | Manager | `VERIFIED_EXISTING` | List territory customers across all assigned sellers. | `{ success: boolean, data: { items: CustomerItem[], pagination } }` |
| `/manager/customers/{id}` | GET | Manager | `VERIFIED_EXISTING` | View territory customer details. | `{ success: boolean, data: { customer: CustomerItem } }` |
| `/manager/customers` | POST | Manager | `VERIFIED_EXISTING` | Onboard new customer directly under territory seller. | `{ success: boolean, data: { customer: CustomerItem } }` |
| `/manager/customers/{id}` | PATCH | Manager | `VERIFIED_EXISTING` | Update territory customer record. | `{ success: boolean, data: { customer: CustomerItem } }` |
| `/manager/sales` | GET | Manager | `VERIFIED_EXISTING` | Territory sales orders stream with seller & customer filters. | `{ success: boolean, data: { items: SaleItem[], pagination } }` |
| `/manager/sales/{id}` | GET | Manager | `VERIFIED_EXISTING` | Get single territory sale order. | `{ success: boolean, data: { sale: SaleItem } }` |
| `/manager/inventory` | GET | Manager | `VERIFIED_EXISTING` | Territory inventory balances across assigned sellers and warehouses. | `{ success: boolean, data: { items: InventoryBalanceItem[] } }` |
| `/manager/shifts` | GET | Manager | `VERIFIED_EXISTING` | Live shift oversight for supervised sellers. | `{ success: boolean, data: { items: Shift[], pagination } }` |
| `/manager/incentives` | GET | Manager | `VERIFIED_EXISTING` | Territory incentive and commission totals. | `{ success: boolean, data: ManagerIncentiveData }` |
| `/manager/profile` | GET | Manager | `VERIFIED_EXISTING` | Manager profile and territory parameters. | `{ success: boolean, data: { user: PublicUser } }` |
| `/manager/profile` | PATCH | Manager | `VERIFIED_EXISTING` | Update manager contact information. | `{ success: boolean, data: { user: PublicUser } }` |

---

## 4. Super Admin Operations Endpoints (`/admin/*`)

| Endpoint | Method | Role | Status | Description & Payload | Response Schema |
| :--- | :---: | :---: | :---: | :--- | :--- |
| `/admin/dashboard` | GET | Admin | `VERIFIED_EXISTING` | National executive dashboard (sales, revenue, inventory, active sellers). | `{ success: boolean, data: AdminDashboardData }` |
| `/admin/dashboard/filters` | GET | Admin | `VERIFIED_EXISTING` | Available filter options (States, Districts, Managers, Sellers, Categories). | `{ success: boolean, data: DashboardFilterOptions }` |
| `/admin/managers` | GET | Admin | `VERIFIED_EXISTING` | List all territory managers with team counts and activity. | `{ success: boolean, data: { items: ManagerItem[], pagination } }` |
| `/admin/managers/{id}` | GET | Admin | `VERIFIED_EXISTING` | Single manager details with territory boundaries. | `{ success: boolean, data: { manager: ManagerItem } }` |
| `/admin/managers` | POST | Admin | `VERIFIED_EXISTING` | Create new territory manager with territory assignments. | `{ success: boolean, data: { manager: ManagerItem } }` |
| `/admin/managers/{id}` | PATCH | Admin | `VERIFIED_EXISTING` | Update manager details or active status. | `{ success: boolean, data: { manager: ManagerItem } }` |
| `/admin/sellers` | GET | Admin | `VERIFIED_EXISTING` | Master list of all field officers nationwide. | `{ success: boolean, data: { items: SellerItem[], pagination } }` |
| `/admin/sellers/{id}` | GET | Admin | `VERIFIED_EXISTING` | Detailed seller record with assigned manager and metrics. | `{ success: boolean, data: { seller: SellerItem } }` |
| `/admin/sellers` | POST | Admin | `VERIFIED_EXISTING` | Onboard field officer with manager assignment. | `{ success: boolean, data: { seller: SellerItem } }` |
| `/admin/sellers/{id}` | PATCH | Admin | `VERIFIED_EXISTING` | Update seller record, manager assignment, or status. | `{ success: boolean, data: { seller: SellerItem } }` |
| `/admin/customers` | GET | Admin | `VERIFIED_EXISTING` | Complete nationwide retail customer database. | `{ success: boolean, data: { items: CustomerItem[], pagination } }` |
| `/admin/customers/{id}` | GET | Admin | `VERIFIED_EXISTING` | Single customer master record. | `{ success: boolean, data: { customer: CustomerItem } }` |
| `/admin/products` | GET | Admin | `VERIFIED_EXISTING` | Master SKU catalog with pricing. | `{ success: boolean, data: { items: ProductItem[] } }` |
| `/admin/products` | POST | Admin | `VERIFIED_EXISTING` | Add SKU with base and minimum price.<br>`{ name, sku, basePricePaise, minimumPricePaise, description? }` | `{ success: boolean, data: { product: ProductItem } }` |
| `/admin/products/{id}` | PATCH | Admin | `VERIFIED_EXISTING` | Update SKU pricing or active status. | `{ success: boolean, data: { product: ProductItem } }` |
| `/admin/inventory/summary` | GET | Admin | `VERIFIED_EXISTING` | National inventory valuation, HQ stock, and transit balances. | `{ success: boolean, data: InventorySummaryData }` |
| `/admin/inventory/receipts` | POST | Admin | `VERIFIED_EXISTING` | Inward factory stock receipt to HQ warehouse.<br>`{ warehouseId, productId, quantity, batchNumber?, notes? }` | `{ success: boolean, data: StockReceiptResult }` |
| `/admin/inventory/transfers` | POST | Admin | `VERIFIED_EXISTING` | Dispatch stock transfer from HQ to Seller / Warehouse.<br>`{ sourceWarehouseId, targetLocationId, productId, quantity, reference? }` | `{ success: boolean, data: StockTransferResult }` |
| `/admin/inventory/transactions` | GET | Admin | `VERIFIED_EXISTING` | Audit ledger of all stock movements nationwide. | `{ success: boolean, data: { items: StockTransactionItem[], pagination } }` |
| `/admin/warehouses` | GET | Admin | `VERIFIED_EXISTING` | List regional and central warehouses. | `{ success: boolean, data: { items: WarehouseItem[] } }` |
| `/admin/warehouses` | POST | Admin | `VERIFIED_EXISTING` | Create warehouse facility.<br>`{ name, code, state, district, address }` | `{ success: boolean, data: { warehouse: WarehouseItem } }` |
| `/admin/settings` | GET | Admin | `VERIFIED_EXISTING` | Business settings (e.g., global minimum sale price in paise). | `{ success: boolean, data: BusinessSettings }` |
| `/admin/settings` | PATCH | Admin | `VERIFIED_EXISTING` | Update business settings.<br>`{ minimumSalePricePaise, lowStockThreshold? }` | `{ success: boolean, data: BusinessSettings }` |
| `/admin/approvals` | GET | Admin | `VERIFIED_EXISTING` | Pending below-minimum-price sales approval queue. | `{ success: boolean, data: { items: ApprovalItem[], pagination } }` |
| `/admin/approvals/{id}/approve` | POST | Admin | `VERIFIED_EXISTING` | Authorize below-minimum sale, confirming stock and invoice generation. | `{ success: boolean, data: { sale: SaleItem } }` |
| `/admin/approvals/{id}/reject` | POST | Admin | `VERIFIED_EXISTING` | Reject below-minimum sale without deducting stock. Retains history. | `{ success: boolean, data: { sale: SaleItem } }` |
| `/admin/sales` | GET | Admin | `VERIFIED_EXISTING` | Complete nationwide sales ledger. | `{ success: boolean, data: { items: SaleItem[], pagination } }` |
| `/admin/invoices` | GET | Admin | `VERIFIED_EXISTING` | Tax invoice archive with download links. | `{ success: boolean, data: { items: InvoiceItem[], pagination } }` |
| `/admin/incentives` | GET | Admin | `VERIFIED_EXISTING` | Seller incentive rates, payout ledger, and monthly totals. | `{ success: boolean, data: AdminIncentivesResponse }` |
| `/admin/incentives/settings` | PATCH | Admin | `VERIFIED_EXISTING` | Update seller-specific incentive rates.<br>`{ sellerId, ratePerPacketPaise, effectiveFrom }` | `{ success: boolean, message: string }` |
| `/admin/incentives/payouts` | POST | Admin | `VERIFIED_EXISTING` | Record commission payout.<br>`{ sellerId, amountPaise, reference, paidAt }` | `{ success: boolean, message: string }` |
| `/admin/reports/sales` | GET | Admin | `VERIFIED_EXISTING` | Aggregate revenue, trend analysis, and geographic performance. | `{ success: boolean, data: SalesReportData }` |
| `/admin/reports/inventory` | GET | Admin | `VERIFIED_EXISTING` | Inventory stock velocity and reorder alerts. | `{ success: boolean, data: InventoryReportData }` |
| `/admin/shifts` | GET | Admin | `VERIFIED_EXISTING` | Master shift tracking and attendance audit. | `{ success: boolean, data: { items: Shift[], pagination } }` |

---

## 5. Customer Categories & Notifications

| Endpoint | Method | Role | Status | Description & Payload | Response Schema |
| :--- | :---: | :---: | :---: | :--- | :--- |
| `/categories` | GET | Any Auth | `VERIFIED_EXISTING` | List customer categories (Retailer, Chemist, General Store, etc.). | `{ success: boolean, data: { items: CategoryItem[] } }` |
| `/categories` | POST | Admin | `VERIFIED_EXISTING` | Create category.<br>`{ name, description? }` | `{ success: boolean, data: { category: CategoryItem } }` |
| `/categories/{id}` | PATCH | Admin | `VERIFIED_EXISTING` | Update or deactivate category. | `{ success: boolean, data: { category: CategoryItem } }` |
| `/notifications` | GET | Any Auth | `VERIFIED_EXISTING` | In-app notification inbox. | `{ success: boolean, data: { items: NotificationItem[], unreadCount: number } }` |
| `/notifications/{id}/read` | PATCH | Any Auth | `VERIFIED_EXISTING` | Mark notification as read. | `{ success: boolean, message: string }` |
| `/notifications/read-all` | POST | Any Auth | `VERIFIED_EXISTING` | Mark all notifications as read. | `{ success: boolean, message: string }` |

---

## 6. Endpoints Excluded from Mobile App
* `/api/contact` (Web-only nodemailer SMTP enquiry handler).
* `/api/chat` (Web-only Mistral AI customer enquiry proxy).
