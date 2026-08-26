import { createHash } from 'node:crypto';
import { narrationText } from '../video/narration.ts';
import { sceneRanges } from '../video/timing.ts';

const videoPath = 'video/out/supercool-ledger.mp4';
const narrationPath = 'video/public/narration.mp3';
const posterPath = 'video/out/poster.png';
const montagePath = 'video/out/inspection-montage.png';
const reportPath = 'video/out/media-evidence.json';
const scriptPath = 'scripts/verify-video-evidence.ts';
const narrationScriptPath = 'video/narration.ts';

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

const probe = (path: string): unknown =>
  JSON.parse(
    run([
      'ffprobe',
      '-v',
      'error',
      '-show_entries',
      'format=duration,size,format_name:stream=index,codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels',
      '-of',
      'json',
      path,
    ]),
  ) as unknown;

for (const path of [videoPath, narrationPath, posterPath, scriptPath, narrationScriptPath]) {
  if (!(await Bun.file(path).exists())) throw new Error(`missing_evidence_input:${path}`);
}

const sceneFrames = sceneRanges.map((scene) => ({
  id: scene.id,
  frame: Math.floor((scene.from + scene.to) / 2),
}));
const selection = sceneFrames.map(({ frame }) => `eq(n\\,${frame})`).join('+');

run([
  'ffmpeg',
  '-y',
  '-loglevel',
  'error',
  '-i',
  videoPath,
  '-vf',
  `select=${selection},scale=480:270,tile=5x2:padding=6:margin=6:color=0x111111`,
  '-frames:v',
  '1',
  montagePath,
]);

const report = {
  tools: {
    ffmpeg: run(['ffmpeg', '-version']).split('\n')[0],
    ffprobe: run(['ffprobe', '-version']).split('\n')[0],
  },
  sceneFrames,
  files: {
    narrationScript: {
      path: narrationScriptPath,
      characters: narrationText.length,
      textSha256: createHash('sha256').update(narrationText).digest('hex'),
      sourceSha256: await sha256(narrationScriptPath),
    },
    narration: {
      path: narrationPath,
      sha256: await sha256(narrationPath),
      metadata: probe(narrationPath),
    },
    video: {
      path: videoPath,
      sha256: await sha256(videoPath),
      metadata: probe(videoPath),
    },
    poster: {
      path: posterPath,
      sha256: await sha256(posterPath),
      metadata: probe(posterPath),
    },
    inspectionMontage: {
      path: montagePath,
      sha256: await sha256(montagePath),
      metadata: probe(montagePath),
    },
    verificationScript: {
      path: scriptPath,
      sha256: await sha256(scriptPath),
    },
  },
};

await Bun.write(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`Media evidence: ${reportPath}\nScene montage: ${montagePath}\n`);
