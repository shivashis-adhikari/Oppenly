// Takes the product screenshots used on the website from the real extension and web app.
// Run after building both: `pnpm build:extension && pnpm --filter @oppenly/web build`, then
// `pnpm --filter @oppenly/site screenshots`.
import { spawn } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const out = path.resolve(here, '../public/screens');
const extension = path.join(root, 'apps/extension/.output/chrome-mv3');
const SCALE = 2;

async function save(buffer, name) {
  await sharp(buffer)
    .webp({ quality: 86, effort: 6 })
    .toFile(path.join(out, `${name}.webp`));
  process.stdout.write(`  ${name}.webp\n`);
}

async function demoServer() {
  const html = await readFile(path.join(here, 'demo-page.html'));
  const server = createServer((_req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(html);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  // Served under a neutral example address (mapped to this computer below).
  return { url: `http://mail.example.test:${server.address().port}/`, close: () => server.close() };
}

async function extensionShots() {
  const demo = await demoServer();
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1200, height: 760 },
    deviceScaleFactor: SCALE,
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
      '--host-resolver-rules=MAP mail.example.test 127.0.0.1',
    ],
  });
  try {
    if (!context.serviceWorkers().length) await context.waitForEvent('serviceworker');
    await new Promise((r) => setTimeout(r, 1000));
    for (const p of context.pages()) await p.close();
    const page = await context.newPage();
    await page.goto(demo.url);
    await page.click('#body');
    await page.waitForFunction(
      () =>
        (document.querySelector('oppenly-layer')?.shadowRoot?.querySelectorAll('.op-ul').length ??
          0) >= 5,
      null,
      { timeout: 30_000 },
    );
    await page.waitForTimeout(600);
    const windowBox = await page.locator('.window').boundingBox();
    const clip = {
      x: windowBox.x - 28,
      y: windowBox.y - 24,
      width: windowBox.width + 56,
      height: windowBox.height + 48,
    };
    /** The window plus any popover from the extension, with a margin. */
    const around = async (selector) => {
      const box = await page.evaluate((sel) => {
        const el = document.querySelector('oppenly-layer').shadowRoot.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
      }, selector);
      if (!box) return clip;
      const x = Math.min(clip.x, box.x - 28);
      const y = Math.min(clip.y, box.y - 24);
      const right = Math.max(clip.x + clip.width, box.right + 28);
      const bottom = Math.max(clip.y + clip.height, box.bottom + 24);
      return { x, y, width: right - x, height: bottom - y };
    };

    // A suggestion card, opened by hovering the underline under "is".
    const target = await page.evaluate(() => {
      const shadow = document.querySelector('oppenly-layer').shadowRoot;
      const lines = [...shadow.querySelectorAll('.op-ul')].map((u) => u.getBoundingClientRect());
      // The underline whose width matches the short word "is" (second line of the paragraph).
      const small = lines.filter((r) => r.width > 6 && r.width < 20);
      return small.length ? { x: small[0].x + small[0].width / 2, y: small[0].y - 6 } : null;
    });
    if (target) {
      await page.mouse.move(target.x, target.y);
      await page.waitForTimeout(700);
    }
    await save(await page.screenshot({ clip: await around('.op-card') }), 'extension-card');
    await page.mouse.move(5, 5);
    await page.waitForTimeout(400);

    // The assistant sidebar.
    await page.locator('oppenly-layer').locator('.op-fab').click();
    await page.waitForTimeout(600);
    await save(await page.screenshot(), 'extension-sidebar');
    await page.locator('oppenly-layer').locator('[aria-label="Close assistant"]').click();

    // A selection rewrite.
    await page.evaluate(() => {
      const field = document.querySelector('#body');
      const start = field.value.indexOf('Thanks for sending');
      field.focus();
      field.setSelectionRange(start, field.value.indexOf('Friday.') + 7);
      document.dispatchEvent(new Event('selectionchange'));
    });
    await page.waitForTimeout(500);
    await page.locator('oppenly-layer').locator('.op-selbar__btn', { hasText: 'Shorten' }).click();
    await page.waitForTimeout(900);
    await save(await page.screenshot({ clip: await around('.op-rewrite') }), 'extension-rewrite');

    // The field button menu.
    await page.keyboard.press('Escape');
    await page.click('#body');
    await page.waitForTimeout(400);
    await page.locator('oppenly-layer').locator('.op-fab-wrap').hover();
    await page.locator('oppenly-layer').locator('.op-mini').click();
    await page.waitForTimeout(400);
    await save(await page.screenshot({ clip }), 'extension-menu');

    // Settings: AI providers.
    const id = new URL(context.serviceWorkers()[0].url()).host;
    const settings = await context.newPage();
    await settings.setViewportSize({ width: 1280, height: 860 });
    await settings.goto(`chrome-extension://${id}/options.html#ai`);
    await settings.waitForTimeout(700);
    await save(await settings.screenshot(), 'extension-providers');
  } finally {
    await context.close();
    demo.close();
  }
}

