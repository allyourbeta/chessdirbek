Read CLAUDE.md and GLOBAL-FEN-ANNOTATIONS-SPEC.md. This adds a new feature: per-position annotations that persist globally by FEN.

Work in this order:

1. Create the SQLAlchemy model in a new file backend/models/annotation_models.py
2. Add the migration to backend/database.py (additive only, do not alter existing tables)
3. Create backend/api/annotations.py with three endpoints (GET, PUT, POST batch)
4. Register the router in backend/api/__init__.py and backend/main.py
5. Create frontend/js/annotation-panel.js as a shared component with mount/setPosition/unmount
6. Integrate into position-detail.js, game-viewer.js, and practice-viewer.js — mount the panel and call setPosition wherever EngineUI.setPosition is called
7. Add the annotation container div in index.html for each view (below FEN, above engine)

PAY ATTENTION TO:
- The race condition protection (_loadVersion) — this is critical
- The dirty-state model (_loadedText, _draftText, _isDirty)
- Save semantics: trim only for emptiness check, preserve formatting, delete row if empty, no-op if unchanged
- Batch endpoint is POST, not GET
- Board editor is EXCLUDED — do not add annotations there
- The panel gets its FEN from setPosition(), never from a DOM text field
- After all changes, verify no JS file exceeds 300 lines
- Run backend tests: python test.py && python test_games.py && python test_game_api.py && python test_practice.py && python test_position_types.py
