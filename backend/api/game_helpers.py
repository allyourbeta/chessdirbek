"""Helpers for game API: tag/game creation and duplicate detection."""

from sqlalchemy.orm import Session

from backend.models import Game, GameCollection, PositionIndex, Tag
from backend.services import compute_position_index, extract_auto_tags


def get_or_create_tags(db: Session, tag_names: list[str]) -> list[Tag]:
    # Normalize and filter tag names
    normalized_names = []
    for name in tag_names:
        name = name.strip().lower().lstrip("#")
        if name:
            normalized_names.append(name)
    
    if not normalized_names:
        return []
    
    # Batch query existing tags to avoid N+1 queries
    existing_tags = (
        db.query(Tag)
        .filter(Tag.name.in_(normalized_names))
        .all()
    )
    existing_by_name = {tag.name: tag for tag in existing_tags}
    
    # Create missing tags and preserve order
    tags = []
    for name in normalized_names:
        if name in existing_by_name:
            tags.append(existing_by_name[name])
        else:
            tag = Tag(name=name)
            db.add(tag)
            db.flush()  # Flush to get ID for potential duplicates in same transaction
            existing_by_name[name] = tag  # Cache for potential duplicates in same call
            tags.append(tag)
    return tags


def _parse_elo(value):
    if not value:
        return None
    try:
        n = int(str(value).strip())
        return n if 0 < n < 4000 else None
    except (ValueError, TypeError):
        return None


def create_game_from_parsed(
    db: Session,
    parsed: dict,
    user_tags: list[str],
    collection_ids: list[int],
    index_data: list[dict] | None = None,
) -> Game:
    headers = parsed["headers"]
    auto_tags = extract_auto_tags(headers)
    all_tag_names = list(set(user_tags + auto_tags))
    tags = get_or_create_tags(db, all_tag_names)

    collections = []
    if collection_ids:
        collections = (
            db.query(GameCollection)
            .filter(GameCollection.id.in_(collection_ids))
            .all()
        )

    game = Game(
        pgn_text=parsed["pgn_text"],
        white=headers.get("White"),
        black=headers.get("Black"),
        event=headers.get("Event"),
        site=headers.get("Site"),
        date_played=headers.get("Date"),
        result=headers.get("Result"),
        eco=headers.get("ECO"),
        opening=headers.get("Opening"),
        move_count=parsed["move_count"],
        white_elo=_parse_elo(headers.get("WhiteElo")),
        black_elo=_parse_elo(headers.get("BlackElo")),
        tags=tags,
        collections=collections,
    )
    db.add(game)
    db.flush()

    if index_data is None:
        index_data = compute_position_index(parsed["pgn_text"])
    for entry in index_data:
        pi = PositionIndex(
            game_id=game.id,
            half_move=entry["half_move"],
            zobrist_hash=entry["zobrist_hash"],
            fen=entry["fen"],
            pawn_sig=entry["pawn_sig"],
        )
        db.add(pi)

    return game


def is_duplicate_game(
    db: Session, parsed: dict, index_data: list[dict]
) -> bool:
    """Check if a game with matching position sequence or PGN text already exists."""
    if db.query(Game).filter(Game.pgn_text == parsed["pgn_text"]).first():
        return True
    if not index_data:
        return False
    final_hash = index_data[-1]["zobrist_hash"]
    move_count = parsed.get("move_count") or (len(index_data) - 1)
    candidates = (
        db.query(Game)
        .join(PositionIndex, PositionIndex.game_id == Game.id)
        .filter(Game.move_count == move_count)
        .filter(PositionIndex.half_move == move_count)
        .filter(PositionIndex.zobrist_hash == final_hash)
        .all()
    )
    for candidate in candidates:
        existing = (
            db.query(PositionIndex)
            .filter(PositionIndex.game_id == candidate.id)
            .order_by(PositionIndex.half_move)
            .all()
        )
        if len(existing) != len(index_data):
            continue
        if all(
            e.zobrist_hash == idx["zobrist_hash"]
            for e, idx in zip(existing, index_data)
        ):
            return True
    return False
