// Builds the Chrome Web Store images from the product screenshots:
// five 1280x800 screenshots, the 440x280 small promo tile and the 1400x560 marquee.
// Run `pnpm --filter @oppenly/site screenshots` first. Output goes to docs/store/.
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const screens = path.resolve(here, '../public/screens');
const out = path.join(root, 'docs/store');

const SHOTS = [
  ['extension-card', 'Fix mistakes in one click, on almost any website'],
  ['extension-sidebar', 'See every suggestion for a text box in one place'],
  ['extension-rewrite', 'Make a sentence shorter, clearer or friendlier'],
  ['extension-menu', 'Pause it or turn it off for a site in one click'],
  ['extension-providers', 'Checks run on your device. Add your own AI if you want'],
];

const font = await readFile(path.join(root, 'packages/ui/src/fonts/figtree-latin.woff2'));
const mark = await readFile(path.join(root, 'assets/brand/oppenly-mark.svg'), 'utf8');
const base = `
  @font-face { font-family: Figtree; src: url(data:font/woff2;base64,${font.toString('base64')}) format('woff2'); font-weight: 300 900; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Figtree, sans-serif; color: #2b3341; overflow: hidden; }
`;

async function image(name) {
  return `data:image/webp;base64,${(await readFile(path.join(screens, `${name}.webp`))).toString('base64')}`;
}

async function render(page, width, height, html, file) {
  await page.setViewportSize({ width, height });
  await page.setContent(
    `<!doctype html><html><head><style>${base}</style></head><body style="width:${width}px;height:${height}px">${html}</body></html>`,
  );
  await page.waitForTimeout(250);
  // The store wants images without transparency.
  await sharp(await page.screenshot())
    .removeAlpha()
    .png()
    .toFile(path.join(out, file));
  process.stdout.write(`  ${file}\n`);
}

await mkdir(out, { recursive: true });

// Store icon: the mark on a transparent 128x128 canvas with the recommended 16px padding.
const art = await sharp(Buffer.from(mark), { density: 384 }).resize(96, 96).png().toBuffer();
await sharp({
  create: { width: 128, height: 128, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([{ input: art, left: 16, top: 16 }])
  .png()
  .toFile(path.join(out, 'icon-128.png'));
process.stdout.write('  icon-128.png\n');

const browser = await chromium.launch({ channel: 'chromium', headless: true });
const page = await browser.newPage();
try {
  let n = 1;
  for (const [name, caption] of SHOTS) {
    await render(
      page,
      1280,
      800,
      `<div style="height:100%;display:grid;grid-template-rows:auto 1fr;background:#edf3ff">
        <h1 style="margin:0;padding:52px 64px 0;font-size:40px;font-weight:720;letter-spacing:-0.025em;line-height:1.15">${caption}</h1>
        <div style="display:grid;place-items:center;padding:32px 64px 44px;min-height:0">
          <img src="${await image(name)}" style="max-width:1152px;max-height:570px;border-radius:14px;border:1px solid #e4e7ec;box-shadow:0 18px 44px rgb(16 24 40 / 0.16)">
        </div>
      </div>`,
      `screenshot-${n++}.png`,
    );
  }

  await render(
    page,
    440,
    280,
    `<div style="height:100%;display:grid;align-content:center;gap:18px;padding:0 40px;background:#edf3ff">
      <div style="display:flex;align-items:center;gap:12px;font-size:34px;font-weight:720;letter-spacing:-0.02em">
        <span style="width:48px;height:48px;display:block">${mark.replace('<svg', '<svg width="48" height="48"')}</span>Oppenly
      </div>
      <div style="font-size:21px;line-height:1.3;color:#5a6475;font-weight:500">Grammar and writing help that stays on your computer</div>
    </div>`,
    'promo-small-440x280.png',
  );

  await render(
    page,
    1400,
    560,
    `<div style="height:100%;display:grid;grid-template-columns:560px 1fr;background:#fff">
      <div style="padding:84px 0 0 72px">
        <div style="display:flex;align-items:center;gap:14px;font-size:30px;font-weight:720">
          <span style="width:44px;height:44px;display:block">${mark.replace('<svg', '<svg width="44" height="44"')}</span>Oppenly
        </div>
        <div style="margin-top:36px;font-size:50px;line-height:1.06;font-weight:750;letter-spacing:-0.035em">Writing help that stays on your computer.</div>
        <div style="margin-top:20px;font-size:22px;color:#5a6475">Free, private and open source.</div>
      </div>
      <div style="margin-top:48px;padding:28px;border-radius:24px 0 0 0;background:#edf3ff">
        <img src="${await image('extension-card')}" style="width:760px;border-radius:14px;border:1px solid #e4e7ec;box-shadow:0 16px 40px rgb(16 24 40 / 0.14)">
      </div>
    </div>`,
    'marquee-1400x560.png',
  );
} finally {
  await browser.close();
}
