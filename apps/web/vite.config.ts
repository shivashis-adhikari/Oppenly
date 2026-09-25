import { randomBytes } from 'node:crypto';
import preact from '@preact/preset-vite';
import { defineConfig, type Plugin } from 'vite';
// @ts-expect-error Plain JavaScript module shared with the production server.
import { handleRelay } from './server/relay.mjs';

const PORT = 4870;

/** In development, serve the same AI relay as `pnpm web` does, with a fresh token. */
function relay(): Plugin {
  const token = randomBytes(24).toString('base64url');
  return {
    name: 'oppenly-relay',
    configureServer(server) {
      server.middlewares.use('/relay', (req, res) => {
        void handleRelay(req, res, { token, port: PORT });
      });
    },
    transformIndexHtml: {
      order: 'pre',
      handler: (html, ctx) => (ctx.server ? html.replace('%OPPENLY_RELAY_TOKEN%', token) : html),
    },
  };
}

export default defineConfig({
  plugins: [preact(), relay()],
  server: { host: 'localhost', port: PORT, strictPort: true },
  preview: { host: 'localhost', port: PORT, strictPort: true },
  worker: { format: 'es' },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
});
