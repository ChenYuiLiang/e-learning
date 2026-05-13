# Recursive Sharing Spec
**Version**: 2026.05.13.V1  
**Objective**: Define how multi-level referral sharing is computed, persisted, and audited.

## 1. Business Rule
1. Level 1 (direct tutor): `20%` of order line amount.
2. Level N+1 (upline): `20%` of previous level share.
3. The chain source is `users.tutorEmail` (upline email).
4. If upline is missing, chain falls back to platform account `info@vibe-coding.tw`.
5. Iteration stops when:
   - `currentTutorEmail` is empty, or
   - `currentShare < 0.01`, or
   - current tutor is already `info@vibe-coding.tw`.

## 2. Formula
Given order line amount `A`:
- `L1 = A * 0.2`
- `L2 = L1 * 0.2 = A * 0.04`
- `L3 = L2 * 0.2 = A * 0.008`

Example (`A=1000`):
- L1 = 200
- L2 = 40
- L3 = 8
- L4 = 1.6
- L5 = 0.32
- L6 = 0.064
- L7 = 0.0128
- L8 = 0.00256 (below 0.01, stop before writing)

## 3. Execution Window
- Function: `calculateMonthlySharing` (Cloud Scheduler)
- Schedule: monthly on day 1 (`0 0 1 * *`)
- Time span: previous calendar month
- Order filter:
  - `orders.status == SUCCESS`
  - `paidAt` within previous month

## 4. Idempotency & Safety
Each ledger row uses deterministic document id:
- `idempotencyKey = sha256("${period}|${orderId}|${orderItemId}|${level}|${tutorEmail}")[:40]`
- Stored to `profit_ledger/{idempotencyKey}` with `set(..., { merge: true })`

This prevents duplicate entries when:
1. Scheduler retries.
2. Monthly job is rerun manually for same period.

## 5. Data Contract (`profit_ledger`)
Core fields:
- `idempotencyKey`
- `tutorEmail`
- `studentUid`
- `orderId`
- `orderItemId`
- `orderAmount`
- `shareAmount`
- `level`
- `referralLink`
- `period`
- `calculatedAt`

See also: `docs/database.md` section `profit_ledger`.

## 6. Operational Runbook
1. If expected share entry is missing:
   - Confirm order `status=SUCCESS`.
   - Confirm `paidAt` falls in target month.
   - Confirm order item amount > 0.
2. If upstream share always goes to platform:
   - Check `users/{uid}.tutorEmail` for upline link.
3. If duplicates are suspected:
   - Query by `idempotencyKey` and `period`.
   - Validate scheduler retries / manual rerun history.

## 7. Related Files
- `functions/index.js` (`calculateMonthlySharing`)
- `docs/database.md`
- `README.md`
