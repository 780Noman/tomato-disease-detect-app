# Code Review — Updated Tomato Training Script

**Reviewed:** "FINAL PRO CODE" (EfficientNetV2-M frozen base + Global Self-Attention Bridge)
**Artefact:** `Best_Tomato_Model.h5`, 438 MB

---

## 1. WHAT THE REVISION FIXED

These are real improvements over the previous version and should all be kept:

| Previous version | Updated version |
|---|---|
| Plain `KFold` | `StratifiedKFold` — minority classes now proportionally represented in every fold |
| No held-out test set | 15% hold-out split taken **before** cross-validation |
| Balancing applied to the whole dataset | `balance_training_data()` applied to `train_fold_df` only; val and test are untouched |
| `Reshape` fed symbolic tensors | `H, W = x_norm.shape[1], x_norm.shape[2]` — static ints, export-safe |
| Component named "Swin Transformer" | Renamed `global_self_attention_bridge` — matches what the code does |
| Base model fully trainable (73.5M) | `base_model.trainable = False` — trainable params down to ~20.3M |

The structural leakage from the previous pipeline is addressed, **provided the correct dataset is attached** (see Issue 3).

---

## 2. CRITICAL ISSUES

### Issue 1 — The best model is selected using the test set

```python
test_loss, test_acc = best_fold_model.evaluate(test_gen, verbose=0)
...
if test_acc > best_overall_acc:
    best_overall_acc = test_acc
    best_model_path = fold_model_path
```

`best_model_path` is chosen by whichever fold scored highest **on the test set**. The final classification report, confusion matrix and ROC curve are then computed on that same test set:

```python
final_model = tf.keras.models.load_model(best_model_path, compile=False)
y_pred_probs = final_model.predict(test_gen)
print(classification_report(y_true, y_pred_classes, ...))
```

Selecting a model on a set and then reporting that model's performance on the same set is model selection on the test set. The hold-out is no longer held out. This is the same class of problem as the previous version, moved one layer up.

**Fix — select on validation, report on test once:**

```python
# inside the fold loop
val_loss, val_acc = best_fold_model.evaluate(val_gen, verbose=0)
test_loss, test_acc = best_fold_model.evaluate(test_gen, verbose=0)

all_fold_val_accuracies.append(val_acc)
all_fold_test_accuracies.append(test_acc)

if val_acc > best_overall_val_acc:        # <-- val, not test
    best_overall_val_acc = val_acc
    best_model_path = fold_model_path
```

---

### Issue 2 — One test set is evaluated five times and the maximum is taken

`test_gen` is constructed once, before the fold loop, and every fold evaluates against it. The reported figure is then `max()` over those five evaluations.

The maximum of five noisy estimates is upward-biased by construction. Even with five identical models, random variation alone produces a gap between the mean and the maximum. On a test set of 84 images that gap is not small.

**Fix — report the distribution, not the best draw:**

```python
mean_acc = np.mean(all_fold_test_accuracies)
std_acc  = np.std(all_fold_test_accuracies)
print(f"Test accuracy: {mean_acc*100:.2f}% ± {std_acc*100:.2f}%")
```

The `mean ± std` is the headline number. The best fold may be used as the deployable artefact, but its individual score is not the result.

---

### Issue 3 — The attached dataset is never verified

The auto-finder accepts any directory containing `tomato__LM` and `tomato__MIT`:

```python
for root, dirs, files in os.walk('/kaggle/input'):
    if 'tomato__LM' in dirs and 'tomato__MIT' in dirs:
        dataset_dir = root
        break
```

Both of these satisfy that condition:

| Dataset | Total images | Per class |
|---|---|---|
| Original OLID-I tomato (correct) | 562 | LM 207, MIT 200, N 47, N_K 40, K 36, JAS_MIT 32 |
| Pre-augmented balanced set (wrong) | 1,406 | ~236 each |

