# API CONTRACTS

## 1. Contract Status

This document defines the mobile integration contract and identifies known existing endpoints from the audit catalog.

* Base URL currently catalogued: `https://femmeflo-inventory.onrender.com/api/v1`
* This URL must be verified for each environment.
* Existing endpoint shapes below are audit-derived, not freshly verified against a running backend.
* Proposed endpoints are explicitly marked `PROPOSED`.
* Do not implement proposed routes in the mobile client until the backend owner confirms their implementation.
* Use the exact existing field names and strict query schemas. Do not send unsupported parameters.

## 2. Common Request Rules

Headers:

```http
Accept: application/json
Content-Type: application/json
Authorization: Bearer <access_token>
X-Request-ID: <uuid>
```

For sale creation, after backend support is implemented:

```http
X-Idempotency-Key: <unique-uuid>
```

Rules:

* Omit `Authorization` for public authentication/recovery requests.
* Do not include tokens in URLs.
* Do not retry non-idempotent requests blindly.
* Use the backend's actual error format.
* Treat 401 as authentication/session failure.
* Treat 403 as an authorization failure unless the backend explicitly indicates token expiry.
* Treat 409 as a conflict where the API uses that status.
* Validate response payloads at the client boundary.
* Do not treat HTTP 200 alone as success if the response indicates business rejection.

## 3. Standard Error Shape

Target error contract for new or updated endpoints:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "requestId": "uuid",
    "fieldErrors": {
      "email": "A valid email is required."
    }
  }
}
```

Existing APIs may return a different shape. The API client must parse the existing shape until the backend contract is standardized.

Recommended error codes:

* `VALIDATION_ERROR`
* `UNAUTHENTICATED`
* `FORBIDDEN`
* `NOT_FOUND`
* `CONFLICT`
* `INSUFFICIENT_STOCK`
* `APPROVAL_REQUIRED`
* `IDEMPOTENCY_CONFLICT`
* `RATE_LIMITED`
* `SERVICE_UNAVAILABLE`
* `INTERNAL_ERROR`

## 4. Authentication

### POST `/auth/login` — Existing, verify shared role behavior

Request:

```json
{
  "identifier": "user@example.com",
  "password": "user-entered-password"
}
```

Catalogued response:

```json
{
  "token": "jwt-access-token",
  "user": {
    "id": "uuid",
    "name": "Example User",
    "email": "user@example.com",
    "role": "SELLER"
  }
}
```

Requirements:

* Do not persist the password.
* Store the token securely.
* Validate the returned role.
* Do not assume the response includes a refresh token.

### POST `/seller/auth/login` — Existing, verify exact response

Request:

```json
{
  "identifier": "user@example.com",
  "password": "user-entered-password"
}
```

Response shape is catalogued as token plus public user. Confirm whether this endpoint is still required or whether `/auth/login` supports all roles.

### POST `/manager/auth/login` — Existing, verify exact response

Same request structure as the role-specific login endpoint.

### POST `/admin/auth/login` — Existing, verify exact response

Same request structure as the role-specific login endpoint.

### GET `/auth/me` — Existing

Request:

* Bearer token required.

Catalogued response:

```json
{
  "user": {
    "id": "uuid",
    "name": "Example User",
    "email": "user@example.com",
    "role": "SELLER"
  }
}
```

The actual `PublicUser` fields must be taken from the backend type/schema.

### PATCH `/auth/password` — Existing

Request:

```json
{
  "currentPassword": "current-password",
  "newPassword": "new-password"
}
```

Response:

* Existing catalog reports a generic record response.
* Verify exact success and error shapes.

### POST `/auth/forgot-password` — Existing

Catalogued request:

```json
{
  "emailOrPhone": "user@example.com"
}
```

Response:

```json
{
  "success": true,
  "message": "If the account exists, recovery instructions will be sent."
}
```

Verify exact delivery behavior and non-enumerating response semantics.

### POST `/auth/reset-password` — Existing

Request:

```json
{
  "token": "password-reset-token",
  "newPassword": "new-password"
}
```

Response:

```json
{
  "success": true,
  "message": "Password updated."
}
```

### GET `/health` and GET `/ready` — Existing

Use for service health checks where supported. Do not interpret a health response as proof that all business dependencies are available.

## 5. Seller APIs

### GET `/seller/dashboard` — Existing

Response: `SellerDashboardData`.

The exact fields and metric definitions must be sourced from the backend types/schema.

### GET `/seller/customers` — Existing

Supported query parameters catalogued:

* `page`
* `pageSize`
* `search`
* `active`

Example:

```http
GET /seller/customers?page=1&pageSize=20&search=example&active=true
```

Response:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 0,
    "totalPages": 0
  }
}
```

Pagination property names must match the actual backend response.

### POST `/seller/customers` — Existing

