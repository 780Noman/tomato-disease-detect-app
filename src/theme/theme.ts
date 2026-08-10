import { palette } from './palette';

export type ColorScheme = 'light' | 'dark';

/**
 * Semantic colour roles. Light and dark themes have identical shapes, so a
 * component written against roles works in both without branching.
 *
 * Colour is never the only signal: semantic states (success/warning/danger)
 * always pair the colour with a text label, enforced by component design.
 */
export interface ThemeColors {
  readonly surface: string;
  readonly surfaceRaised: string;
  readonly text: string;
  readonly textMuted: string;
  readonly border: string;

  readonly primary: string;
  /** Text/icon colour placed on top of `primary`. */
  readonly onPrimary: string;
  /** Pressed/active variant of `primary`. Decorative, not a text colour. */
  readonly primaryPressed: string;
  readonly primaryTint: string;
  /** Text colour on top of `primaryTint`. */
  readonly onPrimaryTint: string;

  /** Secondary sage accent — icons and large text only. */
  readonly accent: string;
  /** Text-grade sage for body-size text. */
  readonly accentText: string;

  readonly success: string;
  /** Warning colour for icons/large text. */
  readonly warning: string;
  /** Text-grade warning for body-size text. */
  readonly warningText: string;
  readonly danger: string;
  /** Text/icon colour placed on top of `danger`. */
  readonly onDanger: string;

  /**
   * Scrim behind a modal. Decorative only — never a text background, so it is
   * exempt from the contrast pairs asserted in theme.contrast.test.ts.
   */
  readonly backdrop: string;
}

export interface Theme {
  readonly scheme: ColorScheme;
  readonly color: ThemeColors;
}

export const lightTheme: Theme = {
  scheme: 'light',
  color: {
    surface: palette.sand50,
    surfaceRaised: palette.white,
    text: palette.ink900,
    textMuted: palette.ink500,
    border: palette.sandBorder,

    primary: palette.terracotta500,
    onPrimary: palette.white,
    primaryPressed: palette.terracotta700,
    primaryTint: palette.terracotta100,
    onPrimaryTint: palette.terracotta700,

    accent: palette.sage500,
    accentText: palette.sage600,

    success: palette.green600,
    warning: palette.gold600,
    warningText: palette.gold700,
    danger: palette.crimson600,
    onDanger: palette.white,

    // Warm ink at 55%: dims the page without the blue cast a neutral black
    // scrim gives the sand surfaces.
    backdrop: 'rgba(42, 33, 28, 0.55)',
  },
};

export const darkTheme: Theme = {
  scheme: 'dark',
  color: {
    surface: palette.coffee900,
    surfaceRaised: palette.coffee800,
    text: palette.linen100,
    textMuted: palette.linen300,
    border: palette.coffeeBorder,

    primary: palette.terracotta300,
    onPrimary: palette.coffee900,
    primaryPressed: palette.terracotta500,
    primaryTint: palette.coffee800,
    onPrimaryTint: palette.terracotta300,

    accent: palette.sage300,
    accentText: palette.sage300,

    success: palette.green300,
    warning: palette.gold300,
    warningText: palette.gold300,
    danger: palette.crimson300,
    onDanger: palette.coffee900,

    // Heavier on dark: the raised card is already close to the page colour, so
    // a light scrim would not separate them.
    backdrop: 'rgba(0, 0, 0, 0.65)',
  },
};

export function themeForScheme(scheme: ColorScheme): Theme {
  return scheme === 'dark' ? darkTheme : lightTheme;
}
