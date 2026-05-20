# Rename: ChessQuiz → Chessdirbek

**Goal**: Replace "ChessQuiz" / "chessquiz" with "Chessdirbek" / "chessdirbek" throughout the entire project.

**Backup**: `./scripts/backup_now.sh` before starting.

---

## Naming rules

| Old | New | Where |
|---|---|---|
| `ChessQuiz` | `Chessdirbek` | Display names: page title, heading, manifest, API title, comments, docs |
| `chessquiz` | `chessdirbek` | Env vars, DB filenames, cache keys, localStorage keys, script paths, backup filenames, plist names, log filenames |
| `chess-quiz` | `chessdirbek` | Any hyphenated references |
| `chess_quiz` | `chessdirbek` | Any underscored references |

## What to change

### Frontend
- `frontend/index.html`: `<title>`, `<h1>♞ ChessQuiz</h1>` → `<h1>♞ Chessdirbek</h1>`, `apple-mobile-web-app-title`
- `frontend/manifest.json`: `name`, `short_name`
- `frontend/sw.js`: comment text, `CACHE_NAME` from `chessquiz-v1` → `chessdirbek-v1`
- `frontend/js/position-form.js`: localStorage key `chessquiz-last-tags` → `chessdirbek-last-tags`

### Backend
- `backend/main.py`: FastAPI title, status endpoint text, module docstring
- `backend/database.py`: env var `CHESSQUIZ_DB_URL` → `CHESSDIRBEK_DB_URL`, default DB filename `chessquiz.db` → `chessdirbek.db`

### Scripts
- `scripts/backup_database.sh`: all path refs, backup filename prefix
- `scripts/backup_now.sh`: all path refs, backup filename prefix
- `scripts/restore_database.sh`: all path refs
- `scripts/cleanup_test_data.py`: DB filename, display text
- `setup_launchagent.sh`: plist name, display text, log filename
- `run.sh`: display text

### Tests
- `tests/conftest.py`: env var, docstring
- `tests/test.py`: display text, docstring
- `tests/test_db_config.py`: env var, test DB filename
- `tests/test_game_api.py`: env var
- `tests/test_name_service.py`: env var
- `tests/test_orientation.py`: env var
- `tests/test_position_types.py`: env var
- `tests/test_practice.py`: env var

### Docs
- `README.md`: project name
- `CLAUDE.md`: project name, backup plist refs, launchctl refs
- `ROADMAP.md`: project name
- `GOING_PUBLIC.md`: all references
- `BOOKMARKLET.md`: all references
- `PUZZLE-VS-TABIYA-DESIGN.md`: reference
- `SPEC-v2.md`: project name
- `PHASE-21-CLEANUP-AND-UX.md`: references
- `PHASE-26-REFACTOR.md`: references

## What NOT to change

- The actual directory name on disk (`~/Droppbox/programming/projects/chessquiz`) — that's the user's filesystem, don't rename it.
- The git remote or repo name — separate decision.
- The existing `chessquiz.db` file — the DATABASE_URL default changes but the existing DB file keeps its old name until the user renames it manually. Add a comment in `database.py`: `# Note: if migrating from ChessQuiz, rename chessquiz.db to chessdirbek.db`

## Important: bump the service worker cache

Changing `CACHE_NAME` from `chessquiz-v1` to `chessdirbek-v1` will force browsers to re-cache everything on next load. This is intentional — we want the old cache cleared.

## Verification

```bash
grep -rn "ChessQuiz\|chessquiz\|CHESSQUIZ" --include="*.html" --include="*.js" --include="*.json" --include="*.py" --include="*.md" --include="*.sh" --include="*.css" | grep -v node_modules | grep -v __pycache__
```

This should return zero results (except possibly the migration comment in `database.py`).

- [ ] App loads at localhost:8000, header says "♞ Chessdirbek"
- [ ] Page title says "Chessdirbek"
- [ ] Manifest shows "Chessdirbek" (check DevTools → Application → Manifest)
- [ ] Tests pass
- [ ] `./run.sh` prints "Chessdirbek starting at..."
- [ ] No console errors

## Commit

Single commit: `Rename ChessQuiz to Chessdirbek throughout`
