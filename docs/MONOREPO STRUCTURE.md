# MONOREPO STRUCTURE

## 1. Repository Strategy

Preferred strategy:

* Keep the existing website and backend repositories intact unless the team explicitly approves a repository consolidation.
* If a monorepo is approved, move code through a planned migration with preserved history where required.
* Do not copy backend implementation into the Expo app.
* Do not make the mobile app depend on Next.js server-only modules.

Proposed monorepo:

```text
femmeflo/
├── apps/
│   ├── mobile/
│   │   ├── app/
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx
│   │   │   ├── (auth)/
│   │   │   │   ├── role-selection.tsx
│   │   │   │   ├── login.tsx
│   │   │   │   ├── forgot-password.tsx
│   │   │   │   └── reset-password.tsx
│   │   │   ├── (seller)/
│   │   │   ├── (manager)/
│   │   │   ├── (admin)/
│   │   │   └── (shared)/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── features/
│   │   │   │   ├── auth/
│   │   │   │   ├── customers/
│   │   │   │   ├── sales/
│   │   │   │   ├── approvals/
│   │   │   │   ├── inventory/
│   │   │   │   ├── payments/
│   │   │   │   ├── incentives/
│   │   │   │   ├── invoices/
│   │   │   │   ├── notifications/
│   │   │   │   ├── reports/
│   │   │   │   └── administration/
│   │   │   ├── navigation/
│   │   │   ├── hooks/
│   │   │   ├── api/
│   │   │   ├── state/
│   │   │   ├── storage/
│   │   │   ├── native/
│   │   │   ├── theme/
│   │   │   ├── validation/
│   │   │   ├── utils/
│   │   │   └── types/
│   │   ├── assets/
│   │   ├── tests/
│   │   ├── app.config.ts
│   │   ├── eas.json
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── web/
│   │   └── Existing Next.js website, if migrated with approval
│   └── api/
│       └── Existing backend, only if its repository and stack are confirmed
├── packages/
│   ├── api-contracts/
│   │   ├── src/
│   │   └── package.json
│   ├── domain-types/
│   │   ├── src/
│   │   └── package.json
│   ├── validation/
│   │   ├── src/
│   │   └── package.json
│   ├── design-tokens/
│   │   ├── src/
│   │   └── package.json
│   └── tooling/
├── docs/
│   ├── product-requirements.md
│   ├── user-stories-and-acceptance-criteria.md
│   ├── information-architecture.md
│   ├── system-architecture.md
│   ├── database-schema.md
│   ├── api-contracts.md
│   ├── monorepo-structure.md
│   ├── scoring-engine-spec.md
│   ├── engineering-scope-definition.md
│   ├── development-phases.md
│   ├── environment-and-devops.md
│   └── testing-strategy.md
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.js
├── prettier.config.js
└── README.md
```

## 2. Mobile Feature Module Convention

Each feature should use a consistent structure:

```text
features/sales/
├── api/
│   ├── sales.api.ts
│   ├── sales.queries.ts
│   └── sales.mutations.ts
├── components/
├── screens/
├── forms/
├── validation/
├── hooks/
├── types/
├── utils/
└── __tests__/
```

Rules:

* Screens orchestrate UI and feature hooks.
* API modules contain endpoint-specific calls.
* Query modules define read caching and invalidation.
* Mutation modules implement safe submission behavior.
* Validation modules handle client-side usability validation.
* Backend validation remains authoritative.
* Do not duplicate authorization rules solely in the UI.

## 3. API Client Location

```text
apps/mobile/src/api/
├── client.ts
├── auth-header.ts
├── errors.ts
├── request-id.ts
├── timeout.ts
├── response-validation.ts
└── index.ts
```

Responsibilities:

* Base URL configuration.
* Bearer-token injection.
* Request ID generation.
* Timeout handling.
* Response parsing.
* Error normalization.
* Safe handling of 401 and 403.
* No automatic replay of non-idempotent requests.

## 4. Shared Package Rules

`packages/api-contracts`:

* Contains verified API request and response types.
* Must reflect the actual backend contract.
* May contain OpenAPI-generated types if the backend provides an OpenAPI specification.
* Must not silently describe proposed endpoints as existing.

`packages/domain-types`:

* Contains shared business types and enums.
* Examples: user role, sale state, payment mode.
* Avoids UI-specific types.

`packages/validation`:

* Contains validation rules that can safely be shared.
* Server-side validation remains mandatory.
* Do not import Node-only dependencies into React Native.

`packages/design-tokens`:

* Contains colors, spacing, typography, radii, and reusable visual tokens.
* Does not contain browser-specific CSS or DOM APIs.

## 5. Dependency Management

* Use a single package manager and lockfile.
* Pin compatible Expo and React Native versions.
* Install native packages through Expo-compatible installation commands where recommended.
* Do not force a web dependency into React Native merely because it is already installed in Next.js.
* Avoid circular dependencies between shared packages and apps.
* Run type checking and tests in CI for every changed package.

## 6. Monorepo Tooling

Suggested starting choices:

* Package manager: pnpm workspaces.
* TypeScript strict mode.
* ESLint.
* Prettier.
* Jest or the Expo-compatible test setup selected for the chosen SDK.
* React Native Testing Library.
* Maestro or an equivalent Android E2E tool.
* EAS Build for managed Android builds where appropriate.

These are proposed tooling choices; verify compatibility with the chosen Expo SDK before installation.

## 7. Repository Migration Rules

* Do not restructure the existing website merely to start mobile development.
* First establish a working standalone Expo app connected to the existing API.
* Consolidate repositories only when ownership, deployment, package boundaries, and CI responsibilities are agreed.
* Never share server secrets through a package consumed by the mobile app.
* Review any shared package for browser-only APIs, Node-only modules, and environment-variable leakage.
