import { base64ToBytes } from './base64';

/**
 * Node's Buffer is the reference implementation here. It exists under Jest but
 * NOT in the release runtime, which is exactly why base64.ts cannot use it —
 * so it is used to check the hand-rolled decoder, never by shipped code.
 */
function reference(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

describe('base64ToBytes', () => {
  it('decodes the empty string to no bytes', () => {
    expect(base64ToBytes('')).toEqual(new Uint8Array(0));
  });

  it.each([
    ['TWFu', 'Man'],
    ['TWE=', 'Ma'],
    ['TQ==', 'M'],
    ['bGVhZg==', 'leaf'],
  ])('decodes %s to %s', (encoded, plain) => {
    expect(base64ToBytes(encoded)).toEqual(new Uint8Array(Buffer.from(plain, 'utf8')));
  });

  it('handles every output length modulo 3, matching Buffer exactly', () => {
    for (let length = 0; length <= 32; length += 1) {
      const bytes = Uint8Array.from({ length }, (_unused, i) => (i * 37) % 256);
      const encoded = Buffer.from(bytes).toString('base64');
      expect(base64ToBytes(encoded)).toEqual(bytes);
    }
  });

  it('matches Buffer on JPEG-like binary data across the full byte range', () => {
    // A deterministic pseudo-random spread so every byte value 0-255 appears,
    // including the 0xFF markers that make up a real JPEG.
    const bytes = new Uint8Array(3000);
    let state = 12345;
    for (let i = 0; i < bytes.length; i += 1) {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      bytes[i] = (state >> 16) & 0xff;
    }
    const encoded = Buffer.from(bytes).toString('base64');
    expect(base64ToBytes(encoded)).toEqual(bytes);
  });

  it('decodes the whole alphabet, including + and /', () => {
    const encoded = Buffer.from(Uint8Array.from({ length: 192 }, (_unused, i) => i)).toString(
      'base64',
    );
    expect(encoded).toMatch(/[+/]/);
    expect(base64ToBytes(encoded)).toEqual(reference(encoded));
  });

  it('ignores newlines and spaces a producer may have inserted', () => {
    expect(base64ToBytes('TWFu\nTWFu')).toEqual(base64ToBytes('TWFuTWFu'));
    expect(base64ToBytes('TWFu TWFu\r\n')).toEqual(base64ToBytes('TWFuTWFu'));
  });

  it('rejects a non-base64 character rather than decoding garbage', () => {
    expect(() => base64ToBytes('TW!u')).toThrow(/not valid base64/);
    // The typed code matters: the UI renders per-code messages, never a generic one.
    let caught: unknown;
    try {
      base64ToBytes('TW!u');
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({ code: 'image-unreadable' });
  });

  it('rejects truncated data instead of returning a short buffer', () => {
    expect(() => base64ToBytes('TWFuT')).toThrow(/truncated/);
  });
});
