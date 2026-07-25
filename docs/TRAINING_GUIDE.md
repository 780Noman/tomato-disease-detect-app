# Corrected Training Pipeline — What Changed and Why

**Companion to:** `train_tomato_corrected.py`
**For:** the tomato leaf pest / nutrient deficiency classification study (OLID-I, 562 original images, 6 classes)

---

## 1. THE SHORT ANSWER TO "WILL ACCURACY DROP?"

Not necessarily. The changes fall into two independent groups.

**Group A — correctness.** These remove a bias from the *evaluation*. On their own they would lower the reported number, because part of the current figure comes from that bias rather than from the model.

**Group B — modelling.** These improve the *model itself*. The current script leaves substantial performance unused.

Run together, the expected outcome is a number in the same range or higher, and one that will survive review.

| Change | Group | Effect |
|---|---|---|
| Selection moved off the test set | A | Lowers |
| Mean ± std instead of max of 5 | A | Lowers |
| Two-stage fine-tuning (was fully frozen) | B | **Raises, substantially** |
| Attention bridge 1280 → 256 channels | B | **Raises** (less overfitting) |
| Test-time augmentation | B | Raises slightly |
| 5-fold ensemble | B | **Raises**, and is more honest than best-fold |

The two largest single levers are the two-stage fine-tuning and the bridge reduction — and both are on the improvement side.

---

## 2. WHERE THE CURRENT 84% COMES FROM

Two mechanisms inflate it. Neither is a modelling gain.

### 2.1 The model was selected using the test set

```python
test_acc = best_fold_model.evaluate(test_gen)     # score on test
if test_acc > best_overall_acc:                   # pick the best on test
    best_model_path = fold_model_path
...
final_model = load_model(best_model_path)         # that model
y_pred = final_model.predict(test_gen)            # scored on the SAME test set
```

Choosing a model on a set and then reporting that model's score on the same set is model selection on the test set. The hold-out stops being a hold-out.

### 2.2 One test set was scored five times and the maximum kept

`test_gen` is built once, before the loop. Each fold evaluates against it, and the reported figure is the highest of the five.

The maximum of five noisy estimates sits above their mean by construction. With 84 test images the per-fold standard deviation is typically 3–5 percentage points, so the maximum commonly runs 4–6 points above the mean. That gap is arithmetic, not model quality.

**Both are fixed in the corrected script**: selection uses validation only, and the headline is `mean ± std` across folds.

---

## 3. THE ACCURACY IMPROVEMENTS — AND WHY THEY ARE LEGITIMATE

### 3.1 Two-stage fine-tuning (largest gain)

The current script sets `base_model.trainable = False` and never unfreezes. Only ImageNet features are used.

ImageNet contains no tomato leaf lesions, no nitrogen chlorosis, no mite stippling. Frozen ImageNet features cannot represent what separates these six classes. Published work on EfficientNetV2 fine-tuning reports gains often exceeding 5% from unfreezing top layers, and the standard recipe is exactly two-stage: train the head with the base frozen, then unfreeze selected layers and continue at a lower learning rate.

The corrected script does this:

```
Stage A: base frozen, 20 epochs, LR 3e-4   -> head and bridge learn
Stage B: top 60 layers unfrozen, 30 epochs, LR 1e-5   -> features adapt
```

BatchNorm layers stay frozen throughout stage B. At batch size 8 the running statistics are too noisy, and updating them normally degrades a pretrained backbone.

This is textbook transfer learning. There is nothing to defend.

### 3.2 Attention bridge: 1280 → 256 channels

The bridge operated on the full 1280-channel feature map:

| Component | At 1280 ch | At 256 ch |
|---|---|---|
| Multi-head attention | ~6.6 M | ~0.26 M |
| Feed-forward network | ~13.1 M | ~0.53 M |
| 1×1 projection | — | ~0.33 M |
| **Bridge total** | **~19.7 M** | **~1.1 M** |

Against roughly 400 unique training images, a 19.7 M-parameter randomly-initialised block is an overfitting machine. An 18× reduction with a 1×1 projection normally *improves* held-out accuracy on data this size.

