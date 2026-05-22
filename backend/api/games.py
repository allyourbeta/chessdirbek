"""Game API routes. All DB calls for games happen here."""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from backend.api.game_helpers import (
    create_game_from_parsed,
    get_or_create_tags,
)
from backend.api.game_schemas import BulkPGNImport, BulkPGNImportResult, GameBrief, GameCreate, GameDetail, GameUpdate, PositionSearchRequest, PositionSearchResult
from backend.api.import_service import new_job_id, run_import, signal_cancel, stream_import
from backend.database import get_db
from backend.models import Game, GameCollection, PositionIndex, Tag
from backend.services import compute_zobrist, parse_single_pgn

router = APIRouter(prefix="/games", tags=["games"])

@router.post("/", response_model=GameBrief, status_code=201)
def create_game(data: GameCreate, db: Session = Depends(get_db)):
    parsed = parse_single_pgn(data.pgn_text)
    if parsed.get("error"):
        raise HTTPException(status_code=400, detail=parsed["error"])
    parsed["pgn_text"] = data.pgn_text

    game = create_game_from_parsed(db, parsed, data.tags, data.collection_ids)
    db.commit()
    db.refresh(game)
    return game

@router.post("/import", response_model=BulkPGNImportResult)
def bulk_import(data: BulkPGNImport, db: Session = Depends(get_db)):
    """Non-streaming bulk import. Atomic: commits once at end, rolls back on error."""
    result = run_import(
        db,
        pgn_text=data.pgn_text,
        user_tags=data.tags,
        collection_ids=data.collection_ids,
        force=data.force,
    )
    if result["total"] == 0:
        raise HTTPException(status_code=400, detail="No games found in PGN")
    return BulkPGNImportResult(
        imported=result["imported"],
        failed=result["failed"],
        duplicates=result["duplicates"],
        errors=result["errors"],
        game_ids=result["game_ids"],
    )

@router.post("/import/stream")
def bulk_import_stream(data: BulkPGNImport):
    """SSE import. Emits start/progress/done/error events. Cancel via /import/cancel/{job_id}."""
    job_id = new_job_id()
    return StreamingResponse(
        stream_import(
            pgn_text=data.pgn_text, user_tags=data.tags,
            collection_ids=data.collection_ids, force=data.force, job_id=job_id,
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "X-Job-Id": job_id},
    )

@router.post("/import/cancel/{job_id}", status_code=202)
def bulk_import_cancel(job_id: str):
    if not signal_cancel(job_id):
        raise HTTPException(status_code=404, detail="Import job not found")
    return {"cancelled": True, "job_id": job_id}

_VALID_RESULTS = {"1-0", "0-1", "1/2-1/2"}

def _apply_game_filters(query, tag, tags, collection_id, search, eco, result):
    tag_names = []
    if tag:
        tag_names.append(tag)
    if tags:
        tag_names.extend(tags)
    for t in tag_names:
        name = t.strip().lower().lstrip("#")
        if not name:
            continue
        query = query.filter(Game.tags.any(Tag.name == name))

    if collection_id:
        query = query.filter(
            Game.collections.any(GameCollection.id == collection_id)
        )

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            Game.white.ilike(pattern)
            | Game.black.ilike(pattern)
            | Game.event.ilike(pattern)
            | Game.opening.ilike(pattern)
        )

    if eco:
        query = query.filter(Game.eco == eco.upper())

    if result and result in _VALID_RESULTS:
        query = query.filter(Game.result == result)

    return query


