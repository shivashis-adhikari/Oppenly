import { defineConfig } from '@playwright/test';

// End-to-end tests load the built extension (`pnpm build`) into Chromium.
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
});
