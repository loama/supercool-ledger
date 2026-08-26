# Operations

## Deployment

Render builds the Dockerfile, runs `bun run db:migrate`, starts the new instance, and waits for `/health/ready`. A failed migration or readiness check prevents the new revision from receiving traffic.

## Migrations

Migrations are ordered SQL files. The runner takes a PostgreSQL advisory lock, checks applied files, stores their SHA 256 checksums, and records each new file inside its database transaction. Concurrent runners therefore serialize. A changed applied file stops deployment and must be replaced by a new migration. Financial schema changes require compatible application rollout and a tested recovery procedure.

Migration 007 requires `REVIEWED_SANDBOX_TENANT_IDS` when an older database contains sandbox sessions. Set it to a comma separated allow list of tenant identifiers only after reviewing every existing session. The migration rejects an incomplete or unknown allow list. Clear the variable after the migration succeeds.

Readiness checks every migration shipped with the running artifact in addition to database connectivity. It uses a bounded connection attempt and returns `503` for an unavailable or stale database. A reachable but stale database does not receive traffic.

## Reconciliation

Run `bun run reconcile`. A clean run exits with zero. Any discrepancy produces a failure result. Do not repair the cached balance until the ledger and incident history explain the mismatch.

The authenticated reconciliation endpoint writes an immutable audit outcome with only the discrepancy count. It does not place account identifiers or balances in audit metadata.

The Render Blueprint never seeds demonstration money automatically. Reviewers invoke `bun run demo` explicitly against an assessment database.

## Incident sequence

1. Stop risky writes through the deployment edge if financial integrity is uncertain.
2. Preserve logs, traces, database state, and the deployed commit identifier.
3. Run reconciliation through a read only credential.
4. Identify affected journals and requests.
5. Correct financial history with new reversal postings. Never edit posted rows.
6. Reconcile again and document the decision.

## Recovery

The assessment deployment uses paid Render PostgreSQL for managed recovery. Recovery procedures must restore into a separate database, run migrations, verify reconciliation, and switch traffic only after evidence is clean.
