import { InferenceError } from '../errors';

/**
 * Packs decoded RGBA pixels into the model's input tensor: RGB float32,
 * raw 0–255 — NO rescale and NO centre-crop, matching the training script
 * exactly (plain resize happens upstream via expo-image-manipulator).
 */
export function packRgbFloat32(rgba: Uint8Array, width: number, height: number): Float32Array {
  const expected = width * height * 4;
  if (rgba.length !== expected) {
    throw new InferenceError(
      'image-unreadable',
      `Decoded pixel buffer is ${rgba.length} bytes, expected ${expected} for ${width}x${height} RGBA.`,
    );
  }
  const out = new Float32Array(width * height * 3);
  let src = 0;
  let dst = 0;
  const pixelCount = width * height;
  for (let i = 0; i < pixelCount; i += 1) {
    out[dst] = rgba[src] as number;
    out[dst + 1] = rgba[src + 1] as number;
    out[dst + 2] = rgba[src + 2] as number;
    src += 4; // skip alpha
    dst += 3;
  }
  return out;
}
