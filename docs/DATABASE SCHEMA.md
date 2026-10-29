# DATABASE SCHEMA

## 1. Status and Conventions

This is a proposed relational schema for the required business behavior, not a claim that the existing database already contains these tables.

Before implementation:

* Inspect the existing backend schema and migrations.
* Reuse compatible tables and identifiers.
* Add migrations only for verified gaps.
* Do not create a parallel database model that duplicates existing business records.

Target database assumption: PostgreSQL.

Conventions:

* Primary keys: UUID unless the existing schema uses another stable identifier.
* Timestamps: `TIMESTAMPTZ`, stored in UTC.
* Currency: integer minor units, such as paise (`BIGINT`), not floating-point values.
* Quantities: `NUMERIC(14,3)` where fractional units are permitted; otherwise use integer units according to product rules.
* Soft deactivation: use `is_active` where historical records must remain readable.
* All sensitive mutations should record the actor and timestamp.
* Exact product units, tax rules, and invoice requirements must follow existing business rules.

## 2. users

| Field          | Type                                   | Constraints / Purpose                                                    |
| -------------- | -------------------------------------- | ------------------------------------------------------------------------ |
| id             | UUID                                   | PK                                                                       |
| name           | VARCHAR(160)                           | NOT NULL                                                                 |
| email          | CITEXT                                 | NOT NULL; UNIQUE if account policy requires global uniqueness            |
| phone          | VARCHAR(20)                            | Nullable unless required by existing account policy                      |
| password_hash  | TEXT                                   | NOT NULL; never return to client                                         |
| role           | ENUM('SUPER_ADMIN','MANAGER','SELLER') | NOT NULL                                                                 |
| manager_id     | UUID                                   | Nullable FK to users.id; used for Seller reporting line where applicable |
| is_active      | BOOLEAN                                | NOT NULL DEFAULT TRUE                                                    |
| created_at     | TIMESTAMPTZ                            | NOT NULL                                                                 |
| updated_at     | TIMESTAMPTZ                            | NOT NULL                                                                 |
| deactivated_at | TIMESTAMPTZ                            | Nullable                                                                 |

Relationships:

* A Manager may have many Sellers through `manager_id`.
* A Seller may be assigned to a Manager.
* Super Admin scope is global, subject to backend policy.

## 3. user_permissions

| Field          | Type         | Constraints / Purpose |
| -------------- | ------------ | --------------------- |
| id             | UUID         | PK                    |
| user_id        | UUID         | FK users.id           |
| permission_key | VARCHAR(120) | NOT NULL              |
| granted        | BOOLEAN      | NOT NULL              |
| created_at     | TIMESTAMPTZ  | NOT NULL              |
| updated_at     | TIMESTAMPTZ  | NOT NULL              |

Constraints:

* UNIQUE(user_id, permission_key).
* Permission names must come from a server-maintained registry.
* Role defaults and user overrides must have explicit precedence rules.

## 4. geographic_assignments

| Field      | Type         | Constraints / Purpose |
| ---------- | ------------ | --------------------- |
| id         | UUID         | PK                    |
| user_id    | UUID         | FK users.id           |
| state      | VARCHAR(100) | Nullable              |
| district   | VARCHAR(100) | Nullable              |
| village    | VARCHAR(120) | Nullable              |
| is_active  | BOOLEAN      | NOT NULL DEFAULT TRUE |
| created_at | TIMESTAMPTZ  | NOT NULL              |

Purpose:

* Represents a user's authorized geographic scope if the existing system supports territory-based authorization.
* Do not use this table if the existing schema has an authoritative territory model.

## 5. categories

| Field           | Type         | Constraints / Purpose |
| --------------- | ------------ | --------------------- |
| id              | UUID         | PK                    |
| name            | VARCHAR(120) | NOT NULL              |
| normalized_name | VARCHAR(120) | NOT NULL              |
| is_active       | BOOLEAN      | NOT NULL DEFAULT TRUE |
| created_by      | UUID         | FK users.id           |
| updated_by      | UUID         | FK users.id           |
| created_at      | TIMESTAMPTZ  | NOT NULL              |
| updated_at      | TIMESTAMPTZ  | NOT NULL              |

