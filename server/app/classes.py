"""Class configuration for the server.

MIRRORS src/config/classes.ts. The mobile app is the primary consumer and its
TypeScript file is the single source of truth for the app; this module exists
because the server cannot import TypeScript. Keep the two in step: the
/health endpoint reports the order it is using so a mismatch is visible
rather than silent.

CLASS ORDER: VERIFIED (2026-07-25). The training script derives its class list
with sorted(df['label'].unique()) and Keras assigns indices in that
alphabetical order. Confirmed empirically against the dataset's class folder
names sorted with Python's sorted(), which returns exactly the order below.

A model_metadata.json in server/models/ still takes precedence if present -
it is the authoritative source, and load_class_order() prefers it.
"""

from __future__ import annotations

import json
from pathlib import Path

EXPECTED_CLASS_ORDER: list[str] = [
    "tomato__JAS_MIT",  # 0
    "tomato__K",  # 1
    "tomato__LM",  # 2
    "tomato__MIT",  # 3
    "tomato__N",  # 4
    "tomato__N_K",  # 5
]

CLASS_ORDER_VERIFIED = True

CATEGORY_BY_CLASS: dict[str, str] = {
    "tomato__LM": "insect-pest",
    "tomato__MIT": "insect-pest",
    "tomato__JAS_MIT": "insect-pest",
    "tomato__N": "nutrient-deficiency",
    "tomato__K": "nutrient-deficiency",
    "tomato__N_K": "nutrient-deficiency",
}

IMG_SIZE = 224
N_CLASSES = len(EXPECTED_CLASS_ORDER)


def load_class_order(models_dir: Path) -> tuple[list[str], bool]:
    """Read the authoritative class order from model_metadata.json if present.

    Returns (order, verified). Falls back to the expected order marked
    unverified. The metadata file - not this module - is authoritative.
    """
    metadata_path = models_dir / "model_metadata.json"
    if not metadata_path.is_file():
        return EXPECTED_CLASS_ORDER, CLASS_ORDER_VERIFIED

    with metadata_path.open(encoding="utf-8") as handle:
        metadata = json.load(handle)

    order = metadata.get("class_order")
    if not isinstance(order, list) or len(order) != N_CLASSES:
        raise ValueError(
            f"model_metadata.json class_order must list {N_CLASSES} classes, got: {order!r}"
        )
    unknown = [c for c in order if c not in CATEGORY_BY_CLASS]
    if unknown:
        raise ValueError(f"model_metadata.json names unknown classes: {unknown}")
    return list(order), True
