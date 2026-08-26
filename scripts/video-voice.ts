import { mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { narrationText } from '../video/narration.ts';
import {
  NARRATION_TEMPO_RATE,
  VIDEO_DURATION_IN_FRAMES,
  VIDEO_FPS,
  VIDEO_PLAYBACK_RATE,
} from '../video/timing.ts';

const sourceOutput = 'video/public/narration.mp3';
const output = 'video/public/narration-fast.mp3';
const decoder = new TextDecoder();

const run = (command: string[]): string => {
  const result = Bun.spawnSync({ cmd: command, stderr: 'pipe', stdout: 'pipe' });
  if (result.exitCode !== 0) {
    throw new Error(`${command[0]} failed: ${decoder.decode(result.stderr).trim()}`);
  }
  return decoder.decode(result.stdout).trim();
};

const sha256 = async (path: string): Promise<string> => {
  const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
  return createHash('sha256').update(bytes).digest('hex');
};

const durationSeconds = (path: string): number =>
  Number(
    run([
      'ffprobe',
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      path,
    ]),
  );

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
await Bun.write(sourceOutput, await response.arrayBuffer());
const tempoResult = Bun.spawnSync({
  cmd: [
    'ffmpeg',
    '-y',
    '-loglevel',
    'error',
    '-i',
    sourceOutput,
    '-filter:a',
    `atempo=${NARRATION_TEMPO_RATE}`,
    '-c:a',
    'libmp3lame',
    '-b:a',
    '128k',
    output,
  ],
  stderr: 'pipe',
  stdout: 'pipe',
});
if (tempoResult.exitCode !== 0) {
  throw new Error(`narration_tempo_failed:${decoder.decode(tempoResult.stderr).trim()}`);
}
const rawDurationSeconds = durationSeconds(sourceOutput);
const playedDurationSeconds = durationSeconds(output);
const compositionDurationSeconds = VIDEO_DURATION_IN_FRAMES / VIDEO_FPS;
await Bun.write(
  'video/assets/narration-metadata.json',
  `${JSON.stringify(
    {
      provider: 'ElevenLabs',
      voiceId,
      voiceName,
      modelId,
      language: 'es-MX',
      tempoRate: NARRATION_TEMPO_RATE,
      playbackRate: VIDEO_PLAYBACK_RATE,
      characters: narrationText.length,
      scriptSha256: createHash('sha256').update(narrationText).digest('hex'),
      rawDurationSeconds,
      playedDurationSeconds,
      compositionDurationSeconds,
      closingHoldSeconds: Number((compositionDurationSeconds - playedDurationSeconds).toFixed(6)),
      sourceSha256: await sha256(sourceOutput),
      sha256: await sha256(output),
      sourceOutput,
      output,
    },
    null,
    2,
  )}\n`,
);
process.stdout.write(
  `${JSON.stringify({
    output,
    tempoRate: NARRATION_TEMPO_RATE,
    playbackRate: VIDEO_PLAYBACK_RATE,
    characters: narrationText.length,
  })}\n`,
);
