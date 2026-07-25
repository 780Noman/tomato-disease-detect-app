# Debug inference server

**This is not the production path.** The app runs the classifier **on-device** through
`react-native-fast-tflite`, which is what makes offline scanning possible. This server exists for
debugging, for inspecting full probability vectors, and for anyone who wants a server-side option.

## Setup — venv only, never global

```bash
cd server
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
```

`server/.venv/` is gitignored. Versions in `requirements.txt` are pinned exactly.

The model runtime is **not** in `requirements.txt` — the server runs fine without it, in degraded
mode. Install one only when you actually want the inference path:

```bash
pip install tensorflow==2.20.0   # loads .keras or .tflite
pip install tflite-runtime       # lighter, .tflite only (Linux)
```

## Run

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Point the app at it with `EXPO_PUBLIC_INFERENCE_PROVIDER=remote` and
`EXPO_PUBLIC_REMOTE_API_URL=http://<your-lan-ip>:8000`.

## Tests

```bash
.venv\Scripts\python -m pytest
```

## Endpoints

### `GET /health`

```json
{
  "status": "degraded",
  "model_loaded": false,
  "model_version": null,
  "class_order": [
    "tomato__JAS_MIT",
    "tomato__K",
    "tomato__LM",
    "tomato__MIT",
    "tomato__N",
    "tomato__N_K"
  ],
  "class_order_verified": false,
  "detail": "No model in server/models. …"
}
```

### `POST /predict`

Multipart upload, field name `image`. Returns the **full** probability vector keyed **by class
name** — never just the winner, and never positional, so the app and server cannot silently
disagree about index order:

```json
{
  "probabilities": { "tomato__LM": 0.8, "tomato__MIT": 0.06, "…": 0.0 },
  "top_class": "tomato__LM",
  "model_version": "Tomato_Model_Mobile.tflite",
  "inference_ms": 240
}
```

## It refuses rather than guessing

| Situation                           | Response                     |
| ----------------------------------- | ---------------------------- |
| Class order unverified              | `503 class-order-unverified` |
| No model file / runtime             | `503 model-not-loaded`       |
| Upload is not a decodable image     | `400 image-unreadable`       |
| Upload larger than 12 MB            | `413 image-too-large`        |
| Model returns the wrong vector size | `500 invalid-model-output`   |

There is **no stub prediction mode**. A server that invents a diagnosis is worse than one that is
plainly unavailable.

## Enabling real predictions

1. Put `Tomato_Model_Mobile.tflite` (or `Tomato_Model_Deploy.keras`) in `server/models/`.
   That directory is gitignored — the model is never committed.
2. Put `model_metadata.json` beside it. Its `class_order` array is **authoritative** and flips
   `class_order_verified` to true; without it the server keeps refusing.
3. Install a model runtime in the venv (above).
4. Restart and check `/health` reports `"status": "ok"`.

`app/classes.py` mirrors `src/config/classes.ts`. Keep them in step — `/health` reports the order it
is using so a mismatch shows up immediately.

## Preprocessing

Matches `docs/train_tomato_corrected.py` exactly: **plain resize** to 224×224 (aspect-distorting,
as `keras.utils.load_img(target_size=…)` does), RGB, **raw 0–255 floats, no rescale** —
EfficientNetV2 normalises internally. `tests/test_preprocess.py` pins all of this, including a test
that fails if anyone introduces a centre-crop.

## Docker

```bash
docker build -t tomato-server .
docker run -p 8000:8000 -v "$(pwd)/models:/app/models:ro" tomato-server
```
