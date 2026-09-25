import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Served from GitHub Pages at https://shivashis-adhikari.github.io/Oppenly/
export default defineConfig({
  base: '/Oppenly/',
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        privacy: resolve(import.meta.dirname, 'privacy.html'),
      },
    },
  },
});
