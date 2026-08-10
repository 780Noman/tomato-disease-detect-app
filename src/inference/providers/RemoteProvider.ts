import axios, { AxiosError, type AxiosInstance } from 'axios';

import { assertClassOrderVerified } from '../classGuard';
import { InferenceError } from '../errors';
import type { InferenceProvider } from '../InferenceProvider';
import { toClassification } from '../rank';
import type { Classification, InferenceInput } from '../types';
import { CLASS_CODES, isClassCode } from '@/config/classes';

/**
 * The shipping inference path (owner decision, 2026-08-10): a FastAPI server,
 * deployed as a Hugging Face Space. Maps the response BY CLASS NAME, never by
 * array position, so a server and app built from the same config cannot
 * disagree silently.
 */

interface PredictResponse {
  readonly probabilities: Record<string, number>;
  readonly model_version?: string;
}

/**
 * Generous on purpose. A free Hugging Face Space is stopped after a period of
 * inactivity and has to start a container before it can answer; that cold
 * start can take most of a minute, and it lands on whoever scans first. A 20 s
 * timeout would report "the server did not respond" for a server that is
 * simply waking up, which is both wrong and unactionable.
 */
const REQUEST_TIMEOUT_MS = 90_000;

/** Short, because nothing waits on it — see wake(). */
const WAKE_TIMEOUT_MS = 5_000;

export class RemoteProvider implements InferenceProvider {
  readonly name = 'remote' as const;

  private readonly client: AxiosInstance;

  private ready = false;

  constructor(baseUrl: string) {
    // eslint-disable-next-line import/no-named-as-default-member -- axios.create is the documented API; a named `create` import does not exist in the type definitions.
    this.client = axios.create({ baseURL: baseUrl, timeout: REQUEST_TIMEOUT_MS });
  }

  // async so the guard's throw surfaces as a rejection, matching run().
  async load(): Promise<void> {
    assertClassOrderVerified();
    this.ready = true;
    this.wake();
  }

  /**
   * Nudges a sleeping Space awake as soon as the app opens, so the container is
   * usually up by the time the user has staged a leaf and pressed the shutter.
   *
   * Deliberately not awaited and deliberately silent: this is an optimisation,
   * not a health check. A failure here says nothing useful — the network may
   * arrive later, and the real request reports its own outcome with a typed
   * error. Blocking or surfacing this would make app startup depend on a
   * server the user has not asked anything of yet.
   */
  private wake(): void {
    // try/catch as well as .catch: this must not be able to fail load(). An
    // optimisation that can break the path it optimises is worse than no
    // optimisation, and a synchronous throw here would reject load() and take
    // diagnosis down with it.
    try {
      void this.client.get('/health', { timeout: WAKE_TIMEOUT_MS }).catch(() => undefined);
    } catch {
      // Ignored by design.
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  async run(input: InferenceInput): Promise<Classification> {
    assertClassOrderVerified();
    const startedAt = Date.now();

    const form = new FormData();
    // React Native's FormData file part: { uri, name, type }.
    form.append('image', {
      uri: input.imageUri,
      name: 'leaf.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);

    let data: PredictResponse;
    try {
      const response = await this.client.post<PredictResponse>('/predict', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      data = response.data;
    } catch (error) {
      throw this.mapTransportError(error);
    }

    return toClassification(this.vectorFromNamedProbabilities(data), {
      provider: this.name,
      modelVersion: data.model_version ?? null,
      durationMs: Date.now() - startedAt,
    });
  }

  dispose(): Promise<void> {
    this.ready = false;
    return Promise.resolve();
  }

  /** Rebuilds the vector in config order from the name-keyed response. */
  private vectorFromNamedProbabilities(data: PredictResponse): number[] {
    const entries = data.probabilities;
    if (entries === undefined || entries === null || typeof entries !== 'object') {
      throw new InferenceError('invalid-response', 'Response has no probabilities object.');
    }
    const names = Object.keys(entries);
    for (const name of names) {
      if (!isClassCode(name)) {
        throw new InferenceError(
          'invalid-response',
          `Server returned unknown class "${name}". Server and app class lists disagree.`,
        );
      }
    }
    return CLASS_CODES.map((code) => {
      const value = entries[code];
      if (typeof value !== 'number') {
        throw new InferenceError('invalid-response', `Server response is missing class "${code}".`);
      }
      return value;
    });
  }

  private mapTransportError(error: unknown): InferenceError {
    if (error instanceof AxiosError) {
      if (error.code === 'ECONNABORTED') {
        return new InferenceError('timeout', undefined, { cause: error });
      }
      const status = error.response?.status;
      if (status === undefined) {
        return new InferenceError('server-unreachable', undefined, { cause: error });
      }
      if (status === 503) {
        return new InferenceError('model-not-loaded', undefined, { cause: error });
      }
      return new InferenceError('server-error', `Server responded ${status}.`, { cause: error });
    }
    return new InferenceError('server-unreachable', undefined, { cause: error });
  }
}
