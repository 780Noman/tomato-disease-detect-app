import type { Category, ClassCode } from '@/config/classes';
import type { ClassScore, InferenceProviderName } from '@/inference/types';

/**
 * A scan as stored. The FULL probability vector is persisted, not just the
 * winner — so a saved scan can be re-rendered with the same honesty rules
 * (top-3, bands, caveats) as a live result.
 */
export interface NewScan {
  readonly createdAt: number;
  /** Local file URI of the saved copy of the photo. */
  readonly imagePath: string;
  readonly topClass: ClassCode;
  readonly category: Category;
  readonly confidence: number;
  readonly lowConfidence: boolean;
  readonly scores: readonly ClassScore[];
  readonly provider: InferenceProviderName;
  readonly modelVersion: string | null;
  /**
   * Whether the class order was verified at the time of the scan. A scan
   * recorded while unverified can never be silently promoted to trustworthy.
   */
  readonly classOrderVerified: boolean;
}

export interface SavedScan extends NewScan {
  readonly id: number;
}
