# Claude Code — Kickoff Prompt & Roadmap

## Tomato Leaf Doctor

---

## PART 0 — DIRECTORY SETUP (before opening Claude Code)

In `C:\Projects`:

```
C:\Projects\
├── Eye_Care-Eye_Disease_Prediction_App\    <- existing, read-only reference
├── apple-leaf-doctor\                      <- existing, read-only reference
│
└── tomato-leaf-doctor\                     <- CREATE THIS
    ├── CLAUDE.md                           <- paste CLAUDE.md here
    ├── KICKOFF.md                          <- paste THIS file here
    └── docs\
        ├── Tomato_Updated_Code_Review.md   <- the model audit
        ├── Tomato_Project_Technical_Audit.md
        ├── Materials.docx                  <- thesis Ch 3 & 4
        ├── training_code.py                <- the FINAL PRO CODE script
        └── model\
            └── README.md                   <- note: model pending, see below
```

Create `docs/model/README.md` with this content so Claude Code knows the state:

```
MODEL STATUS: PENDING

Not yet available:
  - Final trained model file (.keras)
  - Verified class index order
  - TFLite export (blocked - current model is 438 MB)
  - Honest accuracy figures

Expected class order (UNVERIFIED - from alphabetical folder sort):
  0: tomato__JAS_MIT
  1: tomato__K
  2: tomato__LM
  3: tomato__MIT
  4: tomato__N
  5: tomato__N_K

See ../Tomato_Updated_Code_Review.md for why the current model
cannot be trusted yet.
```

Then:

```bash
cd C:\Projects\tomato-leaf-doctor
git init
git branch -M main
claude
```

---

## PART 1 — THE KICKOFF PROMPT

Copy everything between the markers into Claude Code.

--- START ---

Read `CLAUDE.md` in the repo root completely before doing anything else. It is the operating contract for this project. Do not skim it.

Then read, in this order:

1. `docs/Tomato_Updated_Code_Review.md` — the technical audit of the model pipeline. This explains why the model is blocked, why the reported accuracy cannot be trusted, and why §7 of CLAUDE.md (Honest UI) is written the way it is. You need this context.
2. `docs/Tomato_Project_Technical_Audit.md` — the earlier, broader audit including the dataset and capture-protocol constraints.
3. `docs/training_code.py` and `docs/model/README.md` — what the model actually is and what state it is in.

Then read both sibling reference projects in place:

- `C:/Projects/Eye_Care-Eye_Disease_Prediction_App/eye-care-app/mobile`
- `C:/Projects/apple-leaf-doctor`

Study their structure, navigation, tooling, error handling and design-system approach. The Apple project is the closer sibling — it has the inference-abstraction pattern we want to carry forward. Read what is actually there; do not assume it matches what I have told you.

Once you have read all of that, do **not** start coding. Instead:

1. Write your own `PLAN.md` in the repo root, based on what you actually found. Cover: the phases, what each produces, what you will reuse from the siblings versus build fresh, your proposed visual identity (with concrete hex values and a justification for how it stays distinct from the apple app's green), and your logo concept.

2. List every unknown, every assumption you had to make, and every question you need answered before proceeding safely.

3. Show me `PLAN.md` and stop. I will review before you write code.

A roadmap follows below. Treat it as a proposal from a colleague, not as instructions. If the reference projects tell you something different, say so and adjust — that is what I want from you.

Four things you must respect and not work around:

- **This is classification, not detection.** The model returns one softmax vector over six classes. There are no bounding boxes. Do not build a box overlay.

- **The class order is unverified.** Follow CLAUDE.md §4: `src/config/classes.ts` is the single source of truth, ships marked unverified, and the app refuses real inference until confirmed. Build everything against `MockProvider`.

- **Honest UI is not optional.** No accuracy claims anywhere. Top-3 predictions, not just the winner. Low confidence is a first-class result with its own screen state. Read CLAUDE.md §7 twice — it is the reason this project is being built carefully.

- **The logo ships.** The previous project shipped without one. CLAUDE.md §10 lists every required asset. Design the mark as SVG, export every raster size, wire the paths in `app.json`, and verify each path resolves.

--- END ---

---

## PART 2 — PROPOSED ROADMAP

Claude Code should validate this against the reference projects and rewrite it.

### Phase 0 — Recon (no code)

- Read CLAUDE.md, all docs, both reference projects
- Inspect what is actually present in `docs/model/`
- Produce `PLAN.md` + open questions
- **Stop for review**

### Phase 1 — Scaffold & tooling

- `npx create-expo-app` with the TypeScript template
- `strict: true`, path aliases
- ESLint + Prettier
- Husky + lint-staged (pre-commit: typecheck + lint)
- Jest + React Native Testing Library
- GitHub Actions CI
- `eas.json` with a development profile — **configure, do not build**
- `.env` handling, `.env.example` committed
- All three checks green on the empty project

`chore: scaffold expo project with typescript, lint, tests, ci`

### Phase 2 — Brand, assets, design system

- Design the logo as SVG (leaf + diagnostic element, legible at 48px)
- Export: `icon.png`, `adaptive-icon.png` (66% safe zone), `splash.png`, `favicon.png`
- Wire all paths in `app.json` and **verify each resolves**
- Terracotta/sage/warm-sand token set per CLAUDE.md §11, light + dark
- Verify semantic colours are distinguishable from the terracotta primary; verify WCAG AA on every text/background pair
- Base components: Button, Card, Text, Badge, Screen, LoadingState, ErrorState, EmptyState, ConfidenceBar, CategoryPill
- Dev-only gallery screen rendering every component in every state

`feat: brand identity, app assets and terracotta design system`

### Phase 3 — Navigation & shell

- React Navigation native-stack, typed `RootStackParamList`
- Root error boundary
- Screen shells with correct navigation: Splash → Login → Dashboard → Capture Guide → Camera → Confirm → Processing → Results → History → Library → Report
- Zustand stores, typed

`feat: navigation shell and root error boundary`

### Phase 4 — Inference layer (the architectural core)

- `types.ts` — `ClassScore`, `Classification`, `InferenceError` as a typed union
- `InferenceProvider.ts` — the interface
- `config/classes.ts` — the six classes, category mapping, index order, `VERIFIED` flag + runtime guard, per-class reliability notes
- `config/thresholds.ts` — low-confidence cutoff (start 0.60), confidence bands
- `providers/MockProvider.ts` — deterministic, dev only, cannot ship
- `providers/RemoteProvider.ts` — FastAPI client, typed errors, timeout, retry
- `providers/TFLiteProvider.ts` — wired against the interface, disabled behind a flag until a small model exists
- `index.ts` — factory
- Unit tests: top-3 ranking, low-confidence branch, class-index mapping, the unverified-order guard

`feat: swappable inference layer with mock, remote and tflite providers`

### Phase 5 — FastAPI backend

- `server/` — FastAPI, load the `.keras` model, `/predict` and `/health`
- Preprocessing must match training **exactly**: resize to 224×224, no rescale (EfficientNetV2 has `include_preprocessing=True` built in — verify this against the training script rather than assuming)
- Return the full probability vector, not just the winner
- `models/` gitignored
- Dockerfile, `requirements.txt`, README with run instructions
- Works against a stub model until the real one lands

`feat: fastapi classification backend`

### Phase 6 — Capture flow

- Capture Guide screen: the protocol, the worked reference image, why it matters
- Camera: vision-camera, framing overlay, all three permission paths
- Gallery import
- Confirm/retake step
- Preprocess to 224×224 (centre-crop), run inference through the interface
- Explicit loading / error / low-confidence states

`feat: guided capture flow with protocol enforcement`

### Phase 7 — Results

- Category first (Insect Pest / Nutrient Deficiency), prominent — it drives the intervention
- Specific class second, with confidence band
- **Top-3 ranked probability bars**
- Low-confidence state: "Uncertain — consult an extension officer", top-3 framed as possibilities
- Rare-class caveat when JAS_MIT / K / N_K is the top prediction
- Persistent note: the model does not detect healthy leaves
- Treatment & prevention — **placeholder content file, clearly marked, awaiting agronomist sign-off**
- No accuracy figure anywhere

`feat: results screen with top-3 ranking and honest confidence handling`

### Phase 8 — Persistence, library, reports

- SQLite schema + migrations
- Save scan: image path, full probability vector, timestamp, category
- History list, detail, delete
- Disease Library: reference screen for all six classes with symptoms and imagery
- PDF export via expo-print
- History and library fully offline

`feat: offline history, disease library and pdf reports`

### Phase 9 — Auth & hardening

- Firebase Auth (email + anonymous)
- Airplane-mode behaviour: history and library work; scanning explains the requirement and offers retry
- Low-end device pass
- EAS development build, install on a real device, verify end to end
- README with setup instructions

`chore: auth, offline hardening and release build`

---

## PART 3 — WHEN THE MODEL ARRIVES

When the corrected model lands, give Claude Code this:

--- START ---

The model has arrived. It is in `docs/model/`.

1. Load it in Python and print the actual class order. Do not read it from a notebook variable — read it from the model or from the training generator's `class_indices`. Report exactly what you find.
2. Update `src/config/classes.ts` with the confirmed order and flip the verification flag. **That is the only file that changes for the class order.** If you need to edit anything else to make names line up, the abstraction is wrong — fix the abstraction.
3. Place the model in `server/models/`, wire `RemoteProvider` to the live backend, and switch the provider factory away from `MockProvider`.
4. Verification pass: take a held-out set of images with known labels, run them through the real path, and report the **actual** per-class match rate with support counts. Do not smooth it, do not adjust anything to improve the number. If it is poor, we need to know it is poor.
5. Update `config/classes.ts` reliability notes from the real per-class results.
6. Report and stop.

--- END ---

---

## PART 4 — FOLLOW-UP PROMPTS

**After Phase 0:**
> Plan approved. Begin Phase 1. Commit when green.

**Between phases:**
> Phase N approved and merged. Begin Phase N+1. Re-read CLAUDE.md §7, §8 and §9 first.

**On an error:**
> There is an error: [paste]. Do not guess a fix. Find the root cause — read the source, check the actual API, reproduce it. Tell me the cause before the fix.

**If it drifts into placeholders:**
> Stop. CLAUDE.md §1: no placeholder code, no fake data, no TODO stubs, no placeholder assets. If something is missing, say what is missing and stop.

**If it starts adding accuracy claims:**
> Remove that. CLAUDE.md §7: no accuracy claim appears anywhere in this app. We do not have a trustworthy number.
