/**
 * Typed inference failures (CLAUDE.md §9). Every failure mode has its own
 * code and its own user-readable message — "Something went wrong" is banned.
 */

export type InferenceErrorCode =
  | 'no-network'
  | 'server-unreachable'
  | 'server-error'
  | 'timeout'
  | 'invalid-response'
  | 'image-unreadable'
  | 'model-not-loaded'
  | 'model-incompatible'
  | 'class-order-unverified'
  | 'mock-in-production';

const DEFAULT_MESSAGES: Record<InferenceErrorCode, string> = {
  'no-network':
    'No internet connection. Diagnosis runs on a server, so it needs the internet — your history, the disease library and saved reports still work offline.',
  'server-unreachable':
    'Could not reach the diagnosis server. Check your internet connection and try again.',
  'server-error': 'The diagnosis server hit an internal error. Retry in a moment.',
  // The server sleeps when idle and has to start a container before it can
  // answer, so a first slow request is expected rather than a fault. Telling
  // the user to find a faster connection would send them after the wrong thing.
  timeout:
    'The diagnosis server did not answer in time. It may have been asleep after a period of inactivity — tap Try again, it usually answers on the second attempt.',
  'invalid-response':
    'The model returned data this app version does not understand. No diagnosis was made.',
  'image-unreadable': 'This image could not be read. Retake the photo and try again.',
  'model-not-loaded':
    'The on-device model is not available on this build, so no diagnosis was made.',
  'model-incompatible':
    'The model file in this build cannot run on this device: it needs TensorFlow operators that the on-device runtime does not include. No diagnosis was made. Fixing this needs the model re-exported with TFLite built-in operators only (tools/convert_tflite_builtins_only.py) — it cannot be fixed in the app.',
  'class-order-unverified':
    'Developer: the class index order is UNVERIFIED (config/classes.ts). Real inference is disabled until model_metadata.json confirms the order. Use the mock provider.',
  'mock-in-production': 'Developer: MockProvider must never run in a production build.',
};

export class InferenceError extends Error {
  readonly code: InferenceErrorCode;

  constructor(code: InferenceErrorCode, message?: string, options?: { cause?: unknown }) {
    super(message ?? DEFAULT_MESSAGES[code], options);
    this.name = 'InferenceError';
    this.code = code;
  }
}

export function isInferenceError(value: unknown): value is InferenceError {
  return value instanceof InferenceError;
}

export function messageFor(code: InferenceErrorCode): string {
  return DEFAULT_MESSAGES[code];
}
