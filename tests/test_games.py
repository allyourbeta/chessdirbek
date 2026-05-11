#!/usr/bin/env python3
"""Phase 3 tests: PGN parsing, Zobrist hashing, pawn signatures, position indexing."""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from backend.services import (
    compute_pawn_sig,
    compute_position_index,
    compute_zobrist,
    extract_auto_tags,
    get_fen_at_move,
    parse_multi_pgn,
    parse_single_pgn,
)

passed = 0
failed = 0


def check(name, condition, detail=""):
    global passed, failed
    if condition:
        print(f"  ✓ {name}")
        passed += 1
    else:
        print(f"  ✗ {name} — {detail}")
        failed += 1


VALID_PGN = """[Event "Smith-Morra Gambit"]
[Site "Chess.com"]
[Date "2024.01.15"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]
[ECO "B21"]
[Opening "Sicilian Defense: Smith-Morra Gambit"]

1. e4 c5 2. d4 cxd4 3. c3 dxc3 4. Nxc3 Nc6 5. Nf3 d6 6. Bc4 e6 7. O-O Nf6 8. Qe2 Be7 9. Rd1 e5 10. Be3 O-O 11. Rac1 Bg4 12. Nd5 Bxf3 13. gxf3 Nxd5 14. Bxd5 Rc8 15. Bb6 Qd7 16. Rxc6 1-0"""

MULTI_PGN = """[Event "Smith-Morra Gambit"]
[Site "Chess.com"]
[Date "2024.01.15"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]
[ECO "B21"]
[Opening "Sicilian Defense: Smith-Morra Gambit"]

1. e4 c5 2. d4 cxd4 3. c3 dxc3 4. Nxc3 Nc6 5. Nf3 d6 6. Bc4 e6 7. O-O Nf6 8. Qe2 Be7 9. Rd1 e5 10. Be3 O-O 11. Rac1 Bg4 12. Nd5 Bxf3 13. gxf3 Nxd5 14. Bxd5 Rc8 15. Bb6 Qd7 16. Rxc6 1-0

[Event "Another Smith-Morra"]
[Site "Lichess"]
[Date "2024.03.10"]
[White "Player3"]
[Black "Player4"]
[Result "0-1"]
[ECO "B21"]
[Opening "Sicilian Defense: Smith-Morra Gambit"]

1. e4 c5 2. d4 cxd4 3. c3 dxc3 4. Nxc3 Nc6 5. Nf3 e6 6. Bc4 a6 7. O-O Nge7 8. Bg5 h6 9. Be3 Ng6 10. Bb3 Be7 11. Qd2 O-O 12. Rad1 b5 13. f4 Bb7 14. f5 exf5 15. exf5 Nge5 16. Nxe5 Nxe5 17. Qf2 Nc4 0-1

[Event "Elephant Gambit"]
[Site "Online"]
[Date "2024.05.20"]
[White "Opponent"]
[Black "Ashish"]
[Result "0-1"]
[ECO "C40"]
[Opening "Elephant Gambit"]

1. e4 e5 2. Nf3 d5 3. exd5 Bd6 4. d4 e4 5. Ne5 Nf6 6. Bc4 O-O 7. O-O Bxe5 8. dxe5 Nxd5 9. Qh5 Nc6 10. Bxd5 Qxd5 11. Nc3 Qxe5 0-1"""

BAD_PGN = """[Event "Broken"]
[White "???"]

1. e4 zzz99 2. garbage_move LOL"""


print("Running Phase 3 tests...\n")

# --- parse_single_pgn ---
print("parse_single_pgn:")
r = parse_single_pgn(VALID_PGN)
check("Valid PGN parses", r["error"] is None, r.get("error"))
check("Has headers", r["headers"]["White"] == "Player1")
check("Has moves", len(r["moves_san"]) == 31, f"got {len(r['moves_san'])}")
check("Has FENs (moves+1)", len(r["fens"]) == 32, f"got {len(r['fens'])}")
check("Has UCI moves", len(r["moves_uci"]) == 31)
check("Has zobrist hashes", len(r["zobrist_hashes"]) == 32)
check("Has pawn sigs", len(r["pawn_sigs"]) == 32)
check("move_count correct", r["move_count"] == 31)

r2 = parse_single_pgn(BAD_PGN)
check("Bad PGN has moves (partial)", r2["error"] is None and r2["move_count"] < 31)

r3 = parse_single_pgn("")
check("Empty PGN returns error", r3.get("error") is not None)

