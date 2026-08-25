# Operations

## Deployment

Render builds the Dockerfile, runs `bun run db:migrate`, starts the new instance, and waits for `/health/ready`. A failed migration or readiness check prevents the new revision from receiving traffic.

## Migrations

Migrations are ordered SQL files. The runner records each applied file inside the database transaction. Financial schema changes require compatible application rollout and a tested recovery procedure.

## Reconciliation

Run `bun run reconcile`. A clean run exits with zero. Any discrepancy produces a failure result. Do not repair the cached balance until the ledger and incident history explain the mismatch.

## Incident sequence

1. Stop risky writes through the deployment edge if financial integrity is uncertain.
2. Preserve logs, traces, database state, and the deployed commit identifier.
3. Run reconciliation through a read only credential.
4. Identify affected journals and requests.
5. Correct financial history with new reversal postings. Never edit posted rows.
6. Reconcile again and document the decision.

## Recovery

The assessment deployment uses paid Render PostgreSQL for managed recovery. Recovery procedures must restore into a separate database, run migrations, verify reconciliation, and switch traffic only after evidence is clean.
