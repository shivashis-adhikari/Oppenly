// Copies the Harper grammar engine (WebAssembly) into public/ and renders toolbar icons from the
// brand mark. Both are build inputs, so they are regenerated rather than committed.
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

// harper.js only exports an ESM entry, so resolve it the ESM way.
const harperDir = path.dirname(fileURLToPath(import.meta.resolve('harper.js')));
await mkdir(path.join(root, 'public/icon'), { recursive: true });
await copyFile(path.join(harperDir, 'harper_wasm_bg.wasm'), path.join(root, 'public/harper.wasm'));

const mark = await readFile(path.resolve(root, '../../assets/brand/oppenly-mark.svg'));
for (const size of [16, 32, 48, 128]) {
  // Chrome recommends ~12.5% padding around the artwork on the 128px icon.
  const pad = size >= 48 ? Math.round(size * 0.125) : Math.round(size * 0.06);
  const inner = size - pad * 2;
  const art = await sharp(mark, { density: 384 }).resize(inner, inner).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: art, left: pad, top: pad }])
    .png()
    .toFile(path.join(root, `public/icon/${size}.png`));
}
process.stdout.write('Assets ready: harper.wasm and icons\n');