The exact `CreateCustomerPayload` must be taken from the backend schema. Target business requirements include required email, backend category ID, optional photo reference/upload, and optional reviewed location fields.

Illustrative payload only; field names must be verified:

```json
{
  "name": "Customer Name",
  "email": "customer@example.com",
  "phone": "+919876543210",
  "categoryId": "category-uuid",
  "address": {
    "line1": "Address line",
    "village": "Example Village",
    "district": "Example District",
    "state": "Maharashtra",
    "postalCode": "400001"
  },
  "location": {
    "latitude": 19.076,
    "longitude": 72.8777,
    "accuracyMeters": 20
  },
  "photoAssetId": null
}
```

Do not send this exact nested structure unless the backend accepts it.

### GET `/seller/products` — Existing

Response:

```json
{
  "items": []
}
```

Use the actual `ProductItem` schema.

### GET `/seller/sales` — Existing

Supported parameters catalogued:

* `page`
* `pageSize`
* `startDate`

Additional filters must not be sent unless confirmed by the backend.

Response: paginated `SaleItem` collection.

### POST `/seller/sales` — Existing; idempotency support must be verified or added

Target request shape:

```json
{
  "customerId": "customer-uuid",
  "items": [
    {
      "productId": "product-uuid",
      "quantity": 2,
      "unitPricePaise": 2500
    }
  ],
  "paymentMode": "CASH"
}
```

This is a target example, not a verified payload. Use the actual `CreateMultiProductSalePayload`.

Target response:

```json
{
  "sale": {
    "id": "sale-uuid",
    "status": "PENDING_APPROVAL",
    "totalPaise": 5000
  }
}
```

Requirements:

* Validate all totals on the backend.
* Enforce minimum-price rules server-side.
* Support a unique idempotency key or equivalent reconciliation mechanism.
* Return the existing result for a repeated request using the same key and payload.
* Reject reuse of the same key with a different payload.
* A pending approval must not deduct stock or create a final invoice.

### POST `/seller/sales/:id/collect-payment` — Existing; payment semantics unresolved

Catalogued request:

```json
{
  "amountPaise": 5000,
  "paymentMode": "CASH",
  "referenceId": "optional-reference"
}
```

Do not implement this as a partial-payment feature. Before use, reconcile the endpoint's amount-based semantics with the approved rule of Cash, Bank, or Pending and no partial payments.

### GET `/seller/inventory` — Existing

Catalogued response:

```json
{
  "items": [],
  "vanStock": {}
}
```

Use actual `StockTransactionItem` and `vanStock` types.

## 6. Category and Location APIs

### GET `/categories` — Existing

Catalogued query parameters:

* `search`
* `active`

Do not send `page` or `pageSize` unless the backend contract changes; the audit warns that unsupported parameters may be rejected.

Response:

```json
{
  "items": [
    {
      "id": "category-uuid",
      "name": "Example Category",
      "isActive": true
    }
  ]
}
```

Field names must match the actual `Category` schema.

### POST `/admin/categories` — Existing

Catalogued request:

```json
{
  "name": "New Category"
}
```

The audit reports that the strict schema rejects `description` and `active`. Category editing and activation/deactivation endpoints are not sufficiently catalogued.

### GET `/geo/lookup?address=...` — Existing

Use the exact query parameter and response shape. URL-encode the address.

### GET `/geo/reverse?latitude=...&longitude=...` — Existing

Use the exact query parameters. Native reverse geocoding may replace this only if the business accepts the resulting data and backend requirements are satisfied.

## 7. Super Admin APIs

### GET `/admin/dashboard` — Existing

Catalogued filters may include:

* `state`
* `district`
* `village`
* `managerId`
* `sellerId`
* `categoryId`

Use only filters confirmed in the deployed schema.

### GET `/admin/managers` — Existing

Catalogued query parameters:

* `page`
* `pageSize`
* `search`
* `active`
* Additional geographic filters where supported.

Response: paginated `ManagerItem` records.

### POST `/admin/managers` — Existing

The audit catalogs a `CreateManagerPayload` containing name, phone, email, geographic fields, and password. Use the actual backend type and validation rules.

### GET `/admin/sellers` — Existing

Catalogued filters include:

* `page`
* `pageSize`
* `search`
* `managerId`
* `active`
* Geographic filters where supported.

### POST `/admin/sellers` — Existing

Use the verified `CreateSellerPayload`.

### GET `/admin/customers` — Existing

Catalogued filters include:

* `page`
* `pageSize`
* `search`
* `categoryId`
* `sellerId`
* `managerId`
* Geographic filters where supported.

### POST `/admin/customers` — Existing

Use the verified `CreateCustomerPayload`. Email is required by the approved product requirement even if the existing schema currently treats it as optional.

### GET `/admin/sales` — Existing

Catalogued filters include:

* `page`
* `pageSize`
* `search`
* `sellerId`
* `managerId`
* `startDate`
* `endDate`

