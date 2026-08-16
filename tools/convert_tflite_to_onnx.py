"""
Converts the delivered .tflite into a runnable ONNX model, and verifies it.

    python tools/convert_tflite_to_onnx.py \
        assets/model/Tomato_Model_Mobile.tflite \
        server/models/Tomato_Model.onnx

WHY THIS EXISTS
---------------
The delivered Tomato_Model_Mobile.tflite cannot be executed by any stock TFLite
interpreter. tools/inspect_tflite_ops.py reads its bytes and finds 800+ TF Select
("Flex") operators — 201x FlexConv2D, 198x FlexMul, 191x FlexSigmoid and more.
Flex ops are TensorFlow ops, not TFLite ops, so running them needs the Flex
delegate:

  * react-native-fast-tflite does not bundle it (it is ~100 MB on its own), so
    on-device fails with kTfLiteUnresolvedOps.
  * The Windows TensorFlow wheel ships no Flex delegate library either — checked,
    there is nothing matching *flex* in site-packages/tensorflow. So even the
    "full TensorFlow" server path fails here with
    "Select TensorFlow op(s) ... Node number 1 (FlexMul) failed to prepare".

ONNX sidesteps the whole problem. Flex ops ARE TensorFlow ops, and tf2onnx knows
how to map TensorFlow ops to standard ONNX operators, so the Flex-ness stops
mattering. The result runs under plain onnxruntime — no TensorFlow at runtime,
~100 ms per image on CPU.

Exactly two operators do not map: TFL_Erfc, from an exact (erf-based) GELU.
Those are rewritten as 1 - Erf(x), which is the definition of erfc and therefore
an identity, not an approximation. See tools/fix_onnx_erfc.py.

This does NOT fix the model's real problem. Accuracy remains unsettled and the
export is still a messy graph (415 CAST ops from a dynamic input shape). A clean
re-export from the .keras source is still the better artefact — see
tools/convert_tflite_builtins_only.py — but that needs the training code, and
this does not.

REQUIREMENTS (server/.venv only, never global)
    pip install tensorflow tf2onnx onnxruntime
TensorFlow is needed only for the conversion, not to serve the result.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

OPSET = 17
IMG_SIZE = 224
N_CLASSES = 6


def run_tf2onnx(source: Path, destination: Path) -> None:
    print(f"[1/3] tf2onnx: {source.name} -> {destination.name}")
    # Run as a subprocess so tf2onnx's own logging (including the list of
    # unsupported ops) reaches the console verbatim.
    result = subprocess.run(
        [
            sys.executable, "-m", "tf2onnx.convert",
            "--tflite", str(source),
            "--output", str(destination),
            "--opset", str(OPSET),
        ],
        check=False,
    )
    if result.returncode != 0:
        raise SystemExit(
            f"tf2onnx failed with exit code {result.returncode}. "
            "The output above names the operators it could not convert."
        )
    if not destination.is_file():
        raise SystemExit("tf2onnx reported success but wrote no file.")


def rewrite_erfc(path: Path) -> None:
    print(f"\n[2/3] rewriting unsupported ops in {path.name}")
    result = subprocess.run(
        [sys.executable, str(Path(__file__).with_name("fix_onnx_erfc.py")), str(path), str(path)],
        check=False,
    )
    if result.returncode != 0:
        raise SystemExit("The graph still carries operators onnxruntime cannot run.")


def verify(path: Path) -> None:
    """The check that matters: can a stock onnxruntime actually run this?"""
    print(f"\n[3/3] verifying {path.name} with onnxruntime")
    import numpy as np
    import onnxruntime as ort

    session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    model_input = session.get_inputs()[0]
    model_output = session.get_outputs()[0]
    print(f"      input : {model_input.name} {model_input.shape} {model_input.type}")
    print(f"      output: {model_output.name} {model_output.shape} {model_output.type}")

    problems: list[str] = []
    spatial = [d for d in model_input.shape[1:] if isinstance(d, int)]
    if spatial != [IMG_SIZE, IMG_SIZE, 3]:
        problems.append(f"input does not end in [{IMG_SIZE}, {IMG_SIZE}, 3]: {model_input.shape}")

    dtype = np.float16 if "float16" in model_input.type else np.float32
    probe = np.zeros((1, IMG_SIZE, IMG_SIZE, 3), dtype=dtype)
    vector = np.asarray(session.run([model_output.name], {model_input.name: probe})[0][0],
                        dtype=np.float32)

    if vector.shape != (N_CLASSES,):
        problems.append(f"output is {vector.shape}, expected ({N_CLASSES},)")
    total = float(vector.sum())
    print(f"      probe output sums to {total:.4f} (softmax in graph => ~1.0)")
    if abs(total - 1.0) > 0.01:
        problems.append(
            f"output sums to {total:.4f}, not ~1.0 — the graph may end in logits, which would "
            "mean the server must apply softmax itself"
        )

    if problems:
        print("\nPROBLEMS:")
        for problem in problems:
            print(f"  - {problem}")
        raise SystemExit(1)

    size_mb = path.stat().st_size / 1024**2
    print(f"\nDONE. {path} ({size_mb:.1f} MB) runs under stock onnxruntime.")
    print("Place it at server/models/Tomato_Model.onnx; the server prefers ONNX.")


def main() -> int:
    if len(sys.argv) != 3:
        sys.exit("Usage: python tools/convert_tflite_to_onnx.py in.tflite out.onnx")
    source, destination = Path(sys.argv[1]), Path(sys.argv[2])
    if not source.is_file():
        sys.exit(f"No such file: {source}")
    destination.parent.mkdir(parents=True, exist_ok=True)

    run_tf2onnx(source, destination)
    rewrite_erfc(destination)
    verify(destination)
    return 0


if __name__ == "__main__":
    sys.exit(main())
