import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { setupServer } from 'msw/node';

export const mswServer = setupServer();

beforeAll(() => {
  mswServer.listen({ onUnhandledRequest: 'bypass' });
});

afterEach(() => {
  mswServer.resetHandlers();
  cleanup();
});

afterAll(() => {
  mswServer.close();
});
