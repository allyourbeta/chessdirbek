"""SQLAlchemy models. All tables defined here."""

from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
)
from sqlalchemy.orm import relationship

from backend.database import Base


class PositionType(str, PyEnum):
    """Position can be either a puzzle (with solution) or a tabiya (key position)."""
    puzzle = "puzzle"
    tabiya = "tabiya"
    endgame = "endgame"
    strategy = "strategy"

# Many-to-many join table: positions <-> tags
position_tags = Table(
    "position_tags",
    Base.metadata,
    Column("position_id", Integer, ForeignKey("positions.id"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id"), primary_key=True),
)


class Position(Base):
    __tablename__ = "positions"

    id = Column(Integer, primary_key=True, index=True)
    fen = Column(String, nullable=False)
    title = Column(String, nullable=True)
    notes = Column(Text, nullable=True)  # Free-text personal analysis
    stockfish_analysis = Column(Text, nullable=True)  # Stored engine eval
    
    # Position type fields (Phase 15)
    position_type = Column(
        Enum(PositionType), 
        nullable=False, 
        default=PositionType.tabiya,
        server_default="tabiya"
    )
    solution_san = Column(String, nullable=True)  # Required for puzzles
    theme = Column(String, nullable=True)  # Tactical theme for puzzles

    # Display orientation for the saved board view: "white" (default) or "black".
    # Independent of FEN — FEN doesn't encode display orientation.
    orientation = Column(
        String,
        nullable=False,
        default="white",
        server_default="white",
    )

    # Gmail-style star: simple binary flag for priority review
    starred = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="0",
    )

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    tags = relationship("Tag", secondary=position_tags, back_populates="positions")
    quiz_attempts = relationship(
        "QuizAttempt", back_populates="position", cascade="all, delete-orphan"
    )


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)

    positions = relationship(
        "Position", secondary=position_tags, back_populates="tags"
    )
    games = relationship(
        "Game", secondary="game_tags", back_populates="tags"
    )


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True, index=True)
    position_id = Column(Integer, ForeignKey("positions.id"), nullable=False)
    correct = Column(Boolean, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    position = relationship("Position", back_populates="quiz_attempts")
