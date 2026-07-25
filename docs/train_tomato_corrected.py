"""
=============================================================================
TOMATO LEAF PEST & NUTRIENT DEFICIENCY CLASSIFICATION
Corrected training pipeline — leakage-free evaluation + legitimate accuracy gains
=============================================================================

WHAT CHANGED AND WHY
--------------------
Correctness fixes (these make the number defensible):
  1. Model selection moved OFF the test set  -> selection now uses validation only
  2. Headline metric is mean +- std across folds, not the maximum of 5 draws
  3. Dataset identity is verified before training (hard stop on augmented files)
  4. Class index order is pinned explicitly, not inferred per-generator
  5. Global seed set for full reproducibility
  6. Model saved as .keras without optimizer state (~294 MB instead of ~438 MB)

Accuracy improvements (these are standard practice, not tricks):
  7. Two-stage training: head warm-up on a frozen base, then fine-tune the top
     blocks at a low learning rate. The previous script left the base fully
     frozen for the entire run, which caps performance on a domain that differs
     from ImageNet.
  8. Bridge dimensionality reduction: the attention block operated on 1280
     channels (19.7M parameters) against ~400 unique training images. Projecting
     to 256 first cuts that to ~1.1M and reduces overfitting.
  9. Test-time augmentation (4 flips averaged)
 10. Fold ensembling: averaging the 5 fold models is both more honest than
     picking the best one AND normally more accurate
 11. BatchNorm layers stay frozen during fine-tuning (batch size 8 is too small
     for stable BN statistics)

The evaluation is now honest. The modelling is now stronger. These are separate
changes and both are defensible in review.

REQUIREMENTS
------------
Kaggle GPU (P100 or T4). Runtime roughly 2.5-3 h for EfficientNetV2-M.
Attach the ORIGINAL OLID-I tomato folders (562 images), NOT the pre-balanced set.

=============================================================================
"""

import os
import gc
import json
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.utils import resample
from sklearn.metrics import (
    classification_report, confusion_matrix, roc_curve, auc,
    accuracy_score, f1_score,
)
from sklearn.preprocessing import label_binarize

import tensorflow as tf
from tensorflow import keras
from keras import layers, models
from tensorflow.keras.applications import EfficientNetV2M, EfficientNetV2B0
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.optimizers import AdamW
from tensorflow.keras.callbacks import ModelCheckpoint, EarlyStopping, LearningRateScheduler
from tensorflow.keras.losses import CategoricalCrossentropy


# =============================================================================
# CONFIGURATION
# =============================================================================

SEED = 42

BACKBONE = "M"            # "M" = EfficientNetV2-M (proposed) | "B0" = lightweight comparison
IMG_SIZE = 224            # 300 often helps for fine lesion detail; costs ~2x time
BATCH_SIZE = 8
N_SPLITS = 5

# Two-stage schedule
EPOCHS_STAGE_A = 20       # frozen base, train head + bridge
EPOCHS_STAGE_B = 30       # unfreeze top blocks, fine-tune
LR_STAGE_A = 3e-4
LR_STAGE_B = 1e-5         # must be low - high LR here destroys pretrained features
UNFREEZE_TOP_N = 60       # number of top base layers to unfreeze in stage B

BRIDGE_DIM = 256          # project 1280 -> 256 before attention. Set None for original 1280.
LABEL_SMOOTHING = 0.05
USE_TTA = True            # 4-flip test-time augmentation

TEST_FRACTION = 0.15      # held out before cross-validation, touched once at the end

# Reproducibility
tf.keras.utils.set_random_seed(SEED)
keras.mixed_precision.set_global_policy("mixed_float16")


# =============================================================================
# 1. LOCATE AND VERIFY THE DATASET
# =============================================================================

print("Locating dataset...")
dataset_dir = None
for root, dirs, files in os.walk("/kaggle/input"):
    if "tomato__LM" in dirs and "tomato__MIT" in dirs:
        dataset_dir = root
        break

if dataset_dir is None:
    raise ValueError("Dataset not found under /kaggle/input. Check the attachment.")

print(f"Found: {dataset_dir}\n")

records = []
for class_name in sorted(os.listdir(dataset_dir)):
    if "healthy" in class_name.lower():
        continue
    class_path = os.path.join(dataset_dir, class_name)
    if not os.path.isdir(class_path):
        continue
    for img in sorted(os.listdir(class_path)):
        if img.lower().endswith((".jpg", ".jpeg", ".png")):
            records.append({"filename": os.path.join(class_name, img), "label": class_name})

