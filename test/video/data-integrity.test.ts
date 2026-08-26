import { expect, test } from 'bun:test';
import type { ReactElement } from 'react';
import demo from '../../video/assets/demo-run.json';
import { captionCues } from '../../video/captions.ts';
import { narrationSections, narrationSegments, narrationText } from '../../video/narration.ts';
import { VideoRoot } from '../../video/Root.tsx';
import { SuperCoolLedger } from '../../video/SuperCoolLedger.tsx';
import {
  VIDEO_DURATION_IN_FRAMES,
  VIDEO_PAGE_COUNT,
  VIDEO_PLAYBACK_RATE,
  NARRATION_END_FRAME,
  narrationCueStartMilliseconds,
  sceneRanges,
  sourceMillisecondsToVideoFrame,
  visualPageRanges,
} from '../../video/timing.ts';

test('video timing covers ten contiguous scenes at the configured tempo', () => {
  expect(VIDEO_PLAYBACK_RATE).toBe(1);
  expect(sourceMillisecondsToVideoFrame(1250)).toBe(30);
  expect(VIDEO_DURATION_IN_FRAMES).toBe(3570);
  expect(sceneRanges.map((scene) => scene.id)).toEqual([
    'financial-promise',
    'ledger-invariants',
    'repository-map',
    'request-lifecycle',
    'atomic-transfer',
    'data-model',
    'reviewer-sandbox',
    'captured-evidence',
    'observability',
    'aws-review-path',
  ]);
  expect(sceneRanges[0].from).toBe(0);
  expect(sceneRanges.at(-1)?.to).toBe(VIDEO_DURATION_IN_FRAMES);
  for (let index = 1; index < sceneRanges.length; index += 1) {
    expect(Number(sceneRanges[index]?.from)).toBe(Number(sceneRanges[index - 1]?.to));
  }
  for (const scene of sceneRanges) expect(scene.to).toBeGreaterThan(scene.from);

  expect(VIDEO_PAGE_COUNT).toBe(11);
  expect(visualPageRanges).toHaveLength(VIDEO_PAGE_COUNT);
  expect(visualPageRanges.map(({ id }) => id)).toEqual([
    ...sceneRanges.slice(0, 9).map(({ id }) => id),
    'aws-topology',
    'review-path',
  ]);
  expect(visualPageRanges[0].from).toBe(0);
  expect(visualPageRanges.at(-1)?.to).toBe(VIDEO_DURATION_IN_FRAMES);
  for (let index = 1; index < visualPageRanges.length; index += 1) {
    expect(Number(visualPageRanges[index]?.from)).toBe(Number(visualPageRanges[index - 1]?.to));
  }

  const composition = VideoRoot() as ReactElement<{ durationInFrames: number }>;
  expect(composition.props.durationInFrames).toBe(VIDEO_DURATION_IN_FRAMES);
});

test('rendered narration keeps its original pitch at the accelerated tempo', () => {
  const composition = SuperCoolLedger() as ReactElement<{
    children: ReadonlyArray<ReactElement<{ playbackRate?: number; src?: string }>>;
  }>;
  const audio = composition.props.children[0];

  expect(audio?.props.playbackRate).toBe(1);
  expect(audio?.props.src).toContain('narration-fast.mp3');
});

test('Spanish story and visual scenes follow the approved narration sections', async () => {
  expect(narrationSections).toHaveLength(10);
  expect(narrationSections.flat()).toEqual([...narrationSegments]);
  expect(narrationSegments).toHaveLength(24);
  expect(narrationText).toHaveLength(2224);

  for (const claim of [
    'ledger inmutable de partida doble',
    'misma transacción de PostgreSQL',
    'clave de idempotencia del tenant',
    'mismo orden',
    'se confirman juntos',
    'PostgreSQL real',
    'cero diferencias en las tres cuentas',
    'OpenTelemetry',
    'contrato OpenAPI',
  ]) {
    expect(narrationText).toContain(claim);
  }

  const visualSource = await Bun.file('video/scenes.tsx').text();
  for (const visualDetail of [
    'src/server.ts',
    'src/app.ts',
    'sandbox_sessions',
    'supercool-ledger.onrender.com/sandbox',
    'Application Load Balancer',
    'ECS Fargate',
    'RDS writer endpoint',
    'bootstrap_mode = true',
    'bun run db:migrate',
    'bootstrap_mode = false',
    'GET /v1/accounts/:id/entries',
  ]) {
    expect(visualSource).toContain(visualDetail);
  }

  let cueIndex = 0;
  for (const [sectionIndex, section] of narrationSections.entries()) {
    const scene = sceneRanges[sectionIndex];
    if (!scene) throw new Error('scene_range_missing');
    for (const segment of section) {
      const cue = captionCues[cueIndex];
      if (!cue) throw new Error('caption_cue_missing');
      expect(cue.text).toBe(segment);
      expect(cue.from).toBeGreaterThanOrEqual(scene.from);
      expect(cue.to).toBeLessThanOrEqual(scene.to);
      cueIndex += 1;
    }
  }
  expect(cueIndex).toBe(captionCues.length);
});

