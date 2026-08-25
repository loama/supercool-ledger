# Threat model

## Protected assets

The protected assets are balances, immutable ledger history, tenant boundaries, authentication material, database credentials, and operational evidence.

## Threats and controls

1. Duplicate requests could move money twice. A tenant scoped unique idempotency key and stored response prevent it.
2. Concurrent debits could overspend an account. PostgreSQL row locks serialize balance mutation.
3. A caller could name another tenant's account. Every resource query includes the authenticated tenant identifier and returns a generic not found response.
4. SQL injection could alter ledger data. Every value uses a parameterized query and route schemas reject malformed input.
5. A compromised log destination could reveal financial data. Logger redaction removes tokens, keys, request bodies, names, balances, and connection strings.
6. An application defect could create an unbalanced journal. A deferred database constraint rejects the commit.
7. A privileged process could alter history. Database triggers reject updates and deletion of posted journals and postings.
8. A denial of service attempt could exhaust connections. The pool is bounded, payloads are schema limited, and deployment rate limits belong at the edge.
9. A script could join records from different tenants or currencies. Composite database foreign keys bind postings and transfers to their journal, tenant, account, and currency.
10. A suspended customer could reuse a valid token. Financial writes lock and verify tenant status inside their transaction.
11. Concurrent deployment hooks could apply a migration twice. The migration runner holds a PostgreSQL advisory lock across discovery and execution.
12. Audit history could be rewritten. Audit rows are append only, and reconciliation writes a durable outcome record.
13. A script could create an empty journal or unmatched transfer. Deferred commit constraints validate journals, transfers, postings, and cached balances together.
14. A caller could move system funds through the customer API. Customer transfers reject system accounts on either side.
15. An applied migration could be edited in place. Stored SHA 256 checksums stop deployment when history changes.

## Residual risk

The development JWT issuer is not a production identity system. The hosted assessment uses synthetic data. Expected rejected requests remain structured logs and bounded metrics rather than durable financial events. The assessment Blueprint uses one Render owner connection for migrations and runtime because it cannot provision a separate application credential declaratively. A production service must split migration, application, reconciliation, and recovery roles, then add row level security or an equivalent tenant policy. It would also use a managed identity provider, key rotation, network isolation, external rate limiting, and incident tested recovery.