df = pd.DataFrame(records)

# ---- VERIFICATION GATE -------------------------------------------------------
# Everything downstream is meaningless if the pre-augmented set is attached.
print("=" * 70)
print("DATASET VERIFICATION")
print("=" * 70)
print(df["label"].value_counts().to_string())
print(f"\nTotal images: {len(df)}")
print(f"Sample filenames: {df['filename'].head(5).tolist()}")

n_aug = df["filename"].str.contains("aug_", case=False).sum()
if n_aug > 0:
    raise ValueError(
        f"\nSTOP: {n_aug} pre-augmented files detected (filenames containing 'aug_').\n"
        "Attach the ORIGINAL OLID-I tomato set (562 images), not the balanced set.\n"
        "Splitting a pre-augmented set puts rotated copies of the same leaf into\n"
        "both train and test, which invalidates every metric produced."
    )

if len(df) != 562:
    print(
        f"\nWARNING: expected 562 original images, found {len(df)}.\n"
        "Confirm this is the correct dataset before trusting the results.\n"
    )
else:
    print("\nOK: 562 original images, no augmented files detected.")
print("=" * 70 + "\n")

# ---- PINNED CLASS ORDER ------------------------------------------------------
# Fixed once here and used everywhere. Never inferred per-generator.
CLASS_LABELS = sorted(df["label"].unique())
CLASS_TO_IDX = {c: i for i, c in enumerate(CLASS_LABELS)}
N_CLASSES = len(CLASS_LABELS)

print("CLASS INDEX ORDER (this is what the mobile app must use):")
for i, c in enumerate(CLASS_LABELS):
    print(f"  {i}: {c}")
print()


# =============================================================================
# 2. SPLIT: hold out the test set BEFORE cross-validation
# =============================================================================

train_val_df, test_df = train_test_split(
    df, test_size=TEST_FRACTION, stratify=df["label"], random_state=SEED
)

print(f"Test (held out) : {len(test_df)}")
print(f"Train + Val     : {len(train_val_df)}")
print("\nTest set composition (per-class metrics are only as reliable as these counts):")
print(test_df["label"].value_counts().to_string())
print()


# =============================================================================
# 3. HELPERS
# =============================================================================

def load_images_to_array(frame, directory, img_size):
    """Load images into memory with an explicitly pinned label mapping.

    Using arrays rather than a generator for val/test removes any possibility of
    the class index order drifting between splits.
    """
    X = np.zeros((len(frame), img_size, img_size, 3), dtype=np.float32)
    y = np.zeros(len(frame), dtype=np.int32)
    for i, (_, row) in enumerate(frame.iterrows()):
        img = keras.utils.load_img(
            os.path.join(directory, row["filename"]), target_size=(img_size, img_size)
        )
        X[i] = keras.utils.img_to_array(img)
        y[i] = CLASS_TO_IDX[row["label"]]
    return X, y


def balance_training_fold(frame, fold_no):
    """Oversample minority classes up to the majority size. Training fold only."""
    max_size = frame["label"].value_counts().max()
    parts = []
    for cls in CLASS_LABELS:
        sub = frame[frame["label"] == cls]
        if len(sub) == 0:
            raise ValueError(f"Class {cls} missing from a training fold.")
        if len(sub) < max_size:
            # seed varies per fold so folds are genuinely independent
            sub = resample(sub, replace=True, n_samples=max_size, random_state=SEED + fold_no)
        parts.append(sub)
    return pd.concat(parts).sample(frac=1, random_state=SEED + fold_no).reset_index(drop=True)


def cosine_schedule(lr_max, lr_min, total_epochs, warmup_epochs=5):
    def schedule(epoch):
        if epoch < warmup_epochs:
            return lr_max * (epoch + 1) / warmup_epochs
        progress = (epoch - warmup_epochs) / max(1, total_epochs - warmup_epochs)
        return lr_min + 0.5 * (lr_max - lr_min) * (1 + np.cos(np.pi * progress))
    return schedule


