/**
 * The single wiring point for the on-device model.
 *
 * The deployed model's contract, read from Tomato_Model_Mobile.tflite by
 * tools/inspect_tflite_offline.py (PLAN.md §1.2):
 *   input  [1, 224, 224, 3] float32, raw 0–255 (no normalisation)
 *   output [1, 6]           float32, softmax inside the graph
 *
 * PACKAGING DECISION (2026-07-25): the model is bundled into the build as an
 * asset, so on-device diagnosis works with no network at all. This adds
 * ~141 MB to the app.
 *
 * The file lives at assets/model/ and is gitignored — it is never committed.
 * EAS Build normally skips gitignored files, so `.easignore` exists to include
 * this one path in the upload. If the file is missing at bundle time, Metro
 * fails to resolve the require below, which is the correct loud failure: an
 * app that silently shipped without its model would be worse.
 */

export interface TfliteModelConfig {
  readonly inputSize: number;
  readonly channels: number;
  readonly numClasses: number;
  /** True per inspection: the output is already a probability vector. */
  readonly outputIsSoftmax: boolean;
}

export const TFLITE_MODEL_CONFIG: TfliteModelConfig = {
  inputSize: 224,
  channels: 3,
  numClasses: 6,
  outputIsSoftmax: true,
};

/**
 * The model source: Metro's numeric asset id for a bundled `.tflite` (see
 * metro.config.js, which registers the extension), or an absolute URI.
 *
 * CURRENTLY UNSET, deliberately. The delivered model cannot run on-device at
 * all — it carries 800+ TF Select (Flex) operators that no bundled TFLite
 * runtime can resolve (tools/inspect_tflite_ops.py; CLAUDE.md §4). Bundling it
 * anyway added ~141 MB to every APK for a code path that always fails, and that
 * weight is paid twice over: ~8 minutes of upload per EAS build, plus the
 * install size on the phone.
 *
 * So the asset `require` is gone and `.easignore` no longer uploads the model.
 * TFLiteProvider still reports this honestly: resolveModelUri(undefined, ...)
 * raises a typed `model-not-loaded` naming this file.
 *
 * TO RESTORE ON-DEVICE once a builtins-only model exists (see
 * tools/convert_tflite_builtins_only.py, and confirm `npm run verify:model`
 * prints PASS):
 *   1. re-add the require below and assign it to MODEL_SOURCE
 *   2. re-include the model in .easignore
 *   3. set DEFAULT_INFERENCE_PROVIDER back to 'tflite' in config/env.ts
 * Nothing else changes — the resolution and preprocessing paths are unchanged
 * and still covered by tests.
 */
export const MODEL_SOURCE: number | string | undefined = undefined;
