# EFEX inspired video and AWS infrastructure implementation plan

> **For agentic workers:** REQUIRED SUB SKILL: Use superpowers:subagent-driven-development to implement this plan task by task. Steps use checkbox syntax for tracking.

**Goal:** Deliver validated AWS Terraform and a faster EFEX inspired Spanish walkthrough that explains the codebase, financial flow, cloud design, and reviewer sandbox.

**Architecture:** Keep Render as the live assessment deployment and add an independent AWS Terraform root under `infra/aws`. Split the Remotion presentation into shared theme, shared diagram components, scene components, timing data, and one composition entry. The committed narration remains the reproducible source audio while Remotion plays it at exactly 1.5.

**Tech Stack:** TypeScript, Bun, React, Remotion, `@fontsource-variable/dm-sans` 5.3.0, ElevenLabs, Terraform 1.15, AWS provider 6, ECS Fargate, RDS PostgreSQL 17

**Spec:** `docs/superpowers/specs/2026-08-26-efex-video-and-aws-iac-design.md`

## Global constraints

1. Use Bun for every JavaScript command.
2. Keep the application API and financial behavior unchanged.
3. Keep the live Render deployment intact.
4. Use exactly `1.5` as the Remotion audio playback rate.
5. Keep the preview page free of an autoplay attribute.
6. Keep the narration and captions in Spanish.
7. Use `#111111`, `#ffffff`, `#f7f7f2`, `#fff98e`, and `#a3a3a3` as the core video palette.
8. Do not bundle an EFEX logo asset or claim product affiliation.
9. Use Terraform 1.15 and AWS provider 6.
10. Do not require AWS credentials for formatting or validation.

---

### Task 1: AWS Terraform deployment

**Files:**

1. Create `infra/aws/versions.tf`
2. Create `infra/aws/variables.tf`
3. Create `infra/aws/network.tf`
4. Create `infra/aws/security.tf`
5. Create `infra/aws/database.tf`
6. Create `infra/aws/compute.tf`
7. Create `infra/aws/observability.tf`
8. Create `infra/aws/outputs.tf`
9. Create `infra/aws/terraform.tfvars.example`
10. Create `infra/aws/README.md`
11. Modify `.github/workflows/ci.yml`
12. Modify `docs/cloud-deployment.md`
13. Modify `README.md`

**Interfaces:**

1. Consumes the existing Docker image and the health route `/health/ready`.
2. Produces Terraform outputs named `application_url`, `ecr_repository_url`, `ecs_cluster_name`, `ecs_service_name`, and `migration_task_definition_arn`.
3. Produces a migration task that runs `bun run db:migrate` before the service update.

- [ ] **Step 1: Write the infrastructure validation assertions**

Add Terraform commands to the CI verify job using `hashicorp/terraform:1.15.8`. Run formatting, initialization with `-backend=false`, and validation against `infra/aws`.

- [ ] **Step 2: Confirm that validation fails before the Terraform root exists**

Run the exact container commands locally. The expected result is a missing directory or missing configuration failure.

- [ ] **Step 3: Implement the Terraform root**

Use `required_version = "~> 1.15.0"` and `hashicorp/aws` version `~> 6.57.0`. Create the resources listed in the design spec. Use two availability zones, private ECS tasks, private RDS, immutable ECR tags, Secrets Manager, application scaling from two to six tasks, and a separate migration task definition.

- [ ] **Step 4: Document the deployment sequence**

Document `terraform init`, `terraform plan`, `terraform apply`, the ECR build and push commands, the one time migration task command, and the ECS service update command. Explain state security, cost controls, Multi AZ behavior, and why the database writer remains the only balance read target.

- [ ] **Step 5: Validate the infrastructure**

Run:

```bash
docker run --rm -v "$PWD:/workspace" -w /workspace hashicorp/terraform:1.15.8 fmt -check -recursive infra/aws
docker run --rm -v "$PWD:/workspace" -w /workspace/infra/aws hashicorp/terraform:1.15.8 init -backend=false
docker run --rm -v "$PWD:/workspace" -w /workspace/infra/aws hashicorp/terraform:1.15.8 validate
bun test test/docs/evidence-map.test.ts
```

Expected result: every command passes.

- [ ] **Step 6: Commit**

```bash
git add infra/aws .github/workflows/ci.yml docs/cloud-deployment.md README.md
git commit -m "feat(infra): add validated AWS deployment"
```

### Task 2: Video story, narration, and timing contract

**Files:**

1. Create `video/timing.ts`
2. Modify `video/narration.ts`
3. Modify `video/captions.ts`
4. Modify `video/Root.tsx`
5. Modify `scripts/video-voice.ts`
6. Modify `video/assets/narration-metadata.json`
7. Modify `test/video/data-integrity.test.ts`

**Interfaces:**

1. Produces `VIDEO_PLAYBACK_RATE`, `VIDEO_DURATION_IN_FRAMES`, and `sceneRanges` for the composition.
2. Produces ten narration sections whose order matches the ten visual scenes.
3. Keeps `captionCues` contiguous from frame zero through `VIDEO_DURATION_IN_FRAMES`.

- [ ] **Step 1: Extend the video integrity test**

Assert ten scene ranges, exact playback rate `1.5`, contiguous scene and caption ranges, Spanish sandbox instructions, AWS topology claims, and total frame equality with the composition.

- [ ] **Step 2: Confirm the new assertions fail**

Run:

```bash
bun test test/video/data-integrity.test.ts
```

