# MODEL STATUS

**Last updated:** training corrections handed off to the researcher; run pending.

---

## Current state: PENDING

The model is being retrained with a corrected pipeline. Nothing usable exists yet.

| Artefact | Status |
|---|---|
| `Tomato_Model_Deploy.keras` | Not yet produced |
| `model_metadata.json` | Not yet produced |
| Verified class order | **Unverified** |
| TFLite export | Blocked — depends on which backbone wins |
| Honest accuracy figures | Not yet known |

---

## What is arriving

The corrected training script (`../train_tomato_corrected.py`) produces two files that matter to this app:

### 1. `model_metadata.json` — the source of truth

```json
{
  "backbone": "M",
  "img_size": 224,
  "class_order": ["tomato__JAS_MIT", "tomato__K", "tomato__LM",
                  "tomato__MIT", "tomato__N", "tomato__N_K"],
  "n_classes": 6,
  "preprocessing": "raw RGB 0-255; EfficientNetV2 applies its own normalisation internally",
  "cv_test_accuracy_mean": 0.0,
  "cv_test_accuracy_std": 0.0,
  "ensemble_test_accuracy": 0.0,
  "ensemble_macro_f1": 0.0,
  "test_support_per_class": { "tomato__JAS_MIT": 5, "...": 0 },
  "tta": true
}
```

**`class_order` is authoritative.** Read the index order from this file. Do not read it from a notebook variable, a Python list in a script, or this README.

**`test_support_per_class` drives the reliability warnings** in `src/config/classes.ts` (CLAUDE.md §7). Any class with fewer than ~15 test samples gets the "limited training data, confirm with an expert" note on the results screen.

**The accuracy fields are for engineering reference only.** They never appear in the UI — see CLAUDE.md §7.

### 2. `Tomato_Model_Deploy.keras` — the model

Size depends on the backbone the researcher settles on:

| Backbone | `.keras` size | Deployment path |
|---|---|---|
| EfficientNetV2-M | ~294 MB | **Server only** — RemoteProvider via FastAPI |
| EfficientNetV2-B0 | ~25 MB | Server **or** on-device (~5–15 MB after TFLite int8) |

If B0 performs comparably — which is likely on 562 images, and is being run as a comparison — the on-device path opens up and `TFLiteProvider` can be enabled. Build the abstraction so either works without touching a screen.

---

## Expected class order (UNVERIFIED — do not ship against this)

Keras derives class indices by sorting the folder names alphabetically, so the order is expected to be:

```
0: tomato__JAS_MIT     Jassid + Mite        Insect Pest
1: tomato__K           Potassium Deficiency Nutrient Deficiency
2: tomato__LM          Leaf Miner           Insect Pest
3: tomato__MIT         Mite                 Insect Pest
4: tomato__N           Nitrogen Deficiency  Nutrient Deficiency
5: tomato__N_K         Nitrogen + Potassium Nutrient Deficiency
```

This is an expectation, not a verified fact. `src/config/classes.ts` ships marked `UNVERIFIED` with a runtime guard until `model_metadata.json` confirms it. See CLAUDE.md §4.

---

## Known limits of whatever model arrives

Carry these into the UI. They are not pessimism — they are what the data supports.

**Original dataset: 562 images, heavily imbalanced.**

| Class | Original images | Approx. test images |
|---|---|---|
| tomato__LM | 207 | ~31 |
| tomato__MIT | 200 | ~30 |
| tomato__N | 47 | ~7 |
| tomato__N_K | 40 | ~6 |
| tomato__K | 36 | ~5 |
| tomato__JAS_MIT | 32 | ~5 |

- **LM and MIT** will perform well. Everything else rests on 32–47 real leaves.
- **N, K and N_K confuse heavily** — nitrogen and potassium deficiency look similar, and the combined class sits between them. Expect this in the confusion matrix and design the top-3 display around it.
- **Per-class metrics for the four minority classes are computed on 5–7 test images.** One error moves F1 by ~0.2. These numbers are not stable and must never be surfaced as precise claims.
- **There is no healthy class.** A healthy leaf will still be assigned one of the six. The results screen carries a persistent note about this.

---

## Capture protocol — non-negotiable

Every training image is a **single detached leaf on a dark textured surface, shot from directly above under even lighting**. Nothing else is in the training distribution.

A field photo — leaf on the plant, sunlight, soil or foliage behind it — will return a confident, meaningless answer. The camera flow must enforce the protocol. See CLAUDE.md §5.

---

## Background

- `../Tomato_Updated_Code_Review.md` — audit of the previous pipeline; explains why the earlier numbers could not be used
- `../TRAINING_GUIDE.md` — what the corrected script changes and why
- `../train_tomato_corrected.py` — the script being run