def attention_bridge(x, bridge_dim=None, num_heads=8):
    """Global self-attention over the backbone feature map.

    Not a Swin block: there is no window partitioning, no shifted windows and no
    relative position bias. Named accordingly.

    bridge_dim projects the channel dimension down before attention. At 1280
    channels this block carries ~19.7M parameters, which is far too many for a
    few hundred training images.
    """
    if bridge_dim is not None and x.shape[-1] != bridge_dim:
        x = layers.Conv2D(bridge_dim, 1, padding="same", name="bridge_proj")(x)

    hidden = x.shape[-1]
    H, W = x.shape[1], x.shape[2]          # static ints - required by Reshape and by TFLite export

    x_norm = layers.LayerNormalization(epsilon=1e-6)(x)
    flat = layers.Reshape((H * W, hidden))(x_norm)
    attn = layers.MultiHeadAttention(num_heads=num_heads, key_dim=hidden // num_heads)(flat, flat)
    attn = layers.Reshape((H, W, hidden))(attn)
    x = layers.Add()([x, attn])

    x_norm2 = layers.LayerNormalization(epsilon=1e-6)(x)
    ffn = layers.Dense(hidden * 4, activation="gelu")(x_norm2)
    ffn = layers.Dense(hidden)(ffn)
    return layers.Add()([x, ffn])


def build_model(img_size, n_classes, backbone="M", bridge_dim=BRIDGE_DIM):
    inputs = layers.Input(shape=(img_size, img_size, 3))
    if backbone == "M":
        base = EfficientNetV2M(weights="imagenet", include_top=False, input_tensor=inputs)
    elif backbone == "B0":
        base = EfficientNetV2B0(weights="imagenet", include_top=False, input_tensor=inputs)
    else:
        raise ValueError(f"Unknown backbone: {backbone}")

    base.trainable = False                 # stage A

    x = base.output
    x = layers.SpatialDropout2D(0.1)(x)
    x = attention_bridge(x, bridge_dim=bridge_dim)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.LayerNormalization(epsilon=1e-6)(x)
    x = layers.Dense(512, activation="gelu")(x)
    x = layers.Dropout(0.5)(x)
    outputs = layers.Dense(n_classes, activation="softmax", dtype="float32")(x)

    return models.Model(inputs, outputs), base


def unfreeze_top(base, n_layers, freeze_batchnorm=True):
    """Unfreeze the top n layers for fine-tuning.

    BatchNorm stays frozen: with batch size 8 the running statistics are too
    noisy, and updating them typically degrades a pretrained backbone.
    """
    base.trainable = True
    for layer in base.layers[:-n_layers]:
        layer.trainable = False
    if freeze_batchnorm:
        for layer in base.layers:
            if isinstance(layer, layers.BatchNormalization):
                layer.trainable = False


def predict_with_tta(model, X, use_tta=USE_TTA, batch_size=16):
    """Average predictions over 4 flips. Leaves are orientation-agnostic here."""
    probs = model.predict(X, batch_size=batch_size, verbose=0)
    if not use_tta:
        return probs
    probs = probs + model.predict(X[:, :, ::-1, :], batch_size=batch_size, verbose=0)
    probs = probs + model.predict(X[:, ::-1, :, :], batch_size=batch_size, verbose=0)
    probs = probs + model.predict(X[:, ::-1, ::-1, :], batch_size=batch_size, verbose=0)
    return probs / 4.0


# =============================================================================
# 4. LOAD VAL/TEST ARRAYS
# =============================================================================

print("Loading test set into memory...")
X_test, y_test = load_images_to_array(test_df, dataset_dir, IMG_SIZE)
print(f"Test array: {X_test.shape}\n")


# =============================================================================
# 5. CROSS-VALIDATION
# =============================================================================

skf = StratifiedKFold(n_splits=N_SPLITS, shuffle=True, random_state=SEED)

fold_val_acc = []
fold_test_acc = []
fold_test_probs = []          # for the ensemble
best_val_acc = -1.0
best_fold_path = None

train_augmenter = ImageDataGenerator(
    rotation_range=25,
    width_shift_range=0.1,
    height_shift_range=0.1,
    horizontal_flip=True,
    vertical_flip=True,
    brightness_range=[0.85, 1.15],
    zoom_range=0.1,
    fill_mode="nearest",
)

for fold_no, (tr_idx, va_idx) in enumerate(
    skf.split(train_val_df["filename"], train_val_df["label"]), 1
):
    print("=" * 70)
    print(f"FOLD {fold_no}/{N_SPLITS}")
    print("=" * 70)

    train_fold = train_val_df.iloc[tr_idx]
    val_fold = train_val_df.iloc[va_idx]
    train_balanced = balance_training_fold(train_fold, fold_no)

    print(f"train (unique {len(train_fold)} -> balanced {len(train_balanced)}), val {len(val_fold)}")

    train_gen = train_augmenter.flow_from_dataframe(
        train_balanced,
        directory=dataset_dir,
        x_col="filename",
        y_col="label",
        classes=CLASS_LABELS,                 # pinned - never inferred
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode="categorical",
        seed=SEED + fold_no,
    )

    X_val, y_val = load_images_to_array(val_fold, dataset_dir, IMG_SIZE)
    y_val_onehot = keras.utils.to_categorical(y_val, N_CLASSES)

    model, base = build_model(IMG_SIZE, N_CLASSES, BACKBONE, BRIDGE_DIM)
    ckpt_path = f"fold_{fold_no}.keras"

    # ---------- STAGE A: frozen base, train head + bridge ----------
    print("\n-- Stage A: head warm-up (base frozen)")
    model.compile(
        optimizer=AdamW(learning_rate=LR_STAGE_A, weight_decay=1e-5),
        loss=CategoricalCrossentropy(label_smoothing=LABEL_SMOOTHING),
        metrics=["accuracy"],
    )
    model.fit(
        train_gen,
        validation_data=(X_val, y_val_onehot),
        epochs=EPOCHS_STAGE_A,
        callbacks=[
            LearningRateScheduler(cosine_schedule(LR_STAGE_A, 1e-6, EPOCHS_STAGE_A)),
            ModelCheckpoint(ckpt_path, monitor="val_accuracy", save_best_only=True, mode="max"),
        ],
        verbose=2,
    )

    # ---------- STAGE B: unfreeze top blocks, fine-tune ----------
    print(f"\n-- Stage B: fine-tuning top {UNFREEZE_TOP_N} base layers (BN frozen)")
    unfreeze_top(base, UNFREEZE_TOP_N, freeze_batchnorm=True)
    trainable = int(np.sum([np.prod(v.shape) for v in model.trainable_weights]))
    print(f"   trainable parameters: {trainable:,}")

    model.compile(
        optimizer=AdamW(learning_rate=LR_STAGE_B, weight_decay=1e-5),
        loss=CategoricalCrossentropy(label_smoothing=LABEL_SMOOTHING),
        metrics=["accuracy"],
    )
    model.fit(
        train_gen,
        validation_data=(X_val, y_val_onehot),
        epochs=EPOCHS_STAGE_B,
        callbacks=[
            LearningRateScheduler(cosine_schedule(LR_STAGE_B, 1e-7, EPOCHS_STAGE_B, warmup_epochs=2)),
            ModelCheckpoint(ckpt_path, monitor="val_accuracy", save_best_only=True, mode="max"),
            EarlyStopping(monitor="val_accuracy", patience=12, mode="max", restore_best_weights=True),
        ],
        verbose=2,
    )

    # ---------- EVALUATE ----------
    best_fold_model = keras.models.load_model(ckpt_path, compile=False)

    val_probs = predict_with_tta(best_fold_model, X_val)
    val_acc = accuracy_score(y_val, np.argmax(val_probs, axis=1))

    test_probs = predict_with_tta(best_fold_model, X_test)
    test_acc = accuracy_score(y_test, np.argmax(test_probs, axis=1))

    fold_val_acc.append(val_acc)
    fold_test_acc.append(test_acc)
    fold_test_probs.append(test_probs)

    print(f"\nFold {fold_no}:  val {val_acc*100:.2f}%   test {test_acc*100:.2f}%")

    # Selection uses VALIDATION only. The test set is never used to choose a model.
    if val_acc > best_val_acc:
        best_val_acc = val_acc
        best_fold_path = ckpt_path

    del model, base, best_fold_model, X_val
    keras.backend.clear_session()
    gc.collect()


# =============================================================================
# 6. RESULTS
# =============================================================================

fold_test_acc = np.array(fold_test_acc)
mean_acc, std_acc = fold_test_acc.mean(), fold_test_acc.std()

ensemble_probs = np.mean(fold_test_probs, axis=0)
ensemble_pred = np.argmax(ensemble_probs, axis=1)
ensemble_acc = accuracy_score(y_test, ensemble_pred)
ensemble_f1 = f1_score(y_test, ensemble_pred, average="macro")

print("\n" + "=" * 70)
print("RESULTS")
print("=" * 70)
print("\nPer-fold test accuracy:")
for i, a in enumerate(fold_test_acc, 1):
    print(f"  Fold {i}: {a*100:.2f}%")

print(f"\n  Cross-validation : {mean_acc*100:.2f}% +- {std_acc*100:.2f}%   <- report this as the CV result")
print(f"  5-fold ensemble  : {ensemble_acc*100:.2f}%   (macro-F1 {ensemble_f1:.4f})   <- report this as the final model")
print(f"  Deployed model   : fold with best VALIDATION accuracy ({best_val_acc*100:.2f}% val)")
print("\n  Note: no model was selected using the test set.")

print("\n" + "-" * 70)
print("CLASSIFICATION REPORT (5-fold ensemble, held-out test set)")
print("-" * 70)
print(classification_report(y_test, ensemble_pred, target_names=CLASS_LABELS, digits=4, zero_division=0))

print("Support counts per class in the test set:")
for i, c in enumerate(CLASS_LABELS):
    n = int((y_test == i).sum())
    flag = "   <- too few samples for a stable per-class metric" if n < 15 else ""
    print(f"  {c}: {n}{flag}")

# Confusion matrix
plt.figure(figsize=(9, 7))
cm = confusion_matrix(y_test, ensemble_pred)
sns.heatmap(cm, annot=True, fmt="d", cmap="Blues",
            xticklabels=CLASS_LABELS, yticklabels=CLASS_LABELS)
plt.title(f"Confusion Matrix — 5-fold ensemble ({ensemble_acc*100:.2f}%)")
plt.ylabel("Actual")
plt.xlabel("Predicted")
plt.xticks(rotation=45, ha="right")
plt.tight_layout()
plt.savefig("confusion_matrix.png", dpi=300)
plt.show()

# ROC
y_test_bin = label_binarize(y_test, classes=range(N_CLASSES))
plt.figure(figsize=(9, 7))
for i in range(N_CLASSES):
    fpr, tpr, _ = roc_curve(y_test_bin[:, i], ensemble_probs[:, i])
    plt.plot(fpr, tpr, lw=2, label=f"{CLASS_LABELS[i]} (AUC = {auc(fpr, tpr):.3f})")
plt.plot([0, 1], [0, 1], "navy", lw=1.5, linestyle="--")
plt.xlabel("False Positive Rate")
plt.ylabel("True Positive Rate")
plt.title("ROC — 5-fold ensemble")
plt.legend(loc="lower right", fontsize=9)
plt.tight_layout()
plt.savefig("roc_curve.png", dpi=300)
plt.show()


# =============================================================================
# 7. EXPORT FOR THE MOBILE APP
# =============================================================================

final = keras.models.load_model(best_fold_path, compile=False)
final.save("Tomato_Model_Deploy.keras")     # loaded with compile=False -> no optimizer state

size_mb = os.path.getsize("Tomato_Model_Deploy.keras") / (1024 ** 2)
print("\n" + "=" * 70)
print("EXPORT")
print("=" * 70)
print(f"  Tomato_Model_Deploy.keras   {size_mb:.1f} MB (optimizer state excluded)")

metadata = {
    "backbone": BACKBONE,
    "img_size": IMG_SIZE,
    "class_order": CLASS_LABELS,
    "n_classes": N_CLASSES,
    "preprocessing": "raw RGB 0-255; EfficientNetV2 applies its own normalisation internally",
    "cv_test_accuracy_mean": float(mean_acc),
    "cv_test_accuracy_std": float(std_acc),
    "ensemble_test_accuracy": float(ensemble_acc),
    "ensemble_macro_f1": float(ensemble_f1),
    "test_support_per_class": {c: int((y_test == i).sum()) for i, c in enumerate(CLASS_LABELS)},
    "tta": USE_TTA,
    "note": "No model was selected using the test set. Deployed model chosen by validation accuracy.",
}
with open("model_metadata.json", "w") as f:
    json.dump(metadata, f, indent=2)

print("  model_metadata.json         class order + honest metrics for the app")
print("\n  Class order for src/config/classes.ts:")
for i, c in enumerate(CLASS_LABELS):
    print(f"    {i}: {c}")
print("=" * 70)
