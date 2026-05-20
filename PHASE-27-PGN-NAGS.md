# Phase 27: Show ! and ? marks on imported PGN moves

**Goal**: When importing a PGN that contains move annotations (`!`, `?`, `!!`, `??`, `!?`, `?!`), those symbols should appear in the move list throughout the app.

**Scope**: One file, ~5 lines of code. Backend only.

**Read first**: `CLAUDE.md`

**Backup**: `./scripts/backup_now.sh`

---

## Background

PGN encodes move annotations as NAGs (Numeric Annotation Glyphs): `$1` = `!`, `$2` = `?`, etc. python-chess already parses these into a `nags` set on each game node. The parser in `pgn_service.py` currently ignores `node.nags` — so `1. e4! e5?` imports as `["e4", "e5"]` instead of `["e4!", "e5?"]`.

The fix is at parse time: append the NAG symbol to the SAN string when building `moves_san`.

---

## The fix

### Step 1. Add NAG mapping in `backend/services/pgn_service.py`

Near the top of the file, after the imports, add:

```python
# Standard NAG-to-symbol mapping (most common move annotations).
# See PGN specification §10 for the full list.
_NAG_SYMBOLS = {1: "!", 2: "?", 3: "!!", 4: "??", 5: "!?", 6: "?!"}
```

### Step 2. Append NAG symbols to moves

In `parse_single_pgn`, change the line that builds `moves_san` (currently line ~38):

```python
moves_san.append(board.san(node.move))
```

to:

```python
san = board.san(node.move)
# Append NAG symbols (!, ?, !!, ??, !?, ?!) to the move text
for nag in sorted(node.nags):
    sym = _NAG_SYMBOLS.get(nag)
    if sym:
        san += sym
        break  # Only use the first recognized NAG per move
moves_san.append(san)
```

The `sorted()` ensures deterministic behavior if a move has multiple NAGs (rare but possible). `break` after the first one because you almost never see `e4!?!` — a move has one annotation.

### Step 3. That's it

No schema changes needed — `moves_san` is already `list[str]`, and `"e4!"` is still a string.

No frontend changes needed — the game viewer renders `moves_san[i]` directly into the move table. The `!` will just appear as part of the move text.

No database migration needed — moves are parsed from `pgn_text` on the fly when viewing a game via the API. (If any games cache `moves_san` in the DB, re-importing them will pick up the NAGs.)

---

## Important: existing games

Games already imported won't magically gain NAG symbols — their `pgn_text` is stored and re-parsed on each API call via the `GameDetail` response. Let me verify this...

Actually, check how `moves_san` reaches the frontend. If the API re-parses `pgn_text` on every `GET /games/{id}`, then existing games will automatically show NAGs after this fix. If `moves_san` was stored separately at import time and served from the DB, then only newly imported games get the fix.

Look at `backend/api/games.py` to determine which path it uses. If `moves_san` comes from re-parsing `pgn_text`, no backfill needed. If it's stored, existing games need re-import.

---

## Test

Add to `tests/test_name_service.py` (or create `tests/test_pgn_nags.py`):

```python
from backend.services.pgn_service import parse_single_pgn


def test_nag_symbols_in_moves():
    pgn = '1. e4! e5? 2. Nf3!! Nc6?! 3. Bb5!? a6'
    result = parse_single_pgn(pgn)
    assert result["error"] is None
    assert result["moves_san"][0] == "e4!"
    assert result["moves_san"][1] == "e5?"
    assert result["moves_san"][2] == "Nf3!!"
    assert result["moves_san"][3] == "Nc6?!"
    assert result["moves_san"][4] == "Bb5!?"
    assert result["moves_san"][5] == "a6"


def test_no_nag_unchanged():
    pgn = '1. e4 e5 2. Nf3 Nc6'
    result = parse_single_pgn(pgn)
    assert result["moves_san"] == ["e4", "e5", "Nf3", "Nc6"]
```

Run: `python -m pytest tests/test_pgn_nags.py -v`

## Acceptance

- [ ] Import a PGN with `1. e4! e5? 2. Nf3 Nc6` → game viewer shows "e4!" and "e5?" in the move list.
- [ ] Import a PGN without annotations → moves display normally, no change.
- [ ] Tests pass.
- [ ] No console errors.

## Commit

Single commit: `Append NAG symbols (! ? !! ?? !? ?!) to imported PGN moves`
