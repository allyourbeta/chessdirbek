# ChessQuiz

Personal chess position quiz app. Save positions (FEN), annotate them with notes and Stockfish analysis, tag them, and quiz yourself.

## Quick start

```bash
pip install -r requirements.txt
./run.sh
```

Then open http://localhost:8000.

## Documentation

- **Architecture and conventions**: [`CLAUDE.md`](CLAUDE.md)
- **Roadmap**: [`ROADMAP.md`](ROADMAP.md)
- **Detailed design**: [`DESIGN.md`](DESIGN.md), [`SPEC-v2.md`](SPEC-v2.md)
- **Going public plan**: [`GOING_PUBLIC.md`](GOING_PUBLIC.md)
- **Historical specs**: [`docs/archive/`](docs/archive/)

## Backups

Automated nightly backups via launchd. See `scripts/backup_database.sh` and the section on backups in `CLAUDE.md`.

Before any destructive operation:
```bash
./scripts/backup_now.sh
```

## Tests

```bash
python -m pytest tests/
```

## License

MIT — see [`LICENSE`](LICENSE)
