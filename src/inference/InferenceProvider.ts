import type { Classification, InferenceInput, InferenceProviderName } from './types';

/**
 * The seam every screen talks through. Screens never import a concrete
 * provider (CLAUDE.md §8) — they receive this interface from the factory.
 */
export interface InferenceProvider {
  readonly name: InferenceProviderName;
  /** Idempotent; expensive work (model load) happens here, not in run(). */
  load(): Promise<void>;
  isReady(): boolean;
  run(input: InferenceInput): Promise<Classification>;
  dispose(): Promise<void>;
}
