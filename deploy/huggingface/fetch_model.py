"""Downloads the model into models/ at image build time.

Run from the Dockerfile, not at runtime: baking the file into the image means a
cold Space boots straight into a loaded model instead of spending its first
request downloading 141 MB.

The repo must be PUBLIC. A private repo would need an HF token, which would
have to be added as a Space secret and read here — avoid that unless there is
a reason to keep the model private.
"""

from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

from huggingface_hub import hf_hub_download

# Matches server/app/model.py::TFLITE_NAME. The server looks for this exact
# filename, so the copy below renames whatever the Hub file is called.
DESTINATION_NAME = "Tomato_Model_Mobile.tflite"


def main() -> int:
    repo_id = os.environ.get("HF_MODEL_REPO", "").strip()
    filename = os.environ.get("HF_MODEL_FILE", DESTINATION_NAME).strip()

    if not repo_id or repo_id == "REPLACE_ME":
        print(
            "ERROR: HF_MODEL_REPO is not set.\n"
            "Edit the Dockerfile and set it to your model repo, e.g.\n"
            "  ARG HF_MODEL_REPO=your-username/tomato-leaf-doctor-model",
            file=sys.stderr,
        )
        return 1

    models_dir = Path("models")
    models_dir.mkdir(exist_ok=True)
    destination = models_dir / DESTINATION_NAME

    print(f"Downloading {filename} from {repo_id} ...")
    cached = hf_hub_download(repo_id=repo_id, filename=filename)
    shutil.copy(cached, destination)

    size_mb = destination.stat().st_size / 1024**2
    print(f"Model in place: {destination} ({size_mb:.1f} MB)")
    if size_mb < 1:
        print(
            "ERROR: the downloaded file is under 1 MB. That is not the model — "
            "check HF_MODEL_FILE names the real .tflite and not an LFS pointer.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