# --- parse_multi_pgn ---
print("\nparse_multi_pgn:")
results = parse_multi_pgn(MULTI_PGN)
check("Parses 3 games", len(results) == 3, f"got {len(results)}")
ok_count = sum(1 for g in results if g["error"] is None)
check("All 3 valid", ok_count == 3, f"got {ok_count}")
check("Game 1 is Player1", results[0]["headers"]["White"] == "Player1")
check("Game 3 is Elephant Gambit", results[2]["headers"]["Event"] == "Elephant Gambit")

# --- extract_auto_tags ---
print("\nextract_auto_tags:")
tags = extract_auto_tags(r["headers"])
check("ECO tag extracted", "b21" in tags)
check("Opening tag extracted", any("smith-morra" in t for t in tags))
check("Player tags extracted", "player1" in tags and "player2" in tags)

tags_q = extract_auto_tags({"White": "?", "Black": "??", "ECO": "?"})
check("Skips ? values", len(tags_q) == 0, f"got {tags_q}")

# --- get_fen_at_move ---
print("\nget_fen_at_move:")
START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
fen0 = get_fen_at_move(VALID_PGN, 0)
check("Move 0 is starting position", fen0 == START_FEN)

fen1 = get_fen_at_move(VALID_PGN, 1)
check("Move 1 is after e4", "4P3" in fen1)

fen5 = get_fen_at_move(VALID_PGN, 5)
check("Move 5 is valid FEN", "/" in fen5 and len(fen5) > 20)

fen_last = get_fen_at_move(VALID_PGN, r["move_count"])
check("Last move FEN matches", fen_last == r["fens"][-1])

# --- compute_zobrist ---
print("\ncompute_zobrist:")
h1 = compute_zobrist(START_FEN)
check("Starting pos has hash", isinstance(h1, int) and h1 > 0)

h2 = compute_zobrist(START_FEN)
check("Consistent hash", h1 == h2)

AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"
h3 = compute_zobrist(AFTER_E4)
check("Different position = different hash", h3 != h1)

ruy_via_nf3 = "r1bqkbnr/pppppppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3"
ruy_via_nc3 = "r1bqkbnr/pppppppp/2n5/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 3"
check("Different positions = different hashes",
      compute_zobrist(ruy_via_nf3) != compute_zobrist(ruy_via_nc3))

# --- compute_pawn_sig ---
print("\ncompute_pawn_sig:")
sig_start = compute_pawn_sig(START_FEN)
check("Start sig format", sig_start.startswith("w:") and "|b:" in sig_start)
check("Start sig has all pawns",
      sig_start == "w:a2,b2,c2,d2,e2,f2,g2,h2|b:a7,b7,c7,d7,e7,f7,g7,h7")

french_fen = "rnbqkb1r/ppp2ppp/4pn2/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 4"
sig_french = compute_pawn_sig(french_fen)
check("French has d5 for black", "d5" in sig_french.split("|b:")[1])
check("French has e4 for white", "e4" in sig_french.split("|b:")[0])

pieces_only_diff = "r1bqkb1r/ppp2ppp/4pn2/3p4/3PP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 1 4"
sig_pieces_diff = compute_pawn_sig(pieces_only_diff)
check("Same pawns different pieces = same sig", sig_french == sig_pieces_diff)

caro_fen = "rnbqkbnr/pp2pppp/2p5/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3"
sig_caro = compute_pawn_sig(caro_fen)
check("Different pawns = different sig", sig_french != sig_caro)

sig_black = sig_french.split("|b:")[1]
check("Subset check: c6,d5,e6 not all in French",
      not all(sq in sig_black.split(",") for sq in ["c6", "d5", "e6"]))

caro_black = sig_caro.split("|b:")[1]
check("Subset check: c6 in Caro black",
      "c6" in caro_black.split(","))

# --- compute_position_index ---
print("\ncompute_position_index:")
idx = compute_position_index(VALID_PGN)
check("Index count = moves+1", len(idx) == 32, f"got {len(idx)}")
check("First entry half_move=0", idx[0]["half_move"] == 0)
check("First hash matches start", idx[0]["zobrist_hash"] == h1)
check("Each entry has fen", all("fen" in e for e in idx))
check("Each entry has pawn_sig", all("pawn_sig" in e for e in idx))
check("Half moves sequential",
      all(idx[i]["half_move"] == i for i in range(len(idx))))

# Summary
print(f"\n{'='*40}")
print(f"  {passed} passed, {failed} failed")
print(f"{'='*40}")

sys.exit(1 if failed else 0)
