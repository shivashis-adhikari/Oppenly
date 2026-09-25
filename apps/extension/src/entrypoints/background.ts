import { Engine, type LocalRewriteMode, localRewrite, RULE_INFO } from '@oppenly/engine';
import { getPreset, type RewriteMode } from '@oppenly/engine/ai';
import { getProvider } from '@oppenly/engine/vault';
import { createBinaryModuleFromUrl } from 'harper.js';
import { AiService } from '../background/ai-service';
import {
  type ClientMessage,
  PORT_NAME,
  type RuntimeRequest,
  type ServerMessage,
  type TabCommand,
} from '../shared/messages';
import {
  engineSettingsFor,
  getSettings,
  goalsFor,
  onSettingsChanged,
  type Settings,
  updateSettings,
} from '../shared/settings';

const LOCAL_MODES: ReadonlySet<string> = new Set([
  'shorten',
  'formal',
  'friendly',
  'confident',
  'simplify',
]);
const AI_DEBOUNCE_MS = 1200;

export default defineBackground({
  type: 'module',
  main() {
    let settings: Settings | null = null;
    let engine: Engine | null = null;
    let engineReady: Promise<Engine> | null = null;
    const ai = new AiService();

    async function currentSettings(): Promise<Settings> {
      settings ??= await getSettings();
      return settings;
    }

    function getEngine(): Promise<Engine> {
      engineReady ??= (async () => {
        const s = await currentSettings();
        const binary = createBinaryModuleFromUrl(browser.runtime.getURL('/harper.wasm'));
        const e = new Engine(binary);
        await e.init(engineSettingsFor(s));
        engine = e;
        return e;
      })();
      return engineReady;
    }

    onSettingsChanged(async (next) => {
      const prev = settings;
      settings = next;
      if (engine) await engine.updateSettings(engineSettingsFor(next));
      if (prev && (prev.ai.provider !== next.ai.provider || prev.dialect !== next.dialect))
        ai.clear();
    });

    browser.runtime.onConnect.addListener((port) => {
      if (port.name !== PORT_NAME) return;
      const aiTimers = new Map<string, ReturnType<typeof setTimeout>>();
      const aiAborts = new Map<string, AbortController>();
      const rewrites = new Map<string, AbortController>();
      let open = true;
      port.onDisconnect.addListener(() => {
        open = false;
        for (const c of [...aiAborts.values(), ...rewrites.values()]) c.abort();
        for (const t of aiTimers.values()) clearTimeout(t);
      });
      const send = (m: ServerMessage) => {
        if (open) port.postMessage(m);
      };

      port.onMessage.addListener(async (raw: unknown) => {
        const msg = raw as ClientMessage;
        if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return;
        const s = await currentSettings();

        if (msg.t === 'status') {
          send({ t: 'status', ai: await ai.status(s) });
          return;
        }

        if (msg.t === 'analyze') {
          if (typeof msg.text !== 'string' || msg.text.length > 200_000) return;
          const e = await getEngine();
          const goals = goalsFor(s, msg.host);
          const local = await e.analyze(msg.text, [], goals);
          const config = s.ai.liveCheck ? await ai.config(s) : null;
          send({
            t: 'analysis',
            field: msg.field,
            rev: msg.rev,
            analysis: local,
            ai: config ? 'pending' : 'off',
          });
          if (!config) return;

          clearTimeout(aiTimers.get(msg.field));
          aiAborts.get(msg.field)?.abort();
          aiTimers.set(
            msg.field,
            setTimeout(async () => {
              const controller = new AbortController();
              aiAborts.set(msg.field, controller);
              try {
                const extra = await ai.check(msg.text, config, goals, s.dialect, controller.signal);
                if (controller.signal.aborted) return;
                const merged = await e.analyze(msg.text, extra, goals);
                send({
                  t: 'analysis',
                  field: msg.field,
                  rev: msg.rev,
                  analysis: merged,
                  ai: 'done',
                });
              } catch (err) {
                if (controller.signal.aborted) return;
                send({
                  t: 'analysis',
                  field: msg.field,
                  rev: msg.rev,
                  analysis: local,
                  ai: 'error',
                  aiError: (err as Error).message,
                });
              }
            }, AI_DEBOUNCE_MS),
          );
          return;
        }

        if (msg.t === 'cancel') {
          rewrites.get(msg.req)?.abort();
          rewrites.delete(msg.req);
          return;
        }

        if (msg.t === 'rewrite') {
          const controller = new AbortController();
          rewrites.set(msg.req, controller);
          try {
            const config = await ai.config(s);
            const goals = goalsFor(s, msg.host);
            if (config) {
              const text = await ai.rewrite(
                config,
                msg.text,
                msg.mode as RewriteMode,
                msg.custom ?? '',
                goals,
                s.dialect,
                controller.signal,
                (partial) => send({ t: 'rewrite-progress', req: msg.req, text: partial }),
              );
              send({
                t: 'rewrite-done',
                req: msg.req,
                text,
                source: getPreset(config.presetId)?.local ? 'device' : 'ai',
              });
            } else if (LOCAL_MODES.has(msg.mode)) {
              send({
                t: 'rewrite-done',
                req: msg.req,
                text: localRewrite(msg.text, msg.mode as LocalRewriteMode),
                source: 'local',
              });
            } else {
              send({
                t: 'rewrite-error',
                req: msg.req,
                message: 'This rewrite needs an AI provider. Add one in Oppenly settings.',
              });
            }
          } catch (err) {
            if (!controller.signal.aborted)
              send({ t: 'rewrite-error', req: msg.req, message: (err as Error).message });
          } finally {
            rewrites.delete(msg.req);
          }
        }
      });
    });

    browser.runtime.onMessage.addListener((raw: unknown, sender, reply) => {
      if (sender.id !== browser.runtime.id) return false;
      const msg = raw as RuntimeRequest;
      (async () => {
        const s = await currentSettings();
        switch (msg.t) {
          case 'ai-status':
            return ai.status(s);
          case 'rule-info':
            return RULE_INFO;
          case 'open-options':
            await browser.runtime.openOptionsPage();
            return { ok: true };
          case 'test-provider': {
            const config = await getProvider(msg.presetId);
            if (!config) throw new Error('Save the provider first.');
            return ai.test(config);
          }
          case 'list-models': {
            const config = await getProvider(msg.presetId);
            if (!config) throw new Error('Save the provider first.');
            return { models: await ai.models(config) };
          }
        }
        return null;
      })().then(
        (result) => reply({ ok: true, result }),
        (err: Error) => reply({ ok: false, error: err.message }),
      );
      return true;
    });

    async function sendToActiveTab(command: TabCommand) {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab?.id !== undefined)
        await browser.tabs.sendMessage(tab.id, command).catch(() => undefined);
    }

    browser.commands.onCommand.addListener(async (command) => {
      if (command === 'open-assistant') await sendToActiveTab({ t: 'open-assistant' });
      if (command === 'toggle-site') {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        const host = tab?.url ? new URL(tab.url).hostname : '';
        if (!host) return;
        const next = await updateSettings((cur) => ({
          disabledSites: cur.disabledSites.includes(host)
            ? cur.disabledSites.filter((h) => h !== host)
            : [...cur.disabledSites, host],
        }));
        await sendToActiveTab({ t: 'site-toggled', enabled: !next.disabledSites.includes(host) });
      }
    });

    browser.runtime.onInstalled.addListener(async (details) => {
      browser.contextMenus.create({
        id: 'oppenly-rewrite',
        title: 'Rewrite with Oppenly',
        contexts: ['selection', 'editable'],
      });
      browser.contextMenus.create({
        id: 'oppenly-assistant',
        title: 'Open Oppenly assistant',
        contexts: ['editable'],
      });
      if (details.reason === 'install') {
        await browser.tabs.create({ url: browser.runtime.getURL('/welcome.html') });
      }
    });

    browser.contextMenus.onClicked.addListener(async (info, tab) => {
      if (tab?.id === undefined) return;
      const command: TabCommand =
        info.menuItemId === 'oppenly-rewrite'
          ? { t: 'rewrite-selection' }
          : { t: 'open-assistant' };
      await browser.tabs
        .sendMessage(tab.id, command, { frameId: info.frameId })
        .catch(() => undefined);
    });

    // Warm the engine so the first check is instant.
    void getEngine();
  },
});