Constraints:

* UNIQUE(normalized_name).
* Deactivation must not delete historical customer-category relationships.

## 6. customers

| Field               | Type          | Constraints / Purpose                                          |
| ------------------- | ------------- | -------------------------------------------------------------- |
| id                  | UUID          | PK                                                             |
| name                | VARCHAR(160)  | NOT NULL                                                       |
| email               | CITEXT        | NOT NULL                                                       |
| phone               | VARCHAR(20)   | Nullable unless existing policy requires it                    |
| category_id         | UUID          | FK categories.id                                               |
| created_by          | UUID          | FK users.id                                                    |
| assigned_seller_id  | UUID          | FK users.id; nullable if business permits unassigned customers |
| address_line        | VARCHAR(255)  | Nullable until required fields are verified                    |
| village             | VARCHAR(120)  | Nullable                                                       |
| district            | VARCHAR(100)  | Nullable                                                       |
| state               | VARCHAR(100)  | Nullable                                                       |
| postal_code         | VARCHAR(20)   | Nullable                                                       |
| latitude            | NUMERIC(10,7) | Nullable                                                       |
| longitude           | NUMERIC(10,7) | Nullable                                                       |
| location_accuracy_m | NUMERIC(10,2) | Nullable                                                       |
| photo_asset_id      | UUID          | Nullable FK to file_assets.id                                  |
| is_active           | BOOLEAN       | NOT NULL DEFAULT TRUE                                          |
| created_at          | TIMESTAMPTZ   | NOT NULL                                                       |
| updated_at          | TIMESTAMPTZ   | NOT NULL                                                       |

Constraints:

* Email is required and validated on the server.
* Do not impose global email uniqueness until the existing customer identity policy is confirmed.
* Coordinate ranges must be validated.
* Photo is optional.
* Location capture is foreground-only.

## 7. file_assets

| Field           | Type         | Constraints / Purpose               |
| --------------- | ------------ | ----------------------------------- |
| id              | UUID         | PK                                  |
| owner_user_id   | UUID         | FK users.id                         |
| storage_key     | TEXT         | NOT NULL; unique storage object key |
| mime_type       | VARCHAR(100) | NOT NULL                            |
| size_bytes      | BIGINT       | NOT NULL CHECK(size_bytes >= 0)     |
| checksum_sha256 | CHAR(64)     | Nullable                            |
| created_at      | TIMESTAMPTZ  | NOT NULL                            |

Purpose:

* Represents uploaded customer photos or other approved files.
* Do not store large binary objects in customer rows unless the existing architecture explicitly does so.
* Access to files must follow business authorization.

## 8. products

| Field                    | Type         | Constraints / Purpose                                            |
| ------------------------ | ------------ | ---------------------------------------------------------------- |
| id                       | UUID         | PK                                                               |
| name                     | VARCHAR(160) | NOT NULL                                                         |
| sku                      | VARCHAR(80)  | UNIQUE where supported                                           |
| description              | TEXT         | Nullable                                                         |
| unit_code                | VARCHAR(30)  | NOT NULL                                                         |
| base_price_paise         | BIGINT       | NOT NULL CHECK(base_price_paise >= 0)                            |
| minimum_sale_price_paise | BIGINT       | Nullable; global policy may instead be stored in system_settings |
| is_active                | BOOLEAN      | NOT NULL DEFAULT TRUE                                            |
| created_at               | TIMESTAMPTZ  | NOT NULL                                                         |
| updated_at               | TIMESTAMPTZ  | NOT NULL                                                         |

Note:

* Determine whether the minimum sale price is global, product-specific, or both before implementing.
* ₹25 is an example value until the initial production configuration is explicitly approved.

## 9. system_settings

| Field        | Type         | Constraints / Purpose |
| ------------ | ------------ | --------------------- |
| id           | UUID         | PK                    |
| setting_key  | VARCHAR(120) | NOT NULL UNIQUE       |
| value_json   | JSONB        | NOT NULL              |
| updated_by   | UUID         | FK users.id           |
| effective_at | TIMESTAMPTZ  | NOT NULL              |
| created_at   | TIMESTAMPTZ  | NOT NULL              |

