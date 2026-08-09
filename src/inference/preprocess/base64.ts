import { InferenceError } from '../errors';

/**
 * Base64 → bytes, depending on neither `atob` nor Node's `Buffer`.
 *
 * WHY THIS IS HAND-ROLLED — neither global is guaranteed in the release
 * runtime (verified 2026-08-09):
 *   - React Native ships no atob/btoa polyfill; nothing under its Libraries/
 *     defines either name.
 *   - Metro provides no global `Buffer`; the production bundle contains no
 *     `global.Buffer =`.
 *   - Firebase's own bundled base64 helper feature-detects `typeof atob`
 *     rather than assuming it exists, which is the clearest evidence that
 *     assuming it is unsafe.
 *
 * The previous implementation tried `Buffer`, then `globalThis.atob`. Under
 * Jest `Buffer` exists so it passed; in an APK both are likely absent, and
 * every scan would have failed with "This image could not be read". It had
 * never run on device because model loading failed earlier.
 *
 * Decoding here keeps Jest and the device on one identical path — the same
 * lesson as resolveModelUri.ts: dev/release divergence is what hides these
 * failures until an APK exists.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Marks a byte value that is not a base64 data character. */
const INVALID = 255;

const PADDING = '='.charCodeAt(0);

/** charCode → 6-bit value. */
const DECODE_TABLE: Uint8Array = (() => {
  const table = new Uint8Array(256).fill(INVALID);
  for (let i = 0; i < ALPHABET.length; i += 1) {
    table[ALPHABET.charCodeAt(i)] = i;
  }
  return table;
})();

function isSkippable(code: number): boolean {
  // Padding carries no data; whitespace appears when a producer wraps lines.
  return code === PADDING || code === 32 || code === 9 || code === 10 || code === 13;
}

/**
 * @throws InferenceError('image-unreadable') on any character that is not
 *   base64, and on a truncated final group. Silent tolerance here would turn
 *   corrupt image data into a confident wrong diagnosis.
 */
export function base64ToBytes(base64: string): Uint8Array {
  const sextets = new Uint8Array(base64.length);
  let count = 0;

  for (let i = 0; i < base64.length; i += 1) {
    const code = base64.charCodeAt(i);
    if (isSkippable(code)) continue;
    const value = DECODE_TABLE[code] as number;
    if (value === INVALID) {
      throw new InferenceError(
        'image-unreadable',
        `Image data is not valid base64: unexpected character at index ${i}.`,
      );
    }
    sextets[count] = value;
    count += 1;
  }

  // Four 6-bit values (24 bits) decode to three bytes. A trailing group of
  // two or three values encodes one or two bytes; a lone trailing value
  // cannot encode anything and means the data was cut short.
  const remainder = count % 4;
  if (remainder === 1) {
    throw new InferenceError('image-unreadable', 'Image data is truncated base64.');
  }

  const fullGroups = (count - remainder) / 4;
  const bytes = new Uint8Array(fullGroups * 3 + (remainder === 0 ? 0 : remainder - 1));

  let src = 0;
  let dst = 0;
  for (let group = 0; group < fullGroups; group += 1) {
    const a = sextets[src] as number;
    const b = sextets[src + 1] as number;
    const c = sextets[src + 2] as number;
    const d = sextets[src + 3] as number;
    bytes[dst] = ((a << 2) | (b >> 4)) & 0xff;
    bytes[dst + 1] = ((b << 4) | (c >> 2)) & 0xff;
    bytes[dst + 2] = ((c << 6) | d) & 0xff;
    src += 4;
    dst += 3;
  }

  if (remainder >= 2) {
    const a = sextets[src] as number;
    const b = sextets[src + 1] as number;
    bytes[dst] = ((a << 2) | (b >> 4)) & 0xff;
    if (remainder === 3) {
      const c = sextets[src + 2] as number;
      bytes[dst + 1] = ((b << 4) | (c >> 2)) & 0xff;
    }
  }

  return bytes;
}
