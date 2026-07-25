import { useCallback, useEffect, useRef, useState } from 'react';

import { getInferenceProvider, isInferenceError, type Classification } from '@/inference';

export type InferenceStatus =
  | { readonly state: 'idle' }
  | { readonly state: 'loading' }
  | { readonly state: 'success'; readonly result: Classification }
  | { readonly state: 'error'; readonly message: string; readonly code: string };

/**
 * Runs classification for an image through the provider interface. The hook
 * knows nothing about which provider is behind the factory (CLAUDE.md §8).
 * Guards against stale results when a retry starts before the previous run
 * settles, and against setState after unmount.
 */
export function useInference(imageUri: string): {
  status: InferenceStatus;
  retry: () => void;
} {
  const [status, setStatus] = useState<InferenceStatus>({ state: 'idle' });
  const runIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(() => {
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setStatus({ state: 'loading' });

    void (async () => {
      try {
        const provider = await getInferenceProvider();
        if (!provider.isReady()) {
          await provider.load();
        }
        const result = await provider.run({ imageUri });
        if (mountedRef.current && runIdRef.current === runId) {
          setStatus({ state: 'success', result });
        }
      } catch (error) {
        if (!mountedRef.current || runIdRef.current !== runId) return;
        if (isInferenceError(error)) {
          setStatus({ state: 'error', message: error.message, code: error.code });
        } else {
          setStatus({
            state: 'error',
            message: 'Classification failed for an unexpected reason. No diagnosis was made.',
            code: 'unknown',
          });
        }
      }
    })();
  }, [imageUri]);

  useEffect(() => {
    run();
  }, [run]);

  return { status, retry: run };
}