### GET `/admin/sales/:id/invoice?format=pdf` — Existing

Response:

* PDF binary, not JSON.

Requirements:

* Handle the response as binary.
* Confirm authorization for the requested sale.
* Confirm only confirmed sales can produce final invoices.
* Use an app-controlled file location and native sharing APIs.

### GET `/admin/approvals` — Existing

Catalogued query parameters:

* `status`
* `page`

Catalogued response:

```json
{
  "pendingSales": []
}
```

Confirm whether pagination metadata and other statuses are returned.

### POST `/admin/approvals/:id/approve` — Existing

Catalogued request:

```json
{
  "notes": "Optional approval note"
}
```

Response:

```json
{
  "success": true
}
```

The backend must enforce authorization, current state, stock availability, price rules, and idempotent transition behavior.

### POST `/admin/approvals/:id/reject` — Existing

Request:

```json
{
  "reason": "Required rejection reason"
}
```

Response:

```json
{
  "success": true
}
```

The backend must preserve the rejected record and prevent stock/incentive/final-invoice effects.

### GET `/admin/inventory` — Existing

Catalogued query parameters:

* `warehouseId`
* `productId`
* `lowStock`

Response: `InventorySummaryData`.

### POST `/admin/inventory/receipt` — Existing

Use the actual `StockReceiptMultiPayload` or other verified payload type. Do not infer field names from the route name.

### POST `/admin/inventory/transfer` — Existing

Use the actual `StockTransferMultiPayload` or other verified payload type. The backend must atomically validate source stock and destination permissions.

### GET `/admin/permissions/:id` — Existing

Response:

```json
{
  "permissions": []
}
```

### PATCH `/admin/permissions/:id` — Existing

Request:

```json
{
  "permissions": ["permission.key"]
}
```

Use only registered permission keys and enforce the caller's authority server-side.

## 8. Manager APIs — Contract Gap

The audit does not provide a complete Manager-specific API contract.

Do not assume that a Manager can safely reuse a Super Admin endpoint.

Before implementing Manager operations, verify or define:

* Dashboard and permitted filters.
* Team/Seller list and detail.
* Authorized customer list and detail.
* Sales list and detail.
* Approval list and decision endpoints, if authorized.
* Inventory list and movement visibility.
* Incentive summaries.
* Reports.
* Notification inbox and read-state mutation.

Each endpoint must enforce Manager scope server-side.

## 9. Proposed API Additions

These endpoints are proposals, not existing verified routes.

### POST `/seller/sales` — Add idempotency support

Header:

```http
X-Idempotency-Key: <uuid>
```

Behavior:

* Same actor + same key + same request hash returns the original result.
* Same actor + same key + different request hash returns `409 IDEMPOTENCY_CONFLICT`.
* A timeout can be reconciled without creating a second sale.

### GET `/sales/:id` — PROPOSED if no equivalent exists

Purpose:

* Retrieve the authoritative status of a sale after an uncertain response.
* Enforce ownership/territory authorization.
* Return current sale status and relevant transaction references.

### GET `/notifications` — PROPOSED if no equivalent exists

Target query:

* `page`
* `pageSize`
* `unreadOnly`

Target response:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 0,
    "totalPages": 0
  }
}
```

### PATCH `/notifications/:id/read` — PROPOSED if no equivalent exists

Target response:

```json
{
  "success": true
}
```

### GET `/seller/incentives` — PROPOSED if no equivalent exists

Purpose:

* Return Seller-authorized incentive records with the applied rate and calculation context.

### GET `/admin/incentives` — Existing route catalogued; exact contract required

The audit lists this route with month/year/role filters but does not provide a complete request/response schema.

### POST/PATCH `/admin/categories` — PROPOSED lifecycle support

Define create/edit/activate/deactivate contracts only if existing routes do not support these operations.

### Minimum price configuration — PROPOSED until actual endpoint is found

Define an authenticated Super Admin endpoint with:

* Validated monetary value.
* Currency and unit semantics.
* Effective timestamp.
* Audit history.
* Server-side enforcement by the sale endpoint.

### Invoice email status — PROPOSED if no existing mechanism exists

Provide a way to inspect delivery state and retry failures without regenerating duplicate invoices.

## 10. API Contract Test Requirements

* Login for all roles.
* Role mismatch rejection.
* Expired token behavior.
* Forbidden cross-Seller access.
* Forbidden cross-territory Manager access.
* Required customer email validation.
* Category query strictness.
* Below-minimum-price enforcement.
* Pending sale side-effect invariants.
* Duplicate idempotency key behavior.
* Concurrent stock confirmation.
* Payment enum enforcement and no-partial-payment behavior.
* Historical incentive snapshot behavior.
* Invoice eligibility and email retry behavior.
* Shared notification persistence.
* Binary PDF download and authorization.
