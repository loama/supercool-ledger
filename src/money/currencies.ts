export const currencies = ['USD', 'MXN'] as const;
export type Currency = (typeof currencies)[number];

export const isCurrency = (value: string): value is Currency =>
  currencies.includes(value as Currency);

const exponents: Record<Currency, number> = { USD: 2, MXN: 2 };

export const currencyExponent = (currency: Currency): number => exponents[currency];
