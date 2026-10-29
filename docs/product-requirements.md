# PRODUCT REQUIREMENTS DOCUMENT

## 1. Document Control

* Product: FemmeFlo Seller, Manager & Super Admin Management System
* Mobile platform: Android
* Mobile framework: React Native with Expo and TypeScript
* Existing web application: FemmeFlo website and operations portal
* Backend strategy: Reuse the existing backend wherever its contracts and behavior satisfy the requirements
* Initial distribution: Internal Android APK
* Interface language: English
* Operating mode: Online-only for business transactions
* Document status: Implementation baseline; backend-specific contracts require verification against source code

## 2. Product Objective

Build an Android application for Seller, Manager, and Super Admin operations that integrates with the existing FemmeFlo backend.

The application must support customer onboarding, sales, inventory movement, price approvals, payment tracking, seller incentives, invoices, notifications, reporting, and role-specific administration.

The mobile application must not create a separate source of truth for business data. The backend remains authoritative for users, roles, customers, stock, sales, approvals, payments, incentive calculations, invoices, and notifications.

## 3. User Roles

### 3.1 Seller

A Seller can:

* Sign in using email and password.
* View their dashboard and permitted sales metrics.
* View assigned customers.
* Search and paginate customer records.
* Create customers with a required email address.
* Select customer categories loaded from the backend.
* Capture foreground GPS location when adding a customer, where appropriate.
* Review, retry, and manually correct location information before submission.
* Attach an optional customer photo.
* View available products and applicable pricing.
* Create single-product or multi-product sales where supported by the backend.
* Submit below-minimum-price sales for approval.
* View their sales history and sale status.
* View their assigned inventory and stock movements.
* Record a permitted payment mode of Cash, Bank, or Pending.
* View their incentive records and applicable incentive rates.
* View or download invoices when authorized.
* View persistent in-app notifications.
* Change their password.

A Seller must not:

* Approve their own below-minimum-price sale.
* Bypass the server-configured minimum sale price.
* View or modify another Seller's protected records unless explicitly authorized.
* Directly adjust warehouse inventory.
* Change global pricing or incentive configuration.
* Mark a sale successful before the backend confirms it.

### 3.2 Manager

A Manager can:

* Sign in using email and password.
* View their authorized team and territory dashboard.
* View authorized Sellers and associated customer records.
* View permitted sales, inventory, approval, and performance information.
* Use search, filtering, and pagination.
* Review assigned operational records.
* Perform explicitly authorized approval and management actions.
* View permitted reports and incentive summaries.
* Receive and acknowledge in-app notifications.
* Change their password.

Manager permissions must be derived from the existing backend authorization model.

Until the backend permission matrix is verified, the mobile application must not assume that Managers can:

* Approve below-minimum-price sales.
* Change minimum sale prices.
* Create, deactivate, or reassign Sellers.
* Create or approve stock transfers.
* Change Seller incentive rates.
* Perform Super Admin operations.

These actions must remain unavailable to Managers unless the backend explicitly authorizes them.

### 3.3 Super Admin

A Super Admin can:

* Sign in using email and password.
* View the overall administrative dashboard.
* Filter permitted metrics by geography, Manager, Seller, category, and date where supported.
* Create, view, update, and deactivate Managers and Sellers according to backend capabilities.
* View and manage customer records.
* Manage product and category records according to supported APIs.
* Configure the minimum sale price.
* Review, approve, or reject pending price approvals.
* Manage headquarters and warehouse inventory.
* Record stock receipts and transfers.
* View inventory balances and transaction history.
* Manage Seller-specific incentive rates and review incentive records.
* View sales, payments, invoices, and reports.
* Manage supported permissions and notification functions.
* Change their password.

All administrative mutations must be validated and authorized by the backend.

## 4. Functional Requirements

### FR-AUTH: Authentication and Session Management

