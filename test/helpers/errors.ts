import { expect } from 'bun:test';

export const expectErrorCode = async (operation: Promise<unknown>, code: string): Promise<void> => {
  let caught: unknown;
  try {
    await operation;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeDefined();
  expect(caught).toMatchObject({ code });
};
