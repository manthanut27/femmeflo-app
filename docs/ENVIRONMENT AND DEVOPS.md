# ENVIRONMENT AND DEVOPS

## 1. Environments

Required environments:

* Local development.
* Shared development or staging.
* Production.

Each environment must have its own API base URL and credentials.

Do not assume the currently catalogued Render URL is the correct URL for all environments.

## 2. Mobile Environment Variables

Suggested public client configuration:

```text
EXPO_PUBLIC_API_BASE_URL=https://example-api-host/api/v1
EXPO_PUBLIC_APP_ENV=development
```

Rules:

* Replace example values with approved environment-specific values.
* `EXPO_PUBLIC_*` values are embedded in the client bundle and must be treated as public.
* Never put database credentials, SMTP passwords, AI provider keys, signing secrets, or server-only tokens in Expo variables.
* Do not use a mobile environment variable as an authorization boundary.
* Validate required variables at app startup.

## 3. Local Development Setup

Prerequisites:

* Node.js version supported by the selected Expo SDK.
* One package manager.
* Expo-compatible dependencies.
* Android emulator or physical Android device.
* Backend development/staging access.
* Test accounts for Seller, Manager, and Super Admin.

Initial commands, after the repository and Expo SDK are selected:

```bash
npm install
npx expo start
```

Use the package manager and scripts actually configured in the repository. Do not run package installation commands before confirming the project's existing lockfile and package manager.

For Android native package or configuration changes, use the workflow recommended by the selected Expo SDK.

## 4. Android Build Strategy

Development:

* Use Expo development mode for iterative UI and API work.
* Use a physical Android device for GPS, camera/photo, storage, and sharing validation.
* Use an emulator for repeatable navigation and functional tests.

Internal distribution:

* Build a signed Android APK.
* Distribute only to approved internal testers.
* Keep signing credentials outside the repository.
* Record app version, commit, build profile, and environment in release notes.

Production:

* Promote a tested build.
* Verify the production API URL.
* Confirm the production signing configuration.
* Confirm backend migrations and deployment compatibility before release.

## 5. EAS Build Configuration

Example profile intent; adapt to the actual Expo SDK and build requirements:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

Rules:

* Validate the schema against the installed EAS tooling.
* The initial internal release uses an APK.
* Production AAB distribution is optional until the release channel is approved.
* Do not commit signing credentials or private environment files.

## 6. Backend Configuration

Backend-only configuration may include:

* Database connection string.
* JWT signing secret.
* Password-reset token secret or configuration.
* Email provider credentials.
* Object-storage credentials.
* Allowed origins where applicable.
* Rate-limit configuration.
* Logging and monitoring credentials.

Rules:

* Store secrets in the hosting provider's secret manager.
* Rotate compromised credentials.
* Do not expose server secrets through API responses or mobile bundles.
* Keep production and staging secrets separate.
* Use least-privilege service credentials.

## 7. CI Pipeline

Required checks for pull requests:

1. Dependency installation from the lockfile.
2. Formatting check.
3. Lint.
4. TypeScript type check.
5. Unit tests.
6. API contract tests where available.
7. Security/dependency audit.
8. Expo configuration validation.
9. Android build validation for release-impacting changes.

Example script names, to be implemented in `package.json`:

```json
{
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "jest",
    "format:check": "prettier --check ."
  }
}
```

The actual commands must match the selected toolchain and repository layout.

## 8. Release Pipeline

1. Merge approved code into the release branch.
2. Run CI checks.
3. Confirm API compatibility.
4. Confirm database migration order if backend changes are included.
5. Build the Android artifact.
6. Install and smoke-test on a physical device.
7. Verify login for all roles.
8. Verify sale and approval flows against staging.
9. Verify invoice download and email behavior.
10. Verify notification persistence.
11. Approve the release.
12. Publish the internal APK.
13. Record version, commit, build profile, and known limitations.

## 9. Database Migration Safety

* Inspect the existing schema before adding tables.
* Use versioned migrations.
* Back up production data before destructive changes.
* Prefer additive, backward-compatible changes.
* Deploy backend support before deploying a client that requires it.
* Do not remove old columns or endpoints until all deployed clients are compatible.
* Test migrations against a staging copy.
* Define rollback or forward-fix procedures.

## 10. Monitoring and Diagnostics

Monitor:

* API availability.
* Request latency.
* HTTP error rates.
* Authentication failures.
* Sale creation failures.
* Idempotency conflicts.
* Approval failures.
* Inventory conflicts.
* Invoice generation/email failures.
* Notification delivery/persistence errors.
* Android crashes and fatal errors.

Every transaction-related error should be traceable by a non-sensitive request ID.

## 11. Security Requirements

* HTTPS for all non-local environments.
* Secure token storage on device.
* No credentials in source control.
* No secrets in client configuration.
* Least-privilege backend permissions.
* Redacted logs.
* Dependency scanning.
* Restricted access to APK artifacts.
* Tested handling of expired sessions and unauthorized responses.
