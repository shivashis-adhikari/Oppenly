import { type ClientMessage, PORT_NAME, type ServerMessage } from '../shared/messages';

type Handler = (m: ServerMessage) => void;

let port: ReturnType<typeof browser.runtime.connect> | null = null;
const handlers = new Set<Handler>();
const reconnectHandlers = new Set<() => void>();

function ensure() {
  if (port) return port;
  const p = browser.runtime.connect({ name: PORT_NAME });
  p.onMessage.addListener((m: unknown) => {
    for (const h of handlers) h(m as ServerMessage);
  });
  p.onDisconnect.addListener(() => {
    port = null;
    // The background worker was restarted by the browser. Let sessions resend pending work.
    for (const h of reconnectHandlers) h();
  });
  port = p;
  return p;
}

/** Send a message to the background worker over a long-lived port. */
export function send(message: ClientMessage): boolean {
  try {
    ensure().postMessage(message);
    return true;
  } catch {
    port = null;
    return false;
  }
}

export function onServerMessage(h: Handler): () => void {
  handlers.add(h);
  return () => handlers.delete(h);
}

export function onDisconnect(h: () => void): () => void {
  reconnectHandlers.add(h);
  return () => reconnectHandlers.delete(h);
}

export function disconnect(): void {
  port?.disconnect();
  port = null;
}