* FR-AUTH-001: Provide a shared mobile login entry with role selection.
* FR-AUTH-002: Authenticate using email and password.
* FR-AUTH-003: Verify that the server-returned role matches the selected role.
* FR-AUTH-004: Store the access token using native secure storage.
* FR-AUTH-005: Restore a valid session after application restart.
* FR-AUTH-006: Fetch the current user from the backend before exposing protected screens.
* FR-AUTH-007: Handle expired sessions without exposing protected data.
* FR-AUTH-008: Support password recovery and password changes using verified backend contracts.
* FR-AUTH-009: Clear role-specific caches and sensitive in-memory data on logout.
* FR-AUTH-010: Do not invent a refresh-token or server logout endpoint if the backend does not support it.

### FR-CUST: Customer Management

* FR-CUST-001: List authorized customers.
* FR-CUST-002: Support server-side search and pagination where available.
* FR-CUST-003: Require a valid customer email address.
* FR-CUST-004: Load active categories from the backend.
* FR-CUST-005: Capture foreground GPS location when appropriate.
* FR-CUST-006: Allow location retry and manual review before submission.
* FR-CUST-007: Make customer photo optional.
* FR-CUST-008: Preserve form inputs after recoverable validation and network errors.
* FR-CUST-009: Prevent duplicate customer submissions.
* FR-CUST-010: Display success only after receiving a successful backend response.
* FR-CUST-011: Retain historical category references when a category is deactivated.

### FR-SALE: Sales Management

* FR-SALE-001: Display available products and their applicable prices.
* FR-SALE-002: Support the multi-product sale payload where the backend permits it.
* FR-SALE-003: Validate quantity, product selection, and price before submission.
* FR-SALE-004: Enforce the configured minimum sale price on the backend.
* FR-SALE-005: Route below-minimum-price sales into the approval workflow.
* FR-SALE-006: Display sale states such as pending approval, confirmed, and rejected.
* FR-SALE-007: Prevent duplicate sales when a request times out or is retried.
* FR-SALE-008: Do not treat a network timeout as proof that a sale failed.
* FR-SALE-009: Reconcile uncertain submissions before allowing a new transaction.
* FR-SALE-010: Display sale history according to the authenticated user's permissions.

### FR-APPROVAL: Price Approval

* FR-APPROVAL-001: Show pending approvals to authorized approvers.
* FR-APPROVAL-002: Show the requested price, applicable minimum price, Seller, customer, products, and quantities where available.
* FR-APPROVAL-003: Require a reason when rejecting an approval.
* FR-APPROVAL-004: Permit an optional approval note.
* FR-APPROVAL-005: Prevent unauthorized approval actions.
* FR-APPROVAL-006: Prevent duplicate or contradictory approval transitions.
* FR-APPROVAL-007: Record the actor, timestamp, decision, and reason.
* FR-APPROVAL-008: Recheck stock and price conditions during confirmation.
* FR-APPROVAL-009: Make the approval and associated financial/inventory effects transactionally consistent.

### FR-INV: Inventory

* FR-INV-001: Allow Super Admin to view headquarters and warehouse inventory.
* FR-INV-002: Allow authorized users to view their permitted inventory.
* FR-INV-003: Support stock receipts.
* FR-INV-004: Support authorized stock transfers.
* FR-INV-005: Display transaction history and available quantities.
* FR-INV-006: Prevent unauthorized negative inventory.
* FR-INV-007: Record inventory movements in an auditable ledger.
* FR-INV-008: Do not reserve or deduct stock for a pending price approval.
* FR-INV-009: Deduct or allocate stock only when the sale is confirmed according to the approved backend transaction model.
* FR-INV-010: Reject concurrent operations that would oversell stock.

### FR-PAY: Payment Tracking

* FR-PAY-001: Support the business-approved values Cash, Bank, and Pending.
* FR-PAY-002: Do not implement partial payments.
* FR-PAY-003: Validate payment state transitions on the backend.
* FR-PAY-004: Show the selected payment mode and current payment status.
* FR-PAY-005: Do not interpret the legacy amount-based collection endpoint as approval to introduce partial payments.
* FR-PAY-006: Reconcile the existing payment API with the approved payment model before production implementation.

