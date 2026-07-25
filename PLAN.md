# PLAN.md — Tomato Leaf Doctor

**Status: approved (`PLAN_REVIEW_AND_MODEL_UPDATE.md`) and revised — `Tomato_Model_Mobile.tflite` (141 MB) arrived, was inspected offline, and on-device inference is now the primary path. Machine constraint: no package downloads without explicit permission (TensorFlow on this machine is broken by an old protobuf; the model was inspected with a pure-stdlib flatbuffer reader instead).**

This plan is based on what was actually found in this repo, `docs_model_README.md`, `Tomato_Updated_Code_Review.md`, `TRAINING_GUIDE.md`, `train_tomato_corrected.py`, and a full read of both sibling projects. Where reality differs from CLAUDE.md or KICKOFF.md, the difference is stated, not papered over.

---

## 1. What I actually found

### 1.1 This repo differs from the layout KICKOFF.md describes

| KICKOFF.md expects                                                                    | Reality                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/Tomato_Updated_Code_Review.md`, `docs/training_code.py`, `docs/model/README.md` | All docs sit at the **repo root**: `Tomato_Updated_Code_Review.md`, `train_tomato_corrected.py`, `docs_model_README.md`, `TRAINING_GUIDE.md`. The `docs/` folder exists but is **empty**. |
| `docs/Tomato_Project_Technical_Audit.md`                                              | **Absent.** Not in the repo anywhere.                                                                                                                                                     |
| `docs/Materials.docx` (thesis Ch 3 & 4)                                               | **Absent.**                                                                                                                                                                               |
| `git init` already run                                                                | **Not a git repository yet.**                                                                                                                                                             |

Proposed fixes (Phase 1): `git init` + `main` branch; move the four root docs into `docs/` (with `docs/model/README.md` from `docs_model_README.md`) so paths match every cross-reference inside the docs themselves. The two missing documents are listed under Open Questions — nothing in this plan depends on them, but the capture-protocol details and any treatment content in them would be used if provided.

### 1.2 The model situation (UPDATED — the on-device model arrived and was inspected)

- **`Tomato_Model_Mobile.tflite` (140.7 MB) now exists** and was inspected without TensorFlow via `tools/inspect_tflite_offline.py` (pure-stdlib FlatBuffer reader — the provided `inspect_tflite.py` needs a working interpreter, and installs are not permitted). Contract read directly from the file:
  - Input `[1, 224, 224, 3]` float32, unquantised → feed raw 0–255 floats, consistent with the training contract.
  - Output `[1, 6]` float32; the graph's **final operator is SOFTMAX** → outputs are probabilities, used directly, no app-side softmax.
  - `min_runtime_version` 2.12.0; **no embedded class names, labels file, or metadata bundle.**
  - **PENDING: a live numeric sanity inference** (dummy image, output sums to ~1) still requires a working interpreter — it runs on-device via the dev build, or locally if an install is ever permitted. The static checks cover shape/dtype/softmax placement.
- **`model_metadata.json` remains the authoritative class-order source** — still not provided (`labels.txt` also absent). `CLASS_ORDER_VERIFIED` stays `false` and the guard stays active: **a present model is not a verified class order.**
- **Preprocessing contract, read from `train_tomato_corrected.py` itself:** images are loaded with `keras.utils.load_img(..., target_size=(224, 224))` — a **plain resize** (aspect-distorting), raw RGB 0–255, no rescale; EfficientNetV2 normalises internally. Note: this **contradicts CLAUDE.md §6's "resize + centre-crop"** — see Open Question 2.
- Training evaluation uses 4-flip TTA (`USE_TTA = True`); metadata records it. The server will mirror TTA so deployed behaviour matches the reported numbers.
- Expected (UNVERIFIED) class order: `JAS_MIT, K, LM, MIT, N, N_K` — alphabetical, indices 0–5.
- Reliability rule from `docs_model_README.md`: any class with **< 15 test samples** carries the limited-data caveat. Per the support table that is **four** classes — JAS_MIT (~5), K (~5), N_K (~6), **and N (~7)**. CLAUDE.md §7 names only three; the data rule catches N too — see Open Question 3.

### 1.3 Eye Care (`Eye_Care-.../eye-care-app/mobile`) — verified findings

Expo SDK 54, RN 0.81.5, TypeScript `strict: true` (minimal tsconfig extending `expo/tsconfig.base`). Worth carrying: the `RootStackParamList` + `NativeStackScreenProps` typed-navigation convention; the typed axios client shape (module-level `axios.create`, generics on `get<T>`/`post<T>`); the explicit loading/error/retry early-return screen pattern (`QuestionScreen.tsx`). Confirmed absences, as CLAUDE.md claimed: no theme system, no shared components, no state library, no lint config, no tests, no CI. Cautionary finding: the API base URL is a **hardcoded LAN IP** in `src/config/api.ts` — exactly what our typed `env.ts` exists to prevent.

### 1.4 Apple Leaf Doctor — verified findings

The structural sibling is in good shape and most of its skeleton transfers directly:

**Reuse (structure/patterns/tooling):**

- `inference/` layer: `InferenceProvider` interface (`load/isReady/run/dispose`), factory switching on `env.inferenceProvider` with dev-only `MockProvider` (throws in production), `RemoteProvider`, `TFLiteProvider` behind dynamic imports; typed `InferenceError` with a string-literal code union and per-code user messages.
- `config/classes.ts` discipline: readonly tuple → union type, `CLASS_ORDER_VERIFIED: boolean` shipping `false`, a `classGuard` that makes real providers refuse to run until verified. This is exactly the §4 mechanism — it exists and works; I will carry it over.
- `config/env.ts`: single reader of `EXPO_PUBLIC_*`, validating, throwing on bad values; `.env.example` committed.
- `theme/`: `palette.ts` (raw primitives, only `theme.ts` may import) → `tokens.ts` (spacing/radii/type/hairline/shadow/minTouchTarget) → `theme.ts` (semantic roles, identical light/dark shapes) → `ThemeProvider` + `useTheme()`. Swap `palette.ts`, keep the machinery.
- `ErrorBoundary` (dev message / prod copy / reset), `loading | error | ready` unions, `useInference` hook with stale-run guards.
- Repository pattern: `ScanRepository` interface + `SqliteScanRepository` (WAL, `PRAGMA user_version`) + `InMemoryScanRepository` for tests, memoised factory with test override.
- Report pipeline: `expo-print` + `expo-sharing`, HTML builder separated from the export hook.
- Tooling wholesale: ESLint 9 flat config (`eslint-config-expo/flat` + prettier last), Prettier config, Husky pre-commit (`typecheck && lint-staged && test`), lint-staged, jest-expo + RNTL, GitHub Actions CI (Node 22, `npm ci` → typecheck → lint → `test --ci`), tsconfig with `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `@/* → src/*` alias, `eas.json` (development/preview/production profiles, no build triggered).

