/**
 * SINGLE SOURCE OF TRUTH for class names, index order, categories and
 * reliability (CLAUDE.md §4). Every file that names a class imports from
 * here; no class string may be hardcoded anywhere else.
 *
 * ── CLASS ORDER: UNVERIFIED ─────────────────────────────────────────────
 * The order below is the EXPECTED order (Keras sorts class folders
 * alphabetically). It has NOT been confirmed against the deployed model:
 * Tomato_Model_Mobile.tflite carries no class names (verified by offline
 * inspection, PLAN.md §1.2) and model_metadata.json has not been provided.
 *
 * Until CLASS_ORDER_VERIFIED flips to true, every real inference provider
 * refuses to run (src/inference/classGuard.ts). When the authoritative
 * order arrives (model_metadata.json `class_order`, or labels.txt), update
 * THIS FILE ONLY and flip the flag. If any other file needs editing to
 * make names line up, the abstraction is broken — fix the abstraction.
 */

export const CLASS_CODES = [
  'tomato__JAS_MIT', // 0 (expected)
  'tomato__K', // 1
  'tomato__LM', // 2
  'tomato__MIT', // 3
  'tomato__N', // 4
  'tomato__N_K', // 5
] as const;

export type ClassCode = (typeof CLASS_CODES)[number];

export const NUM_CLASSES = CLASS_CODES.length;

/** Flips to true ONLY when the order above is confirmed from model metadata. */
export const CLASS_ORDER_VERIFIED = false;

export type Category = 'insect-pest' | 'nutrient-deficiency';

export interface ClassInfo {
  readonly code: ClassCode;
  readonly displayName: string;
  readonly category: Category;
  /**
   * Test-set support from docs/model/README.md (expected counts until the
   * real model_metadata.json `test_support_per_class` lands). Drives the
   * limited-data caveat below.
   */
  readonly expectedTestSupport: number;
}

export const CLASS_INFO: Record<ClassCode, ClassInfo> = {
  tomato__JAS_MIT: {
    code: 'tomato__JAS_MIT',
    displayName: 'Jassid + Mite (co-infestation)',
    category: 'insect-pest',
    expectedTestSupport: 5,
  },
  tomato__K: {
    code: 'tomato__K',
    displayName: 'Potassium Deficiency',
    category: 'nutrient-deficiency',
    expectedTestSupport: 5,
  },
  tomato__LM: {
    code: 'tomato__LM',
    displayName: 'Leaf Miner',
    category: 'insect-pest',
    expectedTestSupport: 31,
  },
  tomato__MIT: {
    code: 'tomato__MIT',
    displayName: 'Mite',
    category: 'insect-pest',
    expectedTestSupport: 30,
  },
  tomato__N: {
    code: 'tomato__N',
    displayName: 'Nitrogen Deficiency',
    category: 'nutrient-deficiency',
    expectedTestSupport: 7,
  },
  tomato__N_K: {
    code: 'tomato__N_K',
    displayName: 'Nitrogen + Potassium Deficiency',
    category: 'nutrient-deficiency',
    expectedTestSupport: 6,
  },
};

/**
 * Classes evaluated on fewer than this many test images carry the
 * "limited training data — confirm with an expert" caveat (CLAUDE.md §7,
 * rule per docs/model/README.md). Recompute from the real
 * test_support_per_class when model_metadata.json lands.
 */
export const LIMITED_DATA_TEST_SUPPORT_THRESHOLD = 15;

export function isLimitedDataClass(code: ClassCode): boolean {
  return CLASS_INFO[code].expectedTestSupport < LIMITED_DATA_TEST_SUPPORT_THRESHOLD;
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
