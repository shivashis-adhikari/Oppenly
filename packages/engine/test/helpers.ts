import { binaryInlined } from 'harper.js/binaryInlined';
import { Engine } from '../src/analyzer';
import type { EngineSettings, Suggestion } from '../src/types';

let shared: Engine | null = null;

export async function engine(settings: Partial<EngineSettings> = {}): Promise<Engine> {
  if (!shared) {
    shared = new Engine(binaryInlined);
    await shared.init(settings);
  } else {
    await shared.updateSettings({
      dialect: 'american',
      oxfordComma: true,
      disabledRules: [],
      disabledCategories: [],
      dictionary: [],
      dismissed: [],
      goals: {
        audience: 'knowledgeable',
        formality: 'neutral',
        domain: 'general',
        intent: 'inform',
      },
      ...settings,
    });
  }
  return shared;
}

export async function check(
  text: string,
  settings: Partial<EngineSettings> = {},
): Promise<Suggestion[]> {
  const e = await engine(settings);
  const a = await e.analyze(text);
  return a.suggestions;
}

/** Human-readable summary: "original → first replacement [rule]". */
export function describe(s: Suggestion): string {
  return `${s.original} → ${s.replacements[0] ?? '(info)'} [${s.rule}]`;
}
