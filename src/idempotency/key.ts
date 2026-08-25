import { ServiceError } from '../platform/problem.ts';

export const validateIdempotencyKey = (value: string | undefined): string => {
  if (!value || value.length < 8 || value.length > 128 || !/^[\x21-\x7E]+$/.test(value)) {
    throw new ServiceError(400, 'invalid_idempotency_key', 'A valid Idempotency Key is required.');
  }
  return value;
};
