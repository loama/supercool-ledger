import { Type, type Static } from '@sinclair/typebox';

export const AccountIdParamsSchema = Type.Object({
  accountId: Type.String({ format: 'uuid' }),
});

export const CreateAccountSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 120 }),
  currency: Type.Union([Type.Literal('USD'), Type.Literal('MXN')]),
});

export const AccountSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.String(),
  currency: Type.String(),
  balance: Type.String({ pattern: '^\\d+\\.\\d{2}$' }),
  status: Type.String(),
  createdAt: Type.String(),
});

export type AccountIdParams = Static<typeof AccountIdParamsSchema>;
export type CreateAccountInput = Static<typeof CreateAccountSchema>;
