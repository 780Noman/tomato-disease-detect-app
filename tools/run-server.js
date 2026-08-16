/**
 * Starts the local inference server using the venv's Python.
 *
 *   npm run server:dev
 *
 * A launcher rather than a plain npm script because the obvious one-liner
 * breaks: npm runs scripts through cmd.exe on Windows, and cmd refuses an
 * executable path written with forward slashes ('.venv' is not recognized...),
 * while backslashes break the same script on macOS/Linux. Resolving the path
 * here sidesteps the whole problem.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SERVER_DIR = path.join(ROOT, 'server');
const PORT = process.env.PORT ?? '8000';

const candidates = [
  path.join(SERVER_DIR, '.venv', 'Scripts', 'python.exe'), // Windows
  path.join(SERVER_DIR, '.venv', 'bin', 'python'), // macOS / Linux
];

const python = candidates.find((candidate) => fs.existsSync(candidate));
if (python === undefined) {
  console.error('No virtual environment found. Expected one of:');
  for (const candidate of candidates) console.error(`  ${candidate}`);
  console.error('\nCreate it (never install globally — see server/requirements.txt):');
  console.error('  cd server');
  console.error('  python -m venv .venv');
  console.error('  .venv\\Scripts\\python.exe -m pip install -r requirements.txt');
  process.exit(1);
}

console.log(`python : ${python}`);
console.log(`serving: http://0.0.0.0:${PORT}  (phone uses this machine's LAN IP)`);
console.log('health : /health   predict: POST /predict (multipart field "image")\n');

const child = spawn(
  python,
  ['-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', PORT],
  { cwd: SERVER_DIR, stdio: 'inherit' },
);

child.on('exit', (code, signal) => {
  process.exit(signal !== null ? 1 : (code ?? 0));
});
