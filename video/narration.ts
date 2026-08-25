export const narrationText = `SuperCool Ledger is a deliberately narrow account balance service. Its promise is simple: money cannot disappear, duplicate, or be spent twice when requests race.

Immutable double entry postings are the source of truth. Cached balances exist for fast reads, but every posting and balance update commits in the same PostgreSQL transaction. Database constraints reject an unbalanced journal, and posted history cannot be changed or deleted.

The service is one TypeScript and Fastify application with one PostgreSQL authority. Authentication establishes the tenant and scopes. Route schemas validate the contract. The transfer module owns the only money movement path. Reconciliation independently derives balances from postings.

A transfer first claims its tenant scoped idempotency key. It then locks both accounts in sorted identifier order. Only after those locks are held does it validate ownership, currency, account state, and available funds. The transfer, two balanced postings, cached balances, audit event, and stored response commit together.

This demonstration ran against real PostgreSQL. A transfer of two hundred fifty dollars returned created. Repeating the same key returned the same transfer with no second financial effect. An overspend returned insufficient funds. The two postings sum to zero, and reconciliation found zero discrepancies across all three demo accounts.

Operational evidence is part of the design. Structured logs omit payloads and sensitive financial fields. Prometheus metrics use bounded labels. OpenTelemetry traces cover requests and financial operations. Unexpected exceptions can flow to Sentry, while expected business rejection remains a normal response.

The repository includes the OpenAPI contract, migration and concurrency tests, Docker delivery, a Render Blueprint, architecture decisions, threat model, operations guide, and the complete visible AI interaction record. The result favors proof over breadth: a small service whose critical claims can be read, run, and challenged.`;
