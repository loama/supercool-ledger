import { Type, type Static } from '@sinclair/typebox';

export const CreateTransferSchema = Type.Object(
  {
    sourceAccountId: Type.String({ format: 'uuid' }),
    destinationAccountId: Type.String({ format: 'uuid' }),
    amount: Type.String({ pattern: '^(?:0|[1-9]\\d*)(?:\\.\\d{1,2})?$' }),
    currency: Type.Union([Type.Literal('USD'), Type.Literal('MXN')]),
  },
  {
    examples: [
      {
        sourceAccountId: '3179592d-b63f-40c0-9c7f-1cfeb468379f',
        destinationAccountId: '8695b095-d7e2-4d77-9c6e-388c3efb1385',
        amount: '250.00',
        currency: 'USD',
      },
    ],
  },
);

export const TransferIdParamsSchema = Type.Object({
  transferId: Type.String({ format: 'uuid' }),
});

export const TransferSchema = Type.Object(
  {
    id: Type.String({ format: 'uuid' }),
    sourceAccountId: Type.String({ format: 'uuid' }),
    destinationAccountId: Type.String({ format: 'uuid' }),
    amount: Type.String(),
    currency: Type.String(),
    status: Type.Literal('completed'),
    createdAt: Type.String(),
  },
  {
    examples: [
      {
        id: '7fa2d351-7f5e-437c-ad3c-d64447266d43',
        sourceAccountId: '3179592d-b63f-40c0-9c7f-1cfeb468379f',
        destinationAccountId: '8695b095-d7e2-4d77-9c6e-388c3efb1385',
        amount: '250.00',
        currency: 'USD',
        status: 'completed',
        createdAt: '2026-08-25T20:05:00.000Z',
      },
    ],
  },
);

export type CreateTransferInput = Static<typeof CreateTransferSchema>;
export type TransferIdParams = Static<typeof TransferIdParamsSchema>;
