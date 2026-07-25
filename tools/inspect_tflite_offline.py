"""
=============================================================================
OFFLINE TFLITE INSPECTION - pure standard library, no TensorFlow required
=============================================================================

Why this exists
---------------
inspect_tflite.py needs a working TensorFlow or tflite-runtime install. On
this machine TensorFlow 2.20 is present but broken (protobuf too old), and
installing anything is not permitted. A .tflite file is a FlatBuffer with a
published schema, so every static fact the app needs can be read from the
raw bytes with the standard library alone.

What it reports (all read directly from the file, nothing guessed)
------------------------------------------------------------------
  1. Input tensor : shape, dtype, quantisation params
  2. Output tensor: shape, dtype, quantisation params
  3. Whether the graph's final operator is SOFTMAX (probabilities vs logits)
  4. Embedded metadata entries and any zip-attached labels file
  5. The summary block config/classes.ts and TFLiteProvider need

What it cannot do
-----------------
Run an inference. The numeric sanity check (output sums to ~1 on a dummy
image) still requires an interpreter and remains PENDING until one is
available. The static softmax check below covers the contract question.

RUN
    python inspect_tflite_offline.py path/to/model.tflite
=============================================================================
"""

import struct
import sys
import zipfile

EXPECTED_CLASS_ORDER = [
    "tomato__JAS_MIT",  # 0
    "tomato__K",        # 1
    "tomato__LM",       # 2
    "tomato__MIT",      # 3
    "tomato__N",        # 4
    "tomato__N_K",      # 5
]

TENSOR_TYPES = {
    0: "float32", 1: "float16", 2: "int32", 3: "uint8", 4: "int64",
    5: "string", 6: "bool", 7: "int16", 8: "complex64", 9: "int8",
    10: "float64", 11: "complex128", 12: "uint64", 13: "resource",
    14: "variant", 15: "uint32", 16: "uint16", 17: "int4", 18: "bfloat16",
}

# BuiltinOperator codes needed to name the ops around the output.
BUILTIN_OPS = {
    0: "ADD", 1: "AVERAGE_POOL_2D", 2: "CONCATENATION", 3: "CONV_2D",
    4: "DEPTHWISE_CONV_2D", 9: "FULLY_CONNECTED", 14: "LOGISTIC",
    18: "MUL", 22: "RESHAPE", 25: "SOFTMAX", 28: "TANH", 34: "PAD",
    40: "MEAN", 41: "SUB", 42: "DIV", 53: "CAST", 57: "MEAN",
    77: "REDUCE_MAX", 83: "PACK", 97: "QUANTIZE", 6: "DEQUANTIZE",
    114: "GELU",
}
SOFTMAX = 25


def u16(b, o): return struct.unpack_from("<H", b, o)[0]
def i32(b, o): return struct.unpack_from("<i", b, o)[0]
def u32(b, o): return struct.unpack_from("<I", b, o)[0]
def i64(b, o): return struct.unpack_from("<q", b, o)[0]
def f32(b, o): return struct.unpack_from("<f", b, o)[0]
def u8(b, o): return b[o]


class Table:
    """Minimal FlatBuffers table reader (little-endian, per the FB spec)."""

    def __init__(self, buf, pos):
        self.b = buf
        self.pos = pos
        self.vt = pos - i32(buf, pos)
        self.vt_size = u16(buf, self.vt)

    def _slot(self, field_id):
        off = 4 + 2 * field_id
        if off >= self.vt_size:
            return 0
        return u16(self.b, self.vt + off)  # 0 means field absent

    def scalar(self, field_id, reader, default=0):
        o = self._slot(field_id)
        return reader(self.b, self.pos + o) if o else default

    def _indirect(self, field_id):
        o = self._slot(field_id)
        if not o:
            return None
        p = self.pos + o
        return p + u32(self.b, p)

    def string(self, field_id):
        p = self._indirect(field_id)
        if p is None:
            return None
        n = u32(self.b, p)
        return self.b[p + 4:p + 4 + n].decode("utf-8", "replace")

    def vector(self, field_id):
        """Returns (element_start, length) or (None, 0)."""
        p = self._indirect(field_id)
        if p is None:
            return None, 0
        return p + 4, u32(self.b, p)

    def vec_scalars(self, field_id, reader, elem_size):
        p, n = self.vector(field_id)
        if p is None:
            return []
        return [reader(self.b, p + i * elem_size) for i in range(n)]

    def vec_tables(self, field_id):
        p, n = self.vector(field_id)
        if p is None:
            return []
        out = []
        for i in range(n):
            ep = p + i * 4
            out.append(Table(self.b, ep + u32(self.b, ep)))
        return out

    def table(self, field_id):
        p = self._indirect(field_id)
        return Table(self.b, p) if p is not None else None