Use:

* Store the minimum sale price or other globally configured business values only if this fits the existing configuration model.
* For historical reproducibility, preserve effective-dated configuration history instead of overwriting a value without history.
* Validate the setting's JSON shape in the backend.

## 10. warehouses

| Field                | Type         | Constraints / Purpose  |
| -------------------- | ------------ | ---------------------- |
| id                   | UUID         | PK                     |
| name                 | VARCHAR(160) | NOT NULL               |
| code                 | VARCHAR(60)  | UNIQUE                 |
| location_description | TEXT         | Nullable               |
| is_headquarters      | BOOLEAN      | NOT NULL DEFAULT FALSE |
| is_active            | BOOLEAN      | NOT NULL DEFAULT TRUE  |
| created_at           | TIMESTAMPTZ  | NOT NULL               |
| updated_at           | TIMESTAMPTZ  | NOT NULL               |

## 11. inventory_balances

| Field            | Type          | Constraints / Purpose     |
| ---------------- | ------------- | ------------------------- |
| id               | UUID          | PK                        |
| product_id       | UUID          | FK products.id            |
| warehouse_id     | UUID          | Nullable FK warehouses.id |
| seller_id        | UUID          | Nullable FK users.id      |
| quantity_on_hand | NUMERIC(14,3) | NOT NULL DEFAULT 0        |
| updated_at       | TIMESTAMPTZ   | NOT NULL                  |

Constraints:

* Exactly one location owner must be set: warehouse or seller, according to the chosen location model.
* UNIQUE(product_id, warehouse_id) for warehouse balances.
* UNIQUE(product_id, seller_id) for Seller balances.
* Enforce non-negative quantity if negative inventory is not a valid business state.
* If the existing system uses a different inventory location model, adapt this structure rather than duplicating balances.

## 12. inventory_transactions

| Field               | Type                                                                        | Constraints / Purpose          |
| ------------------- | --------------------------------------------------------------------------- | ------------------------------ |
| id                  | UUID                                                                        | PK                             |
| transaction_type    | ENUM('RECEIPT','TRANSFER_OUT','TRANSFER_IN','SALE','ADJUSTMENT','REVERSAL') | NOT NULL                       |
| product_id          | UUID                                                                        | FK products.id                 |
| quantity_delta      | NUMERIC(14,3)                                                               | NOT NULL; signed               |
| warehouse_id        | UUID                                                                        | Nullable FK warehouses.id      |
| seller_id           | UUID                                                                        | Nullable FK users.id           |
| related_transfer_id | UUID                                                                        | Nullable FK stock_transfers.id |
| related_sale_id     | UUID                                                                        | Nullable FK sales.id           |
| actor_user_id       | UUID                                                                        | FK users.id                    |
| idempotency_key     | VARCHAR(160)                                                                | Nullable                       |
| notes               | TEXT                                                                        | Nullable                       |
| created_at          | TIMESTAMPTZ                                                                 | NOT NULL                       |

Rules:

* Transactions are append-only where feasible.
* Corrections should use reversal/adjustment records rather than silently rewriting history.
* Sale-linked transactions are created only when the sale is confirmed.
* Add appropriate unique constraints for idempotent external mutations.

## 13. stock_transfers

| Field                    | Type                                  | Constraints / Purpose     |
| ------------------------ | ------------------------------------- | ------------------------- |
| id                       | UUID                                  | PK                        |
| source_warehouse_id      | UUID                                  | Nullable FK warehouses.id |
| source_seller_id         | UUID                                  | Nullable FK users.id      |
| destination_warehouse_id | UUID                                  | Nullable FK warehouses.id |
| destination_seller_id    | UUID                                  | Nullable FK users.id      |
| status                   | ENUM('DRAFT','CONFIRMED','CANCELLED') | NOT NULL                  |
| created_by               | UUID                                  | FK users.id               |
| confirmed_by             | UUID                                  | Nullable FK users.id      |
| notes                    | TEXT                                  | Nullable                  |
| created_at               | TIMESTAMPTZ                           | NOT NULL                  |
| confirmed_at             | TIMESTAMPTZ                           | Nullable                  |

