import { expect, test } from 'bun:test';
import fc from 'fast-check';
import { formatMinorUnits, parseMoney } from '../../src/money/money.ts';

test('format and parse preserve positive minor units', () => {
  fc.assert(
    fc.property(fc.bigInt({ min: 1n, max: 9_000_000_000_000_000n }), (amountMinor) => {
      const amount = formatMinorUnits(amountMinor, 'USD');
      expect(parseMoney({ amount, currency: 'USD' }).amountMinor).toBe(amountMinor);
    }),
  );
});