def tensor_info(t):
    quant = t.table(4)  # Tensor.quantization
    scales = quant.vec_scalars(2, f32, 4) if quant else []
    zeros = quant.vec_scalars(3, i64, 8) if quant else []
    return {
        "name": t.string(3),
        "shape": t.vec_scalars(0, i32, 4),
        "type": TENSOR_TYPES.get(t.scalar(1, u8), f"unknown({t.scalar(1, u8)})"),
        "scale": scales[0] if scales else None,
        "zero_point": zeros[0] if zeros else None,
    }


def describe(info, role):
    print(f"\n{role}")
    print(f"  name        : {info['name']}")
    print(f"  shape       : {info['shape']}")
    print(f"  dtype       : {info['type']}")
    if info["scale"] not in (None, 0.0):
        print(f"  quantization: scale={info['scale']}, zero_point={info['zero_point']}")
        print(f"  -> dequantise: real = (value - {info['zero_point']}) * {info['scale']}")
    else:
        print("  quantization: none (float tensor)")


def op_name(opcodes, opcode_index):
    oc = opcodes[opcode_index]
    deprecated = struct.unpack_from("<b", oc.b, oc.pos + oc._slot(0))[0] if oc._slot(0) else 0
    builtin = oc.scalar(3, i32, deprecated)
    code = builtin if builtin else deprecated
    custom = oc.string(1)
    if custom:
        return f"CUSTOM:{custom}", code
    return BUILTIN_OPS.get(code, f"BUILTIN_{code}"), code


