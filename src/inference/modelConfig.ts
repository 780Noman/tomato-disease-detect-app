/**
 * The single wiring point for the on-device model.
 *
 * The deployed model's contract, read from Tomato_Model_Mobile.tflite by
 * tools/inspect_tflite_offline.py (PLAN.md §1.2):
 *   input  [1, 224, 224, 3] float32, raw 0–255 (no normalisation)
 *   output [1, 6]           float32, softmax inside the graph
 *
 * MODEL_SOURCE stays undefined until the packaging decision lands with the
 * EAS build phase (bundle-as-asset vs first-run download — a 141 MB asset
 * roughly doubles the APK). While undefined, TFLiteProvider fails loudly
 * with model-not-loaded; it never pretends.
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

/** Asset/require source or file URI for react-native-fast-tflite. */
export const MODEL_SOURCE: number | string | undefined = undefined;
