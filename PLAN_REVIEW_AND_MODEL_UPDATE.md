# PLAN Review — Approved, with Model Integration Update

Read this fully before resuming. The plan is approved. One major thing changed since you wrote it, and your eight open questions are answered below.

---

## 1. The plan is approved

This is strong work. Specifically what was right:

- Computing the contrast ratios instead of assuming them, and rejecting `#D32F2F` and the naive lightened dark-mode red with measured distances — correct and exactly the §11 discipline.
- Catching the preprocessing contradiction by reading the training script, and choosing to match the script (plain resize). Correct.
- Refusing the "stub model" instruction and proposing degraded mode instead. You were right and the instruction was wrong — a stub that returns predictions is fabrication. Degraded mode is the correct design. Keep it.
- Cataloguing the detection-specific files not to copy. Correct — this is classification.
- Driving the rare-class caveat from the data rule rather than the three classes named in prose.

Proceed on all of the above.

---

## 2. MAJOR CHANGE: the model now exists — 141 MB TFLite

Your plan assumed no deployable model and a server-first path with `TFLiteProvider` disabled. That assumption is now outdated.

A **141 MB `.tflite`** model has arrived. This changes the primary architecture:

| Your plan assumed | Now true |
|---|---|
| Model pending; ~294 MB `.keras` if it came | 141 MB `.tflite`, ready |
| Primary path: `RemoteProvider` (FastAPI) | **Primary path: `TFLiteProvider` (on-device)** |
| Offline scanning: not possible | **Offline scanning: the whole point, now achievable** |
| FastAPI server: required | **FastAPI server: now optional / dev-and-debug only** |

141 MB is large for an app but shippable, and on-device inference means farmers can scan with no connectivity — which was the actual requirement. **The on-device path becomes primary. The remote path stays as a debugging fallback.**

### Do NOT wire it blind

A `.tflite` file is a black box. If the input shape, normalisation, output shape, or class order is assumed wrong, the app shows a confident **wrong** diagnosis on every scan and never errors. Before writing a line of `TFLiteProvider` inference code, the model must be inspected.

An inspection script is provided: `inspect_tflite.py`. It reads directly from the file:
- input shape + dtype + quantisation params
- output shape + dtype + whether softmax is inside the graph or must be applied in-app
- a sanity inference (does it run, does it sum to 1)
- everything `config/classes.ts` and `TFLiteProvider` need

**Run it (or have the user run it) first, and drive the provider from its output — not from assumptions.** The three things most likely to bite:

1. **Quantisation.** If the model is int8/uint8 quantised, the input is not raw float 0-255 and the output must be dequantised with the scale/zero-point the script prints. A 141 MB size suggests float16 (roughly half of the 294 MB float32), which usually means float input — but confirm, do not infer.

2. **Softmax placement.** If the output does not sum to ~1, the final softmax is outside the TFLite graph and the app must apply it. The script reports this.

3. **Class order.** The `.tflite` file does not contain class names. The order MUST come from `model_metadata.json` (`class_order`) or a `labels.txt` shipped with it. Until that is confirmed, `CLASS_ORDER_VERIFIED` stays `false` and the guard stays active — even though a model now exists. **A present model does not mean a verified class order.** Ask the user for `model_metadata.json` or `labels.txt`; do not proceed to real inference on the expected alphabetical order alone.

### Revised provider priority

- `TFLiteProvider` — **primary**, on-device, offline. Wire it to the inspected contract exactly.
- `RemoteProvider` — keep it, demote it to a dev/debug fallback behind config. The FastAPI server (Phase 5) is still worth building for debugging and for anyone who wants server-side, but it is no longer the primary path.
- `MockProvider` — unchanged, dev only.

This mostly moves work you had in Phase 5 earlier: the TFLite wiring becomes part of Phase 4, and the model inspection is its first step.

### Offline changes for the better

Your §2.6 said "scanning offline queues nothing silently — it explains that inference needs the network and offers retry." With on-device inference, **scanning now works fully offline too.** Update the offline story: the only thing needing the network becomes Firebase Auth and (if used) the remote fallback. Scanning, history, library, reports — all offline. This is a stronger app; reflect it.

