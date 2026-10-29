# DEVELOPMENT PHASES

## Phase 0 — Repository and Backend Verification

Deliverables:

* Inspect website and backend repositories.
* Confirm actual backend stack, database, deployment, and API base URLs.
* Compare the API catalog with route handlers, controllers, validators, and database schema.
* Verify authentication behavior for all three roles.
* Produce a canonical API inventory.
* Produce a role/permission matrix.
* Identify missing contracts and backend changes.
* Confirm payment semantics, minimum-price units, incentive formula, and invoice rules.

Exit criteria:

* Existing versus proposed endpoints are clearly distinguished.
* Critical sale, inventory, and authorization gaps are documented.
* No screen implementation depends on unverified assumptions.

## Phase 1 — Product and Contract Freeze

Deliverables:

* Approved PRD.
* User stories and acceptance criteria.
* Information architecture.
* Verified API contracts.
* Database migration plan for confirmed gaps.
* Sale and approval state diagram.
* Payment state diagram.
* Incentive calculation definition.
* Invoice email lifecycle definition.
* Notification persistence definition.

Exit criteria:

* Product owner resolves business decisions.
* Backend owner approves API changes.
* Critical invariants have explicit tests.

## Phase 2 — Expo Foundation

Deliverables:

* Android Expo project.
* TypeScript configuration.
* Navigation structure.
* Theme and design tokens.
* Environment configuration.
* API client.
* Secure token storage.
* Session restoration.
* Standard loading, empty, error, and access-denied components.
* Logging and request correlation.

Exit criteria:

* App launches on Android.
* Environment selection works.
* No secrets are bundled.
* API errors are normalized.
* Session state is safely restored and cleared.

## Phase 3 — Authentication and Authorization

Deliverables:

* Shared login UI with role selection.
* Authentication integration.
* Current-user/session validation.
* Forgot/reset password flows.
* Change-password flow.
* Role-aware navigation.
* 401 and 403 handling.

Exit criteria:

* All three roles can sign in with approved accounts.
* Role mismatch is rejected.
* Unauthorized routes are not exposed.
* Expired sessions do not reveal protected data.

## Phase 4 — Customer Onboarding

Deliverables:

* Seller customer list.
* Search and pagination.
* Add Customer form.
* Required email validation.
* Category loading.
* Foreground GPS capture, retry, and manual review.
* Optional photo selection and upload.
* Server validation error mapping.

Exit criteria:

* Customer creation works against the real backend.
* Email is enforced by client and server.
* Location denial does not crash the workflow.
* Photo failure preserves form values.
* Duplicate customer submissions are prevented or safely reconciled.

## Phase 5 — Sales and Approval Safety

Deliverables:

* Product list.
* Sale form.
* Sale history and details.
* Payment mode integration.
* Pending approval state.
* Approver inbox.
* Approve/reject actions.
* Sale idempotency/reconciliation.
* Sale state refresh.

Exit criteria:

* Minimum price is enforced server-side.
* Pending/rejected sale invariants pass integration tests.
* Approval cannot be duplicated.
* Concurrent stock confirmation is safe.
* Payment behavior matches the approved no-partial-payment model.
* Uncertain sale outcomes cannot create duplicate sales.

## Phase 6 — Inventory

Deliverables:

* Super Admin inventory overview.
* Warehouse/location views.
* Stock receipt.
* Stock transfer.
* Seller inventory.
* Transaction history.
* Low-stock view where supported.

Exit criteria:

* Inventory data comes from the backend.
* Receipts and transfers are auditable.
* Negative inventory and duplicate transfers are prevented according to policy.
* Pending approvals do not change inventory.

## Phase 7 — Incentives, Invoices, and Notifications

Deliverables:

* Seller incentive view.
* Admin incentive management.
* Effective-dated incentive rates.
* Historical rate snapshots.
* Invoice PDF download.
* Invoice email lifecycle integration.
* Shared persistent notification inbox.

Exit criteria:

* Historical incentives remain stable after rate changes.
* Pending/rejected sales cannot produce final invoices.
* Email failures can be detected and retried safely.
* Notifications synchronize between website and app.
* No WhatsApp integration exists.

## Phase 8 — Manager and Super Admin Completion

Deliverables:

* Manager dashboard and authorized team views.
* Manager sales/inventory/reporting screens.
* Super Admin user management.
* Category and product administration.
* Minimum-price configuration.
* Permissions.
* Reports and filters.
* Role-specific empty/error states.

Exit criteria:

* Manager scope is enforced by the backend.
* Super Admin operations use verified contracts.
* No UI action implies a permission the backend does not grant.
* Report data and filters match backend definitions.

## Phase 9 — Hardening and Release

Deliverables:

* Unit and integration test completion.
* Android E2E coverage.
* Performance profiling.
* Network-failure testing.
* Security review.
* Accessibility review.
* Internal APK.
* Installation and release notes.
* Crash/log review.
* Regression verification for existing website behavior.

Exit criteria:

* Release blockers are resolved.
* All critical workflows pass on Android.
* Sale, inventory, payment, and approval invariants pass.
* APK is built from the approved release configuration.
* Rollback and support procedures are documented.

## Cross-Phase Rules

* Do not advance a phase with unresolved critical security or transaction invariants.
* Keep feature branches small and reviewable.
* Use feature flags only when they are genuinely supported and controlled.
* Do not merge mocked business behavior as production functionality.
* Every backend contract change requires tests and updated documentation.
