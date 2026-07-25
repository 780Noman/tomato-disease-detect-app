/**
 * Guards CLAUDE.md §10: every asset referenced from app.json resolves on
 * disk, the required brand assets exist, and each raster has the exact
 * dimensions the platform expects. PNG dimensions are read straight from
 * the IHDR header so the test needs no image library.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..', '..');

function pngDimensions(file: string): { width: number; height: number } {
  const buf = fs.readFileSync(file);
  // PNG signature (8 bytes) + IHDR length/type (8 bytes), then width/height.
  expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function collectAssetPaths(node: unknown, found: string[]): void {
  if (typeof node === 'string') {
    if (node.startsWith('./assets/')) found.push(node);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item) => collectAssetPaths(item, found));
    return;
  }
  if (node !== null && typeof node === 'object') {
    Object.values(node).forEach((value) => collectAssetPaths(value, found));
  }
}

describe('app.json asset references', () => {
  const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')) as unknown;

  it('references at least the icon, splash, adaptive icon and favicon', () => {
    const refs: string[] = [];
    collectAssetPaths(appJson, refs);
    expect(refs).toEqual(
      expect.arrayContaining([
        './assets/icon.png',
        './assets/splash.png',
        './assets/adaptive-icon.png',
        './assets/favicon.png',
      ]),
    );
  });

  it('every referenced asset path resolves to a file', () => {
    const refs: string[] = [];
    collectAssetPaths(appJson, refs);
    for (const ref of refs) {
      const resolved = path.join(ROOT, ref);
      expect({ ref, exists: fs.existsSync(resolved) }).toEqual({ ref, exists: true });
    }
  });
});

describe('required brand assets (CLAUDE.md §10)', () => {
  const expected: Record<string, { width: number; height: number } | null> = {
    'assets/icon.png': { width: 1024, height: 1024 },
    'assets/adaptive-icon.png': { width: 1024, height: 1024 },
    'assets/splash.png': { width: 1284, height: 2778 },
    'assets/favicon.png': { width: 48, height: 48 },
    'assets/capture-reference.png': null,
    'assets/logo.svg': null,
    'assets/capture-reference.svg': null,
  };

  it.each(Object.keys(expected))('%s exists and is non-empty', (rel) => {
    const file = path.join(ROOT, rel);
    expect(fs.existsSync(file)).toBe(true);
    expect(fs.statSync(file).size).toBeGreaterThan(0);
  });

  it.each(Object.entries(expected).filter(([, dims]) => dims !== null))(
    '%s has the required dimensions',
    (rel, dims) => {
      expect(pngDimensions(path.join(ROOT, rel))).toEqual(dims);
    },
  );
});
