import type { Settings } from '../../../shared/settings';

export interface SectionProps {
  settings: Settings;
  update: (patch: Partial<Settings> | ((s: Settings) => Partial<Settings>)) => Promise<Settings>;
}
