# Public Sandbox And Spanish Video Implementation Plan

> **For agentic workers:** REQUIRED SUB SKILL: Use superpowers:executing-plans to implement this plan task by task. Steps use checkbox syntax for tracking.

**Goal:** Add a safe hosted reviewer console and replace the video with natural Spanish narration and labels.

**Architecture:** Fastify exposes an optional public sandbox session route backed by the same PostgreSQL ledger. Static local assets provide the reviewer interface. Remotion keeps the existing evidence and visual structure while translating every spoken and visible string.

**Tech Stack:** TypeScript, Bun, Fastify, PostgreSQL, HTML, CSS, browser JavaScript, Remotion, ElevenLabs

**Spec:** `docs/superpowers/specs/2026-08-26-public-sandbox-and-spanish-video-design.md`

## Global constraints

1. Use Bun for every install, test, build, and script.
2. Write and observe a failing test before each production behavior.
3. Never expose signing secrets, metrics tokens, or visitor data.
4. Keep financial scenarios on the existing account, transfer, and reconciliation routes.
5. Use one green accent, warm neutral surfaces, minimal shadows, and responsive single column mobile layout.
6. Keep video evidence synchronized with `video/assets/demo-run.json`.

---

### Task 1: Sandbox persistence and service

**Files:**

1. Create: `migrations/004_sandbox_sessions.sql`
2. Create: `src/sandbox/service.ts`
3. Modify: `src/ledger/seed.ts`
4. Test: `test/integration/sandbox-service.test.ts`

**Interfaces:**

1. Consume `Database.transaction`, `signDevelopmentToken`, and the existing balanced opening journal logic.
2. Produce `SandboxService.createSession(): Promise<SandboxSession>`.

- [x] **Step 1: Write the failing service tests**

Test that one session creates an isolated tenant, balanced opening entries, two returned customer accounts, a stored expiration, and a valid scoped JWT. Test concurrent admission at the configured cap.

- [x] **Step 2: Verify the tests fail for the missing migration and service**

Run `bun test test/integration/sandbox-service.test.ts` and confirm the missing service or relation is the reason.

- [x] **Step 3: Implement the migration and minimal service**

Create `sandbox_sessions` with a tenant reference, creation time, and expiration. Apply a process level burst limit before opening a transaction. Acquire one advisory transaction lock, purge up to twenty five synthetic tenants whose seven day retention has elapsed, count active and daily sessions, create the tenant and balanced opening journal, insert the session, then sign a fifteen minute token.

- [x] **Step 4: Verify the focused tests pass**

Run `bun test test/integration/sandbox-service.test.ts`.

- [x] **Step 5: Commit the persistence unit**

Run `git commit -m "feat(sandbox): add isolated reviewer sessions"`.

### Task 2: Public sandbox API

**Files:**

1. Create: `src/sandbox/routes.ts`
2. Modify: `src/app.ts`
3. Modify: `src/auth/plugin.ts`
4. Modify: `src/platform/config.ts`
5. Modify: `src/server.ts`
6. Modify: `.env.example`
7. Modify: `render.yaml`
8. Test: `test/integration/sandbox-api.test.ts`

**Interfaces:**

1. Consume `SandboxService.createSession()`.
2. Produce `POST /v1/sandbox/sessions` only when `SANDBOX_ENABLED=true`.

- [x] **Step 1: Write the failing route tests**

Test that the route is absent when disabled, returns a no store session response when enabled, never contains the signing secret, and returns a token that can read only its own accounts.

- [x] **Step 2: Verify the route tests fail**

Run `bun test test/integration/sandbox-api.test.ts`.

- [x] **Step 3: Implement the feature flag and route**

Expose only the session creation route publicly. Keep all financial routes behind JWT authentication. Add the OpenAPI schema and generated example.

- [x] **Step 4: Verify focused and authentication tests pass**

Run `bun test test/integration/sandbox-api.test.ts test/unit/auth.test.ts test/integration/accounts-api.test.ts`.

- [x] **Step 5: Commit the API unit**

Run `git commit -m "feat(api): expose guarded sandbox sessions"`.

### Task 3: Reviewer console

**Files:**

1. Create: `src/sandbox/public/index.html`
2. Create: `src/sandbox/public/styles.css`
3. Create: `src/sandbox/public/app.js`
4. Create: `src/sandbox/page.ts`
5. Modify: `src/sandbox/routes.ts`
6. Test: `test/contract/sandbox-page.test.ts`

**Interfaces:**

1. Consume the public session route and existing financial API.
2. Produce `GET /sandbox`, `GET /sandbox/styles.css`, and `GET /sandbox/app.js`.

