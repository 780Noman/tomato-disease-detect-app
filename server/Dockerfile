# Debug/inspection server only — the app runs the model on-device.
FROM python:3.12-slim

WORKDIR /app

# Pillow needs no extra system libs for JPEG/PNG in the slim image's wheels.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# server/models/ is gitignored and NOT copied: mount it at runtime, e.g.
#   docker run -p 8000:8000 -v "$(pwd)/models:/app/models:ro" tomato-server
# Without a model the server starts in degraded mode and /predict returns 503.
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health').status==200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
