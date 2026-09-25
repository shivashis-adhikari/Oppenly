import type { Analysis, Goals, LocalRewriteMode } from '@oppenly/engine';
import type { RewriteMode } from '@oppenly/engine/ai';

export const PORT_NAME = 'oppenly';

export type RewriteRequestMode = RewriteMode | LocalRewriteMode;

/** Where a rewrite ran. */
export type RewriteSource = 'local' | 'device' | 'ai';

/** Content script → background, over a long-lived port. */
export type ClientMessage =
  | { t: 'analyze'; field: string; rev: number; text: string; host: string }
  | {
      t: 'rewrite';
      req: string;
      text: string;
      mode: RewriteRequestMode;
      custom?: string;
      host: string;
    }
  | { t: 'cancel'; req: string }
  | { t: 'status' };

export type AiState = 'off' | 'pending' | 'done' | 'error';

/** Background → content script. */
export type ServerMessage =
  | { t: 'analysis'; field: string; rev: number; analysis: Analysis; ai: AiState; aiError?: string }
  | { t: 'rewrite-progress'; req: string; text: string }
  | { t: 'rewrite-done'; req: string; text: string; source: RewriteSource }
  | { t: 'rewrite-error'; req: string; message: string }
  | { t: 'status'; ai: AiStatus };

export interface AiStatus {
  /** A provider is configured, consented to and ready. */
  ready: boolean;
  /** Display name, e.g. "OpenAI" or "Chrome built-in AI". */
  provider: string | null;
  /** True when the configured provider runs on this computer. */
  local: boolean;
}

/** One-off messages from any extension context to the background. */
export type RuntimeRequest =
  | { t: 'test-provider'; presetId: string }
  | { t: 'list-models'; presetId: string }
  | { t: 'open-options'; section?: string }
  | { t: 'ai-status' }
  | { t: 'rule-info' };

/** Background → content script, sent to a tab (commands and context menus). */
export type TabCommand =
  | { t: 'get-host' }
  | { t: 'open-assistant'; tab?: 'suggestions' | 'rewrite' | 'insights' }
  | { t: 'rewrite-selection' }
  | { t: 'site-toggled'; enabled: boolean };

export type { Goals };
