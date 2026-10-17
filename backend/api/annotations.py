"""Annotation API routes — global position notes keyed by FEN."""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import FenAnnotation
from backend.services import position_key

router = APIRouter(prefix="/annotations", tags=["annotations"])


class AnnotationPut(BaseModel):
    fen: str
    note_text: str = ""
    question_text: str = ""


class AnnotationBatchRequest(BaseModel):
    fens: list[str]


@router.get("/")
def get_annotation(fen: str = Query(...), db: Session = Depends(get_db)):
    key = position_key(fen)
    row = db.query(FenAnnotation).filter(FenAnnotation.fen_key == key).first()
    if row:
        return {
            "fen_key": key,
            "note_text": row.note_text,
            "question_text": row.question_text or "",
            "exists": True,
        }
    return {"fen_key": key, "note_text": "", "question_text": "", "exists": False}


@router.put("/")
def put_annotation(body: AnnotationPut, db: Session = Depends(get_db)):
    key = position_key(body.fen)
    note = body.note_text.strip()
    question = body.question_text.strip()
    row = db.query(FenAnnotation).filter(FenAnnotation.fen_key == key).first()

    # A row only exists to hold a note and/or a question. If both are empty,
    # there's nothing to store — drop the row.
    if not note and not question:
        if row:
            db.delete(row)
            db.commit()
        return {"fen_key": key, "note_text": "", "question_text": "", "saved": True}

    if row:
        row.note_text = body.note_text
        row.question_text = body.question_text
    else:
        row = FenAnnotation(
            fen_key=key,
            note_text=body.note_text,
            question_text=body.question_text,
        )
        db.add(row)

    db.commit()
    db.refresh(row)
    return {
        "fen_key": key,
        "note_text": row.note_text,
        "question_text": row.question_text or "",
        "saved": True,
    }


@router.post("/batch")
def batch_annotations(body: AnnotationBatchRequest, db: Session = Depends(get_db)):
    keys = [position_key(f) for f in body.fens]
    unique_keys = list(set(keys))
    rows = db.query(FenAnnotation).filter(FenAnnotation.fen_key.in_(unique_keys)).all()
    result = {r.fen_key: r.note_text for r in rows}
    return {"annotations": result}
