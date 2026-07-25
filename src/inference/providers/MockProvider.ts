import { InferenceError, type InferenceErrorCode } from '../errors';
import type { InferenceProvider } from '../InferenceProvider';
import { toClassification } from '../rank';
import type { Classification, InferenceInput } from '../types';

/**
 * Deterministic development provider. The same image URI always produces
 * the same scenario, and the scenario set covers everything the UI must
 * handle: each of the six classes on top, a low-confidence result, and the
 * realistic N / K / N_K near-tie.
 *
 * Special URIs of the form `mock://error/<code>` raise that typed error so
 * every failure state can be exercised from the UI.
 *
 * Ships nowhere: constructing it in a production build throws.
 */

// Index order matches config/classes.ts:
// [JAS_MIT, K, LM, MIT, N, N_K]
const SCENARIOS: readonly { readonly label: string; readonly vector: readonly number[] }[] = [
  { label: 'JAS_MIT top', vector: [0.71, 0.05, 0.08, 0.09, 0.04, 0.03] },
  { label: 'K top', vector: [0.03, 0.68, 0.04, 0.05, 0.08, 0.12] },
  { label: 'LM top, high confidence', vector: [0.01, 0.01, 0.93, 0.03, 0.01, 0.01] },
  { label: 'MIT top', vector: [0.06, 0.02, 0.05, 0.82, 0.03, 0.02] },
  { label: 'N top', vector: [0.02, 0.09, 0.03, 0.02, 0.66, 0.18] },
  { label: 'N_K top', vector: [0.02, 0.16, 0.02, 0.02, 0.14, 0.64] },
  { label: 'low confidence', vector: [0.1, 0.13, 0.22, 0.19, 0.2, 0.16] },
  { label: 'N/K/N_K near-tie', vector: [0.02, 0.29, 0.03, 0.02, 0.33, 0.31] },
];

/** FNV-1a, stable across runs — determinism is the point. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const ERROR_URI_PREFIX = 'mock://error/';

export class MockProvider implements InferenceProvider {
  readonly name = 'mock' as const;

  private ready = false;

  constructor() {
    if (!__DEV__) {
      throw new InferenceError('mock-in-production');
    }
  }

  load(): Promise<void> {
    this.ready = true;
    return Promise.resolve();
  }

  isReady(): boolean {
    return this.ready;
  }

  run(input: InferenceInput): Promise<Classification> {
    if (!this.ready) {
      return Promise.reject(new InferenceError('model-not-loaded', 'MockProvider not loaded.'));
    }
    if (input.imageUri.startsWith(ERROR_URI_PREFIX)) {
      const code = input.imageUri.slice(ERROR_URI_PREFIX.length) as InferenceErrorCode;
      return Promise.reject(new InferenceError(code));
    }
    const scenario = SCENARIOS[hash(input.imageUri) % SCENARIOS.length];
    if (scenario === undefined) {
      return Promise.reject(new InferenceError('invalid-response', 'No mock scenario.'));
    }
    return Promise.resolve(
      toClassification(scenario.vector, {
        provider: this.name,
        modelVersion: 'mock',
        durationMs: 42,
      }),
    );
  }

  dispose(): Promise<void> {
    this.ready = false;
    return Promise.resolve();
  }
}
