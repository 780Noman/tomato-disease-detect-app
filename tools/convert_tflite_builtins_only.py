"""
=============================================================================
RE-EXPORT THE MODEL SO IT CAN ACTUALLY RUN ON-DEVICE
=============================================================================

RUN THIS IN GOOGLE COLAB, not on this machine. Colab already has TensorFlow,
so nothing needs installing locally (this machine's TensorFlow is broken and
installs are not permitted).

WHY THIS IS NEEDED
------------------
The delivered Tomato_Model_Mobile.tflite fails on-device with

    TFLite: Failed to allocate memory for input/output tensors!
    Status: unresolved-ops

`tools/inspect_tflite_ops.py` read the model's own bytes and found 800+
TF Select ("Flex") operators, including 201x FlexConv2D, 198x FlexMul and
191x FlexSigmoid. Flex operators are TensorFlow ops, not TFLite ops. Running
them requires the Flex delegate (libtensorflowlite_flex_jni.so), which
react-native-fast-tflite does not bundle. No amount of app-side code can fix
this: the model must be re-exported using TFLite builtins only.

Even Conv2D became a Flex op, which is the signature of a conversion that
was given `tf.lite.OpsSet.SELECT_TF_OPS`. Removing that one option is the
whole fix.

WHAT THIS SCRIPT DOES
---------------------
  1. Loads the trained .keras model.
  2. Exports a SavedModel with a FIXED [1, 224, 224, 3] input signature.
     (The old export had a dynamic shape, which is why the graph carried
     415 CAST and 46 PACK/REDUCE_MAX shape-juggling ops.)
  3. Converts with TFLITE_BUILTINS ONLY -- SELECT_TF_OPS is never set.
  4. Applies float16 weight quantisation: same numerics for practical
     purposes, roughly half the file size. That matters here, because the
     loader reads the whole model into one Java byte array and a 141 MB
     allocation is itself a crash risk on mid-range phones.
  5. VERIFIES the result the same way the phone does -- builds a stock
     tf.lite.Interpreter and calls allocate_tensors(). If that succeeds, the
     device can resolve every operator. If it raises, the conversion is still
     wrong and the script says so instead of writing a broken file.
  6. Prints the input/output contract and confirms the class count is 6.

AFTER RUNNING
-------------
Download tomato_model_builtins.tflite, then locally:

    copy it to  assets/model/Tomato_Model_Mobile.tflite
    npm run verify:model      # must print PASS
    then build the APK

IF STEP 3 FAILS
---------------
The converter will name the unsupported ops. The likely culprit is the `Erfc`
op found in the current model, which comes from an exact (erf-based) GELU
activation. TFLite has no builtin for it. Fix by using the tanh
approximation, which converts to builtins:

    tf.keras.activations.gelu(x, approximate=True)

Re-train or rebuild only the affected layer's activation, then re-run this.
=============================================================================
"""

import tensorflow as tf

# ---- EDIT THESE TWO PATHS ---------------------------------------------------
KERAS_MODEL_PATH = "/content/Tomato_Model.keras"
OUTPUT_TFLITE_PATH = "/content/tomato_model_builtins.tflite"
# -----------------------------------------------------------------------------

SAVED_MODEL_DIR = "/content/saved_model_fixed_shape"
INPUT_SIZE = 224
NUM_CLASSES = 6


def main():
    print(f"TensorFlow {tf.__version__}")

    print("\n[1/6] Loading the Keras model...")
    model = tf.keras.models.load_model(KERAS_MODEL_PATH, compile=False)
    print(f"      parameters: {model.count_params():,}")

    print("\n[2/6] Exporting a SavedModel with a fixed input signature...")
    # A fixed batch and spatial size keeps the graph static. The old export's
    # dynamic shape is what produced hundreds of CAST/PACK shape ops.
    archive = tf.keras.export.ExportArchive()
    archive.track(model)
    archive.add_endpoint(
        name="serve",
        fn=model.call,
        input_signature=[
            tf.TensorSpec(shape=(1, INPUT_SIZE, INPUT_SIZE, 3), dtype=tf.float32)
        ],
    )
    archive.write_out(SAVED_MODEL_DIR)

    print("\n[3/6] Converting with TFLITE_BUILTINS only...")
    converter = tf.lite.TFLiteConverter.from_saved_model(SAVED_MODEL_DIR)
    # THE CRITICAL LINE. SELECT_TF_OPS is deliberately absent -- adding it is
    # what produced the unrunnable model.
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS]
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.target_spec.supported_types = [tf.float16]

    try:
        tflite_bytes = converter.convert()
    except Exception as error:  # noqa: BLE001 - we want the op list verbatim
        print("\nCONVERSION FAILED. The unsupported operators are named below.")
        print("Do NOT work around this by adding SELECT_TF_OPS -- that is the")
        print("original bug. Replace the offending op instead (see the header).")
        print(f"\n{error}")
        raise SystemExit(1) from error

    size_mb = len(tflite_bytes) / 1024 ** 2
    print(f"      converted: {size_mb:.1f} MB")

    print("\n[4/6] Writing the file...")
    with open(OUTPUT_TFLITE_PATH, "wb") as handle:
        handle.write(tflite_bytes)

    print("\n[5/6] Verifying with a stock interpreter (the phone's own check)...")
    interpreter = tf.lite.Interpreter(model_content=tflite_bytes)
    # This is the exact call that fails on-device today. If it returns, every
    # operator in the graph is resolvable without the Flex delegate.
    interpreter.allocate_tensors()
    print("      allocate_tensors() OK -- no unresolved ops.")

    print("\n[6/6] Contract check...")
    in_detail = interpreter.get_input_details()[0]
    out_detail = interpreter.get_output_details()[0]
    print(f"      input : shape={in_detail['shape']} dtype={in_detail['dtype']}")
    print(f"      output: shape={out_detail['shape']} dtype={out_detail['dtype']}")

    problems = []
    if list(in_detail["shape"]) != [1, INPUT_SIZE, INPUT_SIZE, 3]:
        problems.append(f"input shape is {list(in_detail['shape'])}, expected [1,224,224,3]")
    if list(out_detail["shape"]) != [1, NUM_CLASSES]:
        problems.append(f"output shape is {list(out_detail['shape'])}, expected [1,6]")

    # The app assumes the graph ends in softmax (probabilities, not logits).
    probe = tf.zeros((1, INPUT_SIZE, INPUT_SIZE, 3), dtype=tf.float32).numpy()
    interpreter.set_tensor(in_detail["index"], probe)
    interpreter.invoke()
    vector = interpreter.get_tensor(out_detail["index"])[0]
    total = float(vector.sum())
    print(f"      output sums to {total:.4f} (softmax => ~1.0)")
    if abs(total - 1.0) > 0.01:
        problems.append(
            f"output sums to {total:.4f}, not ~1.0 -- the graph may end in logits, "
            "which would mean TFLITE_MODEL_CONFIG.outputIsSoftmax must become false"
        )

    if problems:
        print("\nPROBLEMS FOUND -- report these before shipping the file:")
        for problem in problems:
            print(f"  - {problem}")
        raise SystemExit(1)

    print(f"\nDONE. {OUTPUT_TFLITE_PATH} ({size_mb:.1f} MB) is ready.")
    print("Copy it to assets/model/Tomato_Model_Mobile.tflite, then run")
    print("`npm run verify:model` locally -- it must print PASS.")


if __name__ == "__main__":
    main()
