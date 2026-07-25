"""
=============================================================================
TFLITE MODEL INSPECTION — run this BEFORE wiring the model into the app
=============================================================================

Why this exists
---------------
A mobile model is a black box until you inspect it. If the app assumes the
wrong input shape, the wrong normalisation, or the wrong class-index order,
it will show a confident WRONG diagnosis on every scan and never error out.
This script reads those facts directly from the file so nothing is guessed.

What it reports
---------------
  1. Input : shape, dtype, and (if quantised) the scale/zero-point
  2. Output: shape, dtype, and quantisation params
  3. Whether the model expects 0-255 or 0-1 or int8 input
  4. A sanity inference on a dummy image (does it run? does it sum to 1?)
  5. Everything config/classes.ts and the TFLiteProvider need

INSTALL
    pip install tensorflow numpy pillow
    # or, lighter:
    pip install tflite-runtime numpy pillow

RUN
    python inspect_tflite.py path/to/model.tflite
    python inspect_tflite.py path/to/model.tflite --labels path/to/labels.txt
=============================================================================
"""

import sys
import argparse
import numpy as np

# Prefer the full TF interpreter; fall back to the lite runtime.
try:
    import tensorflow as tf
    Interpreter = tf.lite.Interpreter
    BACKEND = "tensorflow"
except ImportError:
    try:
        from tflite_runtime.interpreter import Interpreter
        BACKEND = "tflite_runtime"
    except ImportError:
        sys.exit("Install tensorflow OR tflite-runtime first.")


EXPECTED_CLASS_ORDER = [
    "tomato__JAS_MIT",   # 0
    "tomato__K",         # 1
    "tomato__LM",        # 2
    "tomato__MIT",       # 3
    "tomato__N",         # 4
    "tomato__N_K",       # 5
]


def human_dtype(dt):
    return {
        np.float32: "float32", np.float16: "float16",
        np.uint8: "uint8 (quantised)", np.int8: "int8 (quantised)",
    }.get(dt, str(dt))