async function webShots() {
  const server = spawn('node', [path.join(root, 'apps/web/server/start.mjs'), '--no-open'], {
    stdio: 'ignore',
    env: { ...process.env, CI: '1' },
  });
  await new Promise((r) => setTimeout(r, 1500));
  const browser = await chromium.launch({ channel: 'chromium', headless: true });
  try {
    for (const scheme of ['light', 'dark']) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: SCALE,
        colorScheme: scheme,
      });
      const page = await context.newPage();
      await page.goto('http://localhost:4870/');
      await page.getByRole('button', { name: 'Try a sample' }).click();
      await page.waitForSelector('.ox-ul');
      await page.waitForTimeout(1200);
      await page.locator('.ox-card__row').first().click();
      await page.waitForTimeout(500);
      await save(await page.screenshot(), `web-editor-${scheme}`);
      if (scheme === 'light') {
        await page.getByRole('tab', { name: 'Insights' }).click();
        await page.waitForTimeout(400);
        await save(await page.screenshot(), 'web-insights');
        await page.locator('.ox-top__score').click();
        await page.waitForTimeout(400);
        await save(await page.screenshot(), 'web-performance');
        await page.keyboard.press('Escape');
        await page.getByRole('link', { name: 'Documents' }).first().click();
        await page.waitForTimeout(600);
        await save(await page.screenshot(), 'web-documents');
      }
      await context.close();
    }
  } finally {
    await browser.close();
    server.kill();
  }
}

async function socialImage() {
  const browser = await chromium.launch({ channel: 'chromium', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
    const mark = await readFile(path.join(root, 'assets/brand/oppenly-mark.svg'), 'utf8');
    const font = await readFile(path.join(root, 'packages/ui/src/fonts/figtree-latin.woff2'));
    const shot = await readFile(path.join(out, 'extension-card.webp'));
    await page.setContent(`<!doctype html><html><head><style>
      @font-face { font-family: Figtree; src: url(data:font/woff2;base64,${font.toString('base64')}) format('woff2'); font-weight: 300 900; }
      body { margin: 0; width: 1200px; height: 630px; display: grid; grid-template-columns: 500px 1fr; background: #fff; font-family: Figtree, sans-serif; color: #2b3341; overflow: hidden; }
      .text { padding: 64px 0 0 64px; }
      .brand { display: flex; align-items: center; gap: 14px; font-size: 30px; font-weight: 700; }
      .brand svg { width: 44px; height: 44px; }
      h1 { margin: 48px 0 0; font-size: 56px; line-height: 1.04; letter-spacing: -0.035em; font-weight: 750; }
      p { margin: 22px 0 0; font-size: 23px; line-height: 1.4; color: #5a6475; }
      .shot { margin: 56px 0 0 12px; padding: 24px; border-radius: 24px 0 0 24px; background: #edf3ff; height: 100%; }
      .shot img { width: 700px; border-radius: 14px; border: 1px solid #e4e7ec; box-shadow: 0 16px 40px rgb(16 24 40 / 0.14); }
    </style></head><body>
      <div class="text"><div class="brand">${mark}<span>Oppenly</span></div>
      <h1>Writing help that stays on your computer.</h1>
      <p>Free, private and open source.</p></div>
      <div class="shot"><img src="data:image/webp;base64,${shot.toString('base64')}"></div>
    </body></html>`);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.resolve(out, '../og.png') });
    process.stdout.write('  og.png\n');
  } finally {
    await browser.close();
  }
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
process.stdout.write('Extension\n');
await extensionShots();
process.stdout.write('Web app\n');
await webShots();
process.stdout.write('Social preview\n');
await socialImage();
