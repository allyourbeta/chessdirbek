#!/bin/bash
# Start Chessdirbek server
cd "$(dirname "$0")"
echo "🎯 Chessdirbek starting at http://localhost:8000"
echo "   API docs at http://localhost:8000/docs"
echo ""
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