The print statement says `"Total Original Diseased Images"`, but nothing checks that the images are original. If the balanced set is attached, the split happens over augmented siblings and **every leakage finding from the previous review applies unchanged** — the corrected split logic would have no effect.

**Fix — verify explicitly before training:**

```python
print(df['label'].value_counts())
print(df['filename'].head(10).tolist())

n_aug = df['filename'].str.contains('aug_').sum()
if n_aug > 0:
    raise ValueError(
        f"{n_aug} pre-augmented files detected. "
        "Attach the ORIGINAL OLID-I tomato set (562 images), not the balanced set."
    )
if len(df) != 562:
    print(f"WARNING: expected 562 original images, found {len(df)}.")
```

**This check should be run before anything else.** If it fails, the other nine issues are secondary.

---

## 3. IMPORTANT ISSUES

### Issue 4 — The test set is too small for four of the six classes

562 × 15% = 84 test images. Stratified, that is approximately:

| Class | Test images |
|---|---|
| LM | 31 |
| MIT | 30 |
| N | 7 |
| N_K | 6 |
| K | 5 |
| JAS_MIT | 5 |

A per-class F1 computed on 5 images shifts by roughly 0.2 for a single misclassification. Those figures cannot support a claim about class-level performance.

**Fix.** Report support counts next to every per-class metric. State plainly in the results section that minority-class metrics are estimated from 5–7 samples and are not stable. If a stronger claim is needed, the alternative is repeated stratified cross-validation reporting per-class metrics pooled across repeats with confidence intervals.

---

### Issue 5 — The 438 MB file contains optimizer state

Parameter arithmetic:

| Component | Parameters |
|---|---|
| EfficientNetV2-M (`include_top=False`) | ~53.2 M (frozen) |
| Attention bridge (MHA ~6.6M + FFN ~13.1M + LayerNorms) | ~19.7 M |
| Head (LayerNorm + Dense 512 + output) | ~0.66 M |
| **Total** | **~73.5 M** |
| **Trainable** (base frozen) | **~20.3 M** |

- Weights: 73.5M × 4 bytes = **~294 MB**
- AdamW moments, trainable params only: 20.3M × 4 × 2 = **~163 MB**
- Total ≈ **457 MB**, consistent with the observed 438 MB

`ModelCheckpoint` includes the optimizer by default. It is useless for inference.

**Fix:**

```python
m = tf.keras.models.load_model(best_model_path, compile=False)
m.save('Best_Tomato_Model.keras')     # ~294 MB, weights only, modern format
```

For mobile deployment, 294 MB is still far too large. TFLite float16 lands around 147 MB and int8 around 74 MB — both still heavy for a farmer-facing app on a low-end device. A smaller backbone is the real answer (Issue 6).

---

### Issue 6 — The model remains oversized relative to the data

Freezing the base was the right move and cut trainable parameters from 73.5M to 20.3M. But the unique training data is:

```
562 × 0.85 (train+val) × 0.85 (train fold) ≈ 406 unique images
```

That is roughly **50,000 trainable parameters per unique training image**. For JAS_MIT specifically, about 23 unique leaves are oversampled up to ~176 rows. Oversampling changes the sampling frequency; it does not add information.

**Fix.** Add EfficientNetV2-B0 (~6M params) and MobileNetV3 (~3M params) to the comparison under the identical recipe. On a dataset this size the smaller backbone will very likely match or beat the M variant on the honest split — and it is deployable on-device at 5–15 MB, which turns "lightweight and edge-deployable" into a contribution rather than a compromise.

---

### Issue 7 — Class index mapping is not pinned

```python
train_gen = train_datagen.flow_from_dataframe(train_balanced_df, ...)   # infers its own classes
val_gen   = val_datagen.flow_from_dataframe(val_fold_df, ...)           # infers its own classes
test_gen  = test_datagen.flow_from_dataframe(test_df, ...)              # infers its own classes
```

Each generator builds its class-index map independently from the labels present in its own dataframe. With classes as small as 5 test images, a fold that happens to omit one produces a label-space mismatch partway through the run instead of a clear failure at the start.