Rules:

* Source and destination must differ.
* Confirmation must atomically validate and update inventory.
* Transfer lines belong in a separate `stock_transfer_items` table.

### stock_transfer_items

| Field       | Type          | Constraints / Purpose        |
| ----------- | ------------- | ---------------------------- |
| id          | UUID          | PK                           |
| transfer_id | UUID          | FK stock_transfers.id        |
| product_id  | UUID          | FK products.id               |
| quantity    | NUMERIC(14,3) | NOT NULL CHECK(quantity > 0) |

## 14. sales

| Field                        | Type                                                        | Constraints / Purpose                                          |
| ---------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| id                           | UUID                                                        | PK                                                             |
| sale_number                  | VARCHAR(80)                                                 | NOT NULL UNIQUE                                                |
| customer_id                  | UUID                                                        | FK customers.id                                                |
| seller_id                    | UUID                                                        | FK users.id                                                    |
| manager_id                   | UUID                                                        | Nullable FK users.id; reporting snapshot/reference             |
| status                       | ENUM('PENDING_APPROVAL','CONFIRMED','REJECTED','CANCELLED') | NOT NULL                                                       |
| payment_mode                 | ENUM('CASH','BANK','PENDING')                               | NOT NULL                                                       |
| payment_status               | ENUM('PENDING','PAID')                                      | NOT NULL; refine if existing business model differs            |
| subtotal_paise               | BIGINT                                                      | NOT NULL CHECK(subtotal_paise >= 0)                            |
| discount_paise               | BIGINT                                                      | NOT NULL DEFAULT 0 CHECK(discount_paise >= 0)                  |
| total_paise                  | BIGINT                                                      | NOT NULL CHECK(total_paise >= 0)                               |
| requested_unit_price_context | JSONB                                                       | Nullable; only if required to preserve submitted price context |
| minimum_price_snapshot_paise | BIGINT                                                      | Nullable                                                       |
| approval_required            | BOOLEAN                                                     | NOT NULL DEFAULT FALSE                                         |
| created_by                   | UUID                                                        | FK users.id                                                    |
| confirmed_at                 | TIMESTAMPTZ                                                 | Nullable                                                       |
| rejected_at                  | TIMESTAMPTZ                                                 | Nullable                                                       |
| created_at                   | TIMESTAMPTZ                                                 | NOT NULL                                                       |
| updated_at                   | TIMESTAMPTZ                                                 | NOT NULL                                                       |

Rules:

* Pending approval has no stock deduction, sold-count increment, earned incentive, or final invoice.
* Confirmation must be idempotent.
* Store the pricing inputs needed to explain the historical sale.
* Do not introduce partial-payment columns or behavior.

## 15. sale_items

| Field               | Type          | Constraints / Purpose                 |
| ------------------- | ------------- | ------------------------------------- |
| id                  | UUID          | PK                                    |
| sale_id             | UUID          | FK sales.id                           |
| product_id          | UUID          | FK products.id                        |
| quantity            | NUMERIC(14,3) | NOT NULL CHECK(quantity > 0)          |
| unit_price_paise    | BIGINT        | NOT NULL CHECK(unit_price_paise >= 0) |
| line_discount_paise | BIGINT        | NOT NULL DEFAULT 0                    |
| line_total_paise    | BIGINT        | NOT NULL CHECK(line_total_paise >= 0) |

Rules:

* Preserve the confirmed unit price and line totals.
* Validate all totals on the backend.
* Add tax fields only after the existing tax/invoice requirements are verified.

## 16. sale_approvals

