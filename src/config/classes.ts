/**
 * SINGLE SOURCE OF TRUTH for class names, index order, categories and
 * reliability (CLAUDE.md §4). Every file that names a class imports from
 * here; no class string may be hardcoded anywhere else.
 *
 * ── CLASS ORDER: VERIFIED (2026-07-25) ──────────────────────────────────
 * The training script derives its class list with
 * `sorted(df['label'].unique())` (docs/train_tomato_corrected.py:155), and
 * Keras assigns class indices in exactly that alphabetical order. The order
 * below was confirmed empirically against the dataset's class folder names:
 *
 *   python -c "import os; print(sorted(os.listdir(<dataset>)))"
 *   -> ['tomato__JAS_MIT','tomato__K','tomato__LM','tomato__MIT',
 *       'tomato__N','tomato__N_K']
 *
 * That is the ground-truth index order the model was trained with, and it
 * matches the order below position for position. Folder names are identical
 * between the original and balanced dataset copies, so the ordering does not
 * depend on which copy was inspected.
 *
 * NOTE ON SCOPE: this settles *app correctness* — each output index maps to
 * the right condition name. It says nothing about how accurate the model is.
 * The .tflite may originate from the older pipeline audited in
 * docs/Tomato_Updated_Code_Review.md, so the honesty rules in CLAUDE.md §7
 * (no accuracy claims, top-3 always shown, low confidence as a first-class
 * result, limited-data caveats) matter MORE here, not less.
 */

export const CLASS_CODES = [
  'tomato__JAS_MIT', // 0
  'tomato__K', // 1
  'tomato__LM', // 2
  'tomato__MIT', // 3
  'tomato__N', // 4
  'tomato__N_K', // 5
] as const;

export type ClassCode = (typeof CLASS_CODES)[number];

export const NUM_CLASSES = CLASS_CODES.length;

/**
 * True: the index order above is confirmed against the dataset folder names
 * sorted alphabetically, matching the training script's
 * `sorted(df['label'].unique())`. See the header for the verification.
 */
export const CLASS_ORDER_VERIFIED = true;

export type Category = 'insect-pest' | 'nutrient-deficiency';

/**
 * Fraction of the dataset held out for testing (train_test_split
 * TEST_FRACTION in docs/train_tomato_corrected.py). Used to derive per-class
 * test support from the original image counts.
 */
export const TEST_SPLIT_FRACTION = 0.15;

export interface ClassInfo {
  readonly code: ClassCode;
  readonly displayName: string;
  readonly category: Category;
  /**
   * Original (non-augmented) image count for this class in the OLID-I tomato
   * set — 562 images total. These are DATASET COUNTS, not figures from a
   * model_metadata.json (none was produced). If a metadata file with
   * `test_support_per_class` ever lands, prefer its real counts over these.
   */
  readonly originalImageCount: number;
}

export const CLASS_INFO: Record<ClassCode, ClassInfo> = {
  tomato__JAS_MIT: {
    code: 'tomato__JAS_MIT',
    displayName: 'Jassid + Mite (co-infestation)',
    category: 'insect-pest',
    originalImageCount: 32,
  },
  tomato__K: {
    code: 'tomato__K',
    displayName: 'Potassium Deficiency',
    category: 'nutrient-deficiency',
    originalImageCount: 36,
  },
  tomato__LM: {
    code: 'tomato__LM',
    displayName: 'Leaf Miner',
    category: 'insect-pest',
    originalImageCount: 207,
  },
  tomato__MIT: {
    code: 'tomato__MIT',
    displayName: 'Mite',
    category: 'insect-pest',
    originalImageCount: 200,
  },
  tomato__N: {
    code: 'tomato__N',
    displayName: 'Nitrogen Deficiency',
    category: 'nutrient-deficiency',
    originalImageCount: 47,
  },
  tomato__N_K: {
    code: 'tomato__N_K',
    displayName: 'Nitrogen + Potassium Deficiency',
    category: 'nutrient-deficiency',
    originalImageCount: 40,
  },
};

/**
 * Approximate number of held-out test images for a class, derived from its
 * original count and the training split. Rounded, and never below zero.
 */
export function approximateTestSupport(code: ClassCode): number {
  return Math.round(CLASS_INFO[code].originalImageCount * TEST_SPLIT_FRACTION);
}

/**
 * Classes evaluated on fewer than this many test images carry the
 * "limited training data — confirm with an expert" caveat (CLAUDE.md §7,
 * rule per docs/model/README.md). With the counts above this flags four of
 * six classes: JAS_MIT (~5), K (~5), N_K (~6) and N (~7).
 */
export const LIMITED_DATA_TEST_SUPPORT_THRESHOLD = 15;

export function isLimitedDataClass(code: ClassCode): boolean {
  return approximateTestSupport(code) < LIMITED_DATA_TEST_SUPPORT_THRESHOLD;
}

export function classCodeForIndex(index: number): ClassCode {
  const code = CLASS_CODES[index];
  if (code === undefined) {
    throw new RangeError(`Class index ${index} is out of range (expected 0..${NUM_CLASSES - 1}).`);
  }
  return code;
}

export function isClassCode(value: string): value is ClassCode {
  return (CLASS_CODES as readonly string[]).includes(value);
}

export function categoryDisplayName(category: Category): string {
  return category === 'insect-pest' ? 'Insect Pest' : 'Nutrient Deficiency';
}
