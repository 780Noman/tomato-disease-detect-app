import type { ClassCode } from '@/config/classes';

export interface ClassScore {
  readonly classCode: ClassCode;
  /** Probability in [0, 1]. */
  readonly probability: number;
}

export type InferenceProviderName = 'mock' | 'remote' | 'tflite';

/**
 * The result of classifying one image. Always carries the FULL probability
 * vector (all six classes, sorted descending) — the UI's top-3 view and any
 * saved scan derive from it, never the other way round.
 */
export interface Classification {
  /** All classes, sorted by probability descending. */
  readonly scores: readonly ClassScore[];
  readonly top: ClassScore;
  /** True when top.probability < LOW_CONFIDENCE_THRESHOLD. */
  readonly lowConfidence: boolean;
  readonly provider: InferenceProviderName;
  readonly modelVersion: string | null;
  readonly durationMs: number;
}

export interface InferenceInput {
  /** Local URI of the captured/selected image. */
  readonly imageUri: string;
}
