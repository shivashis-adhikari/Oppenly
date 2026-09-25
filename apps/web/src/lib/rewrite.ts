import type { Goals } from '@oppenly/engine';
import { REWRITE_INSTRUCTIONS, type RewriteMode } from '@oppenly/engine/ai';
import { LOCAL_REWRITE_LABELS, type LocalRewriteMode } from '@oppenly/engine/labels';
import { ai, aiStatus } from './ai';
import { engine } from './engine';
import { settings } from './settings';

export type Source = 'local' | 'device' | 'ai';

export interface ModeOption {
  mode: string;
  label: string;
}

const LOCAL_ORDER: LocalRewriteMode[] = ['shorten', 'simplify', 'formal', 'friendly', 'confident'];
const AI_ORDER: Exclude<RewriteMode, 'custom'>[] = [
  'improve',
  'fix',
  'shorten',
  'expand',
  'simplify',
  'professional',
  'formal',
  'friendly',
  'confident',
  'persuasive',
];

/** Rewrite options for the current setup: AI modes when a provider is ready, otherwise local. */
export function rewriteModes(): ModeOption[] {
  if (aiStatus.value.ready)
    return AI_ORDER.map((mode) => ({ mode, label: REWRITE_INSTRUCTIONS[mode].label }));
  return LOCAL_ORDER.map((mode) => ({ mode, label: LOCAL_REWRITE_LABELS[mode] }));
}

/** Three short options for the selection toolbar. */
export function quickModes(): ModeOption[] {
  return aiStatus.value.ready
    ? [
        { mode: 'improve', label: 'Improve' },
        { mode: 'shorten', label: 'Shorten' },
        { mode: 'professional', label: 'Professional' },
      ]
    : [
        { mode: 'shorten', label: 'Shorten' },
        { mode: 'formal', label: 'Formal' },
        { mode: 'friendly', label: 'Friendly' },
      ];
}

export async function rewrite(
  text: string,
  mode: string,
  goals: Goals,
  opts: { custom?: string; signal?: AbortSignal; onText?: (t: string) => void } = {},
): Promise<{ text: string; source: Source }> {
  const config = aiStatus.value.ready ? await ai.config(settings.value.ai.provider) : null;
  if (config) {
    const result = await ai.rewrite(
      config,
      text,
      mode as RewriteMode,
      opts.custom ?? '',
      goals,
      settings.value.dialect,
      opts.signal ?? new AbortController().signal,
      opts.onText ?? (() => undefined),
    );
    return { text: result, source: config.presetId === 'on-device' ? 'device' : 'ai' };
  }
  if (!(mode in LOCAL_REWRITE_LABELS)) throw new Error('This option needs an AI provider.');
  const result = await engine.rewrite(text, mode as LocalRewriteMode);
  return { text: result, source: 'local' };
}
