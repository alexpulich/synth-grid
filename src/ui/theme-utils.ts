const SWATCH_KEYS = ['--color-bg', '--color-kick', '--color-lead', '--color-hihat'] as const;

const CSS_DEFAULTS: Record<string, string> = {
  '--color-bg': '#0a0a0f',
  '--color-kick': '#ff3366',
  '--color-lead': '#6633ff',
  '--color-hihat': '#ffcc00',
};

export function deriveSwatches(vars: Record<string, string>): string[] {
  return SWATCH_KEYS.map(key => vars[key] ?? CSS_DEFAULTS[key]);
}
