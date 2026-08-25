import { currencyExponent, isCurrency, type Currency } from './currencies.ts';

export interface MoneyInput {
  amount: string;
  currency: string;
}

export interface Money {
  amountMinor: bigint;
  currency: Currency;
}

const maximumMinorUnits = 9_000_000_000_000_000n;

export const parseMoney = (input: MoneyInput): Money => {
  if (!isCurrency(input.currency)) {
    throw new Error('invalid_currency');
  }

  const exponent = currencyExponent(input.currency);
  const pattern = new RegExp(`^(?:0|[1-9]\\d*)(?:\\.(\\d{1,${exponent}}))?$`);
  const match = pattern.exec(input.amount);
  if (!match) {
    throw new Error('invalid_amount');
  }

  const [whole = '0'] = input.amount.split('.');
  const fraction = (match[1] ?? '').padEnd(exponent, '0');
  const amountMinor = BigInt(whole) * 10n ** BigInt(exponent) + BigInt(fraction || '0');
  if (amountMinor <= 0n || amountMinor > maximumMinorUnits) {
    throw new Error('invalid_amount');
  }

  return { amountMinor, currency: input.currency };
};

export const formatMinorUnits = (amountMinor: bigint, currency: Currency): string => {
  const exponent = currencyExponent(currency);
  const divisor = 10n ** BigInt(exponent);
  const sign = amountMinor < 0n ? '-' : '';
  const absolute = amountMinor < 0n ? -amountMinor : amountMinor;
  const whole = absolute / divisor;
  const fraction = (absolute % divisor).toString().padStart(exponent, '0');
  return `${sign}${whole}.${fraction}`;
};
