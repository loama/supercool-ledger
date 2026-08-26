import { expect, test } from 'bun:test';
import demo from '../../video/assets/demo-run.json';
import { captionCues } from '../../video/captions.ts';
import { narrationSegments, narrationText } from '../../video/narration.ts';

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
  expect(captionCues.at(-1)?.to).toBe(4455);
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
