# SYSTEM ARCHITECTURE

## 1. Architecture Summary

The Android application is a native client of the existing FemmeFlo backend.

The mobile client must not connect directly to the production database or contain server-side secrets. All business operations must pass through authenticated backend APIs.

Target logical architecture:

```text
Android Device
└── Expo / React Native Application
    ├── Navigation and Role-Aware Screens
    ├── Form and Domain Validation
    ├── Query / Server-State Layer
    ├── API Client
    ├── Native Secure Storage
    ├── Location / Image / File Adapters
    └── Safe Mutation and Retry Layer
             |
             | HTTPS + Bearer JWT
             v
Existing FemmeFlo API
├── Authentication and Authorization
├── Customer Management
├── Product and Pricing
├── Sales and Approval
├── Inventory and Stock Ledger
├── Payment Tracking
├── Incentive Calculation
├── Invoice Generation and Email
├── Notification Persistence
└── Reporting and Administration
             |
             v
Existing Database and Integrations
```

The API implementation language, framework, database, and deployment topology must be confirmed from the actual backend repository. The mobile client must not assume that the proposed architecture is already implemented.

## 2. Architectural Boundaries

### Mobile client responsibilities

* Render the interface.
* Collect and validate user input for usability.
* Store the access token securely.
* Call authorized APIs.
* Handle pagination, loading, errors, and stale data.
* Request native permissions when required.
* Prevent accidental duplicate taps.
* Preserve safe form inputs after recoverable errors.
* Display server-authoritative results.

### Backend responsibilities

* Authenticate users.
* Enforce role and territory permissions.
* Validate all submitted payloads.
* Apply minimum-price rules.
* Manage sale approval transitions.
* Apply inventory changes transactionally.
* Enforce payment rules.
* Calculate and snapshot incentives.
* Generate final invoices.
* Trigger invoice email delivery.
* Persist and synchronize notifications.
* Maintain audit trails.
* Prevent duplicate financial transactions.

### Database responsibilities

* Persist authoritative business state.
* Enforce relational integrity.
* Enforce unique constraints where appropriate.
* Support transactional stock and sale operations.
* Preserve historical pricing and incentive calculations.
* Record immutable or append-only transaction history where appropriate.

## 3. Authentication Flow

1. User selects a role and enters credentials.
2. App calls the verified login endpoint.
3. Backend validates credentials and returns an access token and user representation.
4. App verifies that the server-returned role is compatible with the selected role.
5. App stores the token using secure storage.
6. App retrieves current user and permissions from the backend.
7. App initializes role-specific navigation and query state.
8. Requests include `Authorization: Bearer <token>`.
9. On 401, the app stops exposing protected data and requires re-authentication.
10. On 403, the app shows access denied without automatically treating every authorization error as an expired session.
11. Logout clears the token and sensitive local state. A server logout call is used only if a verified endpoint exists.

## 4. Customer Creation Flow

1. Open Add Customer.
2. Load active categories using the supported categories endpoint.
3. Request foreground location permission if location capture is appropriate.
4. Capture coordinates and resolve an address where supported.
5. Allow manual address correction.
6. Optionally select and compress a photo.
7. Validate required fields, including email.
8. Submit the payload according to the verified customer API schema.
9. Display server validation errors without clearing unrelated fields.
10. On success, update the customer list using the returned record.
11. On timeout, do not automatically resubmit if the outcome is uncertain; reconcile through a supported lookup or request identifier.

## 5. Sale and Approval Flow

### Normal sale

1. Load permitted products and authoritative pricing.
2. User selects customer, products, quantities, and approved payment mode.
3. Client validates input for usability.
4. Client submits the sale with a unique idempotency key if the backend supports it.
5. Backend validates identity, permissions, products, price, quantity, payment mode, and available stock.
6. Backend commits the sale and inventory effects atomically.
7. Backend snapshots the effective incentive rate.
8. Backend makes the confirmed sale eligible for final invoice generation and email.
9. App displays the returned status.
10. App refreshes relevant sale and inventory data.

### Below-minimum-price sale

1. Client submits the requested sale.
2. Backend validates the requested price against the configured minimum.
3. Backend records the sale as pending approval.
4. No stock is reserved or deducted.
5. No sold count is incremented.
6. No incentive is earned.
7. No final invoice is issued or emailed.
8. An authorized approver reviews the sale.
9. On approval, the backend rechecks stock and business rules.
10. The backend atomically confirms the sale and applies the required effects.
11. On rejection, the backend retains the record as rejected without stock deduction or incentive.
12. App refreshes status from the backend.

Approval, inventory, incentive, and invoice effects must not be implemented as independent client-side mutations.

## 6. Inventory Consistency

* Use an authoritative stock ledger and/or balances maintained by the backend.
* Every receipt, transfer, and confirmed sale must have a traceable transaction.
* Validate available stock inside the transaction that commits the sale or transfer.
* Protect against concurrent overselling.
* Pending approval records must not consume stock.
* A rejected sale must not create stock movements.
* Inventory balance and ledger updates must be atomic or have a verified reconciliation strategy.
* The mobile client must never calculate authoritative stock by subtracting local pending sales.

## 7. Network and State Management

* Use a centralized typed API client.
* Centralize base URL, authentication headers, timeouts, error parsing, and request IDs.
* Use a server-state library such as TanStack Query if compatible with the chosen Expo SDK and project dependencies.
* Keep form state separate from server cache.
* Invalidate or update affected queries after confirmed mutations.
* Debounce search.
* Use pagination instead of fetching entire datasets.
* Reuse cached reads only with explicit freshness rules.
* Do not retry non-idempotent mutations blindly.
* Retry only safe reads or operations proven idempotent.
* Treat timeout after a mutation as an unknown outcome until reconciled.
* Do not automatically replay offline mutations.

## 8. File and Image Handling

* Request photo access only when the user chooses to attach a photo.
* Prefer compressed, appropriately sized images.
* Upload only through a backend-supported authenticated contract.
* Store downloaded PDFs in an app-controlled location.
* Use native sharing only after a successful download.
* Avoid public, long-lived invoice URLs unless the backend explicitly secures them.
* Clean up temporary files where appropriate.

## 9. Notifications and Email

* Business notifications must be stored on the backend.
* Website and mobile clients must use the same notification source.
* Read/unread updates must persist server-side.
* Email delivery should be triggered by a confirmed sale through a backend-controlled mechanism.
* Email failure must be recoverable independently from the sale transaction.
* Do not send WhatsApp notifications.
* Push notification infrastructure is optional and separate from the required in-app inbox; add it only if explicitly approved.

## 10. Observability

Log:

* Request correlation ID.
* Endpoint and HTTP method.
* Duration.
* HTTP status.
* Safe error category.
* Retry/reconciliation outcome.
* App version and environment.

Never log:

* Passwords.
* Access tokens.
* Full sensitive customer payloads.
* Payment credentials.
* Private invoice contents.

## 11. Architecture Decision Records Required

Before production:

* ADR-001: Confirm existing backend stack and deployment.
* ADR-002: Confirm shared versus role-specific login endpoint.
* ADR-003: Define role and territory authorization matrix.
* ADR-004: Define sale approval and stock transaction boundary.
* ADR-005: Define idempotency and uncertain-outcome reconciliation.
* ADR-006: Reconcile payment modes with the existing collection endpoint.
* ADR-007: Define incentive effective dating and snapshots.
* ADR-008: Define invoice email retries and delivery status.
* ADR-009: Define persistent notification API and read-state synchronization.
* ADR-010: Confirm database schema and migration ownership.
