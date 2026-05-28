"""Chessdirbek API — main entry point."""

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.api import (
    annotations_router,
    chess_router,
    collections_router,
    engine_games_router,
    games_router,
    opening_tree_router,
    positions_router,
    positions_extra_router,
    tags_router,
)
from backend.database import Base, engine, run_lightweight_migrations

# Create all tables on startup
Base.metadata.create_all(bind=engine)
# Apply additive column migrations (ELO, etc.) for existing databases
run_lightweight_migrations()

app = FastAPI(title="Chessdirbek", version="0.1.0")

# CORS for local React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(annotations_router, prefix="/api")
app.include_router(positions_router, prefix="/api")
app.include_router(positions_extra_router, prefix="/api")
app.include_router(tags_router, prefix="/api")
app.include_router(chess_router, prefix="/api")
app.include_router(games_router, prefix="/api")
app.include_router(collections_router, prefix="/api")
app.include_router(opening_tree_router, prefix="/api")
app.include_router(engine_games_router, prefix="/api")


# During local development the browser (and PWA service worker) aggressively
# cache JS/CSS/HTML, which makes on-disk edits appear to have no effect. Send
# no-store on these asset types so a reload always fetches fresh code.
# API (/api/...) and vendored libraries (/vendor/...) are left alone.
@app.middleware("http")
async def _no_cache_assets(request, call_next):
    response = await call_next(request)
    path = request.url.path
    is_asset = path.endswith((".js", ".css", ".html")) or path == "/"
    if is_asset and not path.startswith("/vendor"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

app.mount("/js", StaticFiles(directory=FRONTEND_DIR / "js"), name="js")
app.mount("/css", StaticFiles(directory=FRONTEND_DIR / "css"), name="css")
app.mount("/vendor", StaticFiles(directory=FRONTEND_DIR / "vendor"), name="vendor")


@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "Chessdirbek"}


# Static PWA files (manifest, service worker, icons, favicon)
@app.get("/manifest.json")
def serve_manifest():
    return FileResponse(FRONTEND_DIR / "manifest.json", media_type="application/manifest+json")


@app.get("/sw.js")
def serve_sw():
    return FileResponse(FRONTEND_DIR / "sw.js", media_type="application/javascript")


@app.get("/favicon.ico")
def serve_favicon():
    return FileResponse(FRONTEND_DIR / "favicon.ico", media_type="image/x-icon")


@app.get("/icon-192.png")
def serve_icon_192():
    return FileResponse(FRONTEND_DIR / "icon-192.png", media_type="image/png")


@app.get("/icon-512.png")
def serve_icon_512():
    return FileResponse(FRONTEND_DIR / "icon-512.png", media_type="image/png")


@app.get("/")
def serve_frontend():
    return FileResponse(FRONTEND_DIR / "index.html")


# SPA catch-all: any non-API, non-static path serves index.html so the
# client-side router can read the URL and render the correct view.
_SPA_ROUTES = {
    "positions",  # legacy
    "tabiyas",  # legacy redirect
    "tabiya",
    "endings",
    "strategy", 
    "tactics",
    "games",
    "collections",
    "search",
    "add",
    "bulk-add",
    "editor",
    "play",
    "replay",
    "practice",
}


@app.get("/{top}")
def spa_top(top: str):
    if top in _SPA_ROUTES:
        return FileResponse(FRONTEND_DIR / "index.html")
    from fastapi import HTTPException
    raise HTTPException(status_code=404)


@app.get("/{top}/{rest:path}")
def spa_nested(top: str, rest: str):
    if top in _SPA_ROUTES:
        return FileResponse(FRONTEND_DIR / "index.html")
    from fastapi import HTTPException
    raise HTTPException(status_code=404)
