import { Type, type Static } from '@sinclair/typebox';

export const AccountIdParamsSchema = Type.Object({
  accountId: Type.String({ format: 'uuid' }),
});

export const CreateAccountSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 120 }),
    currency: Type.Union([Type.Literal('USD'), Type.Literal('MXN')]),
  },
  { examples: [{ name: 'Operating USD', currency: 'USD' }] },
);

export const AccountSchema = Type.Object(
  {
    id: Type.String({ format: 'uuid' }),
    name: Type.String(),
    currency: Type.String(),
    balance: Type.String({ pattern: '^\\d+\\.\\d{2}$' }),
    status: Type.String(),
    createdAt: Type.String(),
  },
  {
    examples: [
      {
        id: '3179592d-b63f-40c0-9c7f-1cfeb468379f',
        name: 'Operating USD',
        currency: 'USD',
        balance: '1000.00',
        status: 'active',
        createdAt: '2026-08-25T20:00:00.000Z',
      },
    ],
  },
);

export const AccountEntriesQuerySchema = Type.Object({
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 50 })),
  cursor: Type.Optional(Type.String({ minLength: 1, maxLength: 512 })),
});

export const AccountEntrySchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  journalId: Type.String({ format: 'uuid' }),
  accountId: Type.String({ format: 'uuid' }),
  journalKind: Type.String(),
  reference: Type.String(),
  amount: Type.String({ pattern: '^-?\\d+\\.\\d{2}$' }),
  currency: Type.String(),
  postedAt: Type.String(),
});

export const AccountEntriesSchema = Type.Object({
  entries: Type.Array(AccountEntrySchema),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
});

export type AccountIdParams = Static<typeof AccountIdParamsSchema>;
export type AccountEntriesQuery = Static<typeof AccountEntriesQuerySchema>;
export type CreateAccountInput = Static<typeof CreateAccountSchema>;