- [x] **Step 1: Write failing page contract tests**

Test page availability, no store headers, strict content security policy, local assets, accessible action names, and the absence of embedded secrets.

- [x] **Step 2: Verify the page tests fail**

Run `bun test test/contract/sandbox-page.test.ts`.

- [x] **Step 3: Implement the static console and scenario state machine**

Build the start, loading, active, expired, and error states. Run success, replay, conflict, insufficient funds, concurrent spend, ledger, and reconciliation requests against the existing routes. Keep the JWT in memory only.

- [x] **Step 4: Verify the page contract and capture desktop and mobile screenshots**

Run `bun test test/contract/sandbox-page.test.ts`, start the local service, then use headless Chrome at 1440 by 1000 and 390 by 844.

- [x] **Step 5: Commit the interface unit**

Run `git commit -m "feat(web): add reviewer sandbox console"`.

### Task 4: Spanish video source

**Files:**

1. Modify: `video/narration.ts`
2. Modify: `video/captions.ts`
3. Modify: `video/SuperCoolLedger.tsx`
4. Modify: `scripts/video-voice.ts`
5. Modify: `test/video/data-integrity.test.ts`

**Interfaces:**

1. Consume the existing captured PostgreSQL evidence.
2. Produce Spanish narration, caption cues, and visible video copy.

- [x] **Step 1: Write failing localization evidence tests**

Test the Spanish evidence phrases, exact amounts and statuses, complete caption coverage, and absence of the replaced English headings.

- [x] **Step 2: Verify the evidence tests fail**

Run `bun test test/video/data-integrity.test.ts`.

- [x] **Step 3: Translate and tighten the script, captions, and labels**

Use neutral Mexican Spanish and short spoken sentences. Configure the voice generator for a calm conversational Spanish voice with reduced style intensity.

- [x] **Step 4: Verify the evidence tests pass**

Run `bun test test/video/data-integrity.test.ts`.

- [x] **Step 5: Commit the localization source**

Run `git commit -m "feat(video): localize walkthrough to Spanish"`.

### Task 5: Audio and rendered media

**Files:**

1. Replace: `video/public/narration.mp3`
2. Modify: `video/assets/narration-metadata.json`
3. Replace: `video/out/supercool-ledger.mp4`
4. Replace: `video/out/poster.png`

**Interfaces:**

1. Consume `ELEVENLABS_API_KEY` and the approved conversational Spanish voice identifier.
2. Produce the final narrated MP4 and poster.

- [x] **Step 1: List available ElevenLabs voices without printing the key**

Select a voice described by ElevenLabs as neutral Spanish, calm, and conversational. Generate a short sample before the full narration.

- [x] **Step 2: Generate the narration and measure its duration**

Run `bun run video:voice`. Update composition and cue timing to the measured audio plus a short closing pause.

- [x] **Step 3: Render and inspect the video**

Run `bun run video:render` and `bun run video:still`. Inspect representative frames, the first and final frames, Spanish captions, audio codec, resolution, and duration.

- [x] **Step 4: Run the complete verification gate**

Run `bun run check`, `bun audit --production`, and the production container smoke test.

- [x] **Step 5: Commit the media unit**

Run `git commit -m "feat(video): render Spanish narrated walkthrough"`.

### Task 6: Documentation, deployment, and handoff

**Files:**

1. Modify: `README.md`
2. Modify: `docs/cloud-deployment.md`
3. Modify: `docs/threat-model.md`
4. Modify: `docs/video.md`
5. Modify: `docs/ai-usage/conversation.json`
6. Modify: `docs/ai-usage/conversation.md`
7. Modify: `docs/release-verification.md`

**Interfaces:**

1. Consume the verified sandbox URL, CI results, deployed commit, and media checksums.
2. Produce the reviewer handoff and final public evidence.

- [x] **Step 1: Update documentation and AI disclosure**

Document the explicit public sandbox action, session limits, synthetic data boundary, token expiration, frontend design choice, Spanish voice, and test commands.

- [x] **Step 2: Inspect the complete diff and run the safety gate**

Run `git diff --check`, scan for secrets and unexpected binaries, then rerun the focused evidence tests.

- [x] **Step 3: Commit and open a pull request**

Use a conventional title, assign `loama`, add relevant labels, and monitor every reported check until terminal.

- [x] **Step 4: Deploy the exact reviewed commit**

Confirm Render applies migration 004, enables the sandbox flag, passes readiness, serves `/sandbox`, and runs successful and rejected scenarios against the hosted database.

- [x] **Step 5: Update the local handoff package**

Copy the final video, poster, release record, and testing guide to the output folder and verify their checksums.
