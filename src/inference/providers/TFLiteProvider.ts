import { assertClassOrderVerified } from '../classGuard';
import { InferenceError, messageFor } from '../errors';
import type { InferenceProvider } from '../InferenceProvider';
import { MODEL_SOURCE, TFLITE_MODEL_CONFIG } from '../modelConfig';
import { prepareModelInput } from '../preprocess/prepareModelInput';
import { toClassification } from '../rank';
import type { Classification, InferenceInput } from '../types';

/** Subset of react-native-fast-tflite this provider relies on (v3 API). */
export interface TfliteModel {
  run(inputs: ArrayBuffer[]): Promise<ArrayBuffer[]>;
}

export type ModelLoader = () => Promise<TfliteModel>;

/** Best-effort one-line description of an unknown thrown value. */
function describeCause(error: unknown): string {
  if (error instanceof Error) {
    return error.message.length > 0 ? error.message : error.name;
  }
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error) ?? 'unknown error';
  } catch {
    return 'unknown error';
  }
}

/**
 * Default loader: dynamic import keeps the native fast-tflite binding out of
 * the mock/test path entirely. Jest cannot execute dynamic import(), so this
 * function is exercised on-device only — everything else in the provider is
 * unit-tested by injecting a stub loader.
 */
export async function defaultModelLoader(): Promise<TfliteModel> {
  if (MODEL_SOURCE === undefined) {
    throw new InferenceError(
      'model-not-loaded',
      'MODEL_SOURCE is not set (src/inference/modelConfig.ts). The 141 MB model exists but its packaging (bundled asset vs downloaded file) is decided in the EAS build phase.',
    );
  }
  const { loadTensorflowModel } = await import('react-native-fast-tflite');
  // Empty delegates array = default CPU delegate.
  const model = await loadTensorflowModel(
    typeof MODEL_SOURCE === 'string' ? { url: MODEL_SOURCE } : MODEL_SOURCE,
    [],
  );
  return model as unknown as TfliteModel;
}

/**
 * On-device inference — the primary path. Wired to the inspected contract
 * of Tomato_Model_Mobile.tflite (see modelConfig.ts): float32 raw 0–255 in,
 * a [1, 6] softmax vector out. The output length is validated on every run
 * so a wrong model fails loudly, never with a wrong diagnosis.
 */
export class TFLiteProvider implements InferenceProvider {
  readonly name = 'tflite' as const;

  private readonly loader: ModelLoader;

  private model: TfliteModel | null = null;

  constructor(loader: ModelLoader = defaultModelLoader) {
    this.loader = loader;
  }

  async load(): Promise<void> {
    assertClassOrderVerified();
    if (this.model !== null) return;
    try {
      this.model = await this.loader();
    } catch (error) {
      if (error instanceof InferenceError) throw error;
      // Surface the underlying reason. Without it this failure is
      // indistinguishable from a dozen others on a device with no debugger
      // attached, and diagnosing it becomes guesswork.
      throw new InferenceError(
        'model-not-loaded',
        `${messageFor('model-not-loaded')}\n\nTechnical detail: ${describeCause(error)}`,
        { cause: error },
      );
    }
  }

  isReady(): boolean {
    return this.model !== null;
  }

  async run(input: InferenceInput): Promise<Classification> {
    assertClassOrderVerified();
    if (this.model === null) {
      throw new InferenceError('model-not-loaded', 'Call load() before run().');
    }
    const startedAt = Date.now();

    const tensor = await prepareModelInput(input.imageUri);

    let outputs: ArrayBuffer[];
    try {
      outputs = await this.model.run([tensor.buffer as ArrayBuffer]);
    } catch (error) {
      throw new InferenceError('model-not-loaded', 'On-device inference failed.', {
        cause: error,
      });
    }

    const raw = outputs[0];
    if (raw === undefined) {
      throw new InferenceError('invalid-response', 'Model returned no output tensor.');
    }
    const vector = Array.from(new Float32Array(raw));
    if (vector.length !== TFLITE_MODEL_CONFIG.numClasses) {
      throw new InferenceError(
        'invalid-response',
        `Model output has ${vector.length} values, expected ${TFLITE_MODEL_CONFIG.numClasses}. Wrong model file?`,
      );
    }

    return toClassification(vector, {
      provider: this.name,
      modelVersion: 'tflite-ondevice',
      durationMs: Date.now() - startedAt,
    });
  }

  dispose(): Promise<void> {
    this.model = null;
    return Promise.resolve();
  }
}