@router.get("/", response_model=list[GameBrief])
def list_games(
    tag: str | None = None,
    tags: list[str] | None = Query(default=None),
    collection_id: int | None = None,
    search: str | None = None,
    eco: str | None = None,
    result: str | None = None,
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Game).options(joinedload(Game.tags))
    query = _apply_game_filters(
        query, tag, tags, collection_id, search, eco, result
    )
    return (
        query.order_by(Game.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get("/count")
def count_games(
    tag: str | None = None,
    tags: list[str] | None = Query(default=None),
    collection_id: int | None = None,
    search: str | None = None,
    eco: str | None = None,
    result: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(Game.id)
    query = _apply_game_filters(
        query, tag, tags, collection_id, search, eco, result
    )
    return {"count": query.count()}


@router.get("/{game_id}", response_model=GameDetail)
def get_game(game_id: int, db: Session = Depends(get_db)):
    game = (
        db.query(Game)
        .options(joinedload(Game.tags))
        .filter(Game.id == game_id)
        .first()
    )
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    parsed = parse_single_pgn(game.pgn_text)
    return GameDetail(
        id=game.id,
        pgn_text=game.pgn_text,
        white=game.white,
        black=game.black,
        event=game.event,
        site=game.site,
        date_played=game.date_played,
        result=game.result,
        eco=game.eco,
        opening=game.opening,
        move_count=game.move_count,
        moves_san=parsed.get("moves_san", []),
        fens=parsed.get("fens", []),
        comments=parsed.get("comments", []),
        tags=game.tags,
        created_at=game.created_at,
        updated_at=game.updated_at,
    )


@router.put("/{game_id}", response_model=GameBrief)
def update_game(
    game_id: int, data: GameUpdate, db: Session = Depends(get_db)
):
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    if data.tags is not None:
        game.tags = get_or_create_tags(db, data.tags)

    if data.collection_ids is not None:
        game.collections = (
            db.query(GameCollection)
            .filter(GameCollection.id.in_(data.collection_ids))
            .all()
        )

    db.commit()
    db.refresh(game)
    return game


@router.delete("/{game_id}", status_code=204)
def delete_game(game_id: int, db: Session = Depends(get_db)):
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    db.delete(game)
    db.commit()


@router.post("/search-position", response_model=list[PositionSearchResult])
def search_position(
    data: PositionSearchRequest, db: Session = Depends(get_db)
):
    if data.search_type == "exact":
        try:
            z_hash = compute_zobrist(data.fen)
        except (ValueError, Exception) as e:
            raise HTTPException(status_code=400, detail=f"Invalid FEN: {e}")
        matches = (
            db.query(PositionIndex)
            .filter(PositionIndex.zobrist_hash == z_hash)
            .all()
        )
    elif data.search_type == "pawn":
        from backend.services import compute_pawn_sig

        try:
            target_sig = compute_pawn_sig(data.fen)
        except (ValueError, Exception) as e:
            raise HTTPException(status_code=400, detail=f"Invalid FEN: {e}")

        w_part, b_part = target_sig.split("|")
        target_white = set(w_part.split(":")[1].split(",")) if ":" in w_part and w_part.split(":")[1] else set()
        target_black = set(b_part.split(":")[1].split(",")) if ":" in b_part and b_part.split(":")[1] else set()
        target_white.discard("")
        target_black.discard("")

        query = db.query(PositionIndex)
        for sq in target_white:
            query = query.filter(PositionIndex.pawn_sig.like(f"w:%{sq}%|%"))
        for sq in target_black:
            query = query.filter(PositionIndex.pawn_sig.like(f"%|b:%{sq}%"))
        candidates = query.all()

        matches = []
        for m in candidates:
            sig_w, sig_b = m.pawn_sig.split("|")
            stored_white = set(sig_w.split(":")[1].split(",")) if ":" in sig_w and sig_w.split(":")[1] else set()
            stored_black = set(sig_b.split(":")[1].split(",")) if ":" in sig_b and sig_b.split(":")[1] else set()
            stored_white.discard("")
            stored_black.discard("")
            if target_white.issubset(stored_white) and target_black.issubset(stored_black):
                matches.append(m)
    else:
        raise HTTPException(
            status_code=400, detail="search_type must be 'exact' or 'pawn'"
        )

    seen = set()
    unique_matches = []
    for m in matches:
        key = (m.game_id, m.half_move)
        if key in seen:
            continue
        seen.add(key)
        unique_matches.append(m)

    game_ids = list({m.game_id for m in unique_matches})
    games = db.query(Game).filter(Game.id.in_(game_ids)).all() if game_ids else []
    games_by_id = {g.id: g for g in games}

    results = []
    for m in unique_matches:
        game = games_by_id.get(m.game_id)
        if game:
            results.append(
                PositionSearchResult(
                    game_id=game.id,
                    half_move=m.half_move,
                    white=game.white,
                    black=game.black,
                    event=game.event,
                    result=game.result,
                    eco=game.eco,
                )
            )

    return results
