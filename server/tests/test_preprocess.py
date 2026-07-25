"""The preprocessing contract must match train_tomato_corrected.py exactly.

If these tests drift, the server feeds the model a distribution it was never
trained on and every prediction becomes meaningless.
"""

from __future__ import annotations

import io

import numpy as np
import pytest
from PIL import Image

from app.classes import IMG_SIZE
from app.model import ImageUnreadableError, preprocess, softmax


def encode(width: int, height: int, colour: tuple[int, int, int]) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), colour).save(buffer, format="JPEG", quality=95)
    return buffer.getvalue()


def test_output_shape_is_the_model_input_shape() -> None:
    batch = preprocess(encode(640, 480, (60, 140, 70)))
    assert batch.shape == (1, IMG_SIZE, IMG_SIZE, 3)
    assert batch.dtype == np.float32


def test_values_stay_in_0_255_with_no_rescale() -> None:
    # EfficientNetV2 normalises internally; rescaling here would double-apply it.
    batch = preprocess(encode(300, 300, (200, 100, 50)))
    assert batch.max() > 1.5, "values look rescaled to 0-1; training used raw 0-255"
    assert batch.min() >= 0.0
    assert batch.max() <= 255.0


def test_plain_resize_distorts_aspect_rather_than_cropping() -> None:
    # A wide image whose right half is a different colour: after a plain
    # resize both halves survive. A centre-crop would discard the edges.
    image = Image.new("RGB", (400, 100), (10, 10, 10))
    for x in range(200, 400):
        for y in range(100):
            image.putpixel((x, y), (240, 240, 240))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")

    batch = preprocess(buffer.getvalue())[0]
    left_mean = batch[:, : IMG_SIZE // 4, :].mean()
    right_mean = batch[:, -IMG_SIZE // 4 :, :].mean()
    assert left_mean < 60, "left edge lost - was the image cropped?"
    assert right_mean > 180, "right edge lost - was the image cropped?"


def test_greyscale_and_rgba_are_converted_to_three_channels() -> None:
    for mode in ("L", "RGBA", "P"):
        buffer = io.BytesIO()
        Image.new(mode, (120, 120)).save(buffer, format="PNG")
        assert preprocess(buffer.getvalue()).shape[-1] == 3


def test_non_image_bytes_raise_a_typed_error() -> None:
    with pytest.raises(ImageUnreadableError):
        preprocess(b"this is not an image")


def test_softmax_normalises_logits() -> None:
    vector = softmax(np.array([2.0, 1.0, 0.1, 0.0, -1.0, 3.0], dtype=np.float32))
    assert pytest.approx(float(vector.sum()), abs=1e-5) == 1.0
    assert int(np.argmax(vector)) == 5
