"""FEN annotation model — global position notes keyed by normalized FEN."""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, String, Text

from backend.database import Base


class FenAnnotation(Base):
    __tablename__ = "fen_annotations"

    id = Column(Integer, primary_key=True, index=True)
    fen_key = Column(String, unique=True, nullable=False, index=True)
    note_text = Column(Text, nullable=False, default='')
    # Optional prompt shown (un-blurred) when you reach this position, to
    # direct your thinking. The counterpart to note_text, which is the
    # (blurred) answer. Most positions won't have one.
    question_text = Column(Text, nullable=False, default='', server_default='')
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
