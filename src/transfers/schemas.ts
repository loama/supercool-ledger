import { Type, type Static } from '@sinclair/typebox';

export const CreateTransferSchema = Type.Object({
  sourceAccountId: Type.String({ format: 'uuid' }),
  destinationAccountId: Type.String({ format: 'uuid' }),
  amount: Type.String({ pattern: '^(?:0|[1-9]\\d*)(?:\\.\\d{1,2})?$' }),
  currency: Type.Union([Type.Literal('USD'), Type.Literal('MXN')]),
});

export const TransferIdParamsSchema = Type.Object({
  transferId: Type.String({ format: 'uuid' }),
});

export const TransferSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  sourceAccountId: Type.String({ format: 'uuid' }),
  destinationAccountId: Type.String({ format: 'uuid' }),
  amount: Type.String(),
  currency: Type.String(),
  status: Type.Literal('completed'),
  createdAt: Type.String(),
});

export type CreateTransferInput = Static<typeof CreateTransferSchema>;
export type TransferIdParams = Static<typeof TransferIdParamsSchema>;
