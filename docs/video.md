# Narrated walkthrough

`video/out/supercool-ledger.mp4` is a 1920 by 1080 Remotion presentation with ElevenLabs narration. It explains the service boundary, financial invariants, transfer transaction, real execution evidence, and operational signals.

Burned in sentence captions keep the presentation usable without audio. Their exact text and frame windows live in `video/captions.ts`.

## Evidence source

The numbers shown in the demonstration scene come from `video/assets/demo-run.json`. The capture script starts the real Fastify application against PostgreSQL, creates three synthetic accounts, performs a successful transfer, replays its idempotency key, rejects an overspend, reads the resulting postings, and runs tenant scoped reconciliation.

`test/video/data-integrity.test.ts` checks every claim used by the narration and visual evidence. `test/integration/demo.test.ts` independently runs the same scenario against PostgreSQL and compares its stable evidence with the committed snapshot. Identifiers and timestamps are intentionally excluded because each run creates new synthetic records.

## Narration

The reviewed script lives in `video/narration.ts`. `scripts/video-voice.ts` sends only that text to the ElevenLabs text to speech API. It reads the API key from the local environment, never prints it, and stores only nonsecret generation metadata.

The generator uses Enrique M. Nieto by default. This voice has a native Mexican Spanish accent and a measured narration style. You can choose another voice through `ELEVENLABS_VOICE_ID` and `ELEVENLABS_VOICE_NAME`. You can also override the default `eleven_multilingual_v2` model through `ELEVENLABS_MODEL_ID`.

Generate the audio with:

```bash
bun run video:voice
```

The committed narration asset lets reviewers render the project without an ElevenLabs account.

## Rendering

```bash
bun run video:render
bun run video:still
```

The first command creates `video/out/supercool-ledger.mp4`. The second creates `video/out/poster.png`. The final artifact uses H.264 video and AAC audio, which play directly in modern browsers and common media players.

## Local preview

```bash
bun run video:preview
```

Open `http://127.0.0.1:3013/` after the command starts. The page loads video metadata but does not begin playback until you press play.
