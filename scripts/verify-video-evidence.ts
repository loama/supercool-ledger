import { createHash } from 'node:crypto';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { narrationText } from '../video/narration.ts';
import { visualPageRanges } from '../video/timing.ts';

const videoPath = 'video/out/supercool-ledger.mp4';
const narrationSourcePath = 'video/public/narration.mp3';
const narrationPath = 'video/public/narration-fast.mp3';
const posterPath = 'video/out/poster.png';
const montagePath = 'video/out/inspection-montage.png';
const reportPath = 'video/out/media-evidence.json';
const scriptPath = 'scripts/verify-video-evidence.ts';
const narrationScriptPath = 'video/narration.ts';
const update = Bun.argv.includes('--update');
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

for (const path of [
  videoPath,
  narrationSourcePath,
  narrationPath,
  posterPath,
  scriptPath,
  narrationScriptPath,
]) {
  if (!(await Bun.file(path).exists())) throw new Error(`missing_evidence_input:${path}`);
}

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'supercool-video-evidence-'));
try {
  const sceneFrames = await Promise.all(
    visualPageRanges.map(async (scene, index) => {
      const frame = Math.floor((scene.from + scene.to) / 2);
      const framePath = join(
        temporaryDirectory,
        `${String(index + 1).padStart(2, '0')}-${scene.id}.png`,
      );
      run([
        'ffmpeg',
        '-y',
        '-loglevel',
        'error',
        '-i',
        videoPath,
        '-vf',
        `select=eq(n\\,${frame})`,
        '-frames:v',
        '1',
        framePath,
      ]);
      return { id: scene.id, frame, sha256: await sha256(framePath) };
    }),
  );

  const temporaryMontagePath = join(temporaryDirectory, 'inspection-montage.png');
  const selection = sceneFrames.map(({ frame }) => `eq(n\\,${frame})`).join('+');
  run([
    'ffmpeg',
    '-y',
    '-loglevel',
    'error',
    '-i',
    videoPath,
    '-vf',
    `select=${selection},scale=480:270,tile=6x2:padding=6:margin=6:color=0x111111`,
    '-frames:v',
    '1',
    temporaryMontagePath,
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
      narrationSource: {
        path: narrationSourcePath,
        sha256: await sha256(narrationSourcePath),
        metadata: probe(narrationSourcePath),
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
        sha256: await sha256(temporaryMontagePath),
        metadata: probe(temporaryMontagePath),
      },
      verificationScript: {
        path: scriptPath,
        sha256: await sha256(scriptPath),
      },
    },
  };

  if (update) {
    await copyFile(temporaryMontagePath, montagePath);
    await Bun.write(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`Updated media evidence: ${reportPath}\nScene montage: ${montagePath}\n`);
  } else {
    if (!(await Bun.file(reportPath).exists()))
      throw new Error(`missing_evidence_report:${reportPath}`);
    const committed = (await Bun.file(reportPath).json()) as {
      sceneFrames?: unknown;
      files?: unknown;
    };
    const expected = JSON.stringify({ sceneFrames: committed.sceneFrames, files: committed.files });
    const actual = JSON.stringify({ sceneFrames: report.sceneFrames, files: report.files });
    if (actual !== expected) {
      throw new Error('media_evidence_mismatch:run_bun_run_video:evidence_after_review');
    }
    process.stdout.write(`Verified media evidence: ${reportPath}\nScene montage: ${montagePath}\n`);
  }
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true });
}
