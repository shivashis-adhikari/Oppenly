import {
  AiService,
  type AiStatus,
  listModels,
  onDeviceAvailability,
  setTransport,
} from '@oppenly/engine/ai';
import { deleteProvider, getProvider, listProviders, saveProvider } from '@oppenly/engine/vault';
import type { ProviderBackend } from '@oppenly/ui/settings';
import { signal } from '@preact/signals';
import { settings } from './settings';

/**
 * Provider requests go to the local server's relay (on this computer), which forwards them to
 * the provider. Browsers block most provider APIs from web pages, and the page's security policy
 * only allows connections to the local server.
 */
const relayToken = document.querySelector<HTMLMetaElement>('meta[name="oppenly-relay"]')?.content;
setTransport((url, init) => {
  const headers = new Headers(init.headers);
  headers.set('x-oppenly-target', url);
  headers.set('x-oppenly-token', relayToken ?? '');
  return fetch('/relay', { ...init, headers });
});

export const ai = new AiService();
export const aiStatus = signal<AiStatus>({ ready: false, provider: null, local: true });

export async function refreshAiStatus(): Promise<void> {
  aiStatus.value = await ai.status(settings.value.ai.provider);
}

export const providerBackend: ProviderBackend = {
  list: listProviders,
  get: getProvider,
  save: saveProvider,
  async remove(id) {
    await deleteProvider(id);
    ai.clear();
  },
  // The web app has no per-site permissions; the relay only forwards to the saved address.
  requestAccess: async () => true,
  releaseAccess: async () => undefined,
  async test(id) {
    const config = await ai.config(id);
    if (!config) throw new Error('Save a model first.');
    return ai.test(config);
  },
  async listModels(id) {
    const config = await getProvider(id);
    if (!config) throw new Error('Save this provider first.');
    return listModels(config);
  },
  onDeviceAvailability,
};
