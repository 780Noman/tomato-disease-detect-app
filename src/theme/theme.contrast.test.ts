/**
 * Encodes CLAUDE.md §11 as a CI gate: every text/background pairing the
 * themes permit meets WCAG AA (4.5 body text, 3.0 large text/UI), and the
 * error red stays out of the terracotta family. Change a palette value and
 * this test tells you whether the change is legal.
 */
import { contrastRatio } from './contrast';
import { darkTheme, lightTheme, type Theme } from './theme';

const AA_BODY = 4.5;
const AA_LARGE = 3.0;

function bodyPairs(t: Theme): [string, string, string][] {
  const c = t.color;
  return [
    ['text on surface', c.text, c.surface],
    ['text on surfaceRaised', c.text, c.surfaceRaised],
    ['textMuted on surface', c.textMuted, c.surface],
    ['textMuted on surfaceRaised', c.textMuted, c.surfaceRaised],
    ['primary as text on surface', c.primary, c.surface],
    ['onPrimary on primary', c.onPrimary, c.primary],
    ['onPrimaryTint on primaryTint', c.onPrimaryTint, c.primaryTint],
    ['accentText on surface', c.accentText, c.surface],
    ['success on surface', c.success, c.surface],
    ['warningText on surface', c.warningText, c.surface],
    ['danger on surface', c.danger, c.surface],
    ['onDanger on danger', c.onDanger, c.danger],
  ];
}

function largePairs(t: Theme): [string, string, string][] {
  const c = t.color;
  return [
    ['accent (icons/large only) on surface', c.accent, c.surface],
    ['warning (icons/large only) on surface', c.warning, c.surface],
  ];
}

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
] as const)('%s theme WCAG AA', (_name, theme) => {
  it.each(bodyPairs(theme))('%s meets 4.5:1', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it.each(largePairs(theme))('%s meets 3.0:1', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_LARGE);
  });
});

describe('error red stays distinct from the terracotta primary', () => {
  // Weighted RGB distance — the measure used when #D32F2F (distance 95,
  // same orange-red family) was rejected for the cooler crimson.
  function weightedDistance(a: string, b: string): number {
    const parse = (h: string) => {
      const n = parseInt(h.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
    };
    const [r1, g1, b1] = parse(a);
    const [r2, g2, b2] = parse(b);
    const rm = (r1 + r2) / 2;
    return Math.sqrt(
      (2 + rm / 256) * (r1 - r2) ** 2 +
        4 * (g1 - g2) ** 2 +
        (2 + (255 - rm) / 256) * (b1 - b2) ** 2,
    );
  }

  it.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ] as const)('%s theme keeps danger away from primary', (_name, theme) => {
    expect(weightedDistance(theme.color.danger, theme.color.primary)).toBeGreaterThanOrEqual(90);
  });
});
