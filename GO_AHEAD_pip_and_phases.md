# Go-ahead: pip policy, phase continuation, model wiring

Excellent work through Phase 7 — fourteen gated commits, 159 tests green, and the whole model inspection done without a single download by writing a standard-library FlatBuffer reader. Keeping `CLASS_ORDER_VERIFIED = false` and having both real providers refuse to run until the class order is confirmed was exactly right. Do not relax that guard until the class order is supplied.

Here are answers to your three questions and the plan from here.

---

## 1. pip policy — approved, but scoped and isolated

You may install what is genuinely needed to run things locally. The concern was never "never install anything" — it was "don't waste storage on things we don't need." Those are different.

**Rule: use a virtual environment, and only for the server.** Nothing global.

```bash
cd server
python -m venv .venv
# Windows:
.venv\Scripts\activate
pip install -r requirements.txt
```

- `.venv/` goes in `.gitignore` (confirm it is).
- `requirements.txt` pins exact versions.
- **Do not install TensorFlow into the app/JS side.** The app runs the model through `react-native-fast-tflite` on-device; it never needs Python TF. TF belongs only in the server, and only if the server actually loads the `.keras`/`.tflite` for the debug path.
- The protobuf upgrade to fix the broken TensorFlow: only do it **inside the server venv**, and only if the server path actually needs a live TF sanity check. If the on-device path is primary and working, the server is a debug convenience — do not spend effort fixing global TF for it.

So: `fastapi`, `uvicorn`, `pytest`, and their deps — yes, inside `server/.venv`. Global installs — no.

---

## 2. The one blocker: class order

This is the single thing preventing real inference. Everything else is built and waiting on it.

The class order must come from the training artefacts, not a guess:

- **`model_metadata.json`** — the `class_order` array. This is the authoritative source. The corrected training script writes it.
- or **`labels.txt`** — if one was exported alongside the `.tflite`.

The user is being asked for this now. When it arrives:

1. Read the class order from the file. Do not read it from any notebook variable or Python list.
2. Update `src/config/classes.ts` with the exact order and flip `CLASS_ORDER_VERIFIED` to `true`. That is the only file that changes for the class order.
3. Update `testSupport` per class from the metadata's `test_support_per_class` if present, so the limited-data caveats reflect the real support counts.
4. Keep the `< 15 samples` reliability rule driving the caveats.

**Until that file arrives, do not enable a real provider and do not hardcode the expected alphabetical order as verified.** The expected order is a reasonable guess, but a wrong guess means a confident wrong diagnosis on every scan. The guard exists precisely for this. Leave it.

If the file genuinely cannot be produced, the fallback is a live labelled-image check: run several images of _known_ class through the model and confirm which output index lights up for each. That empirically recovers the order. But the metadata file is faster and definitive — try that first.

---

## 3. Continue: Phases 8 and 9

Proceed on this go-ahead. No need to stop between them unless an assumption fails.

- **Phase 8** — offline history/library/PDF. npm only, no new Python. Go.
- **Phase 9** — auth + hardening. Firebase against `EXPO_PUBLIC_FIREBASE_*` env vars (values come later). Critical point, restated because it matters now that inference is on-device: **auth must not be on the critical path to scanning.** A user with no network and no account must still be able to scan, get a diagnosis, and see history. Anonymous sign-in or a skip path. Auth gates account/sync features only.

- **Phase 5 (FastAPI)** — now genuinely optional. The on-device TFLite path is primary and works offline, which was the whole goal. Build the server only as a debug/inspection convenience, in its own venv per section 1. If time is tight, it is the most deferrable phase. Do not fix global TensorFlow for it.

---

## 4. Process notes — accepted

- The branch-naming drift on phases 3-7 (one branch instead of per-phase) is fine since the commits are cleanly separated per phase. Per-phase branches from Phase 8 on, as you said.
- The live sanity inference being deferred to a device build is correctly tracked as pending, not faked. Good. It gets resolved at the EAS build step along with the class-order verification.

---

## 5. What to do now

1. Continue with Phase 8 (npm only — no blocker).
2. The moment `model_metadata.json` or `labels.txt` arrives: do the class-order wiring in section 2, flip the flag, and report the verified order back.
3. Phase 5 server only if you reach it with time to spare — venv-isolated, per section 1.

You do not need to pause again for approval unless an assumption fails or something material changes. Keep every phase green through the pre-commit gate as you have been.
