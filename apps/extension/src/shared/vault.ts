import type { ProviderConfig } from '@oppenly/engine/ai';

/**
 * Stores AI provider settings, including API keys, in the extension's own IndexedDB.
 * Content scripts run in the web page's origin and cannot open this database. Keys are
 * encrypted with a non-extractable AES-GCM key, so the raw key material never leaves the
 * browser's crypto store. Only the background worker and the settings page call this module.
 */

const DB_NAME = 'oppenly-vault';
const PROVIDERS = 'providers';
const META = 'meta';

interface StoredProvider {
  presetId: string;
  baseUrl: string;
  checkModel: string;
  writeModel: string;
  consentedAt: number | null;
  iv: Uint8Array<ArrayBuffer> | null;
  cipher: ArrayBuffer | null;
  updatedAt: number;
}

export interface ProviderSummary {
  presetId: string;
  baseUrl: string;
  checkModel: string;
  writeModel: string;
  consentedAt: number | null;
  hasKey: boolean;
  updatedAt: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PROVIDERS))
        db.createObjectStore(PROVIDERS, { keyPath: 'presetId' });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(store, mode);
      const req = run(t.objectStore(store));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function cryptoKey(): Promise<CryptoKey> {
  const existing = await tx<CryptoKey | undefined>(META, 'readonly', (s) => s.get('key'));
  if (existing) return existing;
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
  await tx(META, 'readwrite', (s) => s.put(key, 'key'));
  return key;
}

async function encrypt(
  text: string,
): Promise<{ iv: Uint8Array<ArrayBuffer>; cipher: ArrayBuffer }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await cryptoKey(),
    new TextEncoder().encode(text),
  );
  return { iv, cipher };
}

async function decrypt(iv: Uint8Array<ArrayBuffer>, cipher: ArrayBuffer): Promise<string> {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await cryptoKey(), cipher);
  return new TextDecoder().decode(plain);
}

export async function saveProvider(config: ProviderConfig): Promise<void> {
  const secret = config.apiKey ? await encrypt(config.apiKey) : null;
  const record: StoredProvider = {
    presetId: config.presetId,
    baseUrl: config.baseUrl,
    checkModel: config.checkModel,
    writeModel: config.writeModel,
    consentedAt: config.consentedAt,
    iv: secret?.iv ?? null,
    cipher: secret?.cipher ?? null,
    updatedAt: Date.now(),
  };
  await tx(PROVIDERS, 'readwrite', (s) => s.put(record));
}

export async function getProvider(presetId: string): Promise<ProviderConfig | null> {
  const r = await tx<StoredProvider | undefined>(PROVIDERS, 'readonly', (s) => s.get(presetId));
  if (!r) return null;
  const apiKey = r.iv && r.cipher ? await decrypt(r.iv, r.cipher) : '';
  return {
    presetId: r.presetId,
    baseUrl: r.baseUrl,
    apiKey,
    checkModel: r.checkModel,
    writeModel: r.writeModel,
    consentedAt: r.consentedAt,
  };
}

export async function listProviders(): Promise<ProviderSummary[]> {
  const all = await tx<StoredProvider[]>(PROVIDERS, 'readonly', (s) => s.getAll());
  return all.map((r) => ({
    presetId: r.presetId,
    baseUrl: r.baseUrl,
    checkModel: r.checkModel,
    writeModel: r.writeModel,
    consentedAt: r.consentedAt,
    hasKey: Boolean(r.cipher),
    updatedAt: r.updatedAt,
  }));
}

export async function deleteProvider(presetId: string): Promise<void> {
  await tx(PROVIDERS, 'readwrite', (s) => s.delete(presetId));
}

export async function clearVault(): Promise<void> {
  await tx(PROVIDERS, 'readwrite', (s) => s.clear());
}
