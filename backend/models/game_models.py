"""SQLAlchemy models for games, collections, and position indexing."""

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
)
from sqlalchemy.orm import relationship

from backend.database import Base

game_tags = Table(
    "game_tags",
    Base.metadata,
    Column("game_id", Integer, ForeignKey("games.id"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id"), primary_key=True),
)

game_collection_assoc = Table(
    "game_collection_assoc",
    Base.metadata,
    Column("game_id", Integer, ForeignKey("games.id"), primary_key=True),
    Column("collection_id", Integer, ForeignKey("game_collections.id"), primary_key=True),
)


class Game(Base):
    __tablename__ = "games"

    id = Column(Integer, primary_key=True, index=True)
    pgn_text = Column(Text, nullable=False)
    white = Column(String, nullable=True)
    black = Column(String, nullable=True)
    event = Column(String, nullable=True)
    site = Column(String, nullable=True)
    date_played = Column(String, nullable=True)
    result = Column(String, nullable=True)
    eco = Column(String, nullable=True)
    opening = Column(String, nullable=True)
    move_count = Column(Integer, nullable=True)
    white_elo = Column(Integer, nullable=True)
    black_elo = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    starred = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="0",
    )

    tags = relationship("Tag", secondary=game_tags, back_populates="games")
    collections = relationship(
        "GameCollection", secondary=game_collection_assoc, back_populates="games"
    )
    position_indices = relationship(
        "PositionIndex", back_populates="game", cascade="all, delete-orphan"
    )


class GameCollection(Base):
    __tablename__ = "game_collections"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    games = relationship(
        "Game", secondary=game_collection_assoc, back_populates="collections"
    )


class PositionIndex(Base):
    __tablename__ = "position_index"

    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(Integer, ForeignKey("games.id"), nullable=False, index=True)
    half_move = Column(Integer, nullable=False)
    zobrist_hash = Column(Integer, nullable=False, index=True)
    fen = Column(String, nullable=False)
    pawn_sig = Column(String, nullable=False, index=True)

    game = relationship("Game", back_populates="position_indices")
