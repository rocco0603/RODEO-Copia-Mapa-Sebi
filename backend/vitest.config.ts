import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    clearMocks: true,
    testTimeout: 15000,
    include: ['tests/**/*.test.ts'],
  },
});
