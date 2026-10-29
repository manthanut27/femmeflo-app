# SCORING ENGINE SPECIFICATION

## 1. Applicability

A standalone scoring engine is not required by the approved product scope.

The system requires:

* Configurable minimum sale price.
* Below-minimum-price approval.
* Seller-specific incentive rates.
* Historical incentive calculation.
* Sales and operational reports.

These are pricing, approval, and incentive rules, not a generalized ranking or machine-learning scoring engine.

This specification defines the deterministic rules needed for those capabilities. Do not introduce AI scoring, customer risk scoring, Seller ranking, or automated approval scoring without a separate product decision.

## 2. Minimum Sale Price Rule

Inputs:

* Product or products.
* Requested quantity.
* Requested unit price.
* Applicable minimum price configuration.
* Sale creation timestamp.
* Authenticated Seller.
* Applicable pricing policy.

Rules:

1. The backend loads the authoritative minimum price.
2. The backend validates the submitted price and quantities.
3. The backend determines whether approval is required.
4. The mobile client may preview the result but cannot authorize the sale.
5. The backend repeats the validation at the time of approval.
6. A changed minimum-price configuration must not silently rewrite an already recorded request; preserve the policy snapshot required to explain the decision.
7. The exact price comparison unit must be confirmed: per product unit, per line, or another approved pricing basis.
8. Currency arithmetic uses integer minor units, not floating-point arithmetic.

Target decision:

```text
if requested_price < applicable_minimum_price:
    approval_required = true
    status = PENDING_APPROVAL
else:
    approval_required = false
    proceed through normal sale validation
```

The comparison must use the business-approved price basis. Do not apply the pseudocode until that basis is confirmed.

## 3. Approval Decision Rules

Allowed states:

* `PENDING_APPROVAL`
* `CONFIRMED`
* `REJECTED`
* `CANCELLED` only if cancellation is explicitly supported

Rules:

* Only an authorized approver may decide.
* Only a pending record may transition to approved or rejected.
* A rejection requires a reason.
* Approval rechecks stock and applicable business rules.
* Duplicate decisions must not duplicate effects.
* Rejected sales remain visible in history.
* Pending and rejected sales do not deduct stock, increase sold counts, earn incentives, or receive final invoices.
* Confirmation effects must be transactionally consistent.

## 4. Incentive Calculation

### Required inputs

* Confirmed sale.
* Seller ID.
* Confirmation timestamp.
* Eligible sales amount or quantity according to the approved incentive formula.
* Incentive rate effective at confirmation.
* Calculation version.
* Rounding rule.

### Rules

* Incentive rates are Seller-specific.
* Rate changes are effective-dated.
* The effective rate is selected using the sale confirmation timestamp.
* Historical confirmed sales retain the rate and formula used for their calculation.
* Pending and rejected sales do not earn incentives.
* The backend computes authoritative incentive amounts.
* The mobile client displays server-provided results.

### Formula

The exact formula must be confirmed by the business before implementation.

Possible formula categories, not yet selected:

* Percentage of eligible confirmed sales value.
* Fixed amount per unit.
* Tiered rate.
* Product-specific rate.

Do not choose one implicitly.

If a percentage formula is approved, use integer monetary arithmetic with a documented rounding policy. For example:

```text
incentive_amount =
    round_using_approved_rule(
        eligible_amount * effective_rate
    )
```

The actual rate representation, eligible amount, and rounding mode must be specified by the business and backend owner.

## 5. Historical Rate Selection

For a sale confirmed at timestamp `T`:

* Select the applicable Seller rate whose effective period includes `T`.
* Reject ambiguous overlapping rate periods unless the formula explicitly supports multiple components.
* Snapshot the rate ID, numeric rate value, eligible amount, calculation version, and calculated amount.
* Do not recalculate a historical sale from the current rate.
* Any authorized correction must create an auditable adjustment rather than silently changing history.

## 6. Inventory and Sale Invariants

A scoring or incentive calculation must not execute as a separate, independently committed client operation.

For confirmed sales:

* Confirm sale state.
* Apply stock movement exactly once.
* Update sold metrics exactly once.
* Snapshot the applicable incentive rate.
* Create or finalize the incentive record according to the approved accounting workflow.
* Make the sale eligible for final invoice generation.

For pending or rejected sales:

* No stock movement.
* No sold-count increment.
* No earned incentive.
* No final invoice.

## 7. Determinism and Auditability

Given the same:

* Sale data.
* Confirmation timestamp.
* Applicable rate history.
* Formula version.
* Rounding policy.

The incentive calculation must produce the same result.

Record:

* Sale ID.
* Seller ID.
* Rate ID.
* Applied rate value.
* Eligible amount.
* Result.
* Calculation version.
* Calculation timestamp.
* Any adjustment reference.

## 8. Required Tests

* Price below minimum.
* Price exactly equal to minimum.
* Price above minimum.
* Minimum price changes after a request is submitted.
* Approval attempts by unauthorized roles.
* Duplicate approval.
* Concurrent approvals competing for the same stock.
* Seller rate changes after an earlier sale.
* Effective-date boundary conditions.
* Rounding boundary conditions.
* Rejected sale produces no incentive.
* Pending sale produces no incentive.
* Retried confirmed sale does not duplicate incentive records.

## 9. Explicitly Excluded

* Machine-learning score.
* AI-generated approval recommendation.
* Customer credit score.
* Seller ranking based on opaque weights.
* Dynamic price optimization.
* Fraud scoring.
* Automatic incentive formula selection.
