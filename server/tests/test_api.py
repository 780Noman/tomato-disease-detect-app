"""API behaviour, including the two refusals that matter most:
no model present, and an unverified class order. Neither may ever produce a
prediction.
"""

from __future__ import annotations

import io

import numpy as np
from fastapi.testclient import TestClient
from PIL import Image

from app import main
from app.classes import N_CLASSES
from app.main import app

client = TestClient(app)


def leaf_photo() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (500, 500), (60, 130, 70)).save(buffer, format="JPEG")
    return buffer.getvalue()


def test_health_reports_degraded_without_a_model() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["model_loaded"] is False
    assert body["status"] == "degraded"
    assert body["class_order_verified"] is False
    assert len(body["class_order"]) == N_CLASSES


def test_predict_refuses_while_the_class_order_is_unverified() -> None:
    response = client.post("/predict", files={"image": ("leaf.jpg", leaf_photo(), "image/jpeg")})
    assert response.status_code == 503
    assert response.json()["code"] == "class-order-unverified"


def test_predict_rejects_an_empty_upload() -> None:
    response = client.post("/predict", files={"image": ("leaf.jpg", b"", "image/jpeg")})
    assert response.status_code == 400
    assert response.json()["code"] == "image-unreadable"


def test_predict_refuses_when_verified_but_no_model_is_loaded(monkeypatch) -> None:
    monkeypatch.setattr(main.service, "class_order_verified", True)
    monkeypatch.setattr(main.service, "predictor", None)

    response = client.post("/predict", files={"image": ("leaf.jpg", leaf_photo(), "image/jpeg")})
    assert response.status_code == 503
    assert response.json()["code"] == "model-not-loaded"


def test_predict_rejects_a_non_image_upload(monkeypatch) -> None:
    monkeypatch.setattr(main.service, "class_order_verified", True)
    monkeypatch.setattr(main.service, "predictor", lambda batch: np.zeros(N_CLASSES, np.float32))

    response = client.post("/predict", files={"image": ("x.jpg", b"not an image", "image/jpeg")})
    assert response.status_code == 400
    assert response.json()["code"] == "image-unreadable"


def test_predict_returns_the_full_vector_keyed_by_class_name(monkeypatch) -> None:
    monkeypatch.setattr(main.service, "class_order_verified", True)
    monkeypatch.setattr(main.service, "model_version", "test-model")
    # Index 2 is tomato__LM in the expected order.
    vector = np.array([0.02, 0.05, 0.80, 0.06, 0.04, 0.03], dtype=np.float32)
    monkeypatch.setattr(main.service, "predictor", lambda batch: vector)

    response = client.post("/predict", files={"image": ("leaf.jpg", leaf_photo(), "image/jpeg")})
    assert response.status_code == 200
    body = response.json()

    assert len(body["probabilities"]) == N_CLASSES, "the full vector must be returned, not the winner"
    assert body["top_class"] == "tomato__LM"
    assert abs(sum(body["probabilities"].values()) - 1.0) < 0.01
    assert body["model_version"] == "test-model"


def test_logits_are_softmaxed_before_being_returned(monkeypatch) -> None:
    monkeypatch.setattr(main.service, "class_order_verified", True)
    logits = np.array([2.0, 1.0, 5.0, 0.5, 0.0, -1.0], dtype=np.float32)
    monkeypatch.setattr(main.service, "predictor", lambda batch: logits)

    body = client.post(
        "/predict", files={"image": ("leaf.jpg", leaf_photo(), "image/jpeg")}
    ).json()
    assert abs(sum(body["probabilities"].values()) - 1.0) < 0.01
    assert body["top_class"] == "tomato__LM"


def test_a_wrong_length_model_output_is_an_error_not_a_diagnosis(monkeypatch) -> None:
    monkeypatch.setattr(main.service, "class_order_verified", True)
    monkeypatch.setattr(main.service, "predictor", lambda batch: np.array([0.5, 0.5], np.float32))

    response = client.post("/predict", files={"image": ("leaf.jpg", leaf_photo(), "image/jpeg")})
    assert response.status_code == 500
    assert response.json()["code"] == "invalid-model-output"
