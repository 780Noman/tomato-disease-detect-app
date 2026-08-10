# Hugging Face Docker Space for the Tomato Leaf Doctor inference server.
#
# Why a server at all: the delivered .tflite carries 800+ TF Select ("Flex")
# operators, which react-native-fast-tflite cannot resolve on-device. The full
# TensorFlow package registers the Flex delegate, so the same file runs here
# unchanged. See deploy/huggingface/DEPLOY.md.
#
# Follows Hugging Face's documented Docker Space pattern: a non-root user with a
# writable HOME (pip, the HF cache and TensorFlow all need one), and the app
# listening on the port declared as `app_port` in README.md.

FROM python:3.12-slim

# HF Spaces expect a non-root user with uid 1000.
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONUNBUFFERED=1

WORKDIR $HOME/app

COPY --chown=user requirements.txt ./
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# ---- Model -----------------------------------------------------------------
# EDIT THIS ONE LINE: point it at the model repo you uploaded the .tflite to.
# HF Spaces build the Dockerfile as-is, so this default is what gets used.
ARG HF_MODEL_REPO=REPLACE_ME
ARG HF_MODEL_FILE=Tomato_Model_Mobile.tflite
ENV HF_MODEL_REPO=$HF_MODEL_REPO \
    HF_MODEL_FILE=$HF_MODEL_FILE

COPY --chown=user fetch_model.py ./
# Baked into the image on purpose. Downloading at runtime would make every cold
# start pay for 141 MB before it could answer a single request.
RUN python fetch_model.py

# ---- Server ----------------------------------------------------------------
# app/ is copied verbatim from server/app in the main repo — do not edit it
# here. Use `npm run space:prepare` so the two cannot drift.
COPY --chown=user app ./app

# Fail the build rather than deploy a Space that cannot answer. The server is
# designed to degrade instead of crash, which is right at runtime but wrong
# here: a Space that boots "degraded" looks healthy until the first scan fails.
RUN python -c "\
from app.model import ModelService; \
service = ModelService(); \
service.load(); \
print('startup check:', service.detail); \
raise SystemExit(0 if service.loaded and service.class_order_verified else 1)"

EXPOSE 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
