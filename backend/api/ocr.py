"""HTTP layer for board-image -> FEN recognition.

POST /api/ocr                 {image_base64} -> {fen, orientation}
POST /api/ocr/import          {image_base64, category} -> create position, return it
GET  /api/ocr/status          -> diagnostics
POST /api/ocr/download-models -> fetch + extract the pretrained models

/ocr/import is the one-shot used by the macOS quick-capture hotkey: recognize +
save in a single call, no UI. Single-user, local-only.
"""

import base64
import binascii
import sys

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import PositionType
from ..services import ocr_service

router = APIRouter(tags=["ocr"])

# Bump alongside the frontend build stamp so the status URL proves which backend
# code is actually loaded (catches a stale, not-yet-reloaded server).
BACKEND_BUILD = "20260530-2257"

# Friendly category names (what the hotkey chooser shows) -> stored type.
_CATEGORY_TO_TYPE = {
    "tactic": PositionType.puzzle,
    "puzzle": PositionType.puzzle,
    "tabiya": PositionType.tabiya,
    "ending": PositionType.endgame,
    "endgame": PositionType.endgame,
    "strategy": PositionType.strategy,
}


class OcrRequest(BaseModel):
    image_base64: str


class OcrResponse(BaseModel):
    fen: str
    orientation: str


class OcrImportRequest(BaseModel):
    image_base64: str
    category: str = "tabiya"


def _decode_image(image_base64: str) -> bytes:
    data = image_base64 or ""
    if data.strip().startswith("data:") and "," in data:
        data = data.split(",", 1)[1]
    try:
        image_bytes = base64.b64decode(data, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="Invalid base64 image data")
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image")
    return image_bytes


def _ensure_ready():
    if not ocr_service.is_available():
        raise HTTPException(
            status_code=503,
            detail="OCR engine not importable: " + str(ocr_service.import_error()),
        )
    if not ocr_service.models_present():
        raise HTTPException(
            status_code=503,
            detail="Models not downloaded yet. Click 'Download models' first.",
        )


def _recognize(image_bytes: bytes) -> dict:
    try:
        return ocr_service.recognize_fen(image_bytes)
    except ocr_service.OcrUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail="Could not read a board from that image: " + str(exc),
        )


@router.get("/ocr/status")
def ocr_status():
    err = ocr_service.import_error()
    return {
        "build": BACKEND_BUILD,
        "available": err is None,
        "import_error": err,
        "models_present": ocr_service.models_present(),
        "models_dir": str(ocr_service.models_dir()),
        "python_executable": sys.executable,
        "python_prefix": sys.prefix,
    }


@router.post("/ocr/download-models")
def ocr_download_models():
    try:
        ok = ocr_service.download_models()
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Model download failed: " + str(exc))
    return {"models_present": ok, "models_dir": str(ocr_service.models_dir())}


@router.post("/ocr", response_model=OcrResponse)
def ocr_recognize(req: OcrRequest):
    image_bytes = _decode_image(req.image_base64)
    _ensure_ready()
    return _recognize(image_bytes)


@router.post("/ocr/import")
def ocr_import(req: OcrImportRequest, db: Session = Depends(get_db)):
    ptype = _CATEGORY_TO_TYPE.get((req.category or "").strip().lower())
    if ptype is None:
        raise HTTPException(status_code=400, detail="Unknown category: " + str(req.category))
    image_bytes = _decode_image(req.image_base64)
    _ensure_ready()
    result = _recognize(image_bytes)

    # Reuse the real create path (FEN validation, duplicate 409, auto-title, tags).
    from backend.api.positions import create_position
    from backend.api.schemas import PositionCreate

    data = PositionCreate(
        fen=result["fen"],
        position_type=ptype,
        orientation=result["orientation"],
    )
    created = create_position(data, db)
    return {
        "id": created.id,
        "category": ptype.value,
        "fen": created.fen,
        "orientation": created.orientation,
        "title": created.title,
    }
