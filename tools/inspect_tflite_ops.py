"""
=============================================================================
OFFLINE TFLITE OPERATOR AUDIT - pure standard library, no TensorFlow required
=============================================================================

Why this exists
---------------
The release APK loads the model successfully, then fails inside
`TfLiteInterpreterAllocateTensors` with

    TFLite: Failed to allocate memory for input/output tensors!
    Status: unresolved-ops

The wording blames memory; the status does not. `kTfLiteUnresolvedOps` means
the interpreter's op resolver found no implementation for one or more
operators in the graph. The usual cause is a conversion that emitted TF
Select ("Flex") ops, which need a delegate that react-native-fast-tflite
does not bundle; the other cause is a genuine custom op.

This script answers the question from the model's own bytes: exactly which
operators the graph contains, and which of them a stock TFLite runtime
cannot resolve. It reuses the FlatBuffer reader in
inspect_tflite_offline.py, so it needs nothing installed.

RUN
    python tools/inspect_tflite_ops.py assets/model/Tomato_Model_Mobile.tflite
=============================================================================
"""

import sys
from collections import Counter

from inspect_tflite_offline import Table, i32, u32

# Builtin codes a stock TFLite build always resolves. Any name printed as
# BUILTIN_<n> below is simply one this script has no label for -- that is a
# gap in this table, NOT evidence that the runtime cannot resolve it. Only
# CUSTOM ops are reported as unresolvable.
BUILTIN_NAMES = {
    0: "ADD", 1: "AVERAGE_POOL_2D", 2: "CONCATENATION", 3: "CONV_2D",
    4: "DEPTHWISE_CONV_2D", 6: "DEQUANTIZE", 9: "FULLY_CONNECTED",
    14: "LOGISTIC", 17: "MAX_POOL_2D", 18: "MUL", 22: "RESHAPE",
    25: "SOFTMAX", 28: "TANH", 34: "PAD", 40: "MEAN", 41: "SUB", 42: "DIV",
    53: "CAST", 57: "MEAN", 77: "REDUCE_MAX", 83: "PACK", 97: "QUANTIZE",
    114: "GELU", 123: "HARD_SWISH",
}

CUSTOM_BUILTIN_CODE = 32  # BuiltinOperator.CUSTOM


def opcode_details(oc):
    """Returns (label, builtin_code, custom_code, version)."""
    deprecated = oc.scalar(0, lambda b, o: b[o], 0)
    builtin = oc.scalar(3, i32, deprecated)
    code = builtin if builtin else deprecated
    custom = oc.string(1)
    version = oc.scalar(2, i32, 1)
    if custom:
        return f"CUSTOM:{custom}", code, custom, version
    return BUILTIN_NAMES.get(code, f"BUILTIN_{code}"), code, None, version


def main():
    if len(sys.argv) != 2:
        sys.exit("Usage: python tools/inspect_tflite_ops.py path/to/model.tflite")
    path = sys.argv[1]
    with open(path, "rb") as f:
        buf = f.read()

    if buf[4:8] != b"TFL3":
        sys.exit(f"Not a TFLite v3 flatbuffer (identifier {buf[4:8]!r}).")

    model = Table(buf, u32(buf, 0))
    opcodes = model.vec_tables(1)
    subgraphs = model.vec_tables(2)

    print("=" * 70)
    print("TFLITE OPERATOR AUDIT")
    print(f"File            : {path}")
    print(f"Size            : {len(buf) / 1024 ** 2:.1f} MB")
    print(f"Schema version  : {model.scalar(0, u32)}")
    print(f"Subgraphs       : {len(subgraphs)}")
    print(f"Distinct opcodes: {len(opcodes)}")
    print("=" * 70)

    details = [opcode_details(oc) for oc in opcodes]

    # Count actual uses across every subgraph, not just the opcode table:
    # an entry can be declared and never used.
    usage = Counter()
    for index, sg in enumerate(subgraphs):
        operators = sg.vec_tables(3)
        print(f"\nSubgraph {index}: {len(operators)} operators, "
              f"name={sg.string(4) or '(unnamed)'}")
        for op in operators:
            usage[op.scalar(0, u32)] += 1

    print("\n" + "-" * 70)
    print("OPERATORS USED (by frequency)")
    print("-" * 70)
    for opcode_index, count in usage.most_common():
        label, code, custom, version = details[opcode_index]
        marker = "  <-- CUSTOM" if custom else ""
        print(f"  {count:6d}x  {label:32s} (code={code}, v={version}){marker}")

    declared_unused = set(range(len(opcodes))) - set(usage)
    if declared_unused:
        print("\nDeclared but never used:")
        for i in sorted(declared_unused):
            print(f"  {details[i][0]}")

    # ---- The verdict -------------------------------------------------------
    customs = [
        (details[i][2], usage[i])
        for i in usage
        if details[i][2] is not None
    ]
    flex = [(name, n) for name, n in customs if name.startswith("Flex")]

    print("\n" + "=" * 70)
    print("VERDICT")
    print("=" * 70)
    if not customs:
        print("No CUSTOM operators. Every op in this graph is a TFLite builtin,")
        print("so `unresolved-ops` is NOT caused by Flex/TF-Select ops. The next")
        print("suspect is a builtin whose *version* is newer than the runtime's")
        print("registered kernel version -- check the v= numbers above against")
        print("the TFLite runtime bundled by react-native-fast-tflite.")
        print("\nPASS: this model can be resolved by a stock TFLite interpreter.")
        return 0
    else:
        print(f"{len(customs)} CUSTOM operator(s) found -- a stock TFLite")
        print("interpreter cannot resolve these, which is exactly what")
        print("`kTfLiteUnresolvedOps` reports:")
        for name, count in sorted(customs, key=lambda pair: -pair[1]):
            print(f"    {count:6d}x  {name}")
        if flex:
            print("\nThese are TF Select (Flex) ops. They exist because the")
            print("conversion allowed tf.lite.OpsSet.SELECT_TF_OPS. Running them")
            print("needs the Flex delegate, which react-native-fast-tflite does")
            print("not bundle. FIX: re-export with TFLITE_BUILTINS only --")
            print("see tools/convert_tflite_builtins_only.py.")
        print("\nFAIL: this model cannot run on-device. Do not build an APK with it.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
