#!/bin/bash

# Simple one-command smoke test runner for Chessquiz
# Run frontend integration smoke tests to catch regressions

echo "Running Chessquiz frontend smoke tests..."
echo "=========================================="

# Run only the smoke tests 
python -m pytest tests/test_frontend_smoke.py -v --tb=short

echo ""
echo "Smoke tests completed."
echo ""
echo "To run all tests: python -m pytest tests/ -v"