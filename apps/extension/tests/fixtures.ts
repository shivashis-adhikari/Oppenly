import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type BrowserContext,
  test as base,
  chromium,
  type Locator,
  type Page,
} from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(here, '../.output/chrome-mv3');

interface Fixtures {
  context: BrowserContext;
  extensionId: string;
  site: string;
  /** Every request the browser made that was not to the local test server or the extension itself. */
  outbound: string[];
}

/** Serves tests/pages over http://localhost so content scripts run as on a real site. */
async function serve(): Promise<Server> {
  const server = createServer(async (req, res) => {
    const name = req.url === '/' ? 'compose.html' : (req.url ?? '').slice(1).split('?')[0]!;
    try {
      const body = await readFile(path.join(here, 'pages', path.basename(name)));
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(body);
    } catch {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server;
}

export const test = base.extend<Fixtures>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture signature
  site: async ({}, use) => {
    const server = await serve();
    await use(`http://localhost:${(server.address() as AddressInfo).port}`);
    server.close();
  },
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture signature
  outbound: async ({}, use) => {
    await use([]);
  },
  context: async ({ outbound }, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: true,
      viewport: { width: 1280, height: 860 },
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    context.on('request', (r) => {
      const url = new URL(r.url());
      const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
      if (!local && !['chrome-extension:', 'data:', 'blob:'].includes(url.protocol))
        outbound.push(r.url());
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use(new URL(worker.url()).host);
  },
});

export const expect = test.expect;

/** The extension's UI layer (a shadow root). Playwright locators pierce open shadow roots. */
export function layer(page: Page): Locator {
  return page.locator('oppenly-layer');
}

/** Waits until the given field has been checked and underlined. */
export async function waitForUnderlines(page: Page, min = 1): Promise<void> {
  await page.waitForFunction(
    // Websites get <oppenly-layer>; the welcome page mounts the same layer as <oppenly-demo>.
    (n) =>
      (document.querySelector('oppenly-layer, oppenly-demo')?.shadowRoot?.querySelectorAll('.op-ul')
        .length ?? 0) >= n,
    min,
    { timeout: 30_000 },
  );
}

/** Collects uncaught page errors so a test can assert there were none. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}