**Do NOT copy (detection-specific):** `DetectionImage.tsx`, `overlayGeometry.ts`, `decode/yolo.ts`, `geometry/letterbox.ts`, `geometry/nms.ts`, `preprocess/pixels.ts` letterbox packing, `BoundingBox`/`Detection` types, `diagnosis.ts` multi-detection summarisation, the `[1,N,6]` tensor validation in `TFLiteProvider`. Our result type is a ranked probability vector; our TFLite output validation is `[1, 6]`.

**Stack deltas — the sibling does not match CLAUDE.md §6 on four points:**

| CLAUDE.md §6 mandates      | Apple sibling actually uses    | This plan                                                       |
| -------------------------- | ------------------------------ | --------------------------------------------------------------- |
| react-native-vision-camera | **expo-camera**                | Open Question 1 — recommendation: expo-camera                   |
| Axios                      | **fetch**                      | Follow CLAUDE.md: axios, typed client (Eye Care pattern)        |
| expo-image-manipulator     | jpeg-js + custom pixel packing | Follow CLAUDE.md: expo-image-manipulator (fits the remote path) |
| Firebase Auth              | (no auth at all)               | Follow CLAUDE.md: Firebase JS SDK, email + anonymous            |

Also noteworthy: the Apple app's `app.json` references **no icon/splash assets at all** — the "shipped without a logo" failure is real and visible. §10 is treated as a deliverable with verification here.

