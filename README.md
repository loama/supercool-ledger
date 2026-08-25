# SuperCool Ledger

SuperCool Ledger is an account balance service built around one promise: every balance change has balanced immutable postings, concurrent requests cannot spend the same funds, and a retry cannot create a second transfer.

The service uses TypeScript, Bun, Fastify, and PostgreSQL. It is intentionally small. The interesting part is not the number of endpoints. It is the evidence behind the financial invariants.

## Review this repository

1. Read the invariants below.
2. Run `bun run demo` to watch success, replay, rejection, and reconciliation.
3. Read `src/transfers/service.ts` for the complete write transaction.
4. Read `migrations/001_initial.sql` for the database constraints and immutable ledger triggers.
5. Run `bun test test/integration/transfer-concurrency.test.ts` for the competing spend proof.
6. Open `/docs` for the interactive API contract.
7. Read `docs/ai-usage/` for the visible AI interaction record.
8. Watch `video/out/supercool-ledger.mp4` for the narrated design and execution walkthrough.

Public repository: https://github.com/loama/supercool-ledger

## API surface

| Method | Path                              | Scope             | Purpose                                                 |
| ------ | --------------------------------- | ----------------- | ------------------------------------------------------- |
| `POST` | `/v1/accounts`                    | `accounts:write`  | Create a zero balance account                           |
| `GET`  | `/v1/accounts/:accountId`         | `accounts:read`   | Read an account and cached balance                      |
| `GET`  | `/v1/accounts/:accountId/entries` | `accounts:read`   | Read immutable statement entries with cursor pagination |
| `POST` | `/v1/transfers`                   | `transfers:write` | Move funds atomically with an idempotency key           |
| `GET`  | `/v1/transfers/:transferId`       | `transfers:read`  | Read a tenant scoped transfer                           |
| `GET`  | `/v1/operations/reconciliation`   | `operations:read` | Compare cached balances with the ledger                 |

The OpenAPI document also covers liveness, readiness, metrics, and interactive documentation.

## Financial invariants

1. Every journal transaction balances to zero in one currency.
2. Posted journals and postings cannot change or disappear.
3. No endpoint can set an account balance directly.
4. Ledger postings and cached balances commit in the same PostgreSQL transaction.
5. One tenant scoped idempotency key can identify at most one transfer.
6. Customer account balances cannot become negative.
7. Internal transfers conserve total money.
8. Every query enforces the authenticated tenant.
9. Reconciliation derives each cached balance from immutable postings.

## Transfer path

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Database as PostgreSQL

    Client->>API: POST transfer with Idempotency Key
    API->>Database: Begin transaction
    API->>Database: Claim tenant scoped key
    API->>Database: Lock accounts in sorted identifier order
    API->>Database: Validate tenant, currency, state, and funds
    API->>Database: Insert transfer and balanced postings
    API->>Database: Update cached balances
    API->>Database: Store audit event and response
    API->>Database: Commit
    API-->>Client: Completed transfer
```

If the key already completed the same request, the stored response returns without another financial effect. If the payload differs, the service returns `409`.

## Components

```mermaid
flowchart LR
    Client --> Fastify
    Fastify --> Authentication
    Fastify --> Accounts
    Fastify --> Transfers
    Transfers --> Idempotency
    Transfers --> PostgreSQL
    PostgreSQL --> Ledger
    PostgreSQL --> CachedBalances
    Reconciliation --> Ledger
    Reconciliation --> CachedBalances
    Fastify --> Logs
    Fastify --> Metrics
    Fastify --> Traces
    Fastify --> Errors
```

## Run locally

Requirements are Bun 1.3.13 and Docker.

```bash
bun install --frozen-lockfile
bun run db:up
export DATABASE_URL=postgres://supercool:supercool@127.0.0.1:54329/supercool
export AUTH_SECRET=local-development-secret-with-at-least-32-characters
export METRICS_TOKEN=local-metrics-token
bun run db:migrate
bun run dev
```

The service listens on `http://localhost:3000`. Interactive documentation is at `http://localhost:3000/docs`.

## Run the correctness demonstration

With the same environment variables:

```bash
bun run demo
```

The command creates synthetic accounts through balanced opening postings, executes a transfer, repeats the request, attempts an overspend, displays the transfer postings, and runs reconciliation. It never prints the token or idempotency keys.

## Verification

```bash
bun run check
```

The complete gate runs formatting verification, linting, strict type checking, unit tests, PostgreSQL integration tests, property tests, contract tests, and a production build.

The risk evidence is direct:

| Risk                    | Control                                            | Executable evidence                             |
| ----------------------- | -------------------------------------------------- | ----------------------------------------------- |
| Duplicate movement      | Unique tenant scoped key and stored response       | `test/integration/transfers-api.test.ts`        |
| Concurrent overspend    | Sorted row locks and funds check after locking     | `test/integration/transfer-concurrency.test.ts` |
| Partial financial write | One PostgreSQL transaction                         | `test/integration/transfers-api.test.ts`        |
| Ledger mutation         | Immutable triggers and deferred balance constraint | `test/integration/ledger-constraints.test.ts`   |
| Cached balance drift    | Ledger reconciliation                              | `test/integration/reconciliation.test.ts`       |
| Tenant data exposure    | Tenant predicates on resource queries              | `test/integration/accounts-api.test.ts`         |
| Sensitive log exposure  | Structured field redaction                         | `test/unit/log-redaction.test.ts`               |

## Observability

The service emits structured JSON logs with request and trace identifiers. Redaction tests prevent tokens, request bodies, idempotency keys, balances, account names, and database URLs from entering logs.

`/metrics` requires a separate metrics token. Labels contain only bounded values such as route, method, status class, transfer outcome, and reconciliation outcome.

OpenTelemetry spans describe request processing and financial operations. Setting `OTEL_EXPORTER_OTLP_ENDPOINT` activates batched HTTP trace export. Unexpected exceptions go to Sentry only when `SENTRY_DSN` is configured. Expected outcomes such as insufficient funds remain normal API responses.

See `docs/observability.md` for metrics and alert guidance.

## Deployment

`render.yaml` defines a paid Render web service and paid PostgreSQL database in Frankfurt. Render runs migrations before deployment and checks `/health/ready` before routing traffic.

The Dockerfile pins Bun and uses the same application runtime locally, in CI, and on Render.

## Deliberate exclusions

This version does not implement foreign exchange, external bank settlement, cards, holds, interest, account deletion, distributed transactions, or a customer interface. Adding those features would require product policy that the assessment does not define.

## Documentation

1. `docs/architecture.md` explains the design and failure behavior.
2. `docs/threat-model.md` describes threats and controls.
3. `docs/observability.md` documents signals and redaction.
4. `docs/operations.md` covers migrations, reconciliation, and incidents.
5. `docs/cloud-deployment.md` explains Render and an AWS production evolution.
6. `docs/adr/` records the three financial architecture decisions.
7. `docs/ai-usage/` records visible project prompts and responses.
8. `docs/references.md` links the primary technical references used for the design.
9. `docs/video.md` explains how the walkthrough is generated and verified.

## License

MIT
