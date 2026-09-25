import type { Dialect, Goals, Suggestion } from '../types';
import { hash } from '../util/text';
import { getProvider } from '../vault';
import { chat, listModels } from './client';
import { onDeviceAvailability } from './on-device';
import type { RewriteMode } from './prompts';
import { getPreset, type ProviderConfig } from './providers';
import { aiCheck, aiRewrite } from './tasks';

export interface AiStatus {
  /** A provider is chosen, consented to and has a model. */
  ready: boolean;
  /** Display name, e.g. "OpenAI" or "Chrome built-in AI". */
  provider: string | null;
  /** The provider runs on this computer (nothing leaves the device). */
  local: boolean;
}

interface CachedEdits {
  /** Suggestions with offsets relative to the paragraph. */
  items: Suggestion[];
  at: number;
}

const CACHE_LIMIT = 400;

/** Paragraphs worth sending: three words or more. */
function splitForCheck(text: string): { text: string; start: number }[] {
  const paragraphs: { text: string; start: number }[] = [];
  const re = /[^\n]+/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m[0].trim().split(/\s+/).length >= 3) paragraphs.push({ text: m[0], start: m.index });
  }
  return paragraphs;
}

function cacheKey(config: ProviderConfig, goals: Goals, dialect: Dialect) {
  return (paragraph: string) =>
    hash(
      `${config.presetId}|${config.checkModel}|${dialect}|${JSON.stringify(goals)}|${paragraph}`,
    );
}

/** Orchestrates optional AI features. Never runs unless a provider is configured and consented. */
export class AiService {
  private cache = new Map<string, CachedEdits>();

  /** The usable configuration for provider `id`, or null if it is missing or lacks consent. */
  async config(id: string | null): Promise<ProviderConfig | null> {
    if (!id) return null;
    if (id === 'on-device') {
      return {
        presetId: 'on-device',
        baseUrl: '',
        apiKey: '',
        checkModel: 'on-device',
        writeModel: 'on-device',
        consentedAt: 0,
      };
    }
    const config = await getProvider(id);
    if (!config) return null;
    const preset = getPreset(id);
    if (!preset) return null;
    if (!preset.local && !config.consentedAt) return null;
    if (!config.checkModel) return null;
    return config;
  }

  async status(id: string | null): Promise<AiStatus> {
    const preset = id ? getPreset(id) : undefined;
    if (!preset) return { ready: false, provider: null, local: true };
    if (id === 'on-device') {
      const availability = await onDeviceAvailability();
      return { ready: availability === 'available', provider: preset.name, local: true };
    }
    const config = await this.config(id);
    return { ready: Boolean(config), provider: preset.name, local: preset.local };
  }

  /**
   * AI proofreading for the paragraphs of `text` that are not cached yet. Returns suggestions for
   * the whole text (cached and new), with absolute offsets.
   */
  async check(
    text: string,
    config: ProviderConfig,
    goals: Goals,
    dialect: Dialect,
    signal: AbortSignal,
  ): Promise<Suggestion[]> {
    const paragraphs = splitForCheck(text);
    const keyFor = cacheKey(config, goals, dialect);
    const missing = paragraphs.filter((p) => !this.cache.has(keyFor(p.text))).slice(0, 8);

    // Two requests at a time keeps latency low without hammering rate limits.
    for (let i = 0; i < missing.length; i += 2) {
      const batch = missing.slice(i, i + 2);
      await Promise.all(
        batch.map(async (p) => {
          const items = await aiCheck({ config, goals, dialect, signal }, p.text, p.text, 0);
          this.cache.set(keyFor(p.text), { items, at: Date.now() });
        }),
      );
      if (signal.aborted) break;
    }
    if (this.cache.size > CACHE_LIMIT) {
      const oldest = [...this.cache.entries()]
        .sort((a, b) => a[1].at - b[1].at)
        .slice(0, this.cache.size - CACHE_LIMIT);
      for (const [k] of oldest) this.cache.delete(k);
    }
    return this.cached(text, config, goals, dialect);
  }

  /** Suggestions already known for `text`, without contacting the provider. */
  cached(text: string, config: ProviderConfig, goals: Goals, dialect: Dialect): Suggestion[] {
    const keyFor = cacheKey(config, goals, dialect);
    const out: Suggestion[] = [];
    for (const p of splitForCheck(text)) {
      const cached = this.cache.get(keyFor(p.text));
      if (!cached) continue;
      for (const s of cached.items)
        out.push({ ...s, start: s.start + p.start, end: s.end + p.start });
    }
    return out;
  }

  async rewrite(
    config: ProviderConfig,
    text: string,
    mode: RewriteMode,
    custom: string,
    goals: Goals,
    dialect: Dialect,
    signal: AbortSignal,
    onText: (t: string) => void,
  ): Promise<string> {
    return aiRewrite({ config, goals, dialect, signal }, text, mode, custom, onText);
  }

  /** Round-trip test used by the settings page. */
  async test(config: ProviderConfig): Promise<{ ms: number }> {
    const started = performance.now();
    await chat(config, {
      system: 'Reply with the single word OK.',
      user: 'Ping',
      model: config.checkModel,
      maxTokens: 16,
    });
    return { ms: Math.round(performance.now() - started) };
  }

  async models(config: ProviderConfig): Promise<string[]> {
    return listModels(config);
  }

  clear(): void {
    this.cache.clear();
  }
}
