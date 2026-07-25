/**
 * Generates every raster brand asset from the SVG sources (CLAUDE.md §10).
 * SVG-first: assets/logo.svg and assets/capture-reference.svg are the only
 * artwork; everything raster is exported from them by this script.
 *
 * Run: node tools/generate-assets.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const SAND = '#FAF6F1';

function svgBuffer(name) {
  return fs.readFileSync(path.join(ASSETS, name));
}

/** Rasterise an SVG buffer to an exact square size, preserving sharpness. */
function rasterise(buffer, size, nativeSize) {
  // sharp rasterises SVG at its natural size unless density is raised.
  const density = (72 * size) / nativeSize;
  return sharp(buffer, { density }).resize(size, size).png();
}

async function onBackground(buffer, { canvas, mark, native, background }) {
  const markPng = await rasterise(buffer, mark, native).toBuffer();
  return sharp({
    create: { width: canvas, height: canvas, channels: 4, background },
  })
    .composite([{ input: markPng, gravity: 'centre' }])
    .png();
}

async function main() {
  const logo = svgBuffer('logo.svg');
  const reference = svgBuffer('capture-reference.svg');

  // App icon: mark on warm sand, full-bleed square (iOS masks the corners).
  const icon = await onBackground(logo, {
    canvas: 1024,
    mark: 700,
    native: 512,
    background: SAND,
  });
  await icon.toFile(path.join(ASSETS, 'icon.png'));

  // Android adaptive foreground: transparent, artwork inside the centre 66%
  // safe zone (676 of 1024) - the mark is rendered at 600.
  const adaptiveMark = await rasterise(logo, 600, 512).toBuffer();
  await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: adaptiveMark, gravity: 'centre' }])
    .png()
    .toFile(path.join(ASSETS, 'adaptive-icon.png'));

  // Splash: mark centred on sand at full portrait resolution.
  const splashMark = await rasterise(logo, 512, 512).toBuffer();
  await sharp({
    create: { width: 1284, height: 2778, channels: 4, background: SAND },
  })
    .composite([{ input: splashMark, gravity: 'centre' }])
    .png()
    .toFile(path.join(ASSETS, 'splash.png'));

  // Web favicon: the mark alone, transparent background.
  await rasterise(logo, 48, 512).toFile(path.join(ASSETS, 'favicon.png'));

  // Capture-guide worked example (illustration, not a photo).
  await rasterise(reference, 800, 800).toFile(path.join(ASSETS, 'capture-reference.png'));

  for (const f of [
    'icon.png',
    'adaptive-icon.png',
    'splash.png',
    'favicon.png',
    'capture-reference.png',
  ]) {
    const { size } = fs.statSync(path.join(ASSETS, f));
    console.log(`${f.padEnd(24)} ${(size / 1024).toFixed(1)} KB`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
