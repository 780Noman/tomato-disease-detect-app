"""FastAPI debug/inspection server for the tomato leaf classifier.

This is NOT the production inference path - the app runs the model on-device
through react-native-fast-tflite and works offline. This server exists for
debugging, for inspecting probability vectors, and for anyone who wants a
server-side option.

Run (inside server/.venv only):
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse

from .classes import N_CLASSES
from .model import (
    ClassOrderUnverifiedError,
    ImageUnreadableError,
    ModelNotLoadedError,
    ModelService,
)
from .schemas import HealthResponse, PredictResponse

MAX_UPLOAD_BYTES = 12 * 1024 * 1024

service = ModelService()


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # Best-effort load; failure leaves the server in degraded mode, which
    # /health reports honestly.
    service.load()
    yield


app = FastAPI(
    lifespan=lifespan,
    title="Tomato Leaf Doctor - debug inference server",
    description=(
        "Optional debug path. The mobile app runs the model on-device. "
        "This server never fabricates a prediction: with no model present, or while the "
        "class order is unverified, /predict returns a typed error."
    ),
    version="1.0.0",
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok" if service.loaded and service.class_order_verified else "degraded",
        model_loaded=service.loaded,
        model_version=service.model_version,
        class_order=service.class_order,
        class_order_verified=service.class_order_verified,
        detail=service.detail,
    )


@app.post("/predict", response_model=PredictResponse)
async def predict(image: UploadFile = File(...)) -> JSONResponse | PredictResponse:
    payload = await image.read()

    if len(payload) == 0:
        return JSONResponse(
            status_code=400,
            content={"code": "image-unreadable", "detail": "The uploaded file was empty."},
        )
    if len(payload) > MAX_UPLOAD_BYTES:
        return JSONResponse(
            status_code=413,
            content={
                "code": "image-too-large",
                "detail": f"Image exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.",
            },
        )

    try:
        probabilities, top_class, elapsed_ms = service.predict(payload)
    except ClassOrderUnverifiedError as exc:
        return JSONResponse(
            status_code=503,
            content={"code": "class-order-unverified", "detail": str(exc)},
        )
    except ModelNotLoadedError as exc:
        return JSONResponse(
            status_code=503,
            content={"code": "model-not-loaded", "detail": str(exc)},
        )
    except ImageUnreadableError as exc:
        return JSONResponse(
            status_code=400,
            content={"code": "image-unreadable", "detail": str(exc)},
        )
    except ValueError as exc:
        return JSONResponse(
            status_code=500,
            content={"code": "invalid-model-output", "detail": str(exc)},
        )

    assert len(probabilities) == N_CLASSES
    return PredictResponse(
        probabilities=probabilities,
        top_class=top_class,
        model_version=service.model_version,
        inference_ms=elapsed_ms,
    )