### FR-INC: Incentives

* FR-INC-001: Support different incentive rates per Seller.
* FR-INC-002: Allow authorized administrators to configure rates.
* FR-INC-003: Apply the rate effective when a sale is confirmed.
* FR-INC-004: Preserve historical calculations when a rate changes.
* FR-INC-005: Display permitted incentive summaries and transaction details.
* FR-INC-006: Record rate history and the applied rate for each confirmed sale.
* FR-INC-007: Do not calculate final payable incentives exclusively in the mobile client.

### FR-INVCE: Invoices

* FR-INVCE-001: Generate a final invoice only after sale confirmation.
* FR-INVCE-002: Make the invoice downloadable by authorized users.
* FR-INVCE-003: Email the invoice automatically after confirmation.
* FR-INVCE-004: Do not issue final invoices for pending or rejected sales.
* FR-INVCE-005: Provide safe handling for PDF downloads, file permissions, and sharing.
* FR-INVCE-006: Track email delivery or failure where the backend supports it.
* FR-INVCE-007: Do not claim that an email was delivered merely because the sale was confirmed.

### FR-NOTIF: Notifications

* FR-NOTIF-001: Provide a persistent in-app notification inbox.
* FR-NOTIF-002: Synchronize notification state between website and mobile.
* FR-NOTIF-003: Support read/unread status where the backend provides it.
* FR-NOTIF-004: Scope notifications to authorized recipients.
* FR-NOTIF-005: Exclude WhatsApp messages and WhatsApp actions.
* FR-NOTIF-006: Do not treat local-only notification mocks as production notification infrastructure.

### FR-REPORT: Reports and Administration

* FR-REPORT-001: Show role-authorized dashboards and reports.
* FR-REPORT-002: Support available date, geography, Seller, Manager, and category filters.
* FR-REPORT-003: Avoid downloading complete datasets when server-side filtering or pagination is available.
* FR-REPORT-004: Respect the backend's permissions for financial and operational reports.
* FR-REPORT-005: Do not include shift/attendance screens in v1 unless separately approved.

## 5. Non-Functional Requirements

### Performance

* Show skeletons or progress indicators for loading states.
* Debounce search input.
* Use pagination or incremental loading where supported.
* Avoid unnecessary sequential network requests.
* Cache only data that is safe to reuse.
* Distinguish fresh, cached, and stale data.
* Optimize customer photos and other images.
* Prevent avoidable React re-renders.
* Apply request timeouts and bounded retry policies.

### Reliability

* Never report mutation success before backend confirmation.
* Preserve safe form state after recoverable errors.
* Use server-supported idempotency for sale creation.
* Never blindly retry a potentially committed sale with a new identifier.
* Keep financial and inventory mutations online-only.

### Security

* Store tokens in native secure storage.
* Never embed backend secrets in the mobile bundle.
* Enforce authorization on the backend.
* Validate all inputs on the server.
* Do not log passwords, tokens, or sensitive customer data.
* Clear sensitive session state when the session ends.

### Usability

* Use mobile-first navigation and touch targets.
* Provide loading, empty, error, permission-denied, and offline states.
* Use English throughout the application.
* Do not implement voice input.
* Do not request background location tracking.

## 6. Explicitly Out of Scope

* iOS release.
* Public marketing pages.
* Website contact form migration.
* Mobile chatbot migration.
* WhatsApp integration.
* Voice input.
* Background GPS tracking.
* Offline sale or inventory mutation queues.
* Partial payments.
* Unapproved shift/attendance workflows.
* A new independent backend or parallel source of truth.

## 7. Release Acceptance Gate

Release is blocked until:

* Role and territory permissions are verified.
* Sale idempotency is implemented or a proven equivalent is available.
* Approval, stock, payment, incentive, and invoice transitions are integration-tested.
* Manager-specific permissions and API coverage are resolved.
* Customer email validation is enforced by both client and server.
* Invoice email behavior is verified.
* Shared notification persistence is verified.
* Android device testing passes.
