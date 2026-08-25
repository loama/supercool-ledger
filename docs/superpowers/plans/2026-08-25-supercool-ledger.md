# SuperCool Finances Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, publish, deploy, document, narrate, and independently verify a financial account balance microservice whose safety claims are demonstrated by PostgreSQL constraints and concurrency tests.

**Architecture:** One Fastify microservice owns accounts, transfers, ledger postings, idempotency, reconciliation, and audit records. PostgreSQL provides durable state, row locks, atomic commits, and deferred ledger constraints. The service emits structured logs, traces, metrics, and optional Sentry errors, then deploys to paid Render resources through a Blueprint.

**Tech Stack:** TypeScript, Bun, Fastify, TypeBox, PostgreSQL, explicit SQL, Pino, OpenTelemetry, Prometheus metrics, Sentry, Docker Compose, Render Blueprints, Mermaid, Remotion, ElevenLabs

**Spec:** `docs/superpowers/specs/2026-08-25-supercool-ledger-design.md`

## Global constraints

1. Use Bun for dependency management, scripts, tests, builds, and runtime.
2. Store money as integer minor units using TypeScript `bigint` and PostgreSQL `BIGINT`.
3. Never use floating point values for money.
4. Run every lock, constraint, and concurrency test against real PostgreSQL.
5. Write a failing behavior test before production code.
6. Keep the critical transfer transaction in explicit SQL.
7. Never log authorization headers, tokens, idempotency keys, account names, balances, or request bodies.
8. Keep the public repository free of secrets, personal data, and unrelated conversation history.
9. Capture every visible project prompt and response, including reviewer prompts and results.
10. Use synthetic demonstration data only.
11. Use conventional commits with no AI attribution.
12. Do not generate ElevenLabs audio until a restricted key and voice identifier are available.

## File map

`src/platform` owns configuration, application creation, database pooling, migrations, shutdown, and problem responses.

`src/money` owns exact decimal parsing and minor unit serialization.

`src/auth` owns development JWT verification, scopes, and tenant context.

`src/accounts` owns account creation, account reads, and ledger entry pagination.

`src/ledger` owns posting types and ledger invariants.

`src/idempotency` owns key validation, request hashing, claiming, replay, and conflict decisions.

`src/transfers` owns transfer validation, deterministic locking, posting insertion, balance updates, audit insertion, and response persistence.

`src/reconciliation` owns ledger comparison and the command entry point.

`src/observability` owns logging redaction, metrics, tracing, and Sentry configuration.

`test` contains unit, integration, concurrency, property, contract, and smoke tests.

`scripts` contains migration, seed, token, demonstration, capture, and verification commands.

`video` contains Remotion compositions, narration, captions, and sanitized demonstration assets.

`docs` contains architecture, threat, operations, observability, decisions, AI records, and review reports.

### Task 1: Repository and executable health service

**Files:**

- Create: `package.json`
- Create: `bunfig.toml`
- Create: `tsconfig.json`
- Create: `eslint.config.js`
- Create: `.prettierrc.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `src/platform/config.ts`
- Create: `src/platform/problem.ts`
- Create: `src/app.ts`
- Create: `src/server.ts`
- Test: `test/unit/app-health.test.ts`

**Interfaces:**

- Produces: `buildApp(options?: AppOptions): Promise<FastifyInstance>`
- Produces: `loadConfig(env: Record<string, string | undefined>): AppConfig`

- [ ] **Step 1: Create the package manifest and strict configuration**

Use pinned dependencies for Fastify, TypeBox, PostgreSQL, JWT, Pino, OpenTelemetry, Prometheus metrics, Sentry, and test helpers. Add scripts for `dev`, `start`, `test`, `typecheck`, `lint`, `format:check`, `build`, and `check`.

- [ ] **Step 2: Write the failing health test**

```typescript
import { expect, test } from 'bun:test';
import { buildApp } from '../../src/app';

