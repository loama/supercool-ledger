import { expect, test } from 'bun:test';
import type { ReactElement } from 'react';
import demo from '../../video/assets/demo-run.json';
import { captionCues } from '../../video/captions.ts';
import { narrationSections, narrationSegments, narrationText } from '../../video/narration.ts';
import { VideoRoot } from '../../video/Root.tsx';
import { VIDEO_DURATION_IN_FRAMES, VIDEO_PLAYBACK_RATE, sceneRanges } from '../../video/timing.ts';

test('video timing covers ten contiguous scenes at the configured playback rate', () => {
  expect(VIDEO_PLAYBACK_RATE).toBe(1.5);
  expect(VIDEO_DURATION_IN_FRAMES).toBe(2970);
  expect(sceneRanges.map((scene) => scene.id)).toEqual([
    'financial-promise',
    'ledger-invariants',
    'repository-map',
    'request-lifecycle',
    'atomic-transfer',
    'data-model',
    'reviewer-sandbox',
    'captured-evidence',
    'aws-topology',
    'review-path',
  ]);
  expect(sceneRanges[0].from).toBe(0);
  expect(sceneRanges.at(-1)?.to).toBe(VIDEO_DURATION_IN_FRAMES);
  for (let index = 1; index < sceneRanges.length; index += 1) {
    expect(Number(sceneRanges[index]?.from)).toBe(Number(sceneRanges[index - 1]?.to));
  }
  for (const scene of sceneRanges) expect(scene.to).toBeGreaterThan(scene.from);

  const composition = VideoRoot() as ReactElement<{ durationInFrames: number }>;
  expect(composition.props.durationInFrames).toBe(VIDEO_DURATION_IN_FRAMES);
});

test('Spanish story follows the ten scene contract and explains reviewer evidence', () => {
  expect(narrationSections).toHaveLength(10);
  expect(narrationSections.flat()).toEqual([...narrationSegments]);

  for (const source of [
    'src/server.ts',
    'src/app.ts',
    'src/transfers/service.ts',
    'src/accounts/repository.ts',
    'migrations/',
    'scripts/demo-capture.ts',
    'video/assets/demo-run.json',
    'docs/operations.md',
  ]) {
    expect(narrationText).toContain(source);
  }

  for (const sandboxStep of [
    'POST /v1/sandbox/sessions',
    'transferencia exitosa',
    'repetición segura',
    'conflicto de idempotencia',
    'fondos insuficientes',
    'carrera concurrente',
    'asientos inmutables',
    'conciliación',
  ]) {
    expect(narrationText).toContain(sandboxStep);
  }

  for (const awsClaim of [
    'dos zonas de disponibilidad',
    'Application Load Balancer',
    'ECS Fargate',
    'RDS PostgreSQL 17',
    'bootstrap_mode',
    'bun run db:migrate',
    'código cero',
    'sin réplica de lectura',
  ]) {
    expect(narrationText).toContain(awsClaim);
  }
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
  for (const cue of captionCues) expect(narrationText).toContain(cue.text);
  expect(captionCues[0]?.from).toBe(0);
  expect(captionCues.at(-1)?.to).toBe(VIDEO_DURATION_IN_FRAMES);
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
  expect(previewSource).not.toContain('autoplay');
});
