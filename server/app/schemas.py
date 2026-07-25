"""Response models. Probabilities are keyed BY CLASS NAME, never by array
position, so the server and the app cannot disagree silently about order."""

from __future__ import annotations

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(description='"ok" or "degraded"')
    model_loaded: bool
    model_version: str | None = None
    class_order: list[str]
    class_order_verified: bool
    detail: str


class PredictResponse(BaseModel):
    probabilities: dict[str, float] = Field(
        description="The full softmax vector, keyed by class name."
    )
    top_class: str
    model_version: str | None = None
    inference_ms: int


class ErrorResponse(BaseModel):
    code: str
    detail: str