If the architecture must stay exactly as described in the thesis, set `BRIDGE_DIM = None`. The change is a single config value and is worth reporting as an ablation either way.

### 3.3 Test-time augmentation

Predictions are averaged over the image and its three flips. The leaves are photographed flat with no canonical orientation, so flips are label-preserving. Standard practice, typically 1–3 points, no downside.

### 3.4 Five-fold ensemble

Instead of picking the single best fold, average the five fold models' probabilities.

This is the important one conceptually: **it is simultaneously more honest and usually more accurate.** No selection is involved — every fold contributes — and ensembling reduces variance, which matters most on small datasets.

So the honest procedure is likely to produce a *higher* number than the biased one it replaces.

### 3.5 Optional further gains, not enabled by default

- **`IMG_SIZE = 300`.** EfficientNetV2-M was designed for larger inputs. Nutrient-deficiency symptoms are fine-grained colour gradients; 224 px discards detail. Costs roughly 2× runtime.
- **`BACKBONE = "B0"`.** On a 562-image dataset a smaller backbone frequently outperforms a larger one. In a recent tomato leaf benchmark, EfficientNet-B0 was the strongest lightweight model at 70.40%, close behind ResNet18 at 71.80% — on a harder in-field dataset. Worth running as a comparison row, and it is the only variant that can go on-device in the mobile app (5–15 MB after TFLite quantisation, versus 294 MB for the M variant).

---

## 4. HOW THIS COMPARES TO PUBLISHED WORK

This is the part that matters for the paper's framing.

| Study / dataset | Model | Accuracy | Notes |
|---|---|---|---|
| TLID greenhouse tomato (2026) | ResNet18 | **71.80%** (macro-F1 0.6726) | best overall in that comparison |
| TLID greenhouse tomato (2026) | EfficientNet-B0 | **70.40%** (macro-F1 0.6299) | strongest lightweight |
| Dhan Shomadhan (field, few-shot) | lightweight ensemble | ~69% at 15-shot | real field conditions |
| PlantVillage tomato | EfficientNetB5 and others | 99%+ | **not comparable** |

**PlantVillage is not a fair comparison point.** It has 18,160 tomato images across 10 classes on uniform backgrounds. Researchers have reached 100% on it, which is why OLID-I was created as a successor. Quoting a 99% PlantVillage result next to a 562-image OLID-I result invites an immediate objection in review.

**Against the appropriate benchmarks, 84% is already strong — and so is 78%.** Even at the lower end of the expected range after correction, the result sits comfortably above the 71.80% and 70.40% figures from the recent lightweight-model comparison, on a dataset with a fraction of the training images.

The framing writes itself: a leakage-free protocol on 562 original images, outperforming recent benchmarks obtained on larger tomato datasets.

---

## 5. IF THE NUMBER STILL COMES OUT LOWER

There is a standard, fully defensible way to handle this: **report both protocols.**

> Under the balanced-augmentation protocol commonly adopted in prior work — where augmentation is applied before the train/test partition — the model attains X%. Under a leakage-free protocol, where augmentation is confined to the training fold and the test partition contains only original images, the same architecture attains Y%. The gap of (X − Y) points quantifies the optimism introduced by the common protocol.

This turns the finding into a contribution rather than a shortfall. Protocol-comparison results of exactly this kind are published regularly, and reviewers respond well to them — it demonstrates methodological awareness rather than a weaker model.

It also protects the work. If the paper reports only the inflated figure and a reviewer reproduces the pipeline, the outcome is far worse than reporting a lower number voluntarily.

---

## 6. THE ONE THING TO CHECK BEFORE ANYTHING ELSE

The corrected script stops immediately if the wrong dataset is attached:

```python
n_aug = df["filename"].str.contains("aug_", case=False).sum()
if n_aug > 0:
    raise ValueError("STOP: pre-augmented files detected ...")
```

**Why this matters more than everything else in this document.** The dataset auto-finder accepts any folder containing `tomato__LM` and `tomato__MIT`. Both of these satisfy that condition:

| Dataset | Total | Per class |
|---|---|---|
| Original OLID-I tomato — **correct** | 562 | LM 207, MIT 200, N 47, N_K 40, K 36, JAS_MIT 32 |
| Pre-balanced augmented set — **wrong** | 1,406 | ~236 each, filenames `aug_*.jpg` |

If the balanced set is attached, the split runs over augmented siblings of the same leaf. Rotated copies land in both train and test, and every correctness fix in this script has no effect. The verification gate makes that failure loud instead of silent.

Attach the **original OLID-I tomato folders**, not the balanced set.

---

## 7. WHAT THE SCRIPT PRODUCES

| File | Contents |
|---|---|
| `confusion_matrix.png` | 300 dpi, ensemble on the held-out test set |
| `roc_curve.png` | 300 dpi, per-class ROC with AUC |
| `Tomato_Model_Deploy.keras` | ~294 MB, optimizer state excluded (was 438 MB) |
| `model_metadata.json` | class order, metrics, support counts — feeds the mobile app directly |
| `fold_1..5.keras` | per-fold checkpoints |

Console output includes per-fold test accuracy, the cross-validation mean ± std, the ensemble accuracy and macro-F1, the full classification report, and per-class support counts with a warning wherever a class has fewer than 15 test samples.

---

## 8. NUMBERS TO REPORT IN THE PAPER

Report all three. They answer different questions and together they are complete.

| Metric | What it is | Use it for |
|---|---|---|
| **CV test accuracy, mean ± std** | Five folds, each scored on the held-out test set | The headline scientific result — it carries a variance estimate |
| **5-fold ensemble accuracy** | Average of the five models' probabilities | The best achievable configuration |
| **Deployed single-model accuracy** | The fold with the best *validation* score | What actually ships in the mobile app |

Alongside these, state plainly:

- The test set contains 84 images. Report the per-class support next to every per-class metric.
- Four of the six classes have 5–7 test images. A single misclassification moves their F1 by roughly 0.2. Say so — a reviewer will notice otherwise, and pre-empting it reads as rigour.
- Confirm explicitly that no model was selected using the test set.
- State that augmentation was applied only within the training fold.

---

## 9. TWO CORRECTIONS TO CARRY INTO THE WRITE-UP

**The task is multi-class, not multi-label.** The code uses `softmax` with `CategoricalCrossentropy` and `argmax` — one label per image. This is worth being precise about, because OLID-I was explicitly designed as a multi-label dataset. Its authors describe it as the first multi-label classification challenge in agriculture, with 16 multi-label classes and multiple labels present in individual photographs.

Treating `JAS_MIT` and `N_K` as separate atomic classes is a legitimate design choice, but it is multi-class classification and should be described that way. If genuine multi-label output is wanted, the change is `sigmoid` + `BinaryCrossentropy` + multi-hot labels + per-class thresholds — a different experiment.

**The attention block is not a Swin Transformer.** It has no window partitioning, no shifted windows, no relative position bias, no patch merging. It is a global self-attention block. The corrected script names it `attention_bridge` accordingly. Any "shifted-window" claim in the text should be removed — that mechanism is not present in the code, and it is the kind of discrepancy a reviewer checks.

---

## 10. RUNNING IT

1. Attach the **original** OLID-I tomato dataset on Kaggle (562 images, no `aug_` filenames)
2. Enable GPU (P100 or T4)
3. Paste `train_tomato_corrected.py` into a cell and run
4. Expected runtime: roughly 2.5–3 hours for EfficientNetV2-M at 224 px

**Recommended sequence:**

| Run | Config | Purpose |
|---|---|---|
| 1 | `BACKBONE="M"`, `BRIDGE_DIM=256` | the proposed model |
| 2 | `BACKBONE="M"`, `BRIDGE_DIM=None` | ablation: does the projection help? |
| 3 | `BACKBONE="B0"`, `BRIDGE_DIM=256` | lightweight comparison + the deployable model |

Three rows in the results table, one ablation, and a mobile-ready model — from three runs of the same script.
