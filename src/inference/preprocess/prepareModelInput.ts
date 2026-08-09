import * as jpeg from 'jpeg-js';

import { base64ToBytes } from './base64';
import { packRgbFloat32 } from './pixels';
import { InferenceError } from '../errors';
import { TFLITE_MODEL_CONFIG } from '../modelConfig';

/**
 * Image URI → model input tensor, matching training exactly:
 * plain resize to 224×224 (aspect-distorting, like Keras load_img with
 * target_size), then RGB float32 at raw 0–255.
 *
 * expo-image-manipulator and expo-file-system are imported lazily so this
 * module stays testable under Node (the pure parts live in pixels.ts).
 */
export async function prepareModelInput(imageUri: string): Promise<Float32Array> {
  const { inputSize } = TFLITE_MODEL_CONFIG;

  let base64: string;
  try {
    const { ImageManipulator, SaveFormat } = await import('expo-image-manipulator');
    const context = ImageManipulator.manipulate(imageUri);
    // Explicit width AND height: a plain (distorting) resize, not a fit.
    context.resize({ width: inputSize, height: inputSize });
    const rendered = await context.renderAsync();
    const result = await rendered.saveAsync({ format: SaveFormat.JPEG, base64: true, compress: 1 });
    if (!result.base64) {
      throw new InferenceError('image-unreadable', 'Image resize produced no data.');
    }
    base64 = result.base64;
  } catch (error) {
    if (error instanceof InferenceError) throw error;
    throw new InferenceError('image-unreadable', undefined, { cause: error });
  }

  let decoded: { readonly data: Uint8Array; readonly width: number; readonly height: number };
  try {
    decoded = jpeg.decode(base64ToBytes(base64), { useTArray: true });
  } catch (error) {
    throw new InferenceError('image-unreadable', undefined, { cause: error });
  }

  if (decoded.width !== inputSize || decoded.height !== inputSize) {
    throw new InferenceError(
      'image-unreadable',
      `Resized image is ${decoded.width}x${decoded.height}, expected ${inputSize}x${inputSize}.`,
    );
  }

  return packRgbFloat32(decoded.data, decoded.width, decoded.height);
}
