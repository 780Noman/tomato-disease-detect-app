"""Model loading and prediction for the debug server.

Degraded mode is deliberate (PLAN.md §2.5): with no model file present the
server starts, reports model_loaded=false, and returns a typed 503 from
/predict. It NEVER returns a stub or random prediction - a fake diagnosis is
exactly the fabrication CLAUDE.md §7 forbids.

Preprocessing matches train_tomato_corrected.py exactly:
  plain resize to 224x224 (aspect-distorting, like keras load_img with
  target_size), RGB, raw 0-255 floats, no rescale. EfficientNetV2 applies
  its own normalisation internally.
"""

from __future__ import annotations

import io
import time
from pathlib import Path
from typing import Protocol

import numpy as np
from PIL import Image

from .classes import IMG_SIZE, N_CLASSES, load_class_order

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
TFLITE_NAME = "Tomato_Model_Mobile.tflite"
KERAS_NAME = "Tomato_Model_Deploy.keras"


class ModelNotLoadedError(RuntimeError):
    pass


class ClassOrderUnverifiedError(RuntimeError):
    pass


class ImageUnreadableError(ValueError):
    pass


class Predictor(Protocol):
    def __call__(self, batch: np.ndarray) -> np.ndarray: ...


def preprocess(image_bytes: bytes) -> np.ndarray:
    """Bytes -> (1, 224, 224, 3) float32 in 0-255, matching training."""
    try:
        image = Image.open(io.BytesIO(image_bytes))
        image.load()
    except Exception as exc:  # noqa: BLE001 - any decode failure is the same to callers
        raise ImageUnreadableError("The uploaded file could not be decoded as an image.") from exc

    rgb = image.convert("RGB")
    # BILINEAR matches keras.utils.load_img's default interpolation.
    resized = rgb.resize((IMG_SIZE, IMG_SIZE), Image.BILINEAR)
    array = np.asarray(resized, dtype=np.float32)  # already 0-255
    return array[np.newaxis, ...]


def softmax(logits: np.ndarray) -> np.ndarray:
    shifted = logits - np.max(logits)
    exponentiated = np.exp(shifted)
    return exponentiated / np.sum(exponentiated)


class ModelService:
    """Holds whatever model artefact is available, or nothing at all."""

    def __init__(self, models_dir: Path = MODELS_DIR) -> None:
        self.models_dir = models_dir
        self.predictor: Predictor | None = None
        self.model_version: str | None = None
        self.detail = "No model file present; /predict returns 503."
        self.class_order, self.class_order_verified = load_class_order(models_dir)

    @property
    def loaded(self) -> bool:
        return self.predictor is not None

    def load(self) -> None:
        """Best-effort load. Failure leaves the server in degraded mode."""
        tflite_path = self.models_dir / TFLITE_NAME
        keras_path = self.models_dir / KERAS_NAME

        if tflite_path.is_file():
            try:
                self.predictor = self._load_tflite(tflite_path)
                self.model_version = TFLITE_NAME
                self.detail = "TFLite model loaded."
                return
            except Exception as exc:  # noqa: BLE001 - reported, not raised
                self.detail = f"Found {TFLITE_NAME} but could not load it: {exc}"

        if keras_path.is_file():
            try:
                self.predictor = self._load_keras(keras_path)
                self.model_version = KERAS_NAME
                self.detail = "Keras model loaded."
                return
            except Exception as exc:  # noqa: BLE001 - reported, not raised
                self.detail = f"Found {KERAS_NAME} but could not load it: {exc}"
                return

        if not tflite_path.is_file():
            self.detail = (
                f"No model in {self.models_dir}. Place {TFLITE_NAME} or {KERAS_NAME} there "
                "and install tensorflow (or tflite-runtime) in server/.venv. "
                "Until then /predict returns 503 - it never fabricates a prediction."
            )

    def _load_tflite(self, path: Path) -> Predictor:
        # ORDER MATTERS. Full TensorFlow is tried FIRST because this model
        # requires the Flex (Select TF ops) delegate: tools/inspect_tflite_ops.py
        # found 800+ Flex operators in it, including 201x FlexConv2D. The TF pip
        # package registers that delegate automatically; tflite_runtime does not
        # ship it at all and fails with kTfLiteUnresolvedOps -- the exact failure
        # that makes this model unusable on-device.
        try:
            import tensorflow as tf  # type: ignore[import-not-found]

            Interpreter = tf.lite.Interpreter
        except ImportError:
            from tflite_runtime.interpreter import (  # type: ignore[import-not-found]
                Interpreter,
            )

        interpreter = Interpreter(model_path=str(path))
        try:
            interpreter.allocate_tensors()
        except Exception as exc:  # noqa: BLE001 - re-raised with the actionable reason
            raise ValueError(
                f"allocate_tensors() failed for {path.name}: {exc}. If this mentions "
                "unresolved ops or Select TF ops, the runtime lacks the Flex delegate: "
                "install the full `tensorflow` package, not tflite-runtime."
            ) from exc
        input_detail = interpreter.get_input_details()[0]
        output_detail = interpreter.get_output_details()[0]

        expected_input = [1, IMG_SIZE, IMG_SIZE, 3]
        if list(input_detail["shape"]) != expected_input:
            raise ValueError(
                f"Model input shape {list(input_detail['shape'])} != expected {expected_input}."
            )
        if list(output_detail["shape"])[-1] != N_CLASSES:
            raise ValueError(
                f"Model output has {list(output_detail['shape'])[-1]} classes, expected {N_CLASSES}."
            )

        def predict(batch: np.ndarray) -> np.ndarray:
            interpreter.set_tensor(input_detail["index"], batch.astype(np.float32))
            interpreter.invoke()
            return np.asarray(interpreter.get_tensor(output_detail["index"])[0], dtype=np.float32)

        return predict

    def _load_keras(self, path: Path) -> Predictor:
        import tensorflow as tf  # type: ignore[import-not-found]

        model = tf.keras.models.load_model(path, compile=False)

        def predict(batch: np.ndarray) -> np.ndarray:
            return np.asarray(model.predict(batch, verbose=0)[0], dtype=np.float32)

        return predict

    def predict(self, image_bytes: bytes) -> tuple[dict[str, float], str, int]:
        if not self.class_order_verified:
            raise ClassOrderUnverifiedError(
                "The class index order is unverified: no model_metadata.json in server/models/. "
                "Serving predictions now would map indices to the wrong conditions."
            )
        if self.predictor is None:
            raise ModelNotLoadedError(self.detail)

        batch = preprocess(image_bytes)
        started = time.perf_counter()
        raw = self.predictor(batch)
        elapsed_ms = int((time.perf_counter() - started) * 1000)

        if raw.shape[-1] != N_CLASSES:
            raise ValueError(f"Model returned {raw.shape[-1]} values, expected {N_CLASSES}.")

        total = float(np.sum(raw))
        vector = raw if abs(total - 1.0) <= 0.05 else softmax(raw)

        probabilities = {
            name: float(value) for name, value in zip(self.class_order, vector, strict=True)
        }
        top_class = max(probabilities, key=lambda name: probabilities[name])
        return probabilities, top_class, elapsed_ms
