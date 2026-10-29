# ENGINEERING SCOPE DEFINITION

## 1. Objective

Deliver an Android Expo application for Seller, Manager, and Super Admin operations using the existing FemmeFlo backend, with backend changes only where verified requirements are unsupported.

## 2. In Scope — Mobile Application

### Foundation

* Expo Android application.
* TypeScript.
* Shared authentication flow.
* Secure token storage.
* Session restoration and expiry handling.
* Role-aware navigation.
* Centralized API client.
* Consistent loading, empty, error, and access-denied states.
* FemmeFlo visual identity adapted to mobile.

### Seller

* Dashboard.
* Customer list and onboarding.
* Required customer email.
* Category selection.
* Foreground location capture and manual review.
* Optional customer photo.
* Product list.
* Sale creation.
* Sale history.
* Approval status.
* Seller inventory.
* Approved payment mode selection.
* Incentive views.
* Invoice download where authorized.
* Notifications.
* Profile and password change.

### Manager

* Authorized dashboard.
* Team/Seller views.
* Authorized customer, sale, inventory, and report views.
* Approval actions only if confirmed in the permission matrix.
* Incentive summaries where supported.
* Notifications.
* Profile and password change.

### Super Admin

* Dashboard.
* Manager and Seller management.
* Customer administration.
* Products and categories where APIs support them.
* Minimum sale price configuration.
* Approval inbox and decisions.
* Headquarters and warehouse inventory.
* Stock receipts and transfers.
* Incentive configuration and history.
* Sales and reports.
* Permission management where supported.
* Notifications.
* Profile and password change.

### Cross-cutting

* Pagination and debounced search.
* Safe request timeout handling.
* Bounded retries for safe operations.
* Duplicate submission prevention.
* Sale idempotency/reconciliation.
* Native photo and PDF handling.
* Accessibility and Android permission handling.
* Logging without sensitive data.
* Automated unit, integration, and device tests.

## 3. In Scope — Backend Changes if Required

Only after source and runtime verification:

* Server-side required customer email validation.
* Manager API coverage and authorization.
* Minimum-price configuration and enforcement.
* Approval transition consistency.
* Atomic inventory updates.
* Sale idempotency.
* Payment contract reconciliation.
* Historical incentive rate snapshots.
* Final invoice eligibility and email processing.
* Persistent shared notifications.
* Category lifecycle operations.
* Missing reporting endpoints.

Do not implement a proposed endpoint if an existing endpoint already provides the required behavior safely.

## 4. Out of Scope

* iOS release.
* Public marketing pages.
* Website contact form migration.
* Mobile chatbot.
* WhatsApp.
* Voice input.
* Background GPS tracking.
* Offline sale or inventory mutation queue.
* Partial payments.
* Unapproved attendance or shift screens.
* Replacement of the existing backend.
* Direct mobile database access.
* New AI or ranking engine.
* Unapproved accounting, tax, returns, or refund workflows.
* Rebuilding the website's visual layout as a native one-to-one copy.

## 5. Dependencies

* Access to the current website repository.
* Access to the backend repository and deployment configuration.
* Access to the API schema/types and database migrations.
* Test accounts for all three roles.
* Representative data for customers, products, sales, inventory, and approvals.
* Confirmation of payment semantics.
* Confirmation of minimum price units and scope.
* Confirmation of incentive formula and effective-date rules.
* Confirmation of invoice email behavior.
* Confirmation of notification persistence.
* Android device or emulator for validation.
* Internal APK distribution mechanism.

## 6. Technical Constraints

* Backend remains the source of truth.
* Client-side role guards are not authorization.
* No business mutation is considered successful without backend confirmation.
* No blind retry of potentially committed financial or inventory mutations.
* No unsupported query parameters.
* No hardcoded business records as a substitute for API integration.
* No secrets embedded in the APK.
* No unsupported assumptions about the backend framework or database.
* Existing web behavior must not be broken by mobile-specific changes.

## 7. Definition of Done

A feature is complete only when:

* Requirements and permission rules are mapped.
* The actual API contract is verified.
* Loading, empty, error, and unauthorized states are implemented.
* Client validation and server validation are consistent.
* Duplicate submission behavior is tested.
* Relevant unit and integration tests pass.
* Android device testing passes.
* No sensitive information is logged.
* Documentation reflects actual behavior.
* No required workflow relies on mock data.
* Regression tests pass for affected existing website/backend functionality.

## 8. Release Blockers

* Unknown or inconsistent role authorization.
* Unresolved Manager-specific contracts.
* Unverified sale approval invariants.
* Missing safe sale idempotency/reconciliation.
* Payment contract conflicts with no-partial-payment requirement.
* Unverified incentive history behavior.
* Final invoice eligibility not enforced.
* Required invoice email behavior missing.
* Shared notification persistence missing.
* Customer email requirement not enforced server-side.
