import { defineConfig } from 'vitest/config';

// Unit tests only. End-to-end tests in tests/ run with Playwright (`pnpm test:e2e`).
export default defineConfig({
  test: { include: ['src/**/*.test.ts', 'server/**/*.test.ts'] },
});