Expected result: failure because the timing contract and new narration do not exist.

- [ ] **Step 3: Write the Spanish narration**

Write ten paragraphs in the exact scene order from the spec. Explain concrete files and request steps. Keep sentences short enough for burned in captions at 1.5 playback.

- [ ] **Step 4: Implement the timing contract**

Define the exact playback rate, scene names, scene frame ranges, total frames, and caption frames in one module. The composition reads its duration from this module. No scene boundary may overlap or leave a gap.

- [ ] **Step 5: Run the focused test**

Run:

```bash
bun test test/video/data-integrity.test.ts
bun run typecheck
```

Expected result: both commands pass.

- [ ] **Step 6: Commit**

```bash
git add video/timing.ts video/narration.ts video/captions.ts video/Root.tsx scripts/video-voice.ts video/assets/narration-metadata.json test/video/data-integrity.test.ts
git commit -m "feat(video): define expanded walkthrough timing"
```

### Task 3: EFEX inspired Remotion redesign and flowcharts

**Files:**

1. Create `video/theme.ts`
2. Create `video/components.tsx`
3. Create `video/scenes.tsx`
4. Modify `video/SuperCoolLedger.tsx`
5. Modify `package.json`
6. Modify `bun.lock`

**Interfaces:**

1. Consumes `sceneRanges`, `captionCues`, `VIDEO_PLAYBACK_RATE`, and the captured demo JSON.
2. Produces ten scenes rendered by `SuperCoolLedger`.
3. Uses DM Sans through a local Remotion font package.

- [ ] **Step 1: Add the local font dependency**

Run `bun add --dev @fontsource-variable/dm-sans@5.3.0`. Import the local variable font files in the Remotion entry. Do not fetch fonts during rendering.

- [ ] **Step 2: Build shared visual components**

Implement the assessment wordmark, scene shell, title, eyebrow, flow node, connector, status marker, browser frame, and caption bar. Use the palette and surface rules from the spec.

- [ ] **Step 3: Build the ten scenes**

Create the financial promise, invariants, repository map, request lifecycle, transfer sequence, data model, sandbox workflow, evidence, AWS topology, and review path scenes. Every diagram must have a clear reading direction and animated active state.

- [ ] **Step 4: Wire the composition**

Use the shared scene ranges for every `Sequence`. Set the `Audio` playback rate to `VIDEO_PLAYBACK_RATE`. Keep captions above the safe bottom margin.

- [ ] **Step 5: Run focused validation**

Run:

```bash
bun run format:check
bun run lint
bun run typecheck
bun test test/video/data-integrity.test.ts
```

Expected result: every command passes.

- [ ] **Step 6: Commit**

```bash
git add video package.json bun.lock
git commit -m "feat(video): apply EFEX inspired visual system"
```

### Task 4: Narration asset, render, evidence, and documentation

**Files:**

1. Modify `video/public/narration.mp3`
2. Modify `video/out/supercool-ledger.mp4`
3. Modify `video/out/poster.png`
4. Modify `video/assets/narration-metadata.json`
5. Modify `docs/video.md`
6. Modify `docs/release-verification.md`
7. Modify `docs/references.md`
8. Modify `docs/ai-usage/conversation.json`
9. Modify `docs/ai-usage/conversation.md`

**Interfaces:**

1. Consumes the final narration text and ten scene timing contract.
2. Produces the committed MP3, MP4, poster, media digests, and reviewer documentation.

- [ ] **Step 1: Generate the narration**

Use the Enrique M. Nieto voice and `eleven_multilingual_v2`. Record the voice identifier, model, language, character count, and raw audio duration without storing a credential.

- [ ] **Step 2: Align timing to the generated audio**

Calculate the played duration as raw audio duration divided by `1.5`. Adjust scene and caption ranges to end after the narration with a short closing hold. Recheck every contiguous range assertion.

- [ ] **Step 3: Render the final artifacts**

Run:

```bash
bun run video:render
bun run video:still
```

Expected result: the MP4 and poster render without errors.

- [ ] **Step 4: Inspect every scene**

Extract one representative frame from each scene into a temporary montage. Check typography, connector direction, captions, spacing, and safe margins. Check the final media with `ffprobe` and verify that the preview page has controls and no autoplay attribute.

- [ ] **Step 5: Update evidence and references**

Record exact duration, codecs, dimensions, frame rate, and SHA 256 digests. Cite the EFEX website as the visual reference and cite official HashiCorp and AWS documentation for the Terraform deployment.

- [ ] **Step 6: Refresh the visible AI usage record**

Run the project export script with the current session source. Inspect the resulting transcript for credentials before staging it.

- [ ] **Step 7: Run the complete gate**

Run:

```bash
bun run check
docker run --rm -v "$PWD:/workspace" -w /workspace hashicorp/terraform:1.15.8 fmt -check -recursive infra/aws
docker run --rm -v "$PWD:/workspace" -w /workspace/infra/aws hashicorp/terraform:1.15.8 init -backend=false
docker run --rm -v "$PWD:/workspace" -w /workspace/infra/aws hashicorp/terraform:1.15.8 validate
git diff --check
```

Expected result: every command passes.

- [ ] **Step 8: Commit**

```bash
git add video/public/narration.mp3 video/out/supercool-ledger.mp4 video/out/poster.png video/assets/narration-metadata.json docs/video.md docs/release-verification.md docs/references.md docs/ai-usage/conversation.json docs/ai-usage/conversation.md
git commit -m "docs: publish expanded assessment walkthrough"
```
