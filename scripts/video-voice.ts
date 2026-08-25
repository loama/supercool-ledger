import { mkdir } from 'node:fs/promises';
import { narrationText } from '../video/narration.ts';

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) throw new Error('missing_environment:ELEVENLABS_API_KEY');
const voiceId = process.env.ELEVENLABS_VOICE_ID ?? 'JBFqnCBsd6RMkjVDRZzb';
const modelId = 'eleven_multilingual_v2';
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
      voice_settings: { stability: 0.6, similarity_boost: 0.75, style: 0.15 },
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
      modelId,
      characters: narrationText.length,
      output: 'video/public/narration.mp3',
    },
    null,
    2,
  )}\n`,
);
process.stdout.write(
  `${JSON.stringify({ output: 'video/public/narration.mp3', characters: narrationText.length })}\n`,
);
