# Release verification

This record describes the final evidence for the public assessment release on 26 August 2026.

## Release identity

1. Repository: https://github.com/loama/supercool-ledger
2. Review pull request: https://github.com/loama/supercool-ledger/pull/1
3. Merged commit: `2212af834e91895b84e42c1fc4cbe9d36a735520`
4. Live service: https://supercool-ledger.onrender.com
5. Interactive API reference: https://supercool-ledger.onrender.com/docs/
6. Render service: `srv-da71hq67bikc73eiu90g`
7. Render database: `dpg-da713295efls738aods0-a`
8. Render deployment: `dep-da71hqu7bikc73eiua10`

## Local verification

`bun run check` completed with 55 passing tests, 343 assertions, strict TypeScript checks, lint, formatting verification, and a production build.

`bun audit --production` reported no known production dependency vulnerabilities.

The concurrency integration test used PostgreSQL row locks rather than mocks. The complete suite also covered database idempotency, rollback, tenant isolation, immutable history, balanced postings, transfer semantics, cached balance consistency, reconciliation, redaction, tracing, OpenAPI, and video evidence.

## Container verification

The final Docker image was rebuilt from the repository. A fresh PostgreSQL 17 container received all migrations from that image. The application image then returned these results:

1. `/health/ready` returned `200`.
2. `/openapi.json` returned `200` with JSON.
3. `/docs/` returned `200` with HTML.
4. `/metrics` returned `401` without its token.
5. `/metrics` returned `200` with Prometheus text when its token was supplied.

The two temporary smoke containers were removed after verification.

## GitHub verification

Pull request 1 was mergeable and received successful `verify` and `container` checks. The merge preserved the logical commit history and promoted the reviewed branch to `main`.

The public repository default branch is `main`. The merged commit is the same commit deployed by Render.

## Render verification

The Blueprint associated the paid PostgreSQL 17 database and created the paid Docker web service in Frankfurt. Render built the pinned Bun image, completed `bun run db:migrate`, started the service, and waited for `/health/ready` before marking deployment `dep-da71hqu7bikc73eiua10` live.

Direct public checks returned:

1. `/health/live` returned `200` and `{"status":"alive"}`.
2. `/health/ready` returned `200` and `{"status":"ready"}`.
3. `/openapi.json` returned `200` and OpenAPI `3.1.0`.
4. `/docs/` returned `200` and the Scalar reference.
5. `/metrics` returned `401` without authentication.

Readiness compares the database with every migration shipped in the deployed artifact. Its successful response, together with the completed migration hook in Render logs, proves that the hosted schema reached the expected migration set before receiving traffic.

## Media verification

The final Remotion walkthrough uses an ElevenLabs narration asset and complete sentence captions. The MP4 contains H.264 video at 1920 by 1080 and AAC audio. Its duration is 135.061333 seconds and its SHA 256 digest is `cbefcdd9bcfe86f31f5a86f99d9bb915e6a436a9674decc1ff0bd3a4cc40fcda`.

The poster SHA 256 digest is `33b445e542ca7e0699d2e1bece41ee8a89248c629a08e0bd84b007644f7a5b14`.

The committed video evidence is generated from the same sanitized PostgreSQL scenario that the integration test executes and compares. Random identifiers and timestamps are excluded from equality checks by design.

## Review evidence

Two formal rounds each used three independent reviewers. Their complete prompts and responses appear in `docs/ai-usage/review-records.md`. The main adjudication and accepted corrections appear in `docs/reviews/round-1.md` and `docs/reviews/round-2.md`.

The remaining production limitation is explicit. The assessment uses one Render owner connection for migrations and runtime. A production service must separate migration, application, reconciliation, and recovery roles, then enforce tenant policy inside PostgreSQL.