def main():
    if len(sys.argv) != 2:
        sys.exit("Usage: python inspect_tflite_offline.py path/to/model.tflite")
    path = sys.argv[1]
    with open(path, "rb") as f:
        buf = f.read()

    print("=" * 70)
    print("OFFLINE TFLITE INSPECTION (pure stdlib flatbuffer reader)")
    print(f"File: {path}")
    print(f"File size: {len(buf) / 1024 ** 2:.1f} MB")
    print("=" * 70)

    ident = buf[4:8]
    if ident != b"TFL3":
        sys.exit(f"Not a TFLite v3 flatbuffer (identifier {ident!r}). Stopping.")

    model = Table(buf, u32(buf, 0))
    print(f"Schema version : {model.scalar(0, u32)}")
    desc = model.string(3)
    if desc:
        print(f"Description    : {desc}")

    opcodes = model.vec_tables(1)
    subgraphs = model.vec_tables(2)
    print(f"Subgraphs      : {len(subgraphs)} (inspecting subgraph 0)")
    sg = subgraphs[0]

    tensors = sg.vec_tables(0)
    inputs = sg.vec_scalars(1, i32, 4)
    outputs = sg.vec_scalars(2, i32, 4)
    operators = sg.vec_tables(3)
    print(f"Tensors        : {len(tensors)}, Operators: {len(operators)}")

    if len(inputs) != 1 or len(outputs) != 1:
        print(f"NOTE: {len(inputs)} inputs / {len(outputs)} outputs — expected 1/1.")

    in_info = tensor_info(tensors[inputs[0]])
    out_info = tensor_info(tensors[outputs[0]])
    describe(in_info, "INPUT TENSOR")
    describe(out_info, "OUTPUT TENSOR")

    # ---- Input contract ----------------------------------------------------
    print("\n" + "-" * 70)
    print("INPUT CONTRACT (what the app must feed the model)")
    print("-" * 70)
    ishape = in_info["shape"]
    if len(ishape) == 4:
        _, h, w, c = ishape
        print(f"  Expects a {h}x{w} image with {c} channel(s), batch size {ishape[0]}.")
    if in_info["type"] in ("uint8", "int8"):
        print(f"  Input is QUANTISED ({in_info['type']}).")
        print(f"  q = real/{in_info['scale']} + {in_info['zero_point']}")
    else:
        print(f"  Input is FLOAT ({in_info['type']}).")
        print("  Training used raw 0-255 (EfficientNetV2 normalises internally);")
        print("  a float input with no quantisation is consistent with that.")

    # ---- Output contract: is the last op a softmax? -------------------------
    print("\n" + "-" * 70)
    print("OUTPUT CONTRACT")
    print("-" * 70)
    n_out = out_info["shape"][-1] if out_info["shape"] else 0
    print(f"  Output shape {out_info['shape']} -> {n_out} class scores.")
    if n_out != len(EXPECTED_CLASS_ORDER):
        print(f"  WARNING: expected {len(EXPECTED_CLASS_ORDER)} classes, model outputs {n_out}.")
        print("  Do NOT proceed until this matches.")
    else:
        print("  Matches the expected 6-class setup.")

    producer = None
    for op in operators:
        if outputs[0] in op.vec_scalars(2, i32, 4):
            producer = op
            break
    if producer is not None:
        name, code = op_name(opcodes, producer.scalar(0, u32))
        print(f"  Final operator producing the output: {name}")
        if code == SOFTMAX:
            print("  -> SOFTMAX is inside the graph: outputs are probabilities, use directly.")
        else:
            print("  -> Final op is NOT softmax: treat outputs as logits; the app must")
            print("     apply softmax itself. Confirm against the export code.")
    else:
        print("  Could not locate the producing operator (unexpected).")

    # ---- Embedded metadata and attached files -------------------------------
    print("\n" + "-" * 70)
    print("EMBEDDED METADATA / LABELS")
    print("-" * 70)
    buffers = model.vec_tables(4)
    metadata = model.vec_tables(6)
    found_labels = None
    if metadata:
        for m in metadata:
            mname = m.string(0)
            bufidx = m.scalar(1, u32)
            data_p, data_n = buffers[bufidx].vector(0) if bufidx < len(buffers) else (None, 0)
            preview = ""
            if data_p and data_n and data_n <= 64:
                preview = " = " + buf[data_p:data_p + data_n].decode("utf-8", "replace")
            print(f"  metadata entry: {mname!r} ({data_n} bytes){preview}")
    else:
        print("  No metadata entries in the flatbuffer.")
    try:
        with zipfile.ZipFile(path) as z:
            names = z.namelist()
            print(f"  Zip-attached associated files: {names}")
            for n in names:
                if "label" in n.lower() or n.lower().endswith(".txt"):
                    content = z.read(n).decode("utf-8", "replace").strip().splitlines()
                    found_labels = [ln.strip() for ln in content if ln.strip()]
                    print(f"  Contents of {n}:")
                    for i, lab in enumerate(found_labels):
                        print(f"    {i}: {lab}")
    except zipfile.BadZipFile:
        print("  No zip-attached files (no TFLite Metadata associated-file bundle).")

    print("\n" + "-" * 70)
    print("CLASS ORDER")
    print("-" * 70)
    if found_labels:
        if found_labels == EXPECTED_CLASS_ORDER:
            print("  Attached labels MATCH the expected alphabetical order.")
        else:
            print("  Attached labels DIFFER from the expected order. Use the attached")
            print("  labels as the source of truth in src/config/classes.ts.")
    else:
        print("  The .tflite file carries no class names.")
        print("  The order MUST come from model_metadata.json (class_order) or a")
        print("  labels.txt exported alongside the model. Until then the expected")
        print("  order below is UNVERIFIED and CLASS_ORDER_VERIFIED stays false:")
        for i, c in enumerate(EXPECTED_CLASS_ORDER):
            print(f"    {i}: {c}")

    # ---- Summary -------------------------------------------------------------
    print("\n" + "=" * 70)
    print("SUMMARY FOR src/config + TFLiteProvider")
    print("=" * 70)
    is_soft = producer is not None and op_name(opcodes, producer.scalar(0, u32))[1] == SOFTMAX
    print(f"  input_shape        : {ishape}")
    print(f"  input_dtype        : {in_info['type']}")
    quantised = in_info["type"] in ("uint8", "int8")
    print(f"  input_normalisation: {'quantised, map via scale/zero-point' if quantised else 'float, feed raw 0-255 (matches training contract)'}")
    print(f"  output_shape       : {out_info['shape']}")
    print(f"  output_is_softmax  : {is_soft} (static graph check)")
    print(f"  num_classes        : {n_out}")
    print(f"  class_order        : {'from attached labels' if found_labels else 'PENDING - need model_metadata.json or labels.txt'}")
    print(f"  file_size_mb       : {len(buf) / 1024 ** 2:.1f}")
    print("=" * 70)
    print("\nPENDING: a live sanity inference still requires a working interpreter;")
    print("run inspect_tflite.py when one is available, or verify on-device.")


if __name__ == "__main__":
    main()
