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

`bun run check` completed with 71 passing tests, 560 assertions, strict TypeScript checks, lint, formatting verification, and a production build.

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

The final Remotion walkthrough uses the Enrique M. Nieto voice from ElevenLabs and 24 sentence captions in Spanish. The 2,224 character source script matches the committed narration asset. The raw MP3 lasts 145.214688 seconds. Playback at exactly 1.5 shortens it to 96.809792 seconds inside a 99 second composition, leaving a 2.190208 second closing hold.

The rendered MP4 contains H.264 video at 1920 by 1080 and 30 frames per second, plus stereo AAC audio at 48 kHz. Its container duration is 99.050667 seconds, its size is 14,692,501 bytes, and its SHA 256 digest is `4cbe42c2b10ecbb363393301fcd9f094249a49b05ebc46a50a8eb9e9845af99b`.

The poster is a 1920 by 1080 PNG with SHA 256 digest `018baf5b77d235d1458a2e6606bb4ae7e61af3edce3938df40103454296eb915`. The narration asset is mono MP3 at 44.1 kHz with SHA 256 digest `9c00e9d06206568890572b24dfceb0d84564427086be0230dbc3809faac5c2c3`.

`bun run video:verify` records the narration text and source digests, verification script digest, media probe output, and every artifact digest in `video/out/media-evidence.json`. It also extracts one middle frame from each of the ten scenes and retains the samples in `video/out/inspection-montage.png`. The montage received direct visual inspection for scene ownership, typography, connector direction, captions, spacing, and safe margins. The full resolution poster received a separate inspection.

The local preview returned native controls, the committed poster, and no autoplay attribute. A request for bytes 0 through 1023 returned `206 Partial Content`, `Content-Range: bytes 0-1023/14692501`, and exactly 1,024 bytes. An out of bounds request returned `416 Range Not Satisfiable`.

The committed video evidence is generated from the same sanitized PostgreSQL scenario that the integration test executes and compares. Random identifiers and timestamps are excluded from equality checks by design.

## Review evidence

Two formal rounds each used three independent reviewers. A final release review used independent security, interface, and deployment reviewers. Their complete prompts and responses appear in `docs/ai-usage/review-records.md`. The main adjudication and accepted corrections appear in `docs/reviews/round-1.md` and `docs/reviews/round-2.md`.

The remaining production limitation is explicit. The assessment uses one Render owner connection for migrations and runtime. A production service must separate migration, application, reconciliation, and recovery roles, then enforce tenant policy inside PostgreSQL.
