import type { Goals } from '@oppenly/engine';
import { settings } from './settings';

/** A document as stored in this browser's IndexedDB. Nothing is uploaded anywhere. */
export interface DocRecord {
  id: string;
  title: string;
  /** Editor content (ProseMirror JSON). */
  content: unknown;
  /** Plain text, for search and previews. */
  text: string;
  words: number;
  score: number | null;
  goals: Goals;
  createdAt: number;
  updatedAt: number;
  /** When it was moved to the trash, or null. */
  deletedAt: number | null;
  /** Ids of suggestions the user dismissed in this document. */
  dismissed?: string[];
}

const DB = 'oppenly';
const STORE = 'documents';
/** Documents in the trash are deleted for good after this long. */
export const TRASH_DAYS = 30;

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: 'id' });
      store.createIndex('updatedAt', 'updatedAt');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | undefined,
): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req?.result as T);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Storage failed.'));
  });
}

export function newId(): string {
  return crypto.randomUUID();
}

export async function listDocs(): Promise<DocRecord[]> {
  const all = await run<DocRecord[]>('readonly', (s) => s.getAll());
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getDoc(id: string): Promise<DocRecord | undefined> {
  return run<DocRecord | undefined>('readonly', (s) => s.get(id));
}

export async function putDoc(doc: DocRecord): Promise<void> {
  await run('readwrite', (s) => s.put(doc));
}

export async function createDoc(init: Partial<DocRecord> = {}): Promise<DocRecord> {
  const now = Date.now();
  const doc: DocRecord = {
    id: newId(),
    title: '',
    content: null,
    text: '',
    words: 0,
    score: null,
    // New documents start from the default goals in Settings.
    goals: settings.value.goals,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...init,
  };
  await putDoc(doc);
  void requestPersistence();
  return doc;
}

async function patch(id: string, change: Partial<DocRecord>): Promise<void> {
  const doc = await getDoc(id);
  if (doc) await putDoc({ ...doc, ...change });
}

export const trashDoc = (id: string) => patch(id, { deletedAt: Date.now() });
export const restoreDoc = (id: string) => patch(id, { deletedAt: null });

export async function deleteDoc(id: string): Promise<void> {
  await run('readwrite', (s) => s.delete(id));
}

export async function emptyTrash(): Promise<void> {
  for (const d of await listDocs()) if (d.deletedAt) await deleteDoc(d.id);
}

export async function deleteAllDocs(): Promise<void> {
  await run('readwrite', (s) => s.clear());
}

/** Removes documents that have been in the trash longer than TRASH_DAYS. */
export async function purgeOldTrash(): Promise<void> {
  const cutoff = Date.now() - TRASH_DAYS * 86_400_000;
  for (const d of await listDocs()) if (d.deletedAt && d.deletedAt < cutoff) await deleteDoc(d.id);
}

/** Ask the browser not to clear these documents when disk space runs low. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (await navigator.storage?.persisted?.()) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export function displayTitle(doc: Pick<DocRecord, 'title' | 'text'>): string {
  if (doc.title.trim()) return doc.title.trim();
  const first = doc.text.trim().split('\n')[0]?.trim() ?? '';
  return first ? (first.length > 60 ? `${first.slice(0, 60).trimEnd()}…` : first) : 'Untitled';
}
