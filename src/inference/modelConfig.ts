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
 * The model source: Metro's numeric asset id for the bundled `.tflite` (see
 * metro.config.js, which registers the extension), or an absolute URI.
 *
 * This value is NOT passed to react-native-fast-tflite directly. An asset id
 * resolves to a bare `res/raw` resource name in release builds, which the
 * library's Java `URL(..)` call cannot open. It is resolved to an absolute
 * `file://` URI first — see providers/resolveModelUri.ts.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro asset require; binary assets have no import form.
const bundledModel = require('../../assets/model/Tomato_Model_Mobile.tflite') as number;

export const MODEL_SOURCE: number | string | undefined = bundledModel;
