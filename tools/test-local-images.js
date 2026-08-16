/**
 * Sends real images to a running server and prints what it predicts.
 *
 *   npm run test:images                        # 3 images per class, local server
 *   npm run test:images -- --per-class 10
 *   npm run test:images -- --url http://192.168.0.105:8000
 *   npm run test:images -- --dir "C:/some/folder"   # a flat folder, no labels
 *
 * WHAT THIS IS FOR: checking the whole pipeline end to end — image in, six
 * probabilities out, mapped to the right class names — without tapping through
 * the app dozens of times.
 *
 * WHAT THIS IS NOT: a measure of accuracy. The bundled dataset folder holds
 * `aug_*` files, i.e. augmented copies that were almost certainly part of
 * training. A model scoring well on its own training data tells you nothing
 * about field performance, and CLAUDE.md section 7 forbids the app claiming an
 * accuracy figure precisely because the research number was produced this way.
 * Treat the agreement rate below as a smoke test, not a result.
 *
 * Node's built-in fetch; no dependencies.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_DATASET = path.join(ROOT, 'Balance DataSet Without Healthy Class');
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.bmp', '.webp']);
const REQUEST_TIMEOUT_MS = 180_000; // first request loads the model

function parseArgs(argv) {
  const options = { url: 'http://127.0.0.1:8000', perClass: 3, dir: null };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--url' && value !== undefined) options.url = value.replace(/\/+$/, '');
    else if (flag === '--per-class' && value !== undefined) options.perClass = Number(value);
    else if (flag === '--dir' && value !== undefined) options.dir = value;
  }
  if (!Number.isInteger(options.perClass) || options.perClass < 1) {
    console.error('--per-class must be a positive integer');
    process.exit(1);
  }
  return options;
}

function readClassCodes() {
  const source = fs.readFileSync(path.join(ROOT, 'src', 'config', 'classes.ts'), 'utf8');
  const match = /CLASS_CODES\s*=\s*\[([\s\S]*?)\]/.exec(source);
  if (match === null) {
    console.error('could not read CLASS_CODES from src/config/classes.ts');
    process.exit(1);
  }
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function imagesIn(dir, limit) {
  return fs
    .readdirSync(dir)
    .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .sort() // deterministic: the same files every run, so results are comparable
    .slice(0, limit)
    .map((name) => path.join(dir, name));
}

/** Returns [{ file, expected|null }] */
function collectSamples(options, classCodes) {
  if (options.dir !== null) {
    if (!fs.existsSync(options.dir)) {
      console.error(`--dir does not exist: ${options.dir}`);
      process.exit(1);
    }
    const files = imagesIn(options.dir, Number.MAX_SAFE_INTEGER);
    if (files.length === 0) {
      console.error(`no images found in ${options.dir}`);
      process.exit(1);
    }
    return files.map((file) => ({ file, expected: null }));
  }

  if (!fs.existsSync(DEFAULT_DATASET)) {
    console.error(
      `Dataset folder not found:\n  ${DEFAULT_DATASET}\n` +
        'Pass --dir with a folder of images instead.',
    );
    process.exit(1);
  }

  const samples = [];
  for (const code of classCodes) {
    const dir = path.join(DEFAULT_DATASET, code);
    if (!fs.existsSync(dir)) {
      console.warn(`  (no folder for ${code}, skipping)`);
      continue;
    }
    for (const file of imagesIn(dir, options.perClass)) {
      samples.push({ file, expected: code });
    }
  }
  return samples;
}

async function predict(baseUrl, file) {
  const form = new FormData();
  form.append('image', new Blob([fs.readFileSync(file)]), path.basename(file));
  const response = await fetch(`${baseUrl}/predict`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = await response.json();
  if (response.status !== 200) {
    throw new Error(`${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

/** Shortens tomato__N_K to N_K so the table stays readable. */
function short(code) {
  return code === null ? '?' : code.replace(/^tomato__/, '');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const classCodes = readClassCodes();

  console.log(`Server : ${options.url}`);

  // Fail early and clearly rather than reporting six identical 503s.
  let health;
  try {
    const response = await fetch(`${options.url}/health`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    health = await response.json();
  } catch (error) {
    console.error(`\nCannot reach ${options.url}/health — is the server running?\n  ${error}`);
    process.exit(1);
  }
  console.log(`Model  : ${health.model_version ?? '(none)'} — ${health.detail}`);
  if (health.model_loaded !== true) {
    console.error('\nThe server has no model loaded, so it can only return 503.');
    console.error('It never fabricates a prediction, which is why this stops here.');
    process.exit(1);
  }

  const samples = collectSamples(options, classCodes);
  console.log(`Images : ${samples.length}\n`);

  const confusion = new Map();
  let agreed = 0;
  let labelled = 0;
  let failed = 0;

  for (const [index, sample] of samples.entries()) {
    const position = `${String(index + 1).padStart(3)}/${samples.length}`;
    let result;
    try {
      result = await predict(options.url, sample.file);
    } catch (error) {
      failed += 1;
      console.log(`${position}  ${path.basename(sample.file).padEnd(22)} FAILED: ${error.message}`);
      continue;
    }

    const top = result.top_class;
    const confidence = result.probabilities[top];
    const expected = sample.expected;

    let verdict = '';
    if (expected !== null) {
      labelled += 1;
      const match = top === expected;
      if (match) agreed += 1;
      verdict = match ? 'match' : `expected ${short(expected)}`;
      const key = `${expected}\u0000${top}`;
      confusion.set(key, (confusion.get(key) ?? 0) + 1);
    }

    console.log(
      `${position}  ${path.basename(sample.file).padEnd(22)} ` +
        `-> ${short(top).padEnd(8)} ${String(Math.round(confidence * 100)).padStart(3)}%  ` +
        `${String(result.inference_ms).padStart(5)}ms  ${verdict}`,
    );
  }

  if (failed > 0) console.log(`\n${failed} request(s) failed.`);

  if (labelled > 0) {
    console.log('\n' + '-'.repeat(70));
    console.log('Expected vs predicted');
    console.log('-'.repeat(70));
    for (const expected of classCodes) {
      const row = classCodes
        .map((predicted) => {
          const count = confusion.get(`${expected}\u0000${predicted}`) ?? 0;
          return count === 0 ? '  .' : String(count).padStart(3);
        })
        .join(' ');
      console.log(`  ${short(expected).padEnd(8)} ${row}`);
    }
    console.log(
      `  ${' '.repeat(8)} ${classCodes.map((c) => short(c).slice(0, 3).padStart(3)).join(' ')}`,
    );

    console.log(`\nAgreed with the folder label on ${agreed}/${labelled} images.`);
    console.log(
      'NOT an accuracy figure. These are augmented images that were almost\n' +
        'certainly seen during training, so this number is inflated by\n' +
        'construction — the same flaw that makes the published research figure\n' +
        'untrustworthy. To judge real performance, photograph fresh leaves\n' +
        'following the capture protocol and check those.',
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
