# Release verification

This record describes the final evidence for the public assessment release on 26 August 2026.

## Release identity

1. Repository: https://github.com/loama/supercool-ledger
2. Review pull request: https://github.com/loama/supercool-ledger/pull/8
3. Application release commit: `c6e3079119e97b9051d6c5f9b382608b85496120`
4. Live service: https://supercool-ledger.onrender.com
5. Reviewer sandbox: https://supercool-ledger.onrender.com/sandbox
6. Interactive API reference: https://supercool-ledger.onrender.com/docs/
7. Render service: `srv-da71hq67bikc73eiu90g`
8. Render database: `dpg-da713295efls738aods0-a`
9. Render deployment: `dep-da73ioe7bikc73epqtcg`

## Local verification

`bun run check` completed with 65 passing tests, 423 assertions, strict TypeScript checks, lint, formatting verification, and a production build.

`bun audit --production` reported no known production dependency vulnerabilities.

The concurrency integration test used PostgreSQL row locks rather than mocks. The complete suite also covered database idempotency, rollback, tenant isolation, immutable history, balanced postings, transfer semantics, cached balance consistency, reconciliation, sandbox admission, sandbox retention, redaction, tracing, OpenAPI, and video evidence.

## Container verification

The final Docker image was rebuilt from the repository. A fresh PostgreSQL 17 container received all migrations from that image. The application image then returned these results:

1. `/health/ready` returned `200`.
2. `/openapi.json` returned `200` with JSON.
3. `/docs/` returned `200` with HTML.
4. `/metrics` returned `401` without its token.
5. `/metrics` returned `200` with Prometheus text when its token was supplied.
6. `/sandbox` returned `200` with the English reviewer console.
7. `POST /v1/sandbox/sessions` returned `201` from the running image.

The two temporary smoke containers were removed after verification.

## GitHub verification

Pull request 8 was mergeable and received successful `verify` and `container` checks at reviewed head `7d7449922b16214af588cc32b716dc053b3627c0`. The merge preserved the logical commit history and promoted the reviewed branch to `main` as `c6e3079119e97b9051d6c5f9b382608b85496120`.

The `main` pipeline also passed both jobs for the merged commit. The public repository default branch is `main`. Later documentation commits do not alter the runtime source recorded above.

## Render verification

The Blueprint associates the paid PostgreSQL 17 database with the paid Docker web service in Frankfurt. Manual deployment `dep-da73htp5efls738idutg` first built application commit `c6e3079119e97b9051d6c5f9b382608b85496120`, completed `bun run db:migrate`, started the service, and passed `/health/ready`. A Blueprint sync then applied `SANDBOX_ENABLED=true` from `render.yaml` and produced final live deployment `dep-da73ioe7bikc73epqtcg` from the same application commit.

Direct public checks returned:

1. `/health/live` returned `200` and `{"status":"alive"}`.
2. `/health/ready` returned `200` and `{"status":"ready"}`.
3. `/openapi.json` returned `200` and OpenAPI `3.1.0`.
4. `/docs/` returned `200` and the Scalar reference.
5. `/metrics` returned `401` without authentication.
6. `/sandbox` returned `200` with the English console and service ready state.
7. `POST /v1/sandbox/sessions` returned `201` with two isolated synthetic accounts.
8. A transfer of `125.75 USD` returned `201` with state `completed` and changed the source balance from `1000.00` to `874.25`.
9. Repeating one transfer with the same idempotency key returned `200`, the `idempotent-replayed` header, and the same transfer identifier.
10. An attempted transfer of `9999.00 USD` returned `422` with code `insufficient_funds`.
11. Reconciliation returned `200` with zero discrepancies.

Readiness compares the database with every migration shipped in the deployed artifact. Its successful response, together with successful sandbox creation, proves that migration 004 reached the hosted database before public traffic. The browser verification also created a test account and displayed the formatted `HTTP 201` response card with the tenant summary, account count, session duration, and raw JSON disclosure.

## Media verification

The final Remotion walkthrough uses the Enrique M. Nieto voice from ElevenLabs and complete sentence captions in Spanish. The MP4 contains H.264 video at 1920 by 1080 and AAC audio. Its duration is 148.544000 seconds and its SHA 256 digest is `495f9301e651b103c46885c0dc88812cc308124dafa7d64f29b8f8c23247cf30`.

The poster SHA 256 digest is `3a145fbf7af6a32ad3d79378d88b7bfb14dd8de19b617e6b92b9de105d344110`. The narration asset lasts 145.214688 seconds and its SHA 256 digest is `9c00e9d06206568890572b24dfceb0d84564427086be0230dbc3809faac5c2c3`.

The committed video evidence is generated from the same sanitized PostgreSQL scenario that the integration test executes and compares. Random identifiers and timestamps are excluded from equality checks by design.

## Review evidence

Two formal rounds each used three independent reviewers. A final release review used independent security, interface, and deployment reviewers. Their complete prompts and responses appear in `docs/ai-usage/review-records.md`. The main adjudication and accepted corrections appear in `docs/reviews/round-1.md` and `docs/reviews/round-2.md`.

The remaining production limitation is explicit. The assessment uses one Render owner connection for migrations and runtime. A production service must separate migration, application, reconciliation, and recovery roles, then enforce tenant policy inside PostgreSQL.
