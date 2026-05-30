#!/usr/bin/env bash
#
# One-time setup for in-app board OCR (image -> FEN).
#
# Installs the open-source tsoj/Chess_diagram_to_FEN recognizer (MIT) into the
# CURRENTLY ACTIVE Python environment, pulls CPU PyTorch, and downloads the
# pretrained models. Run this with your backend's venv activated:
#
#     source venv/bin/activate          # (whatever venv you run the backend in)
#     ./scripts/setup_ocr.sh
#
# After it finishes, restart the backend (./run.sh) and verify:
#     curl http://localhost:8000/api/ocr/status      ->  {"available": true}
#
# This is the one step that couldn't be tested for you; if any install line
# fails on your machine, the error will say which, and it's safe to re-run.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENDOR="$ROOT/backend/vendor"
TSOJ="$VENDOR/Chess_diagram_to_FEN"

echo "==> Using Python: $(command -v python) ($(python --version 2>&1))"
if ! python -c "import sys; sys.exit(0 if sys.prefix != sys.base_prefix else 1)" 2>/dev/null; then
  echo "WARNING: no virtualenv appears to be active. Activate your backend venv first,"
  echo "         or this will install into your system Python. Ctrl+C to abort; continuing in 5s."
  sleep 5
fi

mkdir -p "$VENDOR"

echo "==> Fetching the recognizer (tsoj/Chess_diagram_to_FEN)"
if [ -d "$TSOJ/.git" ]; then
  git -C "$TSOJ" pull --ff-only
else
  git clone https://github.com/tsoj/Chess_diagram_to_FEN.git "$TSOJ"
fi

echo "==> Upgrading pip"
python -m pip install --upgrade pip

echo "==> Installing CPU PyTorch + Pillow"
python -m pip install pillow
python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

echo "==> Installing the recognizer (editable)"
python -m pip install -e "$TSOJ"

echo "==> Downloading pretrained models"
( cd "$TSOJ" && bash ./download_models.sh )

echo ""
echo "==> Done. Restart the backend, then check:"
echo "      curl http://localhost:8000/api/ocr/status   # expect {\"available\": true}"
