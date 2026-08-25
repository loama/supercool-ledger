# Operations

## Deployment

Render builds the Dockerfile, runs `bun run db:migrate`, starts the new instance, and waits for `/health/ready`. A failed migration or readiness check prevents the new revision from receiving traffic.

## Migrations

Migrations are ordered SQL files. The runner takes a PostgreSQL advisory lock, checks applied files, and records each new file inside its database transaction. Concurrent runners therefore serialize. Financial schema changes require compatible application rollout and a tested recovery procedure.

Readiness checks the latest expected migration in addition to database connectivity. A reachable but stale database does not receive traffic.

## Reconciliation

Run `bun run reconcile`. A clean run exits with zero. Any discrepancy produces a failure result. Do not repair the cached balance until the ledger and incident history explain the mismatch.

The authenticated reconciliation endpoint writes an immutable audit outcome with only the discrepancy count. It does not place account identifiers or balances in audit metadata.

## Incident sequence

1. Stop risky writes through the deployment edge if financial integrity is uncertain.
2. Preserve logs, traces, database state, and the deployed commit identifier.
3. Run reconciliation through a read only credential.
4. Identify affected journals and requests.
5. Correct financial history with new reversal postings. Never edit posted rows.
6. Reconcile again and document the decision.

## Recovery

The assessment deployment uses paid Render PostgreSQL for managed recovery. Recovery procedures must restore into a separate database, run migrations, verify reconciliation, and switch traffic only after evidence is clean.
