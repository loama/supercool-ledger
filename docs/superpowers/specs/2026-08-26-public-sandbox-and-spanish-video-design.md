# Public sandbox and Spanish video design

## Goal

Give a reviewer a safe way to exercise successful and rejected financial operations against the hosted service. Replace the English narration with natural conversational Spanish and translate every visible video label.

## Sandbox boundary

The public experience is a reviewer console, not a customer product. A visitor explicitly starts a synthetic session. The service creates one isolated tenant, two customer accounts, one treasury account, and a balanced opening journal inside one PostgreSQL transaction.

The session response contains a tenant scoped JWT with a fifteen minute expiration. The browser holds it only in memory. The signing secret never reaches the browser. The token grants only the account, transfer, and reconciliation scopes needed by the console.

Sandbox creation is disabled unless `SANDBOX_ENABLED=true`. PostgreSQL serializes session admission with an advisory transaction lock. The service limits daily and total sessions before inserting more synthetic data. It stores no visitor address or other personal data.

## Reviewer scenarios

The console runs these scenarios through the public API:

1. Read both account balances.
2. Create a valid transfer.
3. Repeat the same request and show the idempotent replay.
4. Reuse the key with a different amount and show the conflict.
5. Attempt to spend more than the available balance.
6. Send two competing transfers and show that PostgreSQL prevents an invalid combined spend.
7. Read immutable ledger entries.
8. Run reconciliation and show zero discrepancies.

Each action shows the HTTP status, response body, relevant balance change, and an explanation of the invariant it proves. A reset action creates a new synthetic tenant.

## Interface

The page lives at `/sandbox`. It uses a restrained warm neutral palette with one green accent, minimal shadows, precise numeric typography, and an asymmetric desktop layout that collapses to one column on mobile. It includes loading, success, error, expired session, and empty states.

The console uses local HTML, CSS, and browser JavaScript rather than a new application framework. That keeps the public artifact inside the existing Fastify service, avoids another deployment unit, and leaves the accounting code as the main subject of the assessment.

## Video localization

The Spanish script uses short spoken sentences and neutral Mexican vocabulary. Technical names such as TypeScript, Fastify, PostgreSQL, OpenAPI, Prometheus, OpenTelemetry, Sentry, Docker, and Render remain unchanged.

Every caption and visible label is translated. The narration generator uses `eleven_multilingual_v2` and an ElevenLabs voice described as neutral Spanish, calm, and conversational. The selected voice identifier is stored only as nonsecret metadata.

The final render must contain Spanish audio, Spanish burned in captions, H.264 video, AAC audio, and the same PostgreSQL evidence used by the tests.

## Acceptance criteria

1. Sandbox routes remain absent when the feature flag is false.
2. A public session never reveals `AUTH_SECRET`.
3. The returned JWT can access only its synthetic tenant.
4. Admission limits cannot race past their configured cap.
5. Every scenario uses existing financial routes and PostgreSQL transactions.
6. The page works at mobile and desktop widths.
7. The complete backend test suite and production container pass.
8. Video evidence tests match the Spanish narration and captions.
9. The rendered video is inspected with audio and representative frames.
