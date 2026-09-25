import { defineConfig } from '@playwright/test';

// End-to-end tests run against the built app served by `pnpm start` (run `pnpm build` first).
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 20_000 },
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4870',
    channel: 'chromium',
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  },
  webServer: {
    command: 'node server/start.mjs --no-open',
    url: 'http://localhost:4870',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
