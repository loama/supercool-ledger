import { expect, test } from 'bun:test';
import demo from '../../video/assets/demo-run.json';
import { captionCues } from '../../video/captions.ts';
import { narrationText } from '../../video/narration.ts';

test('narration claims match the captured PostgreSQL run', () => {
  expect(demo.success.status).toBe(201);
  expect(demo.success.body.amount).toBe('250.00');
  expect(demo.replay.status).toBe(200);
  expect(demo.replay.sameTransfer).toBe(true);
  expect(demo.overspend).toEqual({ status: 422, code: 'insufficient_funds' });
  expect(demo.postings.reduce((sum, posting) => sum + BigInt(posting.amountMinor), 0n)).toBe(0n);
  expect(demo.reconciliation).toEqual({ checkedAccounts: 3, discrepancies: [] });
  expect(narrationText).toContain('two hundred fifty dollars');
  expect(narrationText).toContain('zero discrepancies across all three demo accounts');
  for (const cue of captionCues) expect(narrationText).toContain(cue.text);
  expect(captionCues[0]?.from).toBe(0);
  expect(captionCues.at(-1)?.to).toBe(4050);
  for (let index = 1; index < captionCues.length; index += 1) {
    expect(captionCues[index]?.from).toBe(captionCues[index - 1]?.to);
  }
});