| Field           | Type                                  | Constraints / Purpose |
| --------------- | ------------------------------------- | --------------------- |
| id              | UUID                                  | PK                    |
| sale_id         | UUID                                  | FK sales.id           |
| status          | ENUM('PENDING','APPROVED','REJECTED') | NOT NULL              |
| requested_by    | UUID                                  | FK users.id           |
| decided_by      | UUID                                  | Nullable FK users.id  |
| decision_reason | TEXT                                  | Nullable              |
| decision_notes  | TEXT                                  | Nullable              |
| requested_at    | TIMESTAMPTZ                           | NOT NULL              |
| decided_at      | TIMESTAMPTZ                           | Nullable              |

Constraints:

* One active approval record per sale unless the business explicitly supports multiple approval rounds.
* Decision transition must be conditional on the current pending state.
* The decision and sale state transition must be transactionally consistent.

## 17. sale_idempotency

| Field           | Type         | Constraints / Purpose |
| --------------- | ------------ | --------------------- |
| id              | UUID         | PK                    |
| actor_user_id   | UUID         | FK users.id           |
| idempotency_key | VARCHAR(160) | NOT NULL              |
| request_hash    | CHAR(64)     | NOT NULL              |
| sale_id         | UUID         | Nullable FK sales.id  |
| response_status | INTEGER      | Nullable              |
| created_at      | TIMESTAMPTZ  | NOT NULL              |
| expires_at      | TIMESTAMPTZ  | Nullable              |

Constraints:

* UNIQUE(actor_user_id, idempotency_key).
* Reusing a key with a different request hash must be rejected.
* A repeated request with the same key must return the original result or an equivalent safe reconciliation response.
* Retention duration must be defined by backend operations.

## 18. payments

| Field        | Type                          | Constraints / Purpose |
| ------------ | ----------------------------- | --------------------- |
| id           | UUID                          | PK                    |
| sale_id      | UUID                          | FK sales.id           |
| payment_mode | ENUM('CASH','BANK','PENDING') | NOT NULL              |
| status       | ENUM('PENDING','PAID')        | NOT NULL              |
| reference_id | VARCHAR(160)                  | Nullable              |
| recorded_by  | UUID                          | FK users.id           |
| recorded_at  | TIMESTAMPTZ                   | NOT NULL              |
| updated_at   | TIMESTAMPTZ                   | NOT NULL              |

Rules:

* Do not use multiple payment rows to simulate partial payments.
* If the existing application has an amount-based collection ledger, reconcile it with the no-partial-payment rule before migration.
* A payment reference must not be logged in full.

## 19. seller_incentive_rates

| Field          | Type          | Constraints / Purpose                  |
| -------------- | ------------- | -------------------------------------- |
| id             | UUID          | PK                                     |
| seller_id      | UUID          | FK users.id                            |
| rate_type      | VARCHAR(40)   | NOT NULL; define approved formula type |
| rate_value     | NUMERIC(12,6) | NOT NULL CHECK(rate_value >= 0)        |
| effective_from | TIMESTAMPTZ   | NOT NULL                               |
| effective_to   | TIMESTAMPTZ   | Nullable                               |
| created_by     | UUID          | FK users.id                            |
| created_at     | TIMESTAMPTZ   | NOT NULL                               |

Rules:

* Effective periods must not overlap for the same Seller and rate type unless the formula explicitly supports multiple concurrent components.
* Rate changes must preserve historical records.

## 20. sale_incentives

| Field                  | Type          | Constraints / Purpose        |
| ---------------------- | ------------- | ---------------------------- |
| id                     | UUID          | PK                           |
| sale_id                | UUID          | FK sales.id                  |
| seller_id              | UUID          | FK users.id                  |
| incentive_rate_id      | UUID          | FK seller_incentive_rates.id |
| applied_rate_value     | NUMERIC(12,6) | NOT NULL                     |
| eligible_amount_paise  | BIGINT        | NOT NULL                     |
| incentive_amount_paise | BIGINT        | NOT NULL                     |
| calculation_version    | VARCHAR(40)   | NOT NULL                     |
| calculated_at          | TIMESTAMPTZ   | NOT NULL                     |

Rules:

* Create or finalize the incentive only when the sale is confirmed.
* Snapshot the effective rate and calculation version.
* Do not recalculate historical incentives using the current rate.

## 21. invoices

