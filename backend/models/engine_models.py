"""SQLAlchemy model for engine games (play-vs-engine sessions)."""
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from backend.database import Base


class EngineGame(Base):
    __tablename__ = "engine_games"

    id = Column(Integer, primary_key=True, index=True)
    position_id = Column(
        Integer, ForeignKey("positions.id"), nullable=False, index=True
    )
    start_fen = Column(String, nullable=False)        # denormalized for replay convenience
    moves_san = Column(Text, nullable=False)          # space-separated SAN, e.g. "e4 e5 Nf3"
    user_color = Column(String, nullable=False)       # "white" | "black"
    engine_elo = Column(Integer, nullable=False)      # 1320..3190
    result = Column(String, nullable=False)           # "1-0" | "0-1" | "1/2-1/2" | "*"
    outcome = Column(String, nullable=True)           # "checkmate"|"stalemate"|"insufficient"
                                                      #  |"threefold"|"fifty-move"|"resigned"|"abandoned"
    final_fen = Column(String, nullable=False)
    move_count = Column(Integer, nullable=False)      # number of plies
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    position = relationship("Position", backref="engine_games")