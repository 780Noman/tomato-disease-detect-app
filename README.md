# Tomato Leaf Doctor

A React Native (Expo) app that diagnoses tomato leaf **pests** and **nutrient deficiencies** from a
photo of a single detached leaf, for farmers and agricultural extension workers.

Diagnosis runs **on-device**, so scanning works with no connection.

---

## Status

| Area                            | State                                                                                        |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| App (screens, capture, results) | Built                                                                                        |
| Offline history, library, PDF   | Built                                                                                        |
| Inference abstraction           | Built — mock / on-device TFLite / remote                                                     |
| **Class order**                 | **Verified** — confirmed against sorted dataset folder names                                 |
| **Real inference**              | Unblocked; on-device is the default provider. Needs the model packaged at the EAS build step |
| Optional accounts (Firebase)    | Built; needs a project's `EXPO_PUBLIC_FIREBASE_*` values                                     |
| FastAPI debug server            | Built (optional; the on-device path is primary) — see `server/README.md`                     |
| Device verification             | **Pending** — deferred to an EAS development build                                           |

### The model and its class order

`Tomato_Model_Mobile.tflite` (141 MB). Its input/output contract was read from the file itself
(`tools/inspect_tflite_offline.py`):

```
input  [1, 224, 224, 3] float32, raw 0-255 (no normalisation)
output [1, 6]           float32, softmax inside the graph
```

**Class index order — verified.** A `.tflite` carries no class names, but the order is fully
determined by the training code: `sorted(df['label'].unique())`, and Keras assigns indices in that
alphabetical order. Confirmed empirically against the dataset's class folder names:

```
0: tomato__JAS_MIT   1: tomato__K   2: tomato__LM
3: tomato__MIT       4: tomato__N   5: tomato__N_K
```

`CLASS_ORDER_VERIFIED` in `src/config/classes.ts` is `true`, and the on-device provider is the
default. The guard that blocks real providers on an unverified order is still live and still tested
in both directions — it has not become dead code.

**What remains:** the model has to be packaged into a build before on-device inference can actually
run (`MODEL_SOURCE` in `src/inference/modelConfig.ts`, decided at the EAS build step). Until then
the app fails loudly with "the on-device model is not available on this build" — it never
substitutes a fake result. Use `EXPO_PUBLIC_INFERENCE_PROVIDER=mock` to work on the UI meanwhile.

**Separately: model accuracy is not settled.** The class order being right means the app names the
correct condition for each output index. It says nothing about how good the predictions are — the
`.tflite` may come from the pipeline audited in `docs/Tomato_Updated_Code_Review.md`. That is a
research-side matter, and it is exactly why the honesty rules below are non-negotiable.

---

## Requirements

- Node 22+ and npm
- **No JDK or Android SDK is needed locally** — device builds go through EAS Build (cloud)

## Setup

```bash
npm install
cp .env.example .env    # defaults are fine for development
npm start
```

`.env` is gitignored. The committed `.env.example` sets `mock` so the UI is workable before the
model is packaged; with no `.env` at all the app defaults to the real on-device provider.

### Environment variables

| Variable                         | Purpose                                                                |
| -------------------------------- | ---------------------------------------------------------------------- |
| `EXPO_PUBLIC_INFERENCE_PROVIDER` | `tflite` (on-device, **default**), `mock` (dev only), `remote` (debug) |
| `EXPO_PUBLIC_REMOTE_API_URL`     | Required only for `remote`                                             |
| `EXPO_PUBLIC_FIREBASE_*`         | Optional accounts — all four together, or none                         |

## Checks

```bash
npm run typecheck   # tsc --noEmit, zero errors
npm run lint        # eslint, zero warnings
npm test            # jest
```

The pre-commit hook runs all three. CI runs them on every push and pull request, plus the server's
pytest suite in a separate job.

The optional debug server has its own venv-isolated setup and tests — `cd server` and see
`server/README.md`. Python packages are installed **only** inside `server/.venv`, never globally.

## Device build (when asked)

```bash
npx eas build --profile development --platform android
```

`eas.json` is configured with `development`, `preview` and `production` profiles. No build has been
triggered yet. Two things get resolved at this step: the live model sanity check, and how the
141 MB model is packaged (bundled asset vs first-run download) — `MODEL_SOURCE` in
`src/inference/modelConfig.ts` is deliberately unset until that decision is made.

---

## The capture protocol is not optional

Every training image is a **single detached leaf, laid flat on a dark surface, photographed from
directly above under even lighting**. The model has never seen anything else. A photo of a leaf
still on the plant, in sunlight, against soil, is outside the training distribution — the model
will still return a confident-looking answer, and it will be meaningless.

The app therefore guides capture rather than just accepting it: a protocol guide with a worked
reference illustration, a framing overlay on the camera, and a confirm/retake step.

## Honest UI rules (enforced by tests)

- **No accuracy claim anywhere.** `src/honestUi.test.ts` fails CI if accuracy language reaches a UI
  file, and `reportHtml.test.ts` does the same for the PDF.
- **Top-3 predictions always shown**, because Nitrogen, Potassium and combined N+K deficiency look
  alike and a single label hides real ambiguity.
- **Low confidence is a first-class result** (below 0.60): "Uncertain — consult an agricultural
  extension officer", with the ranked list reframed as possibilities.
- **Limited-data caveat** on any class with fewer than 15 test images (currently four of six).
- **No healthy class exists.** A healthy leaf still receives one of the six labels; the results
  screen and the PDF both say so.
- **Confidence is rounded to whole percentages** — `87%`, never `87.3%`.
- **Nothing is ever fabricated.** A malformed model output raises a typed error instead of becoming
  a diagnosis.

## Offline behaviour

Works with no connection: scanning (on-device), history, the disease library, and PDF reports.
Needs a connection: optional account sign-in, and the `remote` debug provider.

**Accounts never gate scanning** — a user with no network and no account can scan, read a
diagnosis, and browse history. `src/features/auth/authNotBlocking.test.tsx` enforces this.

## Treatment guidance scope

The library gives real, conservative, general guidance: symptom descriptions and cultural controls.
It deliberately contains **no chemical product names and no dosages** pending agronomist sign-off,
and escalates treatment decisions to a local agricultural extension officer. A test fails if a
dosage or product name appears.

---

## Layout

```
src/
  app/          navigation, providers, error boundary
  components/   presentational, themed, no business logic
  config/       classes.ts (SINGLE SOURCE OF TRUTH), thresholds, env
  db/           migrations
  features/     auth/ connectivity/ history/ library/ report/ scan/ settings/
  inference/    types, provider interface, providers/, preprocess/, factory
  screens/      one folder per screen
  theme/        palette -> tokens -> theme -> provider
tools/          tflite inspection, asset generation
docs/           model status, training script, technical review
```

Architectural rules worth knowing before changing code: screens never import a provider (they use
the interface); no class string is hardcoded outside `config/classes.ts`; every async operation has
loading, error and success states rendered in the UI. The full contract is in `CLAUDE.md`.
