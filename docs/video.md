# Narrated walkthrough

`video/out/supercool-ledger.mp4` is a 1920 by 1080 Remotion presentation with Spanish narration. Ten scenes explain the financial promise, ledger invariants, repository map, request lifecycle, atomic transfer, data model, reviewer sandbox, captured evidence, observability, and a combined AWS topology and review path.

The visual system takes its color, typography, and layout direction from [EFEX](https://www.efex.com/). EFEX supplied the visual reference only. SuperCool Ledger remains a fictional assessment service and has no product affiliation with EFEX.

Sentence captions remain visible inside the safe bottom margin. Their exact text comes from `video/narration.ts`, while `video/timing.ts` owns every scene and caption range.

## Evidence source

The numbers shown in the demonstration scene come from `video/assets/demo-run.json`. The capture script starts the real Fastify application against PostgreSQL, creates three synthetic accounts, performs a successful transfer, replays its idempotency key, rejects an overspend, reads the resulting postings, and runs tenant scoped reconciliation.

`test/video/data-integrity.test.ts` checks every spoken financial claim against the committed capture. It also checks the ten scene order, all 24 caption ranges, the AWS traffic direction, and the three release states. `test/integration/demo.test.ts` runs the same scenario against PostgreSQL and compares its stable evidence with the committed snapshot. Each run creates new synthetic identifiers and timestamps, so those values are intentionally excluded from equality checks.

## Narration and timing

The approved script lives in `video/narration.ts`. Its 2,224 characters match the text used to generate `video/public/narration.mp3`. The asset uses the ElevenLabs Enrique M. Nieto voice, voice identifier `gbTn1bmCvNgk0QEAVyfM`, model `eleven_multilingual_v2`, and language `es-MX`.

The raw narration lasts 145.214688 seconds. Remotion plays it at exactly 1.5, so the played duration is 96.809792 seconds. The composition lasts 99 seconds and leaves a 2.190208 second closing hold. Scene and caption ranges are contiguous from frame 0 through frame 2970 at 30 frames per second.

The narration SHA 256 digest is `9c00e9d06206568890572b24dfceb0d84564427086be0230dbc3809faac5c2c3`.

`scripts/video-voice.ts` is only needed when replacing the narration. It sends the reviewed text to ElevenLabs, reads the credential from the local environment, never prints it, and stores no credential in the repository.

## Rendering

```bash
bun run video:render
bun run video:still
bun run video:verify
```

The first command creates `video/out/supercool-ledger.mp4`. The second creates `video/out/poster.png`. The third creates `video/out/media-evidence.json` and `video/out/inspection-montage.png`. The report records the verification script digest, SHA 256 digests, probe metadata, and the exact middle frame sampled from every scene. The final MP4 uses H.264 video and AAC audio at 1920 by 1080 and 30 frames per second.

## Visual inspection

The retained montage at `video/out/inspection-montage.png` contains one middle frame from every scene. The exact frame numbers and hashes are recorded in `video/out/media-evidence.json`. Inspect the montage for typography, connector direction, caption spacing, and safe margins after each render. The automated timing test separately verifies every caption remains inside the scene that owns its narration section.

## Local preview

```bash
bun run video:preview
```

Open `http://127.0.0.1:3013/` after the command starts. The page includes native video controls and `preload="metadata"`. It has no autoplay attribute. The media route returns `Accept-Ranges: bytes`, a valid byte request returns `206 Partial Content`, and an invalid range returns `416 Range Not Satisfiable`.