test('reports liveness without a database dependency', async () => {
  const app = await buildApp({ database: null });
  const response = await app.inject({ method: 'GET', url: '/health/live' });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ status: 'alive' });
  await app.close();
});
```

- [ ] **Step 3: Run the test and confirm it fails because `buildApp` is missing**

Run `bun test test/unit/app-health.test.ts`.

- [ ] **Step 4: Implement the smallest Fastify application**

Register `/health/live`, central Problem Details errors, request identifiers, and graceful close hooks. Keep database readiness separate from liveness.

- [ ] **Step 5: Run health, type, lint, and format checks**

Run `bun test test/unit/app-health.test.ts`, `bun run typecheck`, `bun run lint`, and `bun run format:check`.

- [ ] **Step 6: Commit the executable foundation**

Commit as `feat(platform): add executable health service`.

### Task 2: Exact money domain

**Files:**

- Create: `src/money/money.ts`
- Create: `src/money/currencies.ts`
- Test: `test/unit/money.test.ts`
- Test: `test/property/money.property.test.ts`

**Interfaces:**

- Produces: `parseMoney(input: MoneyInput): Money`
- Produces: `formatMinorUnits(amountMinor: bigint, currency: Currency): string`
- Produces: `MoneyInput`, `Money`, and `Currency`

- [ ] **Step 1: Write failing examples for exact parsing**

```typescript
test('parses two decimal currencies without floating point', () => {
  expect(parseMoney({ amount: '1250.04', currency: 'USD' })).toEqual({
    amountMinor: 125004n,
    currency: 'USD',
  });
});

