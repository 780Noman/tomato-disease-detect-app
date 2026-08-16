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
const net = require('net');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SERVER_DIR = path.join(ROOT, 'server');

/**
 * 8010, not 8000. Port 8000 is Django's default `runserver` port and is very
 * often already taken on a development machine — it was here, by an unrelated
 * Python process, and uvicorn's failure ("only one usage of each socket address
 * is normally permitted") does not say which program is holding it. Override
 * with PORT if 8010 is busy too, and keep .env's EXPO_PUBLIC_REMOTE_API_URL in
 * step.
 */
const PORT = process.env.PORT ?? '8010';

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

/**
 * Checks the port before handing it to uvicorn. uvicorn's own failure —
 * "only one usage of each socket address is normally permitted" — does not say
 * which program holds the port or what to do, and the answer is usually "not
 * this project", so killing something is the wrong reflex.
 */
function portIsFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(Number(port), '0.0.0.0');
  });
}

async function main() {
  if (!(await portIsFree(PORT))) {
    console.error(`Port ${PORT} is already in use, so the server cannot start.`);
    console.error('\nSomething else on this machine is listening there. Find out what');
    console.error('before killing anything — on Windows:');
    console.error(
      `  Get-Process -Id (Get-NetTCPConnection -LocalPort ${PORT} -State Listen).OwningProcess`,
    );
    console.error('\nOr just use a different port, and update .env to match:');
    console.error(`  $env:PORT=${Number(PORT) + 1}; npm run server:dev`);
    console.error(`  EXPO_PUBLIC_REMOTE_API_URL=http://<this-machine-ip>:${Number(PORT) + 1}`);
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
}

void main();
