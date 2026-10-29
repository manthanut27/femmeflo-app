# USER STORIES AND ACCEPTANCE CRITERIA

## 1. Authentication

### US-AUTH-001 — Sign in using a selected role

As a user, I want to select my role and sign in so that I can access the correct operational workspace.

Acceptance criteria:

* Given the login screen, when the user selects Seller, Manager, or Super Admin, the selected role is displayed.
* Given valid credentials, when authentication succeeds, the app checks the server-returned user role.
* If the selected role does not match the server-returned role, protected navigation is blocked.
* Invalid credentials produce a clear error without revealing whether an account exists.
* The app does not rely on the selected role as authorization evidence.

### US-AUTH-002 — Restore a valid session

As a returning user, I want to remain signed in while my session is valid.

Acceptance criteria:

* The token is stored using native secure storage.
* On startup, the app validates the stored session with the backend.
* Protected screens are not shown before session validation completes.
* An invalid or expired session returns the user to authentication.
* Role-specific cached data is cleared when the account changes.

### US-AUTH-003 — Recover access

As a user, I want to reset my password when I cannot sign in.

Acceptance criteria:

* The app submits the account identifier using the verified recovery contract.
* The response does not disclose whether the account exists.
* A valid reset token permits password replacement.
* Expired or invalid tokens produce a recoverable error.
* The app does not fabricate a recovery channel or token lifecycle.

## 2. Customer Onboarding

### US-CUST-001 — Browse customers

As a Seller, I want to browse my authorized customers so that I can select the correct customer for a sale.

Acceptance criteria:

* The list displays server-authorized records only.
* Search input is debounced.
* Pagination loads additional records without replacing the entire list incorrectly.
* Loading, empty, and error states are visible.
* Filters and search parameters match the API contract.

### US-CUST-002 — Create a customer

As a Seller, I want to create a customer with required details.

Acceptance criteria:

* Email is required and validated before submission.
* Categories are loaded from the backend.
* Inactive categories are not offered for new records.
* Server validation errors are displayed against the relevant fields where possible.
* Repeated taps do not create duplicate requests.
* Success is shown only after a successful server response.
* A recoverable network error does not erase all entered data.

### US-CUST-003 — Capture customer location

As a Seller, I want to capture and review a customer's location.

Acceptance criteria:

* The app requests foreground location permission contextually.
* When permission is granted, the app attempts to capture coordinates.
* The user can retry location capture.
* The user can review the resolved address and correct it manually.
* Permission denial does not crash the form.
* No background tracking starts.
* The payload matches the verified backend address/location schema.

### US-CUST-004 — Attach a customer photo

As a Seller, I want to attach an optional customer photo.

Acceptance criteria:

* The customer can be saved without a photo.
* A selected image can be previewed, removed, or replaced.
* Unsupported file types and oversized files are handled safely.
* Image compression does not silently corrupt the image.
* Upload failure preserves the rest of the form.
* The upload format matches the backend contract.

## 3. Sales

### US-SALE-001 — Create a sale

As a Seller, I want to create a sale for a customer using available products.

Acceptance criteria:

* Only products returned by the backend can be selected.
* Quantities must be positive and conform to backend rules.
* The displayed price is derived from authoritative pricing data.
* The client cannot override backend minimum-price enforcement.
* A successful response produces a sale detail or confirmation state.
* A network timeout does not automatically produce a second sale.
* The app reconciles uncertain requests before permitting a retry.

### US-SALE-002 — Submit a below-minimum-price sale

As a Seller, I want to submit an eligible discounted sale for approval.

Acceptance criteria:

* The configured minimum price comes from the backend.
* The app clearly indicates that approval is required.
* The submitted sale is recorded as pending approval.
* While pending, it does not deduct or reserve stock, increase sold count, earn incentives, or issue a final invoice.
* The pending sale remains visible in history.
* The app does not display it as a confirmed sale.

### US-SALE-003 — Review sale history

As a Seller, I want to review previous sales and their statuses.

Acceptance criteria:

* Results are scoped to the authenticated Seller.
* Date filters match the backend's supported query parameters.
* Pending, confirmed, and rejected states are distinguishable.
* The list supports pagination where available.
* Cached records are labelled or refreshed so stale data is not presented as current.

## 4. Approvals

### US-APP-001 — Review pending approvals

As an authorized approver, I want to inspect pending sales before deciding.

Acceptance criteria:

* Only records the current user may approve are returned.
* The review includes the requested price and relevant sale context.
* The current configured minimum price is displayed.
* Loading, empty, and error states are supported.
* The approval screen does not expose unauthorized customer data.

### US-APP-002 — Approve a sale

As an authorized approver, I want to approve a pending sale.

Acceptance criteria:

* The backend verifies the user's approval permission.
* The backend verifies that the sale is still pending.
* Stock availability and price rules are rechecked at confirmation.
* Concurrent approvals cannot consume the same stock twice.
* Confirmation, stock effects, sold counts, incentive snapshot, and final invoice eligibility are transactionally consistent.
* Repeated approval requests do not create duplicate effects.
* The app refreshes sale status from the backend.

