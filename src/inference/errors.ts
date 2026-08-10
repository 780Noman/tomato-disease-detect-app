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
    'No network connection. Remote diagnosis needs the internet — your history and library still work offline.',
  'server-unreachable':
    'The diagnosis server did not respond. Check the server address and your connection, then retry.',
  'server-error': 'The diagnosis server hit an internal error. Retry in a moment.',
  timeout: 'The diagnosis took too long and was stopped. Retry on a faster connection.',
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
