/**
 * Raw colour primitives, named by hue. Only theme.ts may import this file —
 * everything else consumes semantic roles from the theme.
 *
 * Every text/background pairing built from these values is verified for
 * WCAG AA in theme.contrast.test.ts. If you change a value here, that test
 * tells you whether the change is legal.
 */
export const palette = {
  // Brand: deep clay / terracotta. Deliberately NOT green — green is the
  // Apple Leaf Doctor app.
  terracotta500: '#A94F2C',
  terracotta700: '#7A3419',
  terracotta300: '#D97B52',
  terracotta100: '#F2E3DA',

  // Secondary accent: muted sage. sage500 fails body-text AA on sand (4.28)
  // and is reserved for icons/large text; sage600 is the text-grade variant.
  sage600: '#57644A',
  sage500: '#6B7A5A',
  sage300: '#93A47F',

  // Light surfaces: warm sand.
  sand50: '#FAF6F1',
  white: '#FFFFFF',
  sandBorder: '#E8DED4',

  // Light ink: warm near-black.
  ink900: '#2A211C',
  ink500: '#6B5F58',

  // Dark surfaces: warm coffee near-black.
  coffee900: '#201914',
  coffee800: '#2B221C',
  coffeeBorder: '#3B3029',

  // Dark ink: warm linen.
  linen100: '#F0E9E2',
  linen300: '#C4B8AE',

  // Semantic: success green is a cool, blue-leaning green — distinct from
  // the apple app's warm agricultural green.
  green600: '#2E7D5B',
  green300: '#5FB78E',

  // Warning gold: gold600 passes only large-text AA (3.02) and is reserved
  // for icons/large text; gold700 is the text-grade variant.
  gold600: '#B8860B',
  gold700: '#8A6508',
  gold300: '#D9A63A',

  // Error: a cooler crimson, hue-shifted away from the orange-brown
  // terracotta family (the naive #D32F2F was measurably too close).
  crimson600: '#BE2745',
  crimson300: '#F2708A',
} as const;