---

## 2. Architecture

Folder layout per CLAUDE.md §8, with the sibling's proven internals. Key contracts:

### 2.1 Inference types (classification, no boxes)

```ts
// inference/types.ts
interface ClassScore {
  classCode: ClassCode;
  probability: number;
} // 0..1
interface Classification {
  scores: readonly ClassScore[]; // ALL six, sorted desc — full vector, always
  top: ClassScore;
  lowConfidence: boolean; // top.probability < thresholds.lowConfidence
  provider: 'mock' | 'remote' | 'tflite';
  modelVersion: string | null;
  durationMs: number;
}
```

`InferenceError` codes (each with its own user-readable message, §9): `no-network`, `server-unreachable`, `server-error`, `image-unreadable`, `model-not-loaded`, `class-order-unverified`, `mock-in-production`, `timeout`, `invalid-response`.

### 2.2 `config/classes.ts` — single source of truth

- `CLASS_CODES` readonly tuple in the expected (alphabetical) order, `ClassCode` union derived from it.
- Per-class record: display name, category (`insect-pest` | `nutrient-deficiency`), description, `testSupport` (from the metadata when it lands; the expected counts until then), `limitedData` derived by the `< 15` rule.
- `CLASS_ORDER_VERIFIED = false` + a runtime guard: `RemoteProvider` and `TFLiteProvider` throw `class-order-unverified` before any network/model call. `MockProvider` is exempt (it never maps indices from a real model). When the metadata lands, this one file changes and the flag flips. Screens import names/categories only from here.

### 2.3 `config/thresholds.ts`

`lowConfidence = 0.60`. Display bands: High ≥ 0.80, Medium 0.60–0.79, Low < 0.60. Confidence displays as a whole percentage or band label — never a decimal place.

### 2.4 Providers

Priority revised by the review: **on-device is primary, remote is a dev/debug fallback.**

- **TFLiteProvider — PRIMARY.** react-native-fast-tflite, wired to the inspected contract exactly: `[1, 224, 224, 3]` float32 raw 0–255 in, `[1, 6]` probabilities out (softmax verified in-graph); output tensor shape validated at load, `model-not-loaded` on any mismatch. Refuses to run while the class order is unverified. On-device TTA defaults to a single pass (4-flip TTA would quadruple latency on a 141 MB model); a config flag keeps it revisitable when `model_metadata.json` lands.
- **RemoteProvider — dev/debug fallback** behind config. Axios, multipart upload to `/predict`, timeout + one retry on network failure, maps the response **by class name, not index**, validates the name set against `config/classes.ts`, carries `model_version` through. Refuses to run while unverified.
- **MockProvider** — deterministic (hash of image URI → scenario), covers every scenario the UI must handle: each of the six classes as top, a low-confidence result, a near-tie between N/K/N_K (the realistic confusion case), and each error code. Throws if `!__DEV__`.

### 2.5 FastAPI server (`server/`) — demoted to optional dev/debug path

No longer the production inference path (on-device is primary). Still built, to the same standard, for debugging and server-side use:

- `GET /health` → `{ status, model_loaded, model_version, class_order }`.
- `POST /predict` (image upload) → full probability vector keyed **by class name**, top class, model version, inference time. Never just the winner.
- Preprocessing matches training exactly: plain resize to 224×224, raw RGB 0–255, no rescale. Mirrors 4-flip TTA when `model_metadata.json` says `tta: true`.
- Loads `Tomato_Model_Deploy.keras` + `model_metadata.json` from `server/models/` (gitignored). **No stub predictions, ever:** with no model present the server starts in an explicit degraded mode — `/health` reports `model_loaded: false`, `/predict` returns a typed 503. The app's `server-error`/`model-not-loaded` paths render this honestly. RemoteProvider's unit tests mock HTTP; nothing fabricates a classification.
- Dockerfile, `requirements.txt`, README. KICKOFF's "works against a stub model" is deliberately **not** followed — a stub that returns predictions is exactly the fabrication §7 bans; degraded mode tests the same integration paths without lying.

