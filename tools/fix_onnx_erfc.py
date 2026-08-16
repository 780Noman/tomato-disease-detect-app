"""
Replaces the unregistered TFL_Erfc nodes in a tf2onnx-converted model with an
exact ONNX equivalent.

WHY
---
The delivered .tflite cannot run on-device: it carries 800+ TF Select ("Flex")
operators (tools/inspect_tflite_ops.py). It also cannot run under
tf.lite.Interpreter on Windows, because the Windows TensorFlow wheel ships no
Flex delegate library at all.

tf2onnx converts it anyway — Flex ops ARE TensorFlow ops, and tf2onnx knows how
to map those. Every operator converts except two:

    ERROR - Tensorflow op [.../Gelu/Erfc: TFL_Erfc] is not supported
    ERROR - Unsupported ops: Counter({'TFL_Erfc': 2})

so onnxruntime refuses the graph with:

    No Op registered for TFL_Erfc with domain_version of 17

WHAT THIS DOES
--------------
Erfc is the complementary error function, and it is defined exactly as

    erfc(x) = 1 - erf(x)

ONNX has had `Erf` since opset 9, so each TFL_Erfc node is rewritten as
Cast -> Erf -> Sub -> Cast. This is an identity, not an approximation: no
accuracy is traded away.

The casts are deliberate. The graph is float16 (the model was float16
quantised), and ONNX Runtime's CPU kernel coverage for float16 is patchy, so the
arithmetic is done in float32 and cast back to the tensor's declared type. Two
nodes out of ~1800 running in float32 costs nothing measurable.

RUN
    python tools/fix_onnx_erfc.py in.onnx out.onnx
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import onnx
from onnx import TensorProto, helper, numpy_helper

TARGET_OP = "TFL_Erfc"


def elem_types(model: onnx.ModelProto) -> dict[str, int]:
    """tensor name -> onnx elem_type, gathered from every declaration there is."""
    try:
        inferred = onnx.shape_inference.infer_shapes(model, strict_mode=False)
    except Exception:  # noqa: BLE001 - inference is best-effort here
        inferred = model

    types: dict[str, int] = {}
    graph = inferred.graph
    for collection in (graph.input, graph.output, graph.value_info):
        for value in collection:
            types[value.name] = value.type.tensor_type.elem_type
    for initializer in graph.initializer:
        types[initializer.name] = initializer.data_type
    return types


def main() -> int:
    if len(sys.argv) != 3:
        sys.exit("Usage: python tools/fix_onnx_erfc.py in.onnx out.onnx")
    source, destination = Path(sys.argv[1]), Path(sys.argv[2])

    print(f"Loading {source} ({source.stat().st_size / 1024**2:.1f} MB) ...")
    model = onnx.load(str(source))
    graph = model.graph

    targets = [node for node in graph.node if node.op_type == TARGET_OP]
    print(f"Found {len(targets)} {TARGET_OP} node(s) out of {len(graph.node)} total.")
    if not targets:
        print("Nothing to rewrite.")
        return 0

    types = elem_types(model)

    one = numpy_helper.from_array(np.array(1.0, dtype=np.float32), name="erfc_one_f32")
    graph.initializer.append(one)

    rebuilt = []
    for node in graph.node:
        if node.op_type != TARGET_OP:
            rebuilt.append(node)
            continue

        source_tensor = node.input[0]
        result_tensor = node.output[0]
        # Fall back to float16 only because that is what this graph uses; say so
        # rather than silently guessing.
        out_type = types.get(result_tensor) or types.get(source_tensor)
        if out_type in (None, 0):
            out_type = TensorProto.FLOAT16
            print(f"  {node.name}: dtype not declared, assuming float16")

        stem = node.name or f"erfc_{len(rebuilt)}"
        rebuilt.extend(
            [
                helper.make_node(
                    "Cast", [source_tensor], [f"{stem}__x32"],
                    to=TensorProto.FLOAT, name=f"{stem}__cast_in",
                ),
                helper.make_node("Erf", [f"{stem}__x32"], [f"{stem}__erf"], name=f"{stem}__erf"),
                helper.make_node(
                    "Sub", ["erfc_one_f32", f"{stem}__erf"], [f"{stem}__erfc32"],
                    name=f"{stem}__sub",
                ),
                helper.make_node(
                    "Cast", [f"{stem}__erfc32"], [result_tensor],
                    to=out_type, name=f"{stem}__cast_out",
                ),
            ]
        )
        print(f"  rewrote {stem} (erfc -> 1 - erf, in float32)")

    del graph.node[:]
    graph.node.extend(rebuilt)

    onnx.checker.check_model(model, full_check=False)
    onnx.save(model, str(destination))
    print(f"\nSaved {destination} ({destination.stat().st_size / 1024**2:.1f} MB)")

    remaining = {n.op_type for n in model.graph.node if n.op_type.startswith("TFL_")}
    if remaining:
        print(f"WARNING: still carries non-standard ops: {sorted(remaining)}")
        return 1
    print("No TFL_* ops remain.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
