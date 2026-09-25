# Contributing

Thanks for helping make Oppenly better. Bug reports, rule improvements, fixes and translations
of the interface are all welcome.

## Reporting a problem

Open an [issue](https://github.com/shivashis-adhikari/Oppenly/issues) with:

- what you typed (or a shorter example that shows the same problem),
- what Oppenly suggested and what you expected,
- the site or app where it happened, and your browser version.

For false alarms, the exact sentence is the most useful thing you can share. Remove anything
private first. For security problems, see [SECURITY.md](SECURITY.md) instead.

## Setting up

You need Node.js 22 (see `.nvmrc`) and pnpm 10.

```sh
git clone https://github.com/shivashis-adhikari/Oppenly.git
cd Oppenly
pnpm install
```

| Command | What it does |
| --- | --- |
| `pnpm dev:extension` | Runs the extension in a new Chrome window, reloading on changes |
| `pnpm dev:web` | Runs the web app with live reload at http://localhost:4870 |
| `pnpm dev:site` | Runs the website |
| `pnpm web` | Builds and starts the web app the way users run it |
| `pnpm lint` | Checks formatting and code style (Biome) |
| `pnpm typecheck` | Type-checks every package |
| `pnpm test` | Runs the unit tests |
| `pnpm build` | Builds everything |
| `pnpm --filter @oppenly/extension test:e2e` | End-to-end tests for the extension (after `pnpm build`) |
| `pnpm --filter @oppenly/web test:e2e` | End-to-end tests for the web app (after `pnpm build`) |

## How the code is organised

| Folder | Contents |
| --- | --- |
| `packages/engine` | The writing engine: grammar (Harper), style rules, tone, statistics, score, local rewrites, and the optional AI layer |
| `packages/ui` | Design tokens, fonts, icons, shared components and the shared settings screens |
| `apps/extension` | The browser extension (WXT, Manifest V3) |
| `apps/web` | The local web app and its small local server |
| `apps/site` | The website and the scripts that take product screenshots |
| `docs` | Publishing guide and notes on how the AI prompts work |

## Ground rules

These keep Oppenly trustworthy. Pull requests that break them will not be merged.

1. **Nothing leaves the device by default.** The only code that may send text over the network
   is `chat()` and `listModels()` in `packages/engine/src/ai/client.ts`, and they refuse to run
   without the user's recorded consent for that provider.
2. **No remote code.** Everything the extension runs is in the package. No `eval`, no scripts
   from the internet.
3. **No tracking.** No analytics, telemetry or third-party scripts, in any app.
4. **Honest suggestions.** Every suggestion says where it came from (this device or an AI
   provider). A rule that is wrong often is worse than no rule.

## Making changes

- Add a test for every rule change: one sentence it should catch, and ideally one it should
  leave alone. Rule tests live in `packages/engine/test/rules.test.ts`, and correct text that
  must never be flagged goes in `packages/engine/test/corpus.ts`.
- Interface text is short, plain and specific. No jargon, no exclamation marks, no emoji.
- Run `pnpm lint`, `pnpm typecheck` and `pnpm test` before opening a pull request. CI also runs
  the end-to-end tests.
- Keep pull requests focused on one change and describe what a user will notice.

By contributing, you agree that your contributions are licensed under the Apache License 2.0.