def describe_tensor(detail, role):
    print(f"\n{role}")
    print(f"  name        : {detail['name']}")
    print(f"  shape       : {list(detail['shape'])}")
    print(f"  dtype       : {human_dtype(detail['dtype'])}")
    scale, zero = detail.get("quantization", (0.0, 0))
    if scale not in (0.0, None):
        print(f"  quantization: scale={scale}, zero_point={zero}")
        print(f"  -> to dequantise: real = (value - {zero}) * {scale}")
    else:
        print(f"  quantization: none (float model)")
    return detail


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("model")
    ap.add_argument("--labels", default=None, help="optional labels.txt, one class per line")
    args = ap.parse_args()

    print("=" * 70)
    print(f"TFLITE MODEL INSPECTION   (backend: {BACKEND})")
    print(f"File: {args.model}")
    print("=" * 70)

    import os
    size_mb = os.path.getsize(args.model) / (1024 ** 2)
    print(f"File size: {size_mb:.1f} MB")

    interp = Interpreter(model_path=args.model)
    interp.allocate_tensors()

    in_detail = interp.get_input_details()[0]
    out_detail = interp.get_output_details()[0]

    describe_tensor(in_detail, "INPUT TENSOR")
    describe_tensor(out_detail, "OUTPUT TENSOR")

    # ---- Interpret the input contract -------------------------------------
    print("\n" + "-" * 70)
    print("INPUT CONTRACT (what the app must feed the model)")
    print("-" * 70)
    ishape = list(in_detail["shape"])
    idtype = in_detail["dtype"]

    if len(ishape) == 4:
        _, h, w, c = ishape
        print(f"  Expects a {h}x{w} image with {c} channel(s), batch size {ishape[0]}.")
    else:
        print(f"  Unusual input rank: {ishape}. Check the export.")

    in_scale, in_zero = in_detail.get("quantization", (0.0, 0))
    if idtype in (np.uint8, np.int8):
        print(f"  Input is QUANTISED ({human_dtype(idtype)}).")
        print(f"  Feed raw pixels mapped through: q = real/{in_scale} + {in_zero}")
        print("  In practice: for a uint8 [0,255] export you usually feed raw bytes as-is.")
    else:
        print(f"  Input is FLOAT ({human_dtype(idtype)}).")
        print("  You must confirm normalisation:")
        print("    - EfficientNetV2 with include_preprocessing=True -> feed raw 0-255")
        print("    - otherwise the model may expect 0-1 or ImageNet mean/std")
        print("  The training script used raw 0-255 (EfficientNetV2 normalises internally).")

    # ---- Interpret the output contract ------------------------------------
    print("\n" + "-" * 70)
    print("OUTPUT CONTRACT (what the app receives)")
    print("-" * 70)
    oshape = list(out_detail["shape"])
    n_out = oshape[-1]
    print(f"  Output shape {oshape} -> {n_out} class scores.")
    if n_out != len(EXPECTED_CLASS_ORDER):
        print(f"  WARNING: expected {len(EXPECTED_CLASS_ORDER)} classes, model outputs {n_out}.")
        print("  Do NOT proceed until this matches. The class list is wrong somewhere.")
    else:
        print(f"  Matches the expected 6-class setup.")

    # ---- Dummy inference ---------------------------------------------------
    print("\n" + "-" * 70)
    print("SANITY INFERENCE (dummy mid-grey image)")
    print("-" * 70)
    if idtype in (np.uint8, np.int8):
        dummy = np.full(ishape, 128, dtype=idtype)
    else:
        dummy = np.full(ishape, 128.0, dtype=np.float32)

    interp.set_tensor(in_detail["index"], dummy)
    interp.invoke()
    out = interp.get_tensor(out_detail["index"])[0].astype(np.float32)

    # Dequantise output if needed
    out_scale, out_zero = out_detail.get("quantization", (0.0, 0))
    if out_detail["dtype"] in (np.uint8, np.int8) and out_scale not in (0.0, None):
        out = (out - out_zero) * out_scale

    print(f"  Raw output vector: {np.round(out, 4).tolist()}")
    print(f"  Sum of outputs   : {out.sum():.4f}  (softmax output sums to ~1.0)")
    if abs(out.sum() - 1.0) > 0.05:
        print("  NOTE: output does not sum to 1. The final softmax may be outside the")
        print("        TFLite graph. The app must apply softmax itself, OR treat these")
        print("        as logits. Confirm with the export code.")
    else:
        print("  Output sums to ~1.0 -> softmax is inside the model; use values directly.")

    top = int(np.argmax(out))
    print(f"  Argmax index     : {top}")

    # ---- Labels ------------------------------------------------------------
    print("\n" + "-" * 70)
    print("CLASS ORDER")
    print("-" * 70)
    if args.labels:
        with open(args.labels) as f:
            labels = [ln.strip() for ln in f if ln.strip()]
        print(f"  labels.txt ({len(labels)} entries):")
        for i, lab in enumerate(labels):
            print(f"    {i}: {lab}")
        if labels == EXPECTED_CLASS_ORDER:
            print("  MATCHES the expected alphabetical order. Safe to use as-is.")
        else:
            print("  DIFFERS from the expected order. Use labels.txt as the source of truth,")
            print("  and set this exact order in src/config/classes.ts.")
    else:
        print("  No labels.txt supplied.")
        print("  The .tflite file does NOT contain class names by itself.")
        print("  You MUST obtain the class order from one of:")
        print("    - model_metadata.json  (class_order field)  <- best")
        print("    - a labels.txt exported alongside the model")
        print("    - the training generator's class_indices")
        print("\n  Expected order (from alphabetical folder sort, UNVERIFIED):")
        for i, c in enumerate(EXPECTED_CLASS_ORDER):
            print(f"    {i}: {c}")

    # ---- Summary for the app ----------------------------------------------
    print("\n" + "=" * 70)
    print("SUMMARY FOR src/config + TFLiteProvider")
    print("=" * 70)
    print(f"  input_shape        : {ishape}")
    print(f"  input_dtype        : {human_dtype(idtype)}")
    print(f"  input_normalisation: {'quantised, feed raw bytes' if idtype in (np.uint8, np.int8) else 'float, feed raw 0-255 (confirm)'}")
    print(f"  output_shape       : {oshape}")
    print(f"  output_is_softmax  : {abs(out.sum() - 1.0) <= 0.05}")
    print(f"  num_classes        : {n_out}")
    print(f"  class_order        : {'from labels.txt above' if args.labels else 'PENDING - get from model_metadata.json'}")
    print(f"  file_size_mb       : {size_mb:.1f}")
    print("=" * 70)
    print("\nNext: put these values in the plan, then wire TFLiteProvider to match EXACTLY.")


if __name__ == "__main__":
    main()
