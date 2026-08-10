/**
 * The pre-build gate. Run this and get a PASS before triggering an EAS build.
 *
 *   npm run verify:release
 *
 * WHY IT EXISTS: every failure so far was found by building an APK, installing
 * it, and scanning a leaf — roughly 40 minutes per attempt. Everything this
 * script checks is checkable from this machine in seconds, against the same
 * deployed server the APK will call.
 *
 * It checks, in order:
 *   1. DEFAULT_REMOTE_API_URL is actually set (an unset URL means the APK has
 *      no server to call and every scan fails).
 *   2. GET /health returns 200, reports the model LOADED, and reports the class
 *      order VERIFIED. A degraded server still returns 200 from a browser, so
 *      "the Space is up" proves nothing on its own.
 *   3. The server's class order matches src/config/classes.ts exactly, in the
 *      same order. A mismatch means every diagnosis is mislabelled.
 *   4. POST /predict with a real image returns all six classes as numbers
 *      summing to ~1.0 — the full contract RemoteProvider depends on.
 *
 * Node's built-in fetch; no dependencies.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HEALTH_TIMEOUT_MS = 120_000; // a sleeping Space has to boot first
const PREDICT_TIMEOUT_MS = 120_000;

function fail(message, ...details) {
  console.error(`\nFAIL: ${message}`);
  for (const detail of details) console.error(`      ${detail}`);
  process.exit(1);
}

/** Reads a string constant out of a TS source file without compiling it. */
function readStringConstant(file, name) {
  const source = fs.readFileSync(file, 'utf8');
  const match = new RegExp(`${name}\\s*=\\s*'([^']*)'`).exec(source);
  if (match === null) fail(`could not find ${name} in ${path.relative(ROOT, file)}`);
  return match[1];
}

/** Reads the CLASS_CODES array out of config/classes.ts, in order. */
function readClassCodes() {
  const file = path.join(ROOT, 'src', 'config', 'classes.ts');
  const source = fs.readFileSync(file, 'utf8');
  const match = /CLASS_CODES\s*=\s*\[([\s\S]*?)\]/.exec(source);
  if (match === null) fail('could not find CLASS_CODES in src/config/classes.ts');
  const codes = [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  if (codes.length === 0) fail('CLASS_CODES parsed as empty');
  return codes;
}

async function getJson(url, timeoutMs) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    fail(`${url} did not return JSON`, `status ${response.status}`, text.slice(0, 300));
  }
  return { status: response.status, body };
}

async function main() {
  console.log('Pre-build release check\n' + '='.repeat(70));

  // ---- 1. URL configured --------------------------------------------------
  const envFile = path.join(ROOT, 'src', 'config', 'env.ts');
  const baseUrl = readStringConstant(envFile, 'DEFAULT_REMOTE_API_URL').replace(/\/+$/, '');
  if (baseUrl.length === 0) {
    fail(
      'DEFAULT_REMOTE_API_URL is empty in src/config/env.ts',
      'The APK would have no server to call, so every scan would fail.',
      'Set it to your Hugging Face Space URL, e.g.',
      "  export const DEFAULT_REMOTE_API_URL = 'https://your-user-your-space.hf.space';",
    );
  }
  if (!/^https:\/\//.test(baseUrl)) {
    fail(
      `DEFAULT_REMOTE_API_URL is "${baseUrl}", which is not https`,
      'Android blocks cleartext HTTP by default, so an http:// URL fails in a release APK.',
    );
  }
  console.log(`[1/4] server URL: ${baseUrl}`);

  // ---- 2. Health ----------------------------------------------------------
  console.log('[2/4] GET /health (a sleeping Space can take a minute to boot)...');
  let health;
  try {
    health = await getJson(`${baseUrl}/health`, HEALTH_TIMEOUT_MS);
  } catch (error) {
    fail(`could not reach ${baseUrl}/health`, String(error));
  }
  if (health.status !== 200) {
    fail(`/health returned ${health.status}`, JSON.stringify(health.body));
  }
  console.log(`      status=${health.body.status} model=${health.body.model_version}`);
  console.log(`      detail: ${health.body.detail}`);

  if (health.body.model_loaded !== true) {
    fail(
      'the server is running but has NO MODEL loaded',
      'It would return 503 for every scan. The detail line above says why.',
      'If it mentions unresolved ops or Select TF ops, the Space is using',
      'tflite-runtime instead of tensorflow — fix deploy/huggingface/requirements.txt.',
    );
  }
  if (health.body.class_order_verified !== true) {
    fail('the server reports class_order_verified=false — every diagnosis would be mislabelled');
  }

  // ---- 3. Class order agreement -------------------------------------------
  const expected = readClassCodes();
  const actual = health.body.class_order;
  if (!Array.isArray(actual) || actual.join('|') !== expected.join('|')) {
    fail(
      'the server and the app disagree about class order',
      `app:    ${expected.join(', ')}`,
      `server: ${Array.isArray(actual) ? actual.join(', ') : JSON.stringify(actual)}`,
    );
  }
  console.log(`[3/4] class order matches app config (${expected.length} classes)`);

  // ---- 4. A real prediction -----------------------------------------------
  const imagePath = path.join(ROOT, 'assets', 'capture-reference.png');
  if (!fs.existsSync(imagePath)) fail(`no test image at ${path.relative(ROOT, imagePath)}`);

  const form = new FormData();
  form.append('image', new Blob([fs.readFileSync(imagePath)]), 'leaf.png');

  console.log('[4/4] POST /predict with a real image...');
  let predict;
  try {
    const response = await fetch(`${baseUrl}/predict`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(PREDICT_TIMEOUT_MS),
    });
    predict = { status: response.status, body: await response.json() };
  } catch (error) {
    fail(`POST ${baseUrl}/predict failed`, String(error));
  }
  if (predict.status !== 200) {
    fail(`/predict returned ${predict.status}`, JSON.stringify(predict.body));
  }

  const probabilities = predict.body.probabilities;
  if (probabilities === null || typeof probabilities !== 'object') {
    fail('/predict response has no probabilities object', JSON.stringify(predict.body));
  }

  const missing = expected.filter((code) => typeof probabilities[code] !== 'number');
  if (missing.length > 0) {
    fail(`/predict omitted classes: ${missing.join(', ')}`, JSON.stringify(probabilities));
  }
  const unknown = Object.keys(probabilities).filter((code) => !expected.includes(code));
  if (unknown.length > 0) {
    fail(`/predict returned unknown classes: ${unknown.join(', ')}`);
  }

  const total = expected.reduce((sum, code) => sum + probabilities[code], 0);
  if (Math.abs(total - 1) > 0.02) {
    fail(
      `probabilities sum to ${total.toFixed(4)}, not ~1.0`,
      'RemoteProvider treats the response as a probability vector.',
    );
  }

  const top = expected.reduce((best, code) =>
    probabilities[code] > probabilities[best] ? code : best,
  );
  console.log(
    `      6 classes, sum=${total.toFixed(4)}, top=${top} ` +
      `(${(probabilities[top] * 100).toFixed(0)}%), ${predict.body.inference_ms} ms`,
  );
  console.log(
    '      (the reference image is not a real leaf photo, so the label itself is meaningless —\n' +
      '       this checks the contract, not the diagnosis)',
  );

  console.log('\n' + '='.repeat(70));
  console.log('PASS — the deployed server satisfies the contract the APK expects.');
  console.log('Safe to build. Note that npm run verify:model still fails by design:');
  console.log('this model cannot run on-device, which is why inference is server-side.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
