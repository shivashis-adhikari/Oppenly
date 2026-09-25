import type { Dialect, Goals, Suggestion } from '../types';
import { chat } from './client';
import { cleanRewrite, editsToSuggestions, parseEdits } from './parse';
import {
  CHECK_SYSTEM,
  COMPOSE_SYSTEM,
  checkUser,
  composeUser,
  INSIGHT_INSTRUCTIONS,
  INSIGHT_SYSTEM,
  type InsightMode,
  insightUser,
  REWRITE_INSTRUCTIONS,
  REWRITE_SYSTEM,
  type RewriteMode,
  rewriteUser,
} from './prompts';
import type { ProviderConfig } from './providers';

export * from './client';
export * from './on-device';
export * from './parse';
export * from './prompts';
export * from './providers';

export interface AiContext {
  config: ProviderConfig;
  goals: Goals;
  dialect: Dialect;
  signal?: AbortSignal;
}

/** AI proofreading of one passage. `base` is the passage's offset in `document`. */
export async function aiCheck(
  ctx: AiContext,
  document: string,
  passage: string,
  base: number,
): Promise<Suggestion[]> {
  if (passage.trim().split(/\s+/).length < 3) return [];
  const reply = await chat(ctx.config, {
    system: CHECK_SYSTEM,
    user: checkUser(passage, ctx.goals, ctx.dialect),
    model: ctx.config.checkModel,
    json: true,
    temperature: 0,
    maxTokens: 1500,
    signal: ctx.signal,
  });
  let edits: ReturnType<typeof parseEdits> = [];
  try {
    edits = parseEdits(reply);
  } catch {
    return [];
  }
  return editsToSuggestions(
    document,
    passage,
    base,
    edits,
    ctx.config.presetId === 'on-device' ? 'device-ai' : 'ai',
  );
}

export async function aiRewrite(
  ctx: AiContext,
  text: string,
  mode: RewriteMode,
  customInstruction = '',
  onText?: (partial: string) => void,
): Promise<string> {
  const instruction =
    mode === 'custom' ? customInstruction : REWRITE_INSTRUCTIONS[mode].instruction;
  const reply = await chat(ctx.config, {
    system: REWRITE_SYSTEM,
    user: rewriteUser(text, instruction, ctx.goals, ctx.dialect),
    model: ctx.config.writeModel || ctx.config.checkModel,
    temperature: mode === 'fix' ? 0 : 0.4,
    maxTokens: Math.min(4000, Math.max(400, Math.ceil(text.length / 2))),
    signal: ctx.signal,
    onText: onText ? (t) => onText(cleanRewrite(t)) : undefined,
  });
  return cleanRewrite(reply);
}

export async function aiCompose(
  ctx: AiContext,
  request: string,
  context = '',
  onText?: (partial: string) => void,
): Promise<string> {
  const reply = await chat(ctx.config, {
    system: COMPOSE_SYSTEM,
    user: composeUser(request, ctx.goals, ctx.dialect, context),
    model: ctx.config.writeModel || ctx.config.checkModel,
    temperature: 0.6,
    maxTokens: 1500,
    signal: ctx.signal,
    onText: onText ? (t) => onText(cleanRewrite(t)) : undefined,
  });
  return cleanRewrite(reply);
}

export async function aiInsight(
  ctx: AiContext,
  text: string,
  mode: InsightMode,
  extra = '',
  onText?: (partial: string) => void,
): Promise<string> {
  const reply = await chat(ctx.config, {
    system: INSIGHT_SYSTEM,
    user: insightUser(text, INSIGHT_INSTRUCTIONS[mode].instruction(extra)),
    model: ctx.config.writeModel || ctx.config.checkModel,
    temperature: 0.3,
    maxTokens: 1200,
    signal: ctx.signal,
    onText,
  });
  return reply.trim();
}
