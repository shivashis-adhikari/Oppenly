import type { Category } from '../../types';
import { CLARITY_RULES } from './clarity';
import { CORRECTNESS_RULES } from './correctness';
import { DELIVERY_RULES } from './delivery';
import { blandWords, ENGAGEMENT_RULES } from './engagement';
import type { Rule } from './types';

export const ALL_RULES: Rule[] = [
  ...CORRECTNESS_RULES,
  ...CLARITY_RULES,
  ...ENGAGEMENT_RULES,
  ...DELIVERY_RULES,
];

/** Rules whose output depends on the whole document, so they are not cached per paragraph. */
export const DOCUMENT_RULES: ReadonlySet<Rule> = new Set([blandWords]);

export interface RuleInfo {
  id: string;
  name: string;
  description: string;
  category: Category;
}

/** Style rules the user can switch on or off in settings. */
export const RULE_INFO: RuleInfo[] = ALL_RULES.map(({ id, name, description, category }) => ({
  id,
  name,
  description,
  category,
}));

export type { Draft, Rule, RuleContext } from './types';
