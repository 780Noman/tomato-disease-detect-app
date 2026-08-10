---
title: Tomato Leaf Doctor Inference
emoji: 🍅
colorFrom: red
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
---

# Tomato Leaf Doctor — inference server

Serves the tomato leaf pest and nutrient-deficiency classifier used by the
Tomato Leaf Doctor mobile app.

## Why this exists

The model was exported with TF Select ("Flex") operators — 800+ of them,
including `FlexConv2D`. An on-device TFLite runtime cannot resolve those, so the
mobile app cannot run this model locally. The full TensorFlow package registers
the Flex delegate, so the same file runs here without modification.

## Endpoints

### `GET /health`

Reports whether the model actually loaded, the class order in use, and a
human-readable `detail`. Check this first — the server is built to degrade
rather than crash, so a running Space is not by itself proof of a loaded model.

### `POST /predict`

`multipart/form-data` with one field, `image`. Returns probabilities keyed by
class name:

```json
{
  "probabilities": {
    "tomato__JAS_MIT": 0.03,
    "tomato__K": 0.05,
    "tomato__LM": 0.78,
    "tomato__MIT": 0.06,
    "tomato__N": 0.04,
    "tomato__N_K": 0.04
  },
  "top_class": "tomato__LM",
  "model_version": "Tomato_Model_Mobile.tflite",
  "inference_ms": 812
}
```

Keys, not array positions, so the client and server cannot silently disagree
about class order.

Typed errors instead of guesses: `503 model-not-loaded`,
`503 class-order-unverified`, `400 image-unreadable`, `413 image-too-large`,
`500 invalid-model-output`. **No prediction is ever fabricated.**

## Input expectations

Images must follow the app's capture protocol: one detached tomato leaf, laid
flat on a dark surface, shot from directly above under even lighting. Anything
else is outside the training distribution and the answer will be meaningless
however confident it looks.

There is **no healthy class** — a healthy leaf will still be assigned one of the
six conditions.

## Accuracy

No accuracy figure is published for this model. The reported research number was
produced by a biased selection procedure and is not trustworthy, so no claim is
made here or in the app.
