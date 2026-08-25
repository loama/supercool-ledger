# Architecture

## Service boundary

SuperCool Ledger is one deployable microservice and one PostgreSQL database. Accounts, transfers, postings, idempotency, reconciliation, and audit events remain modules inside that service.

This boundary keeps the financial commit inside one database transaction. Splitting the modules across network services would replace a readable transaction with distributed coordination that the assessment does not need.

## Source of truth

Immutable postings are the financial record. `accounts.balance_minor` is a cached value for fast reads. The transfer transaction updates both in one commit, and reconciliation compares the cache with the signed posting sum.

Postings carry the journal tenant. Composite foreign keys require every posting, transfer account, and transfer journal to share the same tenant and currency. A reversal trigger requires the original journal and reversal to belong to the same tenant. These checks protect the ledger even when a future script bypasses the HTTP layer.

Deferred commit checks cover both sides of each relationship. Every journal must contain balanced postings, every completed transfer must contain exactly its declared debit and credit, and every cached account balance must equal the immutable posting sum. A script cannot create an empty journal, invent a completed transfer, insert postings without updating balances, or update a balance without postings.

Every monetary value is an integer minor unit. The API accepts decimal strings and returns decimal strings. JavaScript floating point values never represent money.

## Concurrency

The service uses `READ COMMITTED` with explicit account row locks. A transfer locks both account rows in sorted identifier order. Competing writes to the same account serialize, and opposite direction transfers use the same order to reduce deadlocks.

The second transfer reads the balance only after it obtains the lock. It cannot spend a stale value.

Financial writes also take a shared lock on the tenant. Suspending a tenant waits for current work, then prevents new account creation and transfers.

The customer transfer API rejects system accounts on either side. Opening balances and future settlement flows require a separate privileged path rather than reusing customer authorization.

## Idempotency

The service claims the tenant, operation scope, and key inside the financial transaction. The row stores a canonical request hash and the completed response.

An identical replay returns the stored result. A different payload returns a conflict. If the transaction rolls back, its new idempotency row rolls back with it.

## Failure behavior

1. A process failure before commit leaves no financial change.
2. A lost response after commit is safe because the client can replay the key.
3. A database outage rejects writes instead of buffering money operations in memory.
4. An unbalanced journal fails at commit through a deferred database trigger.
5. A reconciliation mismatch emits an operational failure and never repairs history automatically.

Migration runners serialize through a PostgreSQL advisory lock. Each applied file stores a SHA 256 checksum, and changed history stops deployment. Readiness compares the database with every migration included in the running artifact.

## Availability choice

The service chooses consistency over accepting writes during database failure. Reads also use the primary database because a delayed replica can show a stale balance.

## Public contract

Fastify validates headers, parameters, queries, request bodies, and responses from TypeBox schemas. The same schemas generate `openapi.json` and the interactive `/docs` page. Problem responses use stable codes and do not expose database or validation internals.

Account statement pagination uses a cursor composed from posting time and posting identifier. This keeps the read order stable as newer immutable entries arrive.