### 2.6 Persistence

`db/` with a `user_version`-keyed migration runner (the sibling only stamps the version; a real runner is small and prevents pain later). `scans` table: id, created_at, image_path, top_class, category, full probability vector (JSON), confidence, low_confidence flag, provider, model_version, class_order_verified-at-scan-time.

**Offline story, upgraded by on-device inference:** scanning, history, library, and reports all work with no connectivity — that is the point of the app. The network is needed only for Firebase Auth and the optional remote fallback, and **auth is not on the critical path to scanning** (anonymous/skip lets a user scan offline; auth gates account features, not diagnosis).

---

## 3. Visual identity — verified, not assumed

All contrast ratios below were **computed** (WCAG relative luminance). AA requires 4.5 for body text, 3.0 for large text/UI components.

### 3.1 Light theme

| Token                | Hex       | Verified contrast                                    |
| -------------------- | --------- | ---------------------------------------------------- |
| Surface              | `#FAF6F1` | —                                                    |
| Surface raised       | `#FFFFFF` | —                                                    |
| Ink                  | `#2A211C` | 14.64 on surface ✓                                   |
| Ink muted            | `#6B5F58` | 5.74 on surface ✓                                    |
| Border               | `#E8DED4` | decorative hairline                                  |
| Primary (terracotta) | `#A94F2C` | 5.08 as text on surface ✓; white on it 5.47 ✓        |
| Primary dark         | `#7A3419` | white on it 9.00 ✓; on tint 7.19 ✓                   |
| Primary tint         | `#F2E3DA` | chip/selected background                             |
| Accent sage          | `#6B7A5A` | 4.28 — **fails body-text AA**; icons/large text only |
| Accent sage text     | `#57644A` | 5.87 ✓ (text-grade variant)                          |
| Success              | `#2E7D5B` | 4.65 ✓                                               |
| Warning              | `#B8860B` | 3.02 — icons/large only                              |
| Warning text         | `#8A6508` | 4.95 ✓                                               |
| Error                | `#BE2745` | 5.47 on surface ✓; white on it 5.89 ✓                |

**The error red was changed from the starting `#D32F2F`, exactly as §11 anticipated.** Measured, `#D32F2F` is in the same orange-red family as the terracotta primary (weighted RGB distance 95 — marginal). `#BE2745` is a cooler crimson: same distance numerically but hue-shifted toward pink, out of terracotta's orange-brown family, and higher-contrast (5.47 vs 4.63). Additionally, **every semantic state pairs an icon and a text label with the colour** — colour is never the only signal.

### 3.2 Dark theme (day one, same token shape)

| Token          | Hex       | Verified contrast                                                                                                                                                   |
| -------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Surface        | `#201914` | warm near-black                                                                                                                                                     |
| Surface raised | `#2B221C` | —                                                                                                                                                                   |
| Ink            | `#F0E9E2` | 14.42 ✓                                                                                                                                                             |
| Ink muted      | `#C4B8AE` | 8.93 ✓                                                                                                                                                              |
| Primary        | `#D97B52` | 5.70 as text ✓; dark ink on it 5.70 ✓ (buttons use dark text)                                                                                                       |
| Error          | `#F2708A` | 6.16 ✓; distance 94 from dark primary — the naive lightened red (`#EF6B5E`) was distance **52** from the lightened terracotta, verified too close, and was rejected |
| Success        | `#5FB78E` | 7.15 ✓                                                                                                                                                              |
| Warning        | `#D9A63A` | 7.82 ✓                                                                                                                                                              |
| Sage           | `#93A47F` | 6.49 ✓                                                                                                                                                              |

### 3.3 Distinct from the siblings — justification

