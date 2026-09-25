import preact from '@preact/preset-vite';
import { defineConfig } from 'wxt';

const REPO = 'https://github.com/shivashis-adhikari/Oppenly';

export default defineConfig({
  srcDir: 'src',
  outDir: '.output',
  manifestVersion: 3,
  vite: () => ({
    plugins: [preact()],
    build: { sourcemap: false, chunkSizeWarningLimit: 4096 },
  }),
  manifest: {
    name: 'Oppenly: Grammar Checker & Writing Assistant',
    short_name: 'Oppenly',
    description:
      'Grammar, clarity and tone suggestions on every website. Runs on your device. Free and open source.',
    homepage_url: REPO,
    minimum_chrome_version: '120',
    permissions: ['storage', 'contextMenus'],
    // Requested one origin at a time, only when the user adds an AI provider.
    optional_host_permissions: ['https://*/*', 'http://localhost/*', 'http://127.0.0.1/*'],
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
    icons: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },
    action: {
      default_title: 'Oppenly',
      default_icon: { 16: 'icon/16.png', 32: 'icon/32.png' },
    },
    commands: {
      'open-assistant': {
        suggested_key: { default: 'Alt+Shift+O' },
        description: 'Open the Oppenly assistant for the focused text field',
      },
      'toggle-site': {
        suggested_key: { default: 'Alt+Shift+P' },
        description: 'Turn Oppenly on or off for the current site',
      },
    },
  },
});
