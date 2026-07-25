import axios, { AxiosError, type AxiosInstance } from 'axios';

import { assertClassOrderVerified } from '../classGuard';
import { InferenceError } from '../errors';
import type { InferenceProvider } from '../InferenceProvider';
import { toClassification } from '../rank';
import type { Classification, InferenceInput } from '../types';
import { CLASS_CODES, isClassCode } from '@/config/classes';

/**
 * FastAPI fallback (dev/debug — on-device is the primary path). Maps the
 * response BY CLASS NAME, never by array position, so a server and app
 * built from the same config cannot disagree silently.
 */

interface PredictResponse {
  readonly probabilities: Record<string, number>;
  readonly model_version?: string;
}

const REQUEST_TIMEOUT_MS = 20_000;

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
