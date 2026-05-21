"""Pydantic schemas for request/response validation."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator

from backend.models import PositionType


# --- Tags ---
class TagBase(BaseModel):
    name: str


class TagOut(TagBase):
    id: int

    class Config:
        from_attributes = True


# --- Positions ---
class PositionCreate(BaseModel):
    fen: str
    title: str | None = None
    notes: str | None = None
    stockfish_analysis: str | None = None
    position_type: PositionType = PositionType.tabiya
    solution_san: Optional[str] = None
    theme: Optional[str] = None
    orientation: str = "white"  # "white" or "black" — default if not derived from FEN client-side
    tags: list[str] = []  # Tag names — created if they don't exist

    @field_validator("orientation")
    @classmethod
    def _check_orientation(cls, v: str) -> str:
        if v not in ("white", "black"):
            raise ValueError("orientation must be 'white' or 'black'")
        return v


class PositionUpdate(BaseModel):
    fen: str | None = None
    title: str | None = None
    notes: str | None = None
    stockfish_analysis: str | None = None
    position_type: Optional[PositionType] = None
    solution_san: Optional[str] = None
    theme: Optional[str] = None
    orientation: Optional[str] = None
    tags: list[str] | None = None  # If provided, replaces all tags

    @field_validator("orientation")
    @classmethod
    def _check_orientation(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if v not in ("white", "black"):
            raise ValueError("orientation must be 'white' or 'black'")
        return v


class PositionOut(BaseModel):
    id: int
    fen: str
    title: str | None
    notes: str | None
    stockfish_analysis: str | None
    position_type: PositionType
    solution_san: Optional[str]
    theme: Optional[str]
    orientation: str
    starred: bool
    tags: list[TagOut]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PositionBrief(BaseModel):
    """Lightweight position for list views."""
    id: int
    fen: str
    title: str | None
    position_type: PositionType
    solution_san: Optional[str]
    theme: Optional[str]
    orientation: str
    starred: bool
    tags: list[TagOut]

    class Config:
        from_attributes = True


class BulkReclassifyRequest(BaseModel):
    """Request to bulk reclassify positions."""
    position_ids: list[int]
    new_type: PositionType
    solution_san: Optional[str] = None  # Applied to all if changing to puzzle
    theme: Optional[str] = None  # Applied to all if changing to puzzle


class BulkReclassifyResponse(BaseModel):
    """Response from bulk reclassification."""
    success_count: int
    failure_count: int
    errors: list[str] = []


# --- Quiz ---
class QuizAttemptCreate(BaseModel):
    position_id: int
    correct: bool


class QuizAttemptOut(BaseModel):
    id: int
    position_id: int
    correct: bool
    created_at: datetime

    class Config:
        from_attributes = True


class QuizPositionOut(BaseModel):
    """Position served during a quiz (answer hidden)."""
    id: int
    fen: str
    title: str | None
    tags: list[TagOut]

    class Config:
        from_attributes = True


# --- Board Info ---
class BoardInfoOut(BaseModel):
    fen: str
    turn: str
    is_check: bool
    is_checkmate: bool
    is_stalemate: bool
    legal_moves: list[str]
    piece_count: dict
    pawn_structure: dict


# --- Stats ---
class PositionStatsOut(BaseModel):
    position_id: int
    total_attempts: int
    correct_count: int
    incorrect_count: int
    accuracy: float


# --- UCI to SAN ---
class UciToSanRequest(BaseModel):
    fen: str
    uci_moves: list[str]


class UciToSanOut(BaseModel):
    san: str