| Field                 | Type                                                   | Constraints / Purpose                             |
| --------------------- | ------------------------------------------------------ | ------------------------------------------------- |
| id                    | UUID                                                   | PK                                                |
| sale_id               | UUID                                                   | FK sales.id; UNIQUE if one final invoice per sale |
| invoice_number        | VARCHAR(100)                                           | NOT NULL UNIQUE                                   |
| status                | ENUM('READY','EMAIL_PENDING','EMAILED','EMAIL_FAILED') | NOT NULL                                          |
| storage_key           | TEXT                                                   | Nullable                                          |
| generated_at          | TIMESTAMPTZ                                            | Nullable                                          |
| emailed_at            | TIMESTAMPTZ                                            | Nullable                                          |
| last_email_error_code | VARCHAR(100)                                           | Nullable                                          |
| created_at            | TIMESTAMPTZ                                            | NOT NULL                                          |

Rules:

* Final invoices are eligible only for confirmed sales.
* Email failure must not undo a confirmed sale.
* Invoice generation and email delivery should be independently retryable.
* Tax fields and numbering rules must follow the verified invoice requirements.

## 22. notifications

| Field             | Type         | Constraints / Purpose |
| ----------------- | ------------ | --------------------- |
| id                | UUID         | PK                    |
| recipient_user_id | UUID         | FK users.id           |
| event_type        | VARCHAR(100) | NOT NULL              |
| title             | VARCHAR(200) | NOT NULL              |
| body              | TEXT         | NOT NULL              |
| resource_type     | VARCHAR(80)  | Nullable              |
| resource_id       | UUID         | Nullable              |
| read_at           | TIMESTAMPTZ  | Nullable              |
| created_at        | TIMESTAMPTZ  | NOT NULL              |

Indexes:

* `(recipient_user_id, created_at DESC)`.
* `(recipient_user_id, read_at, created_at DESC)`.

Rules:

* Notifications must be backend-persisted.
* Read state must synchronize between website and mobile.
* Do not create WhatsApp delivery records or workflows.

## 23. audit_logs

| Field         | Type         | Constraints / Purpose             |
| ------------- | ------------ | --------------------------------- |
| id            | UUID         | PK                                |
| actor_user_id | UUID         | Nullable FK users.id              |
| action        | VARCHAR(120) | NOT NULL                          |
| resource_type | VARCHAR(100) | NOT NULL                          |
| resource_id   | UUID         | Nullable                          |
| request_id    | VARCHAR(120) | Nullable                          |
| before_state  | JSONB        | Nullable; redact sensitive values |
| after_state   | JSONB        | Nullable; redact sensitive values |
| created_at    | TIMESTAMPTZ  | NOT NULL                          |

Rules:

* Log approvals, price changes, incentive changes, stock movements, permission changes, and important user administration events.
* Never store passwords, bearer tokens, or unnecessary sensitive customer data.

## 24. Key Relationships

```text
users
 ├── customers.created_by
 ├── customers.assigned_seller_id
 ├── sales.seller_id
 ├── sale_approvals.requested_by
 ├── sale_approvals.decided_by
 ├── inventory_transactions.actor_user_id
 ├── seller_incentive_rates.seller_id
 └── notifications.recipient_user_id

customers ──< sales ──< sale_items >── products
                    ├── sale_approvals
                    ├── payments
                    ├── sale_incentives
                    └── invoices

warehouses ──< inventory_balances >── products
warehouses ──< inventory_transactions >── products
stock_transfers ──< stock_transfer_items >── products
```

## 25. Required Database Integrity Tests

* A pending sale does not create sale inventory transactions.
* Approval cannot confirm a sale twice.
* Two concurrent sales cannot oversell the same stock.
* A rejected sale does not deduct stock or earn incentives.
* A confirmed sale snapshots the correct incentive rate.
* Changing a rate does not alter previous incentive records.
* Duplicate idempotency keys cannot create duplicate sales.
* A category deactivation does not erase historical customer records.
* A final invoice cannot be created for a pending or rejected sale.
* Notification read state is persisted server-side.
