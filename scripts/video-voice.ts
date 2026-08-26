import { mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { narrationText } from '../video/narration.ts';
import { VIDEO_PLAYBACK_RATE } from '../video/timing.ts';

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) throw new Error('missing_environment:ELEVENLABS_API_KEY');
const voiceId = process.env.ELEVENLABS_VOICE_ID ?? 'gbTn1bmCvNgk0QEAVyfM';
const voiceName = process.env.ELEVENLABS_VOICE_NAME ?? 'Enrique M. Nieto';
const modelId = process.env.ELEVENLABS_MODEL_ID ?? 'eleven_multilingual_v2';
const response = await fetch(
  `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
  {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text: narrationText,
      model_id: modelId,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0,
        use_speaker_boost: true,
        speed: 1,
      },
    }),
  },
);
if (!response.ok) {
  throw new Error(`elevenlabs_request_failed:${response.status}`);
}
await mkdir('video/public', { recursive: true });
await mkdir('video/assets', { recursive: true });
await Bun.write('video/public/narration.mp3', await response.arrayBuffer());
await Bun.write(
  'video/assets/narration-metadata.json',
  `${JSON.stringify(
    {
      provider: 'ElevenLabs',
      voiceId,
      voiceName,
      modelId,
      language: 'es-MX',
      playbackRate: VIDEO_PLAYBACK_RATE,
      characters: narrationText.length,
      scriptSha256: createHash('sha256').update(narrationText).digest('hex'),
      output: 'video/public/narration.mp3',
    },
    null,
    2,
  )}\n`,
);
process.stdout.write(
  `${JSON.stringify({
    output: 'video/public/narration.mp3',
    playbackRate: VIDEO_PLAYBACK_RATE,
    characters: narrationText.length,
  })}\n`,
);
