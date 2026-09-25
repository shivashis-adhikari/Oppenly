import {
  type BinaryModule,
  Dialect as HarperDialect,
  type Lint,
  LocalLinter,
  SuggestionKind,
} from 'harper.js';
import type { Category, Dialect } from '../types';

/** A finding from the grammar engine, with offsets relative to the checked text. */
export interface GrammarFinding {
  rule: string;
  kind: string;
  category: Category;
  title: string;
  message: string;
  start: number;
  end: number;
  replacements: string[];
}

const DIALECTS: Record<Dialect, HarperDialect> = {
  american: HarperDialect.American,
  british: HarperDialect.British,
  canadian: HarperDialect.Canadian,
  australian: HarperDialect.Australian,
  indian: HarperDialect.Indian,
};

const TITLES: Record<string, string> = {
  Spelling: 'Correct your spelling',
  Typo: 'Correct the typo',
  Grammar: 'Correct the grammar',
  Agreement: 'Change the verb form',
  Punctuation: 'Correct the punctuation',
  Capitalization: 'Correct the capitalization',
  BoundaryError: 'Fix the spacing between words',
  Repetition: 'Remove the repeated word',
  Redundancy: 'Remove redundancy',
  Readability: 'Improve readability',
  WordChoice: 'Correct the word choice',
  Usage: 'Correct the usage',
  Style: 'Improve the style',
  Enhancement: 'Choose a better word',
  Eggcorn: 'Correct the phrase',
  Malapropism: 'Correct the word choice',
  Formatting: 'Fix the formatting',
  Nonstandard: 'Use the standard form',
  Regionalism: 'Match your English variety',
  WordOrder: 'Change the word order',
  Miscellaneous: 'Correct the error',
};

const KIND_CATEGORY: Record<string, Category> = {
  Redundancy: 'clarity',
  Readability: 'clarity',
  Style: 'clarity',
  Enhancement: 'engagement',
};

const RULE_CATEGORY: Record<string, Category> = {
  AvoidCurses: 'delivery',
};

/** Rules we replace with our own implementation, or that are style preferences we don't impose. */
const DISABLED_RULES = [
  'LongSentences',
  'FillerWords',
  'UseEllipsisCharacter',
  'SpelledNumbers',
  'BoringWords',
  'AvoidContractions',
  'VeryUnique',
  'OrthographicConsistency',
  'RoadMap',
];

/** Wraps the Harper grammar engine (Rust, compiled to WebAssembly). Runs fully offline. */
export class GrammarEngine {
  private linter: LocalLinter | null = null;
  private dialect: Dialect = 'american';
  private oxfordComma = true;
  private words: string[] = [];
  private ready: Promise<void> | null = null;

  constructor(private readonly binary: BinaryModule) {}

  async init(dialect: Dialect, oxfordComma: boolean): Promise<void> {
    this.ready ??= (async () => {
      this.dialect = dialect;
      this.oxfordComma = oxfordComma;
      this.linter = new LocalLinter({ binary: this.binary, dialect: DIALECTS[dialect] });
      await this.linter.setup();
      await this.applyConfig();
    })();
    await this.ready;
  }

  private async applyConfig(): Promise<void> {
    if (!this.linter) return;
    const config = await this.linter.getDefaultLintConfig();
    for (const rule of DISABLED_RULES) if (rule in config) config[rule] = false;
    config.OxfordComma = this.oxfordComma;
    config.NoOxfordComma = false;
    await this.linter.setLintConfig(config);
  }

  async configure(dialect: Dialect, oxfordComma: boolean, words: string[]): Promise<void> {
    if (!this.linter) await this.init(dialect, oxfordComma);
    const linter = this.linter!;
    if (dialect !== this.dialect) {
      await linter.setDialect(DIALECTS[dialect]);
      this.dialect = dialect;
    }
    if (oxfordComma !== this.oxfordComma) {
      this.oxfordComma = oxfordComma;
      await this.applyConfig();
    }
    const sorted = [...new Set(words)].sort();
    if (sorted.join('\n') !== this.words.join('\n')) {
      await linter.clearWords();
      if (sorted.length) await linter.importWords(sorted);
      this.words = sorted;
    }
  }

  async check(text: string): Promise<GrammarFinding[]> {
    if (!this.linter) throw new Error('GrammarEngine.init() must be called first');
    const grouped = await this.linter.organizedLints(text, { language: 'plaintext' });
    const findings: GrammarFinding[] = [];
    for (const [rule, lints] of Object.entries(grouped)) {
      for (const lint of lints as Lint[]) {
        const span = lint.span();
        const kind = lint.lint_kind();
        // harper.js already reports JavaScript (UTF-16) string offsets.
        const start = span.start;
        const end = span.end;
        const original = text.slice(start, end);
        const replacements = lint
          .suggestions()
          .map((s) => {
            const kindName = s.kind();
            const replacement = s.get_replacement_text();
            s.free();
            if (kindName === SuggestionKind.Remove) return '';
            if (kindName === SuggestionKind.InsertAfter) return original + replacement;
            return replacement;
          })
          .filter((r, i, all) => all.indexOf(r) === i);
        const message = lint.message();
        lint.free();
        findings.push({
          rule,
          kind,
          category: RULE_CATEGORY[rule] ?? KIND_CATEGORY[kind] ?? 'correctness',
          title: TITLES[kind] ?? 'Correct the error',
          message: message.replace(/`/g, '“').replace(/“([^“]*)“/g, '“$1”'),
          start,
          end,
          replacements,
        });
      }
    }
    return findings;
  }

  dispose(): void {
    void this.linter?.dispose();
    this.linter = null;
    this.ready = null;
  }
}
