import { describe, expect, test } from 'bun:test';
import { formatMinorUnits, parseMoney } from '../../src/money/money.ts';

describe('money', () => {
  test('parses two decimal currencies without floating point', () => {
    expect(parseMoney({ amount: '1250.04', currency: 'USD' })).toEqual({
      amountMinor: 125004n,
      currency: 'USD',
    });
  });

  test.each(['1.001', '1e3', '-1.00', '+1.00', ' 1.00', '0', '0.00', '.50'])(
    'rejects invalid amount %s',
    (amount) => {
      expect(() => parseMoney({ amount, currency: 'USD' })).toThrow('invalid_amount');
    },
  );

  test('rejects unsupported currencies', () => {
    expect(() => parseMoney({ amount: '1.00', currency: 'BTC' })).toThrow('invalid_currency');
  });

  test('formats exact minor units', () => {
    expect(formatMinorUnits(125004n, 'USD')).toBe('1250.04');
    expect(formatMinorUnits(1n, 'MXN')).toBe('0.01');
  });
});
