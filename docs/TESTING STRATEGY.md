# TESTING STRATEGY

## 1. Testing Objectives

Verify:

* Correct behavior for all three roles.
* Contract compatibility with the actual backend.
* Business invariants for sales, approvals, inventory, payments, incentives, and invoices.
* Safe handling of network failures.
* No duplicate financial or inventory transactions.
* Secure session and permission behavior.
* Reliable operation on Android devices.
* Performance under realistic list and network conditions.

## 2. Testing Layers

### Unit tests

Test:

* Field validation.
* Money formatting and parsing.
* Date formatting.
* Role-aware navigation decisions.
* Error normalization.
* Pagination helpers.
* Search debounce.
* Form-state preservation.
* Incentive display formatting.
* Sale status presentation.
* Safe retry classification.

Do not treat client unit tests as proof that server-side authorization or pricing enforcement works.

### Component tests

Test:

* Login form.
* Customer form.
* Category selector.
* Location permission states.
* Photo picker states.
* Sale form.
* Approval decision dialog.
* Inventory list.
* Notification inbox.
* Invoice download error states.

### API contract tests

Test:

* Request methods, paths, headers, query parameters, and payload shapes.
* Strict-schema rejection of unsupported fields.
* Response validation.
* 401 and 403 behavior.
* Pagination response shape.
* PDF binary response handling.
* Error response parsing.

Use the actual backend schema or OpenAPI contract where available.

### Integration tests

Test complete backend workflows:

* Authentication and session restore.
* Customer creation.
* Sale creation.
* Below-minimum-price approval.
* Stock receipt and transfer.
* Payment update.
* Incentive calculation.
* Invoice generation and email.
* Notification creation and read-state synchronization.

### End-to-end tests

Use a physical Android device or emulator to test:

* Login.
* Role navigation.
* Customer onboarding.
* Location permission.
* Photo selection.
* Sale creation.
* Approval status.
* Inventory views.
* Invoice download/share.
* Session expiry.
* Network loss and recovery.

## 3. Role-Based Authorization Matrix

Create test accounts for:

* Super Admin.
* Manager with a known authorized territory/team.
* Seller with assigned customers and inventory.
* Seller with no access to another Seller's records.
* Inactive user.

Required negative tests:

* Seller attempts to open another Seller's sale.
* Seller attempts to approve a sale.
* Manager attempts to access a record outside authorized scope.
* Manager attempts a Super Admin-only mutation.
* Inactive user attempts authentication.
* Expired token calls a protected endpoint.
* Direct API request bypasses a hidden UI control.

Expected outcome:

* The backend denies unauthorized operations.
* The app displays a useful error.
* Protected data is not exposed.

## 4. Sale and Approval Invariant Tests

### Pending sale

Assert:

* Sale is recorded as pending approval.
* Stock is unchanged.
* Sold count is unchanged.
* Incentive ledger is unchanged.
* No final invoice exists.
* No final invoice email is triggered.

### Rejected sale

Assert:

* Sale remains visible in history.
* Status is rejected.
* Stock is unchanged.
* Sold count is unchanged.
* Incentive ledger is unchanged.
* No final invoice is issued.

### Approved sale

Assert:

* Sale transitions to confirmed exactly once.
* Stock is updated according to the approved inventory model.
* Sold count changes exactly once.
* Effective incentive rate is snapshotted.
* Final invoice becomes eligible for generation.
* Email delivery is triggered through the backend workflow.

### Concurrent approval

* Submit two approval requests for the same sale.
* Verify only one state transition succeeds.
* Verify inventory is changed once.
* Verify only one incentive record and final invoice are created.

## 5. Idempotency and Network Failure Tests

Simulate:

* Client timeout before the request reaches the server.
* Server receives and commits the request but the response is lost.
* Connection drops while the response is being returned.
* User taps submit repeatedly.
* Client retries with the same idempotency key.
* Client retries with the same key but a different payload.
* App restarts while a request outcome is unknown.

Expected behavior:

* A confirmed mutation is not duplicated.
* Same key and same payload return the original outcome or safe reconciliation response.
* Same key with different payload is rejected.
* The app does not assume a timeout means the server did not commit.
* A potentially committed sale is reconciled before a new sale can be created.

## 6. Payment Tests

Test:

* Cash.
* Bank.
* Pending.
* Unsupported payment mode.
* Payment mutation timeout.
* Duplicate payment submission.
* Reconciliation of current payment status.