**Fix — pass the class list explicitly to all three:**

```python
GEN_ARGS = dict(
    directory=dataset_dir, x_col='filename', y_col='label',
    classes=class_labels,                     # <-- pin the order
    target_size=(img_size, img_size),
    batch_size=batch_size, class_mode='categorical',
)
train_gen = train_datagen.flow_from_dataframe(train_balanced_df, **GEN_ARGS)
val_gen   = val_datagen.flow_from_dataframe(val_fold_df, shuffle=False, **GEN_ARGS)
test_gen  = test_datagen.flow_from_dataframe(test_df, shuffle=False, **GEN_ARGS)
```

---

### Issue 8 — The run is not reproducible

`random_state=42` is set on `train_test_split`, `StratifiedKFold` and `resample`, but there is no global seed. Weight initialisation, dropout masks and the augmentation stream all vary between runs, so the reported number cannot be reproduced — including by an examiner attempting to verify it.

**Fix:**

```python
import tensorflow as tf
tf.keras.utils.set_random_seed(42)      # seeds Python, NumPy and TensorFlow
```

---

### Issue 9 — `.h5` is a legacy format for this architecture

Keras 3 treats `.h5` as legacy. Round-tripping `MultiHeadAttention` and `LayerNormalization` through it is a known source of load failures, and it does not export cleanly to TFLite or ONNX.

**Fix.** Save `.keras` throughout — both the per-fold checkpoints and the final artefact.

---

### Issue 10 — Every fold oversamples identically

```python
cls_balanced = resample(cls_df, replace=True, n_samples=max_size, random_state=42)
```

The seed is fixed, so every fold duplicates the same rows in the same proportions. The folds are less independent than a 5-fold protocol implies, which narrows the reported standard deviation.

**Fix.** Pass the fold number through: `random_state=fold_no`.

---

## 4. MINOR

- `test_gen` is not reset between the five `evaluate()` calls inside the loop. It is correctly reset before the final `predict()`. Adding `test_gen.reset()` before each evaluation removes any dependence on iterator position.
- Five `model_fold_N.h5` checkpoints at ~438 MB each consume roughly 2.2 GB of Kaggle output. Saving `.keras` without the optimizer reduces this substantially.
- The final report is generated from a single fold. Even after fixing Issue 1, consider ensembling all five folds for the deployed artefact — it is usually more stable than any single fold on a dataset this small.

---

## 5. ORDER OF WORK

1. **Run the dataset verification snippet (Issue 3).** Nothing else matters until the image count comes back as 562 with no `aug_` filenames.
2. Change model selection from `test_acc` to `val_acc` (Issue 1).
3. Report `mean ± std` across folds instead of the maximum (Issue 2).
4. Add the global seed (Issue 8) and pin `classes=` on the generators (Issue 7).
5. Re-run. Record the honest number.
6. Save without the optimizer, as `.keras` (Issues 5, 9).
7. Add EfficientNetV2-B0 / MobileNetV3 to the comparison (Issue 6).
8. Report per-class metrics with their support counts, and state the sample-size limitation (Issue 4).

---

## 6. WHAT TO EXPECT AFTER THE FIX

If the dataset check passes and issues 1 and 2 are corrected, the reported accuracy will drop. That is the point — the current figure includes a selection effect.

A realistic honest outcome on 562 original images:

- **LM and MIT** (200+ real images each): strong, F1 likely 0.85–0.95
- **N, K, N_K, JAS_MIT** (32–47 real images each): weak, F1 likely 0.40–0.70, and unstable
- **Heavy confusion among N, K and N_K** — visually similar nutrient symptoms

This is a defensible result. "With 32 real samples of Jassid+Mite co-infestation, deep models cannot reliably detect it, and the high accuracies reported under balanced-augmentation protocols are an artefact of leakage" is a reproducible finding and a stronger contribution than a number that cannot be reproduced.