### US-APP-003 — Reject a sale

As an authorized approver, I want to reject an invalid or unacceptable sale.

Acceptance criteria:

* A rejection reason is required.
* The backend records the decision and actor.
* The sale remains in history as rejected.
* Rejection does not deduct stock or earn incentives.
* No final invoice is issued.
* A repeated or conflicting decision is handled safely.

## 5. Inventory

### US-INV-001 — View inventory

As an authorized user, I want to view inventory that I am allowed to access.

Acceptance criteria:

* The API enforces inventory scope.
* Quantities and locations come from the backend.
* Filters do not cause unsupported query parameters.
* The UI distinguishes loading, empty, stale, and failed states.
* The app does not invent stock quantities from cached sales.

### US-INV-002 — Receive stock

As a Super Admin, I want to record a stock receipt.

Acceptance criteria:

* The receipt form follows the backend payload schema.
* Quantities and product identifiers are validated.
* The operation is submitted once.
* The UI confirms success only after the backend commits the receipt.
* The resulting inventory and transaction history are refreshed.

### US-INV-003 — Transfer stock

As an authorized user, I want to transfer stock between permitted locations.

Acceptance criteria:

* The backend validates source and destination permissions.
* The backend validates available stock.
* A transfer is auditable.
* Duplicate requests do not create duplicate transfers.
* Concurrent transfers cannot create negative stock.
* The app refreshes source and destination balances after confirmation.

## 6. Payments

### US-PAY-001 — Select a payment mode

As a Seller, I want to record the approved payment mode for a sale.

Acceptance criteria:

* Supported values are Cash, Bank, and Pending.
* The app does not offer partial payment.
* The server rejects unsupported payment modes.
* The app displays the resulting payment status returned by the backend.
* Any conflict with the existing amount-based collection endpoint is resolved before release.

### US-PAY-002 — Handle an uncertain payment request

As a Seller, I want to know whether a payment update succeeded if the network fails.

Acceptance criteria:

* The app does not blindly resubmit a possibly committed payment mutation.
* The app retrieves the current sale/payment state where supported.
* The user sees a clear reconciliation outcome.
* Sensitive payment references are not written to logs.

## 7. Incentives

### US-INC-001 — View incentives

As a Seller, I want to view my permitted incentive history.

Acceptance criteria:

* The backend determines which records the Seller may see.
* The app displays the applied rate and resulting incentive when provided.
* Historical totals remain stable after future rate changes.
* The app does not calculate final payout solely from a mutable current rate.

### US-INC-002 — Configure a Seller's incentive rate

As an authorized administrator, I want to change a Seller's incentive rate.

Acceptance criteria:

* Only authorized roles can change rates.
* The new rate has an effective time or date.
* Existing confirmed sales retain their applied rate.
* Invalid or overlapping rate periods are rejected according to backend rules.
* Rate changes are auditable.

## 8. Invoices and Notifications

### US-INVCE-001 — Download an invoice

As an authorized user, I want to download a sale invoice.

Acceptance criteria:

* The backend authorizes access to the specific sale.
* Only a confirmed sale can produce a final invoice.
* The PDF is downloaded to an app-controlled temporary location.
* The app handles binary responses correctly.
* Failed downloads display a retry option.
* The invoice is not exposed through an unrestricted public URL.

### US-INVCE-002 — Email a confirmed invoice

As a customer-facing business user, I want the invoice to be emailed automatically after sale confirmation.

Acceptance criteria:

* Invoice email processing is triggered by confirmed sale state.
* Pending and rejected sales do not trigger final invoice email.
* Email delivery failure does not roll back an otherwise committed sale.
* Delivery attempts and failures are observable through a supported backend mechanism.
* The app does not claim delivery unless delivery status is known.

### US-NOTIF-001 — View notifications

As a user, I want to see business notifications on both website and mobile.

Acceptance criteria:

* Notifications are loaded from a shared backend source.
* Read/unread state persists across devices where supported.
* Notification access follows backend authorization.
* Local-only storage is not treated as cross-device persistence.
* No WhatsApp workflow is present.

## 9. Security and Reliability

### US-SEC-001 — Enforce role permissions

As the business, I want every protected operation authorized by the backend.

Acceptance criteria:

* Seller access to another Seller's records is denied unless explicitly permitted.
* Manager access outside their authorized scope is denied.
* Super Admin-only mutations reject other roles.
* Direct API calls cannot bypass client navigation restrictions.
* Unauthorized responses are handled without exposing protected content.

### US-REL-001 — Operate with unreliable connectivity

As a user, I want clear feedback when the network is unavailable.

Acceptance criteria:

* Business mutations are not queued for automatic offline execution.
* The app never reports an offline transaction as successful.
* Safe form inputs remain available after recoverable errors.
* Retry behavior is bounded and operation-aware.
* A potentially committed sale is reconciled before another sale is created.

## 10. Excluded Stories

* WhatsApp notifications.
* Voice input.
* Background location tracking.
* Offline sale queue.
* Partial payments.
* iOS-specific release.
* Public marketing and contact pages.
* Shift/attendance workflows until explicitly approved.
