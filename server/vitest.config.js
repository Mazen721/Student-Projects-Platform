import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    passWithNoTests: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
    testTimeout: 30000,
    hookTimeout: 60000,
    pool: 'forks',
  },
});