test('Spanish narration claims match the captured PostgreSQL run', async () => {
  expect(demo.success.status).toBe(201);
  expect(demo.success.body.amount).toBe('250.00');
  expect(demo.replay.status).toBe(200);
  expect(demo.replay.sameTransfer).toBe(true);
  expect(demo.overspend).toEqual({ status: 422, code: 'insufficient_funds' });
  expect(demo.postings.reduce((sum, posting) => sum + BigInt(posting.amountMinor), 0n)).toBe(0n);
  expect(demo.reconciliation).toEqual({ checkedAccounts: 3, discrepancies: [] });
  expect(narrationText).toContain('doscientos cincuenta dólares');
  expect(narrationText).toContain('cero diferencias en las tres cuentas');
  expect(captionCues.map((cue) => cue.text)).toEqual([...narrationSegments]);
  expect(captionCues.map((cue) => cue.from)).toEqual(
    narrationCueStartMilliseconds.map(sourceMillisecondsToVideoFrame),
  );
  expect(narrationCueStartMilliseconds).toEqual([
    70, 5150, 13680, 17440, 26400, 33050, 39500, 44430, 47160, 53460, 58170, 62400, 67750, 75380,
    78960, 85300, 91600, 95510, 100820, 103100, 107730, 111130, 121700, 138040,
  ]);
  for (const cue of captionCues) expect(narrationText).toContain(cue.text);
  expect(captionCues[0]?.from).toBe(sourceMillisecondsToVideoFrame(70));
  expect(captionCues[1]?.from).toBe(sourceMillisecondsToVideoFrame(5150));
  expect(captionCues.at(-1)?.to).toBe(NARRATION_END_FRAME);
  expect(NARRATION_END_FRAME).toBeLessThan(VIDEO_DURATION_IN_FRAMES);
  for (let index = 1; index < captionCues.length; index += 1) {
    expect(captionCues[index]?.from).toBe(captionCues[index - 1]?.to);
  }

  const visualSource = await Bun.file('video/SuperCoolLedger.tsx').text();
  expect(visualSource).toContain('Invariantes financieras');
  expect(visualSource).toContain('Transferencia atómica');
  expect(visualSource).toContain('Evidencia operativa');
  expect(visualSource).not.toContain('Financial invariants');
  expect(visualSource).not.toContain('Atomic transfer');
  expect(visualSource).not.toContain('Operational evidence');

  const previewSource = await Bun.file('scripts/video-preview.ts').text();
  expect(previewSource).toContain('<html lang="es">');
  expect(previewSource).toContain('<video controls preload="metadata" playsinline');
  expect(previewSource).toContain('poster="/poster.png"');
  expect(previewSource).toContain("url.pathname === '/poster.png'");
  expect(previewSource).not.toContain('autoplay');
});

test('video visuals preserve the signed postings captured from PostgreSQL', async () => {
  const scenes = (await import('../../video/scenes.tsx')) as unknown as {
    capturedPostingVisuals: ReadonlyArray<{
      amount: string;
      amountMinor: string;
      role: string;
    }>;
  };

  expect(scenes.capturedPostingVisuals).toEqual([
    { amount: '-250.00', amountMinor: '-25000', role: 'débito' },
    { amount: '+250.00', amountMinor: '+25000', role: 'crédito' },
  ]);
  expect(
    scenes.capturedPostingVisuals.reduce((sum, posting) => sum + BigInt(posting.amountMinor), 0n),
  ).toBe(0n);
});

test('AWS visuals separate inbound traffic, NAT egress, and migration order', async () => {
  const scenes = (await import('../../video/scenes.tsx')) as unknown as {
    awsReleasePhaseAt: (frame: number) => { id: string } | null;
    awsReleasePhases: ReadonlyArray<{
      id: string;
      migrationRuns: boolean;
      serviceExists: boolean;
    }>;
    awsTrafficPaths: {
      egress: readonly string[];
      inbound: readonly string[];
    };
  };

  expect(scenes.awsTrafficPaths).toEqual({
    inbound: ['Internet', 'Application Load Balancer', 'ECS Fargate', 'RDS writer endpoint'],
    egress: ['ECS Fargate', 'NAT gateway per AZ', 'Internet'],
  });
  expect(scenes.awsTrafficPaths.inbound).not.toContain('NAT gateway per AZ');
  expect(scenes.awsReleasePhases).toEqual([
    { id: 'bootstrap', migrationRuns: false, serviceExists: false },
    { id: 'migration', migrationRuns: true, serviceExists: false },
    { id: 'service', migrationRuns: false, serviceExists: true },
  ]);
  expect(
    [119, 120, 189, 190, 249, 250].map((frame) => scenes.awsReleasePhaseAt(frame)?.id ?? null),
  ).toEqual([null, 'bootstrap', 'bootstrap', 'migration', 'migration', 'service']);
});
