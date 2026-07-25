import { InferenceError } from './errors';
import type { Classification, ClassScore, InferenceProviderName } from './types';
import { classCodeForIndex, NUM_CLASSES } from '@/config/classes';
import { LOW_CONFIDENCE_THRESHOLD } from '@/config/thresholds';

/** Tolerance for "softmax sums to 1" — float16 weights and TTA both wobble. */
const SUM_TOLERANCE = 0.05;

/**
 * Turns a raw probability vector (model index order) into a Classification.
 * Pure and heavily tested — every provider funnels through here, so the
 * validation rules hold no matter where the numbers came from.
 *
 * Throws invalid-response rather than fabricating: a malformed vector must
 * never become a diagnosis (CLAUDE.md §7).
 */
export function toClassification(
  probabilities: readonly number[],
  meta: {
    readonly provider: InferenceProviderName;
    readonly modelVersion: string | null;
    readonly durationMs: number;
  },
): Classification {
  if (probabilities.length !== NUM_CLASSES) {
    throw new InferenceError(
      'invalid-response',
      `Expected ${NUM_CLASSES} class probabilities, got ${probabilities.length}.`,
    );
  }
  for (const p of probabilities) {
    if (!Number.isFinite(p) || p < 0 || p > 1) {
      throw new InferenceError(
        'invalid-response',
        `Probability out of range: ${String(p)}. The vector is not a softmax output.`,
      );
    }
  }
  const sum = probabilities.reduce((acc, p) => acc + p, 0);
  if (Math.abs(sum - 1) > SUM_TOLERANCE) {
    throw new InferenceError(
      'invalid-response',
      `Probabilities sum to ${sum.toFixed(4)}, not ~1. The vector is not a softmax output.`,
    );
  }

  const scores: ClassScore[] = probabilities
    .map((probability, index) => ({ classCode: classCodeForIndex(index), probability }))
    .sort((a, b) => b.probability - a.probability);

  const top = scores[0];
  if (top === undefined) {
    throw new InferenceError('invalid-response', 'Empty probability vector.');
  }

  return {
    scores,
    top,
    lowConfidence: top.probability < LOW_CONFIDENCE_THRESHOLD,
    provider: meta.provider,
    modelVersion: meta.modelVersion,
    durationMs: meta.durationMs,
  };
}