Assert:

* No partial-payment UI is available.
* Unsupported modes are rejected server-side.
* The mobile client does not invent payment success.
* Existing amount-based collection behavior is reconciled with the approved product rule.

## 7. Incentive Tests

Test:

* Seller-specific rates.
* Rate effective before sale confirmation.
* Rate change after sale confirmation.
* Exact effective-date boundary.
* Rejected sale.
* Pending sale.
* Duplicate confirmation.
* Rounding boundaries.
* Rate history retrieval.

Assert:

* The correct effective rate is used.
* Historical results do not change when a new rate is created.
* Pending and rejected sales do not earn incentives.
* Duplicate requests do not create duplicate incentive records.

## 8. Customer Onboarding Tests

Test:

* Valid required email.
* Missing email.
* Invalid email.
* Category loading failure.
* Inactive category.
* Location permission granted.
* Location permission denied.
* Location timeout.
* Manual address entry.
* Photo omitted.
* Photo selected.
* Unsupported image.
* Image upload failure.
* Server validation error.
* Double submit.
* Network timeout.

Assert:

* Email is enforced by client and server.
* Optional photo is not required.
* Location failure does not crash the form.
* Entered data is preserved after recoverable errors.
* No duplicate customer is created by repeated submission.

## 9. Invoice and Email Tests

Test:

* Confirmed sale.
* Pending sale.
* Rejected sale.
* PDF download success.
* PDF download failure.
* Unauthorized invoice request.
* Email provider unavailable.
* Email retry.
* Duplicate event processing.

Assert:

* Only confirmed sales receive final invoices.
* PDF access follows sale permissions.
* Email failure does not undo a confirmed sale.
* Duplicate events do not create duplicate invoices or uncontrolled duplicate email sends.
* Delivery status is reported accurately.

## 10. Notification Tests

Test:

* Notification created by a business event.
* Notification visible on web and mobile.
* Mark read on mobile.
* Read state refreshed on web.
* Unauthorized notification access.
* Pagination.
* Empty inbox.
* Backend unavailable.

Assert:

* Notifications persist server-side.
* Read state synchronizes across clients.
* Local-only notifications are not treated as shared.
* No WhatsApp action is present.

## 11. Performance Tests

Measure:

* App startup time.
* Login completion time.
* Customer list loading time.
* Sale product loading time.
* Search response behavior.
* Pagination latency.
* Sale submission feedback.
* Invoice download time.
* Memory usage on long lists.

Test:

* Slow network.
* High latency.
* Intermittent connection.
* API cold start.
* Large customer datasets.
* Repeated navigation between lists.
* Repeated refreshes.

Requirements:

* Use skeletons or progress indicators.
* Debounce search.
* Avoid fetching entire datasets unnecessarily.
* Avoid repeated identical requests when safe caching is available.
* Never use stale cached data as if it were fresh.
* Do not sacrifice transaction integrity for perceived speed.

## 12. Accessibility and UX Tests

* Touch targets are usable on Android.
* Inputs have labels and validation messages.
* Keyboard does not hide critical actions.
* Status is not communicated by color alone.
* Loading and errors are announced appropriately.
* Permission prompts explain the purpose.
* Text remains legible at supported system font scales.
* Forms can be completed without voice input.

## 13. Release Regression Checklist

Before each internal APK:

* All three roles can authenticate.
* Role mismatch is rejected.
* Customer creation requires email.
* Categories load from the backend.
* Location denial is handled safely.
* Photo is optional.
* Normal sale works.
* Below-minimum sale becomes pending.
* Pending/rejected sale invariants pass.
* Approval cannot duplicate stock effects.
* Payment options match the approved contract.
* Historical incentive calculations remain stable.
* Confirmed invoice can be downloaded.
* Invoice email behavior is verified.
* Notifications persist and synchronize.
* Session expiry is handled safely.
* Network timeout does not create duplicate sales.
* No WhatsApp or voice-input feature is present.
* No critical regression exists in the existing website/backend.
* Release build uses the correct environment and contains no secrets.

## 14. Exit Criteria

A release candidate may proceed only when:

* Critical and high-severity defects are resolved.
* All transaction invariant tests pass.
* Role authorization tests pass.
* API contract tests pass.
* Android E2E smoke tests pass.
* Network-failure and idempotency tests pass.
* No production feature depends on mock data.
* Known limitations are documented and accepted.