test('rejects excess fractional digits', () => {
  expect(() => parseMoney({ amount: '1.001', currency: 'USD' })).toThrow('invalid_amount');
});
```

- [ ] **Step 2: Confirm the tests fail for the missing parser**

Run `bun test test/unit/money.test.ts`.

- [ ] **Step 3: Implement decimal string parsing with `bigint`**

Accept canonical positive decimal strings, enforce currency exponents, reject signs, scientific notation, whitespace, zero, and values beyond the configured limit.

- [ ] **Step 4: Add property tests for round trips**

Generate safe positive minor unit values, format them, parse them, and assert equality.

- [ ] **Step 5: Run all money tests and commit**

Commit as `feat(money): add exact minor unit representation`.

### Task 3: PostgreSQL schema and migration safety

**Files:**

- Create: `docker-compose.yml`
- Create: `migrations/001_initial.sql`
- Create: `src/platform/database.ts`
- Create: `src/platform/migrate.ts`
- Create: `scripts/migrate.ts`
- Create: `test/helpers/database.ts`
- Test: `test/integration/migrations.test.ts`
- Test: `test/integration/ledger-constraints.test.ts`

**Interfaces:**

- Produces: `Database` with `query`, `connect`, `transaction`, and `close`
- Produces: `migrate(database): Promise<void>`
- Produces: test helpers `withDatabase` and `resetDatabase`

- [ ] **Step 1: Write a failing empty database migration test**

Create a temporary schema, run migrations, and assert that the required tables, indexes, constraints, and trigger functions exist.

- [ ] **Step 2: Start PostgreSQL and verify the migration test fails**

Run `bun run db:up` and `bun test test/integration/migrations.test.ts`.

- [ ] **Step 3: Add the initial migration**

Create `tenants`, `accounts`, `journal_transactions`, `postings`, `transfers`, `idempotency_records`, and `audit_events`. Add foreign keys, tenant indexes, positive transfer checks, nonnegative cached balance checks, append only triggers, and a deferred constraint trigger that verifies same currency postings sum to zero.

- [ ] **Step 4: Write failing constraint tests**

Attempt an unbalanced journal commit, a posting update, a posting delete, and a negative cached balance. Assert PostgreSQL rejects each operation.

- [ ] **Step 5: Run migration and constraint tests**

Run `bun test test/integration/migrations.test.ts test/integration/ledger-constraints.test.ts`.

- [ ] **Step 6: Commit schema and database foundation**

Commit as `feat(database): add immutable ledger schema`.

### Task 4: Authentication and tenant isolation

**Files:**

- Create: `src/auth/token.ts`
- Create: `src/auth/plugin.ts`
- Create: `src/auth/context.ts`
- Create: `scripts/token.ts`
- Test: `test/unit/auth.test.ts`
- Test: `test/integration/tenant-isolation.test.ts`

**Interfaces:**

- Produces: `signDevelopmentToken(claims, secret): Promise<string>`
- Produces: Fastify request property `auth: AuthContext`
- Consumes: `AppConfig.authSecret`

- [ ] **Step 1: Write failing JWT and scope tests**

Test valid claims, expired tokens, invalid signatures, missing tenant identifiers, and missing scopes.

- [ ] **Step 2: Confirm authentication tests fail**

Run `bun test test/unit/auth.test.ts`.

- [ ] **Step 3: Implement authentication plugin and token command**

Verify bearer tokens, require `sub`, `tenant_id`, `scope`, `iat`, and `exp`, then attach an immutable context to the request.

- [ ] **Step 4: Write and run tenant isolation integration tests**

Create two tenants. Confirm one tenant receives `404` for the other tenant's known account identifier.

- [ ] **Step 5: Commit authentication boundary**

Commit as `feat(auth): enforce scoped tenant access`.

### Task 5: Account API and immutable entry reads

**Files:**

- Create: `src/accounts/schemas.ts`
- Create: `src/accounts/repository.ts`
- Create: `src/accounts/service.ts`
- Create: `src/accounts/routes.ts`
- Test: `test/integration/accounts-api.test.ts`

**Interfaces:**

- Produces: `createAccount`, `getAccount`, and `listAccountEntries`
- Produces: routes for account create, read, and cursor based entry listing

- [ ] **Step 1: Write failing account API tests**

Test zero balance creation, exact string serialization, duplicate identifiers, unauthorized access, tenant isolation, and stable cursor pagination.

- [ ] **Step 2: Confirm account tests fail at missing routes**

Run `bun test test/integration/accounts-api.test.ts`.

- [ ] **Step 3: Implement schemas, repository, service, and routes**

Every query includes `tenant_id`. Creation always sets zero balance. Responses serialize minor units as strings.

- [ ] **Step 4: Run account and tenant tests**

Run `bun test test/integration/accounts-api.test.ts test/integration/tenant-isolation.test.ts`.

- [ ] **Step 5: Commit account API**

Commit as `feat(accounts): add tenant scoped account API`.

### Task 6: Idempotency state machine

**Files:**

- Create: `src/idempotency/key.ts`
- Create: `src/idempotency/hash.ts`
- Create: `src/idempotency/repository.ts`
- Test: `test/unit/idempotency.test.ts`
- Test: `test/integration/idempotency-concurrency.test.ts`

**Interfaces:**

- Produces: `validateIdempotencyKey(value): string`
- Produces: `hashRequest(value): string`
- Produces: `claimIdempotency(client, input): Promise<ClaimResult>`

- [ ] **Step 1: Write failing validation and hashing tests**

Accept visible ASCII keys of bounded length. Reject empty, oversized, or control character values. Canonicalize request objects before hashing.

- [ ] **Step 2: Implement key validation and canonical hashing**

Use SHA 256 over canonical JSON. Never log the original key.

- [ ] **Step 3: Write a failing concurrent claim test**

Use two database clients and one tenant, scope, and key. Confirm only one transaction owns a new claim and the second observes its committed state.

- [ ] **Step 4: Implement the database claim and replay decisions**

Return `new`, `replay`, `conflict`, or `in_progress`. A rolled back transaction must release the claim because claim creation occurs inside the financial transaction.

- [ ] **Step 5: Run all idempotency tests and commit**

Commit as `feat(idempotency): persist request replay decisions`.

### Task 7: Atomic transfer service

**Files:**

- Create: `src/transfers/schemas.ts`
- Create: `src/transfers/errors.ts`
- Create: `src/transfers/repository.ts`
- Create: `src/transfers/service.ts`
- Create: `src/transfers/routes.ts`
- Test: `test/integration/transfers-api.test.ts`
- Test: `test/integration/transfer-rollback.test.ts`

**Interfaces:**

- Produces: `createTransfer(context, command, key): Promise<TransferResult>`
- Produces: `getTransfer(context, id): Promise<TransferView>`
- Consumes: money parsing, authentication context, database transaction, and idempotency state

- [ ] **Step 1: Write failing successful transfer and response tests**

Assert `201`, balanced postings, updated cached balances, completed transfer, audit event, and stored response.

- [ ] **Step 2: Confirm tests fail before transfer code exists**

Run `bun test test/integration/transfers-api.test.ts`.

- [ ] **Step 3: Implement the explicit SQL transaction**

Begin one database transaction, claim idempotency, select both tenant scoped accounts with `FOR UPDATE` in sorted identifier order, validate state and currency, insert transfer and journal records, insert two postings, update both balances, insert the audit event, persist the response, and commit.

- [ ] **Step 4: Write failing error and rollback tests**

Test insufficient funds, same account transfer, wrong currency, closed account, unknown account, cross tenant destination, and injected failure after posting insertion.

- [ ] **Step 5: Implement structured domain errors and rollback behavior**

Map expected domain errors to Problem Details without sending them to Sentry.

- [ ] **Step 6: Run transfer, constraint, and rollback tests**

Run `bun test test/integration/transfers-api.test.ts test/integration/transfer-rollback.test.ts test/integration/ledger-constraints.test.ts`.

- [ ] **Step 7: Commit atomic transfers**

Commit as `feat(transfers): add atomic ledger transfers`.

### Task 8: Concurrency and property proof

**Files:**

- Create: `test/integration/transfer-concurrency.test.ts`
- Create: `test/property/ledger.property.test.ts`
- Create: `test/helpers/parallel.ts`

**Interfaces:**

- Consumes: public transfer API and independent PostgreSQL connections
- Produces: repeatable proofs for overspend prevention, duplicate safety, conservation, and lock ordering

- [ ] **Step 1: Write the concurrent overspend test**

Fund one source with 10000 minor units. Launch two transfers of 8000 minor units to different destinations through separate connections. Assert one succeeds, one receives insufficient funds, the source holds 2000, and total money remains 10000.

- [ ] **Step 2: Run the test repeatedly and confirm it fails without locking proof**

Run `bun test test/integration/transfer-concurrency.test.ts --rerun-each 10` or the equivalent loop supported by the test command.

- [ ] **Step 3: Correct any locking or transaction defects exposed by the test**

Do not add process locks. PostgreSQL remains the coordination authority.

- [ ] **Step 4: Add concurrent duplicate and opposite direction transfer tests**

Prove one financial effect for duplicate keys and no deadlock for transfers that name accounts in opposite source order.

- [ ] **Step 5: Add generated transfer sequence tests**

Generate valid and invalid transfers, then assert total conservation, nonnegative balances, and ledger equality after every committed sequence.

- [ ] **Step 6: Run the concurrency suite repeatedly and commit**

Commit as `test(transfers): prove concurrent balance safety`.

### Task 9: Reconciliation and operational audit

**Files:**

- Create: `src/reconciliation/service.ts`
- Create: `src/reconciliation/command.ts`
- Create: `scripts/reconcile.ts`
- Create: `src/ledger/seed.ts`
- Create: `scripts/seed.ts`
- Test: `test/integration/reconciliation.test.ts`

**Interfaces:**

- Produces: `reconcile(database): Promise<ReconciliationResult>`
- Produces: deterministic synthetic seed command

- [ ] **Step 1: Write failing clean and mismatch reconciliation tests**

Confirm a correct ledger exits cleanly. Create a mismatch with a privileged test connection and confirm discrepancy identifiers, audit event, and failure status.

- [ ] **Step 2: Implement read only reconciliation**

Never repair automatically. Emit only internal account identifiers and no amounts in logs.

- [ ] **Step 3: Write and implement the seed command through ledger postings**

The seed creates one tenant, a system treasury account, three customer accounts, and opening journals. It never updates balances without postings.

- [ ] **Step 4: Run reconciliation tests and commit**

Commit as `feat(operations): add ledger reconciliation`.

### Task 10: Logs, metrics, traces, and errors

**Files:**

- Create: `src/observability/logger.ts`
- Create: `src/observability/metrics.ts`
- Create: `src/observability/tracing.ts`
- Create: `src/observability/errors.ts`
- Create: `src/observability/plugin.ts`
- Test: `test/unit/log-redaction.test.ts`
- Test: `test/integration/metrics.test.ts`
- Test: `test/integration/tracing.test.ts`
- Test: `test/integration/error-capture.test.ts`

**Interfaces:**

- Produces: `createLogger`, `metricsRegistry`, `withSpan`, and `captureUnexpectedError`
- Consumes: request lifecycle and transfer outcome events

- [ ] **Step 1: Write failing log redaction tests**

Feed headers, keys, account names, balances, request bodies, and connection strings through captured logs. Assert none appear.

- [ ] **Step 2: Implement recursive redaction and request logging**

Allow request identifier, trace identifier, method, route, status, duration, stable error code, and transfer identifier.

- [ ] **Step 3: Write failing metric label and count tests**

Assert transfer outcomes, idempotency replays, authentication failures, reconciliation discrepancies, request latency, and pool waits. Reject high cardinality labels.

- [ ] **Step 4: Implement Prometheus metrics and protected metrics route**

- [ ] **Step 5: Write failing trace and Sentry boundary tests**

Expected domain errors create spans but no Sentry issue. Unexpected exceptions create a redacted Sentry event when enabled.

- [ ] **Step 6: Implement OpenTelemetry and optional Sentry adapters**

- [ ] **Step 7: Run observability tests and commit**

Commit as `feat(observability): instrument financial operations`.

### Task 11: OpenAPI and deterministic demonstration

**Files:**

- Create: `src/platform/openapi.ts`
- Create: `scripts/demo.ts`
- Create: `scripts/demo-capture.ts`
- Create: `test/contract/openapi.test.ts`
- Create: `test/integration/demo.test.ts`
- Generate: `openapi.json`
- Generate: `video/assets/demo-run.json`

**Interfaces:**

- Produces: `/docs` and `/openapi.json`
- Produces: sanitized deterministic `DemoRun`

- [ ] **Step 1: Write failing OpenAPI contract tests**

Validate every route, security scheme, `Idempotency-Key`, money string, response, and Problem Details example.

- [ ] **Step 2: Implement OpenAPI generation from route schemas**

- [ ] **Step 3: Write the failing demonstration integration test**

Assert the demo resets synthetic data, transfers funds, replays the request, attempts an overspend, runs reconciliation, and writes no token or idempotency key.

- [ ] **Step 4: Implement terminal and JSON capture commands**

- [ ] **Step 5: Run contract and demo tests, regenerate checked artifacts, and commit**

Commit as `feat(demo): add reproducible correctness walkthrough`.

### Task 12: Containers, CI, and Render Blueprint

**Files:**

- Create: `Dockerfile`
- Create: `.dockerignore`
- Modify: `docker-compose.yml`
- Create: `render.yaml`
- Create: `.github/workflows/ci.yml`
- Create: `.github/dependabot.yml`
- Create: `scripts/smoke.ts`
- Test: `test/smoke/container.test.ts`

**Interfaces:**

- Produces: one reproducible application image and one Render deployment definition

- [ ] **Step 1: Write the container smoke test**

Build the image, start it against PostgreSQL, wait for readiness, call liveness and readiness, then stop cleanly.

- [ ] **Step 2: Implement a minimal non root Docker image**

Pin the Bun base image by version, copy only required files, run as a non root user, declare health behavior, and handle termination signals.

- [ ] **Step 3: Add CI gates**

Use pinned action commits. Run frozen install, format, lint, type check, tests with PostgreSQL, OpenAPI validation, Docker smoke, secret scan, and Blueprint validation.

- [ ] **Step 4: Add paid Render Blueprint**

Define one Docker web service, one paid PostgreSQL database, a predeploy migration command, readiness path, internal database URL, and secret placeholders.

- [ ] **Step 5: Run local image and configuration verification**

Run `bun run check`, Docker smoke, `docker compose config`, and the available Render Blueprint validator.

- [ ] **Step 6: Commit deployment assets**

Commit as `build(deploy): add reproducible Render deployment`.

### Task 13: Reviewer documentation and AI record

**Files:**

- Create: `README.md`
- Create: `docs/architecture.md`
- Create: `docs/threat-model.md`
- Create: `docs/observability.md`
- Create: `docs/operations.md`
- Create: `docs/cloud-deployment.md`
- Create: `docs/adr/001-immutable-ledger.md`
- Create: `docs/adr/002-locked-balance-cache.md`
- Create: `docs/adr/003-database-idempotency.md`
- Create: `docs/ai-usage/manifest.json`
- Create: project interaction records under `docs/ai-usage/`
- Test: `test/docs/links.test.ts`
- Test: `test/docs/evidence-map.test.ts`

**Interfaces:**

- Produces: a direct public reviewer path and complete visible AI disclosure

- [ ] **Step 1: Write failing link and evidence map tests**

Require every README path, command, diagram source, risk, mechanism, and test reference to exist.

- [ ] **Step 2: Write the README and supporting documents**

Lead with the money safety claim, hosted links, local command, invariants, two diagrams, demonstration, evidence map, limitations, and AI disclosure.

- [ ] **Step 3: Build the AI transcript manifest**

Record every visible project prompt, response, reviewer prompt, reviewer result, affected artifact, and correction. Exclude hidden platform messages, credentials, and unrelated prior work.

- [ ] **Step 4: Run prose, link, command, and secret checks**

- [ ] **Step 5: Commit reviewer documentation**

Commit as `docs: add ledger design and review guide`.

### Task 14: Remotion explanation with ElevenLabs narration

**Files:**

- Create: `video/package.json` only if isolated dependency boundaries require it
- Create: `video/src/index.ts`
- Create: `video/src/Root.tsx`
- Create: `video/src/LedgerExplainer.tsx`
- Create: `video/src/scenes/`
- Create: `video/src/components/`
- Create: `video/src/theme.ts`
- Create: `video/narration/script.json`
- Create: `video/narration/captions.json`
- Create: `scripts/video-voice.ts`
- Create: `scripts/video-render.ts`
- Generate: `video/assets/narration.mp3`
- Generate: `video/out/supercool-ledger.mp4`
- Test: `test/video/data-integrity.test.ts`
- Test: `test/video/frames.test.ts`

**Interfaces:**

- Consumes: `video/assets/demo-run.json`, narration script, captions, architecture data, and ElevenLabs audio
- Produces: final MP4 and deterministic render metadata

- [ ] **Step 1: Write failing video data integrity tests**

Assert every transfer identifier, amount, balance, replay, rejection, and reconciliation result shown in the video exists in `demo-run.json`.

- [ ] **Step 2: Implement the restrained visual system**

Use off white, charcoal, muted green, restrained yellow, Geist typography, flat diagrams, precise number alignment, minimal shadows, and motion through transform and opacity. Avoid generic card grids, neon, fake terminals, and decorative animation.

- [ ] **Step 3: Build scenes from real data**

Create scenes for risk, ledger, locking, idempotency, live success, replay, overspend rejection, observability, reconciliation, and final links.

- [ ] **Step 4: Write and review narration and captions**

The spoken explanation must match the architecture documents and captured outputs exactly.

- [ ] **Step 5: Generate ElevenLabs narration**

Require `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`. Send only the approved narration. Store generation metadata without secret values. Never print the key.

- [ ] **Step 6: Render and inspect representative frames**

Render the video, inspect frames from every scene, verify audio synchronization and captions, then run `ffprobe` for dimensions, duration, audio stream, and codec metadata.

- [ ] **Step 7: Commit video sources and approved artifact**

Commit as `feat(video): explain ledger safety with real data`.

### Task 15: Public GitHub and paid Render release

**Files:**

- Modify: README hosted links
- Create: `docs/release-verification.md`

**Interfaces:**

- Produces: public repository, pull request, green CI, hosted API, hosted docs, and verified release record

- [ ] **Step 1: Create the public GitHub repository and feature branch**

Create `supercool-ledger` under the authenticated account. Use branch `feat/financial-ledger-service` and assign the pull request to `loama`.

- [ ] **Step 2: Run the high risk prepush gate**

Inspect all changes, run `git diff --check`, scan secrets and binaries, run the full check, Docker smoke, video integrity, and documentation verification.

- [ ] **Step 3: Push logical commits and create the pull request**

Use a conventional title and structured body. Apply `feature`, `security`, and `documentation` labels.

- [ ] **Step 4: Provision paid Render resources from `render.yaml`**

Provide secret values through Render, deploy, run migrations, seed synthetic data, and verify the exact deployed commit.

- [ ] **Step 5: Verify hosted behavior**

Check health, OpenAPI, account read, successful transfer, idempotent replay, overspend rejection, metrics protection, log redaction, and reconciliation.

- [ ] **Step 6: Update links, push, and monitor CI and deployment**

Continue until every reported check finishes without failure and the pull request is mergeable.

### Task 16: Verification round one

**Files:**

- Create: `docs/reviews/round-1-correctness.md`
- Create: `docs/reviews/round-1-operations.md`
- Create: `docs/reviews/round-1-presentation.md`
- Create: `docs/reviews/round-1-judgment.md`

**Interfaces:**

- Consumes: complete local repository, public pull request, Render deployment, and video
- Produces: independently sourced findings, judged resolutions, fixes, and fresh verification evidence

- [ ] **Step 1: Dispatch three independent reviewers**

Reviewer one examines financial correctness and security. Reviewer two examines implementation, tests, observability, CI, and deployment. Reviewer three examines documentation, AI disclosure, hosted demonstration, narration, captions, and video.

- [ ] **Step 2: Judge every finding against code and reproducible evidence**

Reject unsupported findings with a written reason. Convert every valid finding into a failing test or direct artifact check before changing code.

- [ ] **Step 3: Apply confirmed fixes through test driven cycles**

- [ ] **Step 4: Run the complete local and hosted verification gate**

- [ ] **Step 5: Commit the review record and fixes**

Commit as `fix: resolve first independent review` and `docs: record first review judgment` where logical separation permits.

### Task 17: Verification round two

**Files:**

- Create: `docs/reviews/round-2-correctness.md`
- Create: `docs/reviews/round-2-operations.md`
- Create: `docs/reviews/round-2-presentation.md`
- Create: `docs/reviews/round-2-judgment.md`
- Modify: `docs/release-verification.md`

**Interfaces:**

- Consumes: corrected repository and deployment after round one
- Produces: final independent evidence and Eduardo handoff state

- [ ] **Step 1: Dispatch three fresh independent reviewers with no round one conclusions**

- [ ] **Step 2: Judge findings and reproduce valid defects**

- [ ] **Step 3: Apply confirmed fixes through test driven cycles**

- [ ] **Step 4: Run a clean checkout installation and complete check**

- [ ] **Step 5: Verify GitHub, CI, Render, OpenAPI, demonstration, observability, AI transcript, narration, captions, and video**

- [ ] **Step 6: Record exact commands, commit identifiers, deployment identifier, and artifact checksums**

- [ ] **Step 7: Push, monitor every check, and prepare the final user verification guide**

Commit as `fix: resolve second independent review` and `docs: record final verification` where logical separation permits.
