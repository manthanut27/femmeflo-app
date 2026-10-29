INFORMATION ARCHITECTURE
1. Navigation Principles
Use one authenticated application shell.
Resolve the authenticated role from the backend.
Use the role selection on login only as a sign-in hint, never as authorization.
Show only screens and actions permitted by the authenticated user's capabilities.
Keep mobile navigation optimized for frequent operational tasks.
Use the existing FemmeFlo visual identity while applying mobile-first layouts.
Do not recreate every website route as a native screen.
Keep public marketing pages, public contact forms, and the website chatbot out of the mobile management application.
2. Application Lifecycle
Launch app.
Display startup/loading state.
Read the stored access token from secure storage.
If no token exists, show the login screen.
If a token exists, validate it using the verified current-user endpoint.
If valid, build the authenticated user context from server data.
Resolve role and permissions.
Load the appropriate role dashboard.
If invalid or expired, clear protected session state and return to login.
If the API is unreachable, show a recoverable connection state without exposing unvalidated protected data.
3. Shared Screens
Screen ID	Screen	Purpose
SH-001	Startup	Restore and validate session
SH-002	Role Selection	Select Seller, Manager, or Super Admin for login
SH-003	Login	Email/password authentication
SH-004	Forgot Password	Request password recovery
SH-005	Reset Password	Set a new password using a valid reset token
SH-006	Notifications	Shared backend-backed notification inbox
SH-007	Profile	View permitted user profile information
SH-008	Change Password	Change current password
SH-009	Session Expired	Explain re-authentication requirement
SH-010	Access Denied	Explain that the current role cannot perform an action
SH-011	Network/Error State	Explain connection failure and safe retry behavior
4. Seller Navigation

Recommended primary navigation:

Home
Customers
Sales
Inventory
Profile / More
Seller Home
Today's permitted sales metrics.
Current inventory summary where supported.
Pending sale status summary.
Incentive summary where supported.
Notification indicator.
Refresh action.
Customers
Customer list.
Search.
Pagination or incremental loading.
Customer detail, if a detail contract exists.
Add Customer.
Customer history, if a supported endpoint exists.
Add Customer
Required customer identity fields from the verified API schema.
Required email.
Category selector populated from the backend.
Foreground location capture and retry.
Manual address/location review.
Optional photo picker.
Field-level validation.
Submit and recoverable error states.
Sales
Sales list.
Date filter where supported.
Sale details.
New Sale.
Product selection.
Quantity and price entry.
Payment mode selection according to the confirmed backend contract.
Pending approval state.
Confirmed/rejected state.
Invoice download for authorized confirmed sales.
Inventory
Seller-authorized stock summary.
Stock transaction history.
Product and quantity details.
No inventory mutation unless explicitly supported for the Seller role.
Profile / More
Profile details.
Change password.
Incentives.
Notifications.
Logout.
5. Manager Navigation

Recommended primary navigation:

Dashboard
Team
Operations
Reports
Profile / More
Dashboard
Authorized team and territory metrics.
Sales summaries.
Pending work summaries where permitted.
Inventory alerts where permitted.
Team
Authorized Manager team/Seller list.
Seller details.
Customer assignment/management only if the backend permits it.
Search and pagination.
Operations
Authorized sales list.
Approval inbox only if Manager approval permission is verified.
Inventory views only within permitted scope.
Payment and sale detail views where permitted.
Reports
Authorized sales reports.
Authorized team performance reports.
Available filters.
No export function unless a verified backend contract supports it.
Profile / More
Profile.
Change password.
Notifications.
Logout.
6. Super Admin Navigation

Recommended primary navigation:

Dashboard
People
Sales & Approvals
Inventory
More
Dashboard
Global authorized metrics.
Geographic filters.
Manager and Seller filters.
Sales and inventory summaries.
Alerts.
People
Managers list/create/detail/edit/deactivate where supported.
Sellers list/create/detail/edit/deactivate where supported.
Customers list/detail/create/edit where supported.
Permission management where supported.
Sales & Approvals
Sales ledger.
Sale detail.
Pending approval list.
Approval review.
Approve/reject actions.
Invoice download for confirmed sales.
Payment status and mode.
Inventory
Headquarters inventory.
Warehouse inventory.
Stock receipt.
Stock transfer.
Inventory transaction history.
Low-stock view where supported.
More
Products.
Categories.
Minimum sale price configuration.
Incentive configuration and history.
Reports.
Notifications.
Profile and change password.

Only show a feature if the backend contract and permission are verified. Do not show a functional-looking screen that relies on hardcoded or mock business data.

7. Shared UI Patterns
List screen: title, search/filter controls, paginated list, loading skeleton, empty state, error state.
Detail screen: server-authoritative data, permitted actions, explicit status.
Form screen: field-level validation, submit state, duplicate-submit protection, recoverable error preservation.
Destructive action: confirmation dialog, reason where required, server-side authorization.
Approval screen: pending status, decision context, explicit approve/reject actions.
Network failure: show that the operation's outcome may be unknown when applicable.
Transaction result: distinguish confirmed, pending approval, rejected, and unknown outcome.
8. Native Platform Features
Secure token storage: Expo SecureStore.
Foreground location: Expo Location.
Photo selection: Expo ImagePicker.
Image resizing/compression: Expo ImageManipulator where appropriate.
PDF storage and sharing: Expo FileSystem and Expo Sharing, using APIs supported by the selected Expo SDK.
Android permission handling: request only when a feature needs the permission.
9. Excluded Navigation

Do not create native screens for:

Public homepage and marketing sections.
Public contact form.
Website chatbot.
Website route aliases and typo redirects.
Voice input.
WhatsApp actions.
Background location tracking.
Offline transaction queue.
Shift/attendance until approved.
10. Route-to-Screen Mapping Rule

Website route count is not the native screen count.

For each website feature:

Identify the business capability.
Identify the authorized roles.
Identify the actual backend contract.
Decide whether it is a native screen, a subsection, a modal, or excluded.
Define loading, empty, error, and permission states.
Verify that the screen does not duplicate an existing mobile workflow.