Apple Leaf Doctor's palette is agricultural greens with amber/soil accents; Eye Care is medical blue. Here green is demoted entirely: the primary is a burnt-orange terracotta (hue ≈ 22°, brown-orange family), surfaces are warm sand rather than cool neutrals, and sage appears only as a secondary accent, never as the primary of any control. Success green (`#2E7D5B`) is a cool blue-leaning green deliberately distant from the apple app's warm agricultural green. Same structural discipline as the siblings (hairlines, 4/8 spacing, one type scale) so the family resemblance comes from structure, not hue.

### 3.4 Logo concept

**A single serrated tomato-leaflet silhouette inside a focus reticle** — four viewfinder corner brackets framing the leaf, single-weight stroke, one colour. It says "leaf under inspection" in one glance, ties directly to the framing overlay on the camera screen (the brand mark _is_ the capture UI), and reduces cleanly: at 48px the corner brackets and leaf outline survive; detail like leaf veins appears only at large sizes. Terracotta mark on sand; sand-on-terracotta reversed variant for dark contexts. Authored as `assets/logo.svg` first; `icon.png` (1024), `adaptive-icon.png` (1024, artwork inside the centre 66%), `splash.png` (1284×2778), `favicon.png` (48) exported from it; every `app.json` path verified to resolve as a phase gate. Explicitly not a tomato fruit.

`assets/capture-reference.png` (the §5 worked example) will be a clean vector-drawn illustration of the protocol — single leaf, dark textured surface, top-down framing — clearly an illustration, not a fake photo. A real protocol-compliant photograph from the researcher would be better; requested in Open Questions.

---

## 4. Phases

Every phase gate: `npm run typecheck` (0 errors), `npm run lint` (0 warnings), `npm test` green; loading/error/success states on every screen touched; every referenced asset path resolves; committed on `feat/phase-N-*` with conventional commits. Device verification is deferred to EAS and tracked as pending — never marked done.

**Phase 1 — Repo + scaffold.** `git init`, `main`, move docs into `docs/` (`chore:`). `create-expo-app` (TS template, SDK 54), strict tsconfig + `noUncheckedIndexedAccess` + `@/*` alias, ESLint 9 flat + Prettier, Husky + lint-staged (pre-commit: typecheck + lint + staged tests), jest-expo + RNTL, GitHub Actions CI, `eas.json` (configure only), `.env.example` + typed `env.ts`. All checks green on the skeleton.

**Phase 2 — Brand + design system.** `logo.svg` → all §10 raster exports, wired in `app.json`, every path verified by a script/test. `theme/` (palette/tokens/theme/ThemeProvider, light + dark) with the §3 verified values; contrast assertions encoded in a unit test so regressions fail CI. Base components: Screen, Text, Button, Card, Badge, CategoryPill, ConfidenceBar (band-labelled), LoadingState, ErrorState, EmptyState. Dev-only ComponentGallery rendering every component in every state, both themes.

**Phase 3 — Navigation + shell.** Typed `RootStackParamList`; native-stack; root ErrorBoundary; screen shells: Home → CaptureGuide → Camera → ConfirmPhoto → Results, plus History, ScanDetail, Library, DiseaseDetail, Settings, Auth. Zustand stores (settings, scan session). Deep-link scheme.

**Phase 4 — Inference layer (on-device first).** The recorded inspection contract (§1.2) is the spec. Everything in §2.1–2.4 with tests: TFLiteProvider wired to `[1,224,224,3]` float32 → `[1,6]` probabilities with load-time shape validation; top-3 ranking; low-confidence branching; name-based remote response mapping; the unverified-order guard actually blocking **both** real providers; mock-in-production throw; every error code has a distinct message. Decode/ranking logic is pure TS, tested under Node; the live on-device pass is EAS-deferred and tracked as pending.

**Phase 5 — FastAPI server (optional dev/debug path).** §2.5, same standard, no longer primary. Degraded mode without a model; preprocessing unit-tested against the training contract (plain resize, 0–255); pytest in CI (separate job).

**Phase 6 — Capture flow.** CaptureGuide (protocol steps, reference image, "why does this matter?"); Camera via **expo-camera** (decided, review Q1) with framing overlay and the three permission paths (not-asked / denied / blocked→settings deep-link); gallery import; ConfirmPhoto with retake; expo-image-manipulator preprocessing (plain resize, review Q2); inference through the interface with explicit loading/error states.

**Phase 7 — Results.** Category banner first (pesticide-vs-fertiliser class of intervention), specific class + band second, top-3 probability bars always, low-confidence first-class state ("Uncertain — consult an agricultural extension officer", top-3 framed as possibilities), limited-data caveat for the four `< 15`-support classes, persistent no-healthy-class note, treatment guidance content (Open Question 5), zero accuracy claims anywhere — enforced by a lint-style test greping the app for accuracy-claim patterns.

**Phase 8 — Persistence, library, reports.** §2.6 DB; History list/detail/delete; Disease Library for all six classes; PDF export via expo-print/expo-sharing (report carries the same honesty rules: bands, top-3, caveats, no accuracy claims); all of it offline.

**Phase 9 — Auth + hardening.** Firebase Auth (email + anonymous, JS SDK, AsyncStorage persistence); airplane-mode pass (history/library/reports work; scanning explains and offers retry); README; EAS development build **when instructed** — device verification tracked as pending until then.

**When the model lands** (KICKOFF Part 3): read `class_order` from `model_metadata.json`, update `config/classes.ts` only, flip the flag, load the model into `server/models/`, switch the factory to remote, run the held-out verification set, update reliability notes from real support counts, report actual numbers unsmoothed.

---

## 5. Open questions — Q1–Q8 resolved by the review; current open items below

All eight original questions were answered in `PLAN_REVIEW_AND_MODEL_UPDATE.md` §3:

- **Q1 Camera:** **expo-camera** (overrides CLAUDE.md §6; §6 corrected in a `docs:` commit).
- **Q2 Preprocessing:** **plain resize to 224×224**, matching the training script; the CLAUDE.md centre-crop line was wrong and is corrected. Camera overlay encourages square framing.
- **Q3 Rare-class caveats:** driven by the `< 15 test samples` config rule (currently four classes: JAS_MIT, K, N_K, N); recomputed from `test_support_per_class` when the real metadata lands.
- **Q4 Missing documents:** not blocking; supplied later if their detail matters.
- **Q5 Treatment content:** approved middle path — real, conservative, general guidance per class with a visible "general, pending local agronomist review" scope line; **no chemical dosages** until an agronomist signs off.
- **Q6 Firebase:** build complete against `EXPO_PUBLIC_FIREBASE_*` env vars; values later; **auth never gates scanning** (anonymous/skip; offline scanning must work).
- **Q7 capture-reference:** vector illustration ships now (honest, clearly drawn); a real protocol photo remains requested; never a fabricated photo.
- **Q8 Server hosting:** env-driven, even less urgent now that remote is a fallback.

**Currently open:**

1. **Class-order source (blocking real inference only):** `model_metadata.json` or `labels.txt` for `Tomato_Model_Mobile.tflite`. The `.tflite` carries no class names (verified). Until one arrives, `CLASS_ORDER_VERIFIED` stays `false`, real providers refuse to run, and all UI work proceeds against MockProvider.
2. **Live model sanity inference:** pending a working interpreter (local TF is broken by an old protobuf and installs are not permitted) — will be verified on-device via the EAS dev build, and tracked as pending until then.
3. **npm downloads for Phase 1:** scaffolding the Expo app (`create-expo-app`, `npm install`) necessarily downloads packages. Given the explicit no-download instruction, Phase 1 waits for a go-ahead on npm installs specifically. Everything download-free (git init, docs restructure, this plan revision, CLAUDE.md correction) is done.

**Assumptions I am proceeding on:** Expo SDK 54 / RN 0.81 (both siblings); Node + npm available and sufficient (no JDK/Android SDK — device builds via EAS only, on instruction); the expected alphabetical class order is used for the mock and the config _shape_ only, never for real inference (the guard enforces this); accuracy fields in the future metadata are engineering reference only and never rendered.
