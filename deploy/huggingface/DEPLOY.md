# Deploying the inference server to Hugging Face

Follow these in order. Nothing here needs `git-lfs`, a JDK, or TensorFlow on
your machine.

## Why the app calls a server at all

The delivered `Tomato_Model_Mobile.tflite` was exported with TF Select ("Flex")
operators — 800+ of them, including `FlexConv2D`. Those are TensorFlow ops, not
TFLite ops. An on-device TFLite runtime cannot resolve them, and the delegate
that could is a ~100 MB library that `react-native-fast-tflite` does not bundle.

Run `npm run verify:model` to see this for yourself; it reads the model's own
bytes and lists every offending operator.

The **full TensorFlow package registers that delegate automatically**, so the
same file runs unchanged on a server. That is what this deployment does. The
alternative — re-exporting the model with builtins only
(`tools/convert_tflite_builtins_only.py`) — needs the training code, which this
project does not have.

**Consequence:** diagnosis needs an internet connection. The app says so on
first launch and shows a live banner when offline. History, the disease library
and PDF reports still work with no connection.

---

## Step 1 — Upload the model to a Hugging Face model repo

The model is 141 MB, which is why it goes in its own repo rather than the Space:
uploading through the website avoids needing `git-lfs` locally.

1. Sign in at <https://huggingface.co>.
2. **New** → **Model**.
   - Owner: your account
   - Model name: `tomato-leaf-doctor-model`
   - Visibility: **Public** (a private repo would need a token added to the
     Space as a secret — avoid that unless you need it)
3. Open the new repo → **Files** tab → **Add file** → **Upload files**.
4. Drag in `assets/model/Tomato_Model_Mobile.tflite` from this project.
5. **Commit changes to main.** The 141 MB upload takes a few minutes.

Your repo id is `<your-username>/tomato-leaf-doctor-model`. You need it in the
next step.

## Step 2 — Point the Dockerfile at that repo

Edit **`deploy/huggingface/Dockerfile`**, one line:

```dockerfile
ARG HF_MODEL_REPO=your-username/tomato-leaf-doctor-model
```

(It ships as `REPLACE_ME`; every script below refuses to proceed until you
change it, so this cannot be forgotten.)

## Step 3 — Assemble the Space folder

```
npm run space:prepare
```

This writes `.hf-space/`, containing the Dockerfile, requirements, README and a
copy of `server/app/`. Always use this rather than copying files by hand —
`server/app/` is the tested source of truth, and a hand-copied duplicate is how
a deployed server quietly drifts from it.

## Step 4 — Create the Space

1. **New** → **Space**.
   - Space name: `tomato-leaf-doctor`
   - License: your choice
   - SDK: **Docker** → **Blank**
   - Hardware: **CPU basic (free)**
   - Visibility: **Public**
2. Note the Space URL. It is your username and space name joined with a dash:

   ```
   https://<your-username>-tomato-leaf-doctor.hf.space
   ```

   That is the API host. The page you browse
   (`huggingface.co/spaces/<user>/<space>`) is not.

## Step 5 — Push the Space

The Space repo holds only small text files, so plain `git` is enough.

```bash
cd .hf-space
git init
git add -A
git commit -m "Tomato Leaf Doctor inference server"
git branch -M main
git remote add origin https://huggingface.co/spaces/<your-username>/tomato-leaf-doctor
git push -u origin main
```

Git asks for a username and password. The password is **not** your account
password — create an access token at
<https://huggingface.co/settings/tokens> with **write** permission and paste
that.

## Step 6 — Watch the build

Open the Space → **Logs**. The first build takes roughly 5–10 minutes, mostly
installing TensorFlow. Expected in the log:

```
Downloading Tomato_Model_Mobile.tflite from <your-repo> ...
Model in place: models/Tomato_Model_Mobile.tflite (140.7 MB)
startup check: TFLite model loaded.
```

The build **fails on purpose** if the model does not load. A Space that boots
"degraded" looks healthy until the first scan fails, so that failure is pulled
forward to the build.

If the log mentions unresolved ops or Select TF ops, change `tensorflow-cpu` to
`tensorflow` in `deploy/huggingface/requirements.txt`, re-run
`npm run space:prepare`, and push again.

## Step 7 — Put the URL in the app

Edit **`src/config/env.ts`**:

```ts
export const DEFAULT_REMOTE_API_URL = 'https://your-username-tomato-leaf-doctor.hf.space';
```

It is a committed constant, not an env var, because `.easignore` keeps `.env`
out of the EAS upload — a release APK sees no environment variables at all.

No trailing slash, and it must be `https`: Android blocks cleartext HTTP in
release builds.

## Step 8 — Verify before building anything

```
npm run verify:release
```

**This is the step that ends the build-install-fail cycle.** From this machine,
against the real deployed Space, it checks:

1. the URL is set and is https
2. `/health` returns 200 **and reports the model actually loaded** (a degraded
   server still answers 200, so "the Space is up" proves nothing)
3. the server's class order matches `src/config/classes.ts` exactly — a mismatch
   would mislabel every diagnosis
4. `/predict` with a real image returns all six classes as numbers summing to
   ~1.0 — the full contract `RemoteProvider` depends on

Only build once this prints `PASS`.

## Step 9 — Build the APK

```
git push origin main
```

```
$env:EXPO_TOKEN="<your-token>"; npx eas-cli build -p android --profile preview --non-interactive
```

The APK is now ~15 MB instead of ~180 MB, because the model no longer ships
inside it.

---

## Things worth knowing

**A free Space sleeps after a period of inactivity.** The first scan afterwards
can take up to a minute while the container starts. The app allows for this: the
request timeout is 90 s, it pings `/health` on launch to start the wake-up early,
and a timeout message explains that retrying usually works. Before showing the
app to anyone, open a scan once yourself to warm it up.

**`npm run verify:model` still fails, by design.** It reports that the model
cannot run on-device, which is the reason this server exists. It is not a
regression.

**If you later get a builtins-only model** (via
`tools/convert_tflite_builtins_only.py`, which needs the training code): drop it
into `assets/model/`, confirm `npm run verify:model` prints `PASS`, and set
`DEFAULT_INFERENCE_PROVIDER` back to `'tflite'` in `src/config/env.ts`. The app
then works fully offline and the server becomes optional again.
