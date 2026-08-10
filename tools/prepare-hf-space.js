/**
 * Assembles the exact folder to push to the Hugging Face Space, into .hf-space/.
 *
 * The point is that server/app/ stays the single source of truth. Copying those
 * files by hand into a second repo is how the deployed server quietly drifts
 * from the tested one, so this script does it and refuses to guess.
 *
 *   node tools/prepare-hf-space.js      (or: npm run space:prepare)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '.hf-space');
const DEPLOY = path.join(ROOT, 'deploy', 'huggingface');
const SERVER_APP = path.join(ROOT, 'server', 'app');

const DEPLOY_FILES = ['Dockerfile', 'requirements.txt', 'README.md', 'fetch_model.py'];

function copyInto(sourceDir, targetDir, files) {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const name of files) {
    fs.copyFileSync(path.join(sourceDir, name), path.join(targetDir, name));
    console.log(`  ${path.relative(ROOT, path.join(targetDir, name))}`);
  }
}

function main() {
  // Rebuild from scratch: a stale file left behind here would be deployed.
  fs.rmSync(OUT, { recursive: true, force: true });

  console.log('Assembling .hf-space/ ...');
  copyInto(DEPLOY, OUT, DEPLOY_FILES);

  const appFiles = fs
    .readdirSync(SERVER_APP)
    .filter((name) => name.endsWith('.py'))
    .sort();
  if (appFiles.length === 0) {
    console.error('ERROR: no .py files found in server/app — nothing to deploy.');
    process.exit(1);
  }
  copyInto(SERVER_APP, path.join(OUT, 'app'), appFiles);

  const dockerfile = fs.readFileSync(path.join(OUT, 'Dockerfile'), 'utf8');
  const placeholder = dockerfile.includes('HF_MODEL_REPO=REPLACE_ME');

  console.log(`\nDone. ${appFiles.length} server file(s) + ${DEPLOY_FILES.length} deploy file(s).`);

  if (placeholder) {
    console.log('\n' + '='.repeat(70));
    console.log('ACTION REQUIRED before pushing');
    console.log('='.repeat(70));
    console.log('deploy/huggingface/Dockerfile still says HF_MODEL_REPO=REPLACE_ME.');
    console.log('Set it to the model repo holding Tomato_Model_Mobile.tflite, e.g.');
    console.log('    ARG HF_MODEL_REPO=your-username/tomato-leaf-doctor-model');
    console.log('then re-run this script. The Space build fails fast on the');
    console.log('placeholder rather than deploying a server with no model.');
    process.exit(1);
  }

  console.log('\nNext: see deploy/huggingface/DEPLOY.md (step 3 onward).');
}

main();
