# Notes for coding agents

Read [CONTRIBUTING.md](CONTRIBUTING.md) first. Its ground rules apply to every change.

## Commands

- Install: `pnpm install`
- Check everything: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- End-to-end: `pnpm --filter @oppenly/extension test:e2e` and `pnpm --filter @oppenly/web test:e2e`
  (both need `pnpm build` first; Playwright uses the `chromium` channel)
- Website screenshots: `pnpm --filter @oppenly/site screenshots` (needs both apps built)

## Conventions

- TypeScript strict mode, ES modules, Preact with signals. Biome formats and lints (`pnpm format`).
- Match the style of the surrounding code: short functions, a one-line comment where the reason
  is not obvious, no commented-out code.
- The main thread of the web app and the extension's content script import from
  `@oppenly/engine/types`, `labels`, `ai` and `vault` only (types from the root are fine). The full engine
  (Harper and the rule data) loads in the web app's worker and the extension's background worker.
- User-facing text: plain English, sentence case, no jargon, no exclamation marks, no emoji.
- Pin exact dependency versions and check the license of anything new (MIT, Apache-2.0, BSD or
  similar only).

## Privacy invariants

- Only `packages/engine/src/ai/client.ts` may send text off the device, and only after consent.
- The web app page may only connect to its own local server (enforced by its Content Security
  Policy in `apps/web/server/start.mjs`).
- API keys are stored with `packages/engine/src/vault.ts` and never logged, exported or shown.

## Before committing

Run the full check above. Commits are authored by the repository owner.
