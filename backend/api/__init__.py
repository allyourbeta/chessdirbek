from backend.api.annotations import router as annotations_router
from backend.api.collections import router as collections_router
from backend.api.games import router as games_router
from backend.api.opening_tree import router as opening_tree_router
from backend.api.positions import router as positions_router
from backend.api.positions_extra import router as positions_extra_router
from backend.api.tags_and_chess import chess_router, tags_router
from backend.api.engine_games import router as engine_games_router

__all__ = [
    "annotations_router",
    "positions_router",
    "positions_extra_router",
    "tags_router",
    "chess_router",
    "games_router",
    "collections_router",
    "opening_tree_router",
    "engine_games_router",
]
