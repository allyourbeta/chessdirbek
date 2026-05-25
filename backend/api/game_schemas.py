"""Pydantic schemas for game and collection endpoints."""

from datetime import datetime

from pydantic import BaseModel

from backend.api.schemas import TagOut


class GameCreate(BaseModel):
    pgn_text: str
    tags: list[str] = []
    collection_ids: list[int] = []


class BulkPGNImport(BaseModel):
    pgn_text: str
    tags: list[str] = []
    collection_ids: list[int] = []
    force: bool = False


class BulkPGNImportResult(BaseModel):
    imported: int
    failed: int
    duplicates: int = 0
    errors: list[str]
    game_ids: list[int]


class GameBrief(BaseModel):
    id: int
    white: str | None
    black: str | None
    white_elo: int | None = None
    black_elo: int | None = None
    event: str | None
    date_played: str | None
    result: str | None
    eco: str | None
    opening: str | None
    move_count: int | None
    starred: bool = False
    tags: list[TagOut]

    class Config:
        from_attributes = True


class GameDetail(BaseModel):
    id: int
    pgn_text: str
    white: str | None
    black: str | None
    event: str | None
    site: str | None
    date_played: str | None
    result: str | None
    eco: str | None
    opening: str | None
    move_count: int | None
    moves_san: list[str]
    fens: list[str]
    comments: list[str | None]
    tags: list[TagOut]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GameUpdate(BaseModel):
    tags: list[str] | None = None
    collection_ids: list[int] | None = None


class CollectionCreate(BaseModel):
    name: str
    description: str | None = None


class CollectionOut(BaseModel):
    id: int
    name: str
    description: str | None
    game_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class CollectionDetail(BaseModel):
    id: int
    name: str
    description: str | None
    games: list[GameBrief]
    created_at: datetime

    class Config:
        from_attributes = True


class CollectionUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class PositionSearchRequest(BaseModel):
    fen: str
    search_type: str = "exact"


class PositionSearchResult(BaseModel):
    game_id: int
    half_move: int
    white: str | None
    black: str | None
    event: str | None
    result: str | None
    eco: str | None


class OpeningTreeMove(BaseModel):
    san: str
    fen: str
    games: int
    white_wins: int
    draws: int
    black_wins: int


class OpeningTreeResponse(BaseModel):
    fen: str
    total_games: int
    moves: list[OpeningTreeMove]


# --- Practice (Phase 10) ---
class PracticeGameCreate(BaseModel):
    root_position_id: int
    pgn_text: str
    user_color: str
    final_fen: str
    move_count: int
    engine_name: str = "Stockfish"
    engine_level: str
    final_eval: float | None = None
    starting_eval: float | None = None
    user_verdict: str | None = None
    notes: str | None = None


class PracticeGameUpdate(BaseModel):
    user_verdict: str | None = None
    notes: str | None = None


class PracticeGameOut(BaseModel):
    id: int
    root_position_id: int
    pgn_text: str
    user_color: str
    final_fen: str
    move_count: int
    engine_verdict: str | None
    user_verdict: str | None
    final_eval: float | None
    starting_eval: float | None
    engine_name: str
    engine_level: str
    notes: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class PracticeGameBrief(BaseModel):
    id: int
    root_position_id: int
    user_color: str
    move_count: int
    engine_verdict: str | None
    user_verdict: str | None
    engine_level: str
    created_at: datetime

    class Config:
        from_attributes = True


class PracticeEngineBreakdown(BaseModel):
    engine_level: str
    total: int
    wins: int
    draws: int
    losses: int
    abandoned: int
    win_rate: float


class PracticeStatsOut(BaseModel):
    position_id: int
    total_games: int
    wins: int
    draws: int
    losses: int
    abandoned: int
    win_rate: float
    avg_move_count: float
    avg_final_eval: float | None
    by_engine_level: list[PracticeEngineBreakdown]


class PracticeTreeMove(BaseModel):
    san: str
    fen: str
    games: int
    wins: int
    draws: int
    losses: int
    win_rate: float


class PracticeTreeResponse(BaseModel):
    position_id: int
    total_games: int
    moves: list[PracticeTreeMove]


class PracticePositionSummary(BaseModel):
    position_id: int
    fen: str
    title: str | None
    total_games: int
    wins: int
    losses: int
    draws: int
    win_rate: float
    last_played: datetime | None

    class Config:
        from_attributes = True