---

## 3. Answers to your eight open questions

**Q1 — Camera: expo-camera or vision-camera?**
Go with **expo-camera**, your recommendation. It is sibling-proven, simpler, one fewer native dependency, and for guided single-still capture it is entirely sufficient. This overrides CLAUDE.md §6. Update §6 in a `docs:` commit noting the decision and why.

**Q2 — Preprocessing: plain resize or centre-crop?**
**Plain resize to 224×224**, matching the training script exactly. You read the code correctly; the CLAUDE.md "centre-crop" line was wrong. The app's preprocessing must match training or the model sees a distribution it was not trained on. Encourage square framing in the camera overlay to keep distortion small. Correct the CLAUDE.md §6 line in the same `docs:` commit.

**Q3 — Rare-class caveat set (3 vs 4 classes)?**
**Drive it from the data rule.** The `< 15 test samples` threshold is the honest criterion, and it flags four classes (JAS_MIT, K, N_K, and N). The three-class figure in §7 prose was illustrative. When the real `model_metadata.json` lands, recompute from its actual `test_support_per_class` — the count may shift again, and the config rule should be the single source.

**Q4 — Missing documents.**
Not blocking. `Tomato_Project_Technical_Audit.md` is background on why the earlier pipeline was rejected; `Materials.docx` is the thesis chapters. Neither changes the app. Proceed without them; they will be supplied if their capture-protocol or treatment detail turns out to matter.

**Q5 — Treatment content vs the no-placeholder rule.**
Your middle path is **approved**: write real, conservative, general per-class guidance (cultural controls, symptom description, and a clear "consult a local agricultural extension officer for chemical treatment and dosage" escalation), in one content file, with a visible in-app line that the guidance is general and pending local agronomist review. This is not a placeholder — it is real, safe, general content with an honest scope limit. Keep chemical/pesticide dosages out entirely until an agronomist signs off; a wrong dosage has real consequences.

**Q6 — Firebase credentials.**
Build the feature complete against `EXPO_PUBLIC_FIREBASE_*` env vars, documented in `.env.example`. The values come later. One addition: since scanning is now fully offline, make sure **auth is not on the critical path to scanning** — anonymous sign-in or a skip option must let a user scan without a network. Auth gates history-sync or account features, not the core diagnosis.

**Q7 — capture-reference image.**
Ship the vector illustration for now. A real protocol-compliant photo from the dataset team would be better and is still requested — but do not block on it, and do not fabricate a photo. A clearly-drawn illustration is honest; a fake photo is not.

**Q8 — Server hosting.**
Leave it env-driven (`EXPO_PUBLIC_REMOTE_API_URL`). Since remote is now a fallback rather than the primary path, hosting is even less urgent. Local uvicorn/Docker for dev is fine.

---

## 4. Small correction to your plan

Your Phase 5 (FastAPI) and Phase 4 (inference) ordering assumed remote-primary. Re-sequence so the **on-device path is built and verified first**:

- **Phase 4** now includes: run `inspect_tflite.py`, record the contract, then implement `TFLiteProvider` against it with tests, plus the mock and the (now-fallback) remote client.
- **Phase 5** (FastAPI) stays, but framed as the optional debug/server path. Still build it to the same standard; just not the primary.

Everything else in your phase plan stands.

---

## 5. What to do now

1. Ask the user for `model_metadata.json` or `labels.txt` (the class order source) and the `.tflite` file's location. Until the class order is confirmed from one of those, `CLASS_ORDER_VERIFIED` stays `false`.
2. Run `inspect_tflite.py` against the model. Record the input/output contract.
3. Update `PLAN.md`: on-device primary, the inspected model contract, the offline-scanning change, and the Q1-Q8 resolutions above.
4. Update CLAUDE.md §6 (`docs:` commit): expo-camera, plain resize.
5. Then begin Phase 1.

Show the updated `PLAN.md` and the inspection output, then proceed to Phase 1. You do not need to stop again after this unless something material changes or an assumption fails.
