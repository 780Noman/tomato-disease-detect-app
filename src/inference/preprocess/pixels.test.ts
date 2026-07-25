import * as jpeg from 'jpeg-js';

import { packRgbFloat32 } from './pixels';
import { InferenceError } from '../errors';

describe('packRgbFloat32', () => {
  it('drops alpha and keeps raw 0-255 values — no rescale, matching training', () => {
    // Two pixels: red and mid-grey, both fully opaque.
    const rgba = new Uint8Array([255, 0, 0, 255, 128, 128, 128, 255]);
    const packed = packRgbFloat32(rgba, 2, 1);
    expect(Array.from(packed)).toEqual([255, 0, 0, 128, 128, 128]);
  });

  it('rejects a buffer of the wrong size as image-unreadable', () => {
    expect(() => packRgbFloat32(new Uint8Array(5), 2, 1)).toThrow(InferenceError);
  });

  it('round-trips through a real JPEG encode/decode close to the source values', () => {
    // A uniform 8x8 mid-green tile survives JPEG compression nearly exactly.
    const size = 8;
    const source = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i += 1) {
      source[i * 4] = 60;
      source[i * 4 + 1] = 140;
      source[i * 4 + 2] = 70;
      source[i * 4 + 3] = 255;
    }
    const encoded = jpeg.encode({ data: source, width: size, height: size }, 95);
    const decoded = jpeg.decode(encoded.data, { useTArray: true });
    const packed = packRgbFloat32(new Uint8Array(decoded.data), decoded.width, decoded.height);

    expect(packed.length).toBe(size * size * 3);
    // JPEG is lossy; a uniform tile should stay within a few counts.
    expect(Math.abs((packed[0] as number) - 60)).toBeLessThanOrEqual(6);
    expect(Math.abs((packed[1] as number) - 140)).toBeLessThanOrEqual(6);
    expect(Math.abs((packed[2] as number) - 70)).toBeLessThanOrEqual(6);
  });
});
