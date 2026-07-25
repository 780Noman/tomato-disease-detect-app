/**
 * Confidence handling (CLAUDE.md §7). Bands, not false precision: the UI
 * shows whole percentages or band labels, never decimal places.
 */

/** Below this, the primary result is "Uncertain" — a first-class state. */
export const LOW_CONFIDENCE_THRESHOLD = 0.6;

export const HIGH_CONFIDENCE_THRESHOLD = 0.8;

/** How many ranked predictions the results screen shows. */
export const TOP_PREDICTIONS_SHOWN = 3;

export type ConfidenceBand = 'high' | 'medium' | 'low';

export function confidenceBand(probability: number): ConfidenceBand {
  if (probability >= HIGH_CONFIDENCE_THRESHOLD) return 'high';
  if (probability >= LOW_CONFIDENCE_THRESHOLD) return 'medium';
  return 'low';
}

export function confidenceBandLabel(band: ConfidenceBand): string {
  switch (band) {
    case 'high':
      return 'High confidence';
    case 'medium':
      return 'Medium confidence';
    case 'low':
      return 'Low confidence';
    default: {
      const unreachable: never = band;
      return unreachable;
    }
  }
}

/** Honest display rounding: "87%", never "87.3%". */
export function displayPercent(probability: number): string {
  return `${Math.round(probability * 100)}%`;
}
