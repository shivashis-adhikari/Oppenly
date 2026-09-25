// Copies the Harper grammar engine (WebAssembly) into public/ and renders the favicons from the
// brand mark. Both are build inputs, so they are regenerated rather than committed.
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const mark = path.resolve(root, '../../assets/brand/oppenly-mark.svg');

const harperDir = path.dirname(fileURLToPath(import.meta.resolve('harper.js')));
await mkdir(path.join(root, 'public'), { recursive: true });
await copyFile(path.join(harperDir, 'harper_wasm_bg.wasm'), path.join(root, 'public/harper.wasm'));
await copyFile(mark, path.join(root, 'public/favicon.svg'));
for (const size of [32, 180]) {
  await sharp(mark, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(path.join(root, `public/${size === 180 ? 'apple-touch-icon' : 'favicon-32'}.png`));
}
process.stdout.write('Assets ready: harper.wasm and icons\n');
