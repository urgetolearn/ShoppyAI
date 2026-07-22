"""
fashn_api_server.py
====================
Paste this entire file into a single Colab cell and run it.

What it does:
  1. Loads TryOnPipeline once (reuses weights from ./weights/).
  2. Starts a Flask server on port 7860.
  3. Exposes POST /try-on — accepts two uploaded image files
     ('person' and 'garment') and an optional 'category' field.
  4. Returns the generated image directly as image/png.
  5. Starts a cloudflared tunnel and prints the public URL.

Copy that URL into your .env:
  FASHN_TUNNEL_URL=https://xxxx-xx-xx.trycloudflare.com

Then (re)start the Node server — the full flow is live.

TODO (Colab) — Step 1: Run this cell BEFORE starting the Node server.
TODO (Colab) — Step 2: Copy the printed tunnel URL into .env.
TODO (Colab) — Step 3: Keep this Colab tab open for the demo.
              The tunnel dies when the cell is interrupted or the runtime resets.
"""

# ---------------------------------------------------------------------------
# Imports & setup
# ---------------------------------------------------------------------------

import io
import os
import re
import stat
import subprocess
import sys
import threading
import time
import urllib.request

from flask import Flask, request, jsonify
from PIL import Image

# ---------------------------------------------------------------------------
# Install Flask if not already present
# ---------------------------------------------------------------------------

try:
    import flask  # noqa: F401
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "flask"])

# ---------------------------------------------------------------------------
# Install cloudflared binary (one-time per Colab session)
# ---------------------------------------------------------------------------

CLOUDFLARED_URL = (
    "https://github.com/cloudflare/cloudflared/releases/latest/download/"
    "cloudflared-linux-amd64"
)
CLOUDFLARED_BIN = "/usr/local/bin/cloudflared"

if not os.path.exists(CLOUDFLARED_BIN):
    print("Downloading cloudflared...")
    urllib.request.urlretrieve(CLOUDFLARED_URL, CLOUDFLARED_BIN)
    os.chmod(CLOUDFLARED_BIN, stat.S_IRWXU | stat.S_IRGRP | stat.S_IXGRP)
    print("cloudflared installed.")
else:
    print("cloudflared already present.")

# ---------------------------------------------------------------------------
# Load TryOnPipeline (reuses ./weights/ downloaded in your notebook)
#
# TODO (Colab): Make sure you've run the weights-download cell in
#               fashn_vton_setup.ipynb first.  The pipeline expects:
#                 /content/fashn-vton-1.5/weights/model.safetensors
#                 /content/fashn-vton-1.5/weights/dwpose/yolox_l.onnx
#                 /content/fashn-vton-1.5/weights/dwpose/dw-ll_ucoco_384.onnx
# ---------------------------------------------------------------------------

# The notebook runs from /content/fashn-vton-1.5, so weights are at ./weights
WEIGHTS_DIR = "./weights"

print(f"Loading TryOnPipeline from {WEIGHTS_DIR} ...")
from fashn_vton import TryOnPipeline  # noqa: E402

pipeline = TryOnPipeline(weights_dir=WEIGHTS_DIR)
print("Pipeline ready.")

# ---------------------------------------------------------------------------
# Flask app
# ---------------------------------------------------------------------------

app = Flask(__name__)
PORT = 7860


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/try-on", methods=["POST"])
def try_on():
    """
    Accepts JSON with:
      - person_image_b64  : base64-encoded person image  (required)
      - garment_image_b64 : base64-encoded garment image (required)
      - category          : string (optional, default "tops")

    Returns JSON with:
      - result_image_b64  : base64-encoded output PNG
      - mime_type         : "image/png"
    """
    import base64

    data = request.get_json(force=True, silent=True) or {}

    if "person_image_b64" not in data:
        return jsonify({"error": "'person_image_b64' is required"}), 400
    if "garment_image_b64" not in data:
        return jsonify({"error": "'garment_image_b64' is required"}), 400

    category = data.get("category", "tops")

    try:
        person_img  = Image.open(io.BytesIO(base64.b64decode(data["person_image_b64"]))).convert("RGB")
        garment_img = Image.open(io.BytesIO(base64.b64decode(data["garment_image_b64"]))).convert("RGB")
    except Exception as e:
        return jsonify({"error": f"Failed to decode images: {str(e)}"}), 400

    print(
        f"[try-on] Running pipeline — category={category}, "
        f"person={person_img.size}, garment={garment_img.size}"
    )

    try:
        result = pipeline(person_img, garment_img, category=category)
        output_image = result.images[0]
    except Exception as e:
        print(f"[try-on] Pipeline error: {e}")
        return jsonify({"error": f"Pipeline failed: {str(e)}"}), 500

    buf = io.BytesIO()
    output_image.save(buf, format="PNG")
    buf.seek(0)

    result_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    print(f"[try-on] Done — {len(buf.getvalue())} bytes")
    return jsonify({"result_image_b64": result_b64, "mime_type": "image/png"})


# ---------------------------------------------------------------------------
# Start Flask in a background thread
# ---------------------------------------------------------------------------


def _run_flask():
    import logging
    log = logging.getLogger("werkzeug")
    log.setLevel(logging.WARNING)
    app.run(host="0.0.0.0", port=PORT, use_reloader=False)


flask_thread = threading.Thread(target=_run_flask, daemon=True)
flask_thread.start()

time.sleep(2)
print(f"Flask server running on http://localhost:{PORT}")

# ---------------------------------------------------------------------------
# Start cloudflared tunnel
#
# TODO (Colab): The tunnel URL changes every time you restart this cell.
#               Update FASHN_TUNNEL_URL in .env whenever you restart.
# ---------------------------------------------------------------------------

tunnel_proc = subprocess.Popen(
    [CLOUDFLARED_BIN, "tunnel", "--url", f"http://localhost:{PORT}"],
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
)

print("Waiting for Cloudflare tunnel URL...")
tunnel_url = None
for line in tunnel_proc.stdout:
    match = re.search(r"https://[a-z0-9\-]+\.trycloudflare\.com", line)
    if match:
        tunnel_url = match.group(0)
        break

if tunnel_url:
    print(f"\n{'='*60}")
    print(f"  FASHN VTON tunnel is LIVE")
    print(f"  Copy this URL into your .env:")
    print(f"")
    print(f"  FASHN_TUNNEL_URL={tunnel_url}")
    print(f"{'='*60}\n")
else:
    print("Could not detect tunnel URL from cloudflared output.")
    print("Check above for a trycloudflare.com URL.")
