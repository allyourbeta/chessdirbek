#!/bin/bash

set -e

# Always run from the project root, no matter where this script is launched from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

OVERALL_SUCCESS=true
SERVER_PID=""

cleanup() {
    if [[ -n "$SERVER_PID" ]]; then
        kill "$SERVER_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT

run_test_section() {
    local section_name="$1"
    local command="$2"

    echo -e "${YELLOW}=== $section_name ===${NC}"

    if eval "$command"; then
        echo -e "${GREEN}✅ $section_name PASSED${NC}"
        echo ""
        return 0
    else
        echo -e "${RED}❌ $section_name FAILED${NC}"
        echo ""
        OVERALL_SUCCESS=false
        return 1
    fi
}

echo "===================="
echo "Phase 9 Smoke Tests"
echo "===================="
echo ""

# 1. Static Regression Audits
run_test_section "Static Regression Audits" "python3 static_audits.py"

# 2. Backend Tests (optional because local DB may not be available)
echo -e "${YELLOW}=== Backend API Tests ===${NC}"
if python -m pytest tests/test_basic_api.py::TestHealthAndStatic -v 2>/dev/null; then
    echo -e "${GREEN}✅ Backend API Tests PASSED${NC}"
else
    echo -e "${YELLOW}⚠️  Backend API Tests SKIPPED or FAILED (database/test environment may not be available)${NC}"
fi
echo ""

# 3. Frontend Integration Tests
run_test_section "Frontend Integration Tests" "python -m pytest tests/test_frontend_smoke.py -v"

# 4. Comprehensive Smoke Tests
if command -v pytest >/dev/null 2>&1 || python -m pytest --version >/dev/null 2>&1; then
    run_test_section "Comprehensive Frontend Tests" "python -m pytest tests/test_frontend_smoke_comprehensive.py -v --tb=short"
else
    echo -e "${YELLOW}⚠️  pytest not found, skipping comprehensive tests${NC}"
    echo ""
fi

# 4b. Engine Parser Tests
if command -v node >/dev/null 2>&1; then
    run_test_section "Engine Parser Tests" "node tests/engine/parse.test.js"
else
    echo -e "${YELLOW}⚠️  node not found, skipping engine parser tests${NC}"
    echo ""
fi

# 4b2. Engine Lifecycle Tests (timeout / init-retry / stop-race)
if command -v node >/dev/null 2>&1; then
    run_test_section "Engine Lifecycle Tests" "node tests/engine/lifecycle.test.js"
else
    echo -e "${YELLOW}⚠️  node not found, skipping engine lifecycle tests${NC}"
    echo ""
fi

# 4c. FEN Rotation Tests (Flip-FEN button)
if command -v node >/dev/null 2>&1; then
    run_test_section "FEN Rotation Tests" "node tests/fen/rotate.test.js"
else
    echo -e "${YELLOW}⚠️  node not found, skipping FEN rotation tests${NC}"
    echo ""
fi

# 4d. Side-to-move Completion Tests (detail Lichess button)
if command -v node >/dev/null 2>&1; then
    run_test_section "Side-to-move Completion Tests" "node tests/fen/side-to-move.test.js"
else
    echo -e "${YELLOW}⚠️  node not found, skipping side-to-move tests${NC}"
    echo ""
fi

# 4e. FEN Utils Tests (consolidated fen-utils.js module)
if command -v node >/dev/null 2>&1; then
    run_test_section "FEN Utils Tests" "node tests/fen/fen-utils.test.js"
else
    echo -e "${YELLOW}⚠️  node not found, skipping fen-utils tests${NC}"
    echo ""
fi

# 5. Manual verification checks
echo -e "${YELLOW}=== Manual Verification Checks ===${NC}"

echo "Checking for critical files..."
critical_files=(
    "frontend/js/api-client.js"
    "frontend/js/board.js"
    "frontend/js/move-count.js"
    "frontend/js/eco-openings.js"
    "frontend/js/fen-actions.js"
    "frontend/js/tag-renderer.js"
    "frontend/js/empty-states.js"
    "frontend/js/navigation.js"
)

for file in "${critical_files[@]}"; do
    if [[ -f "$file" ]]; then
        echo -e "${GREEN}✅${NC} $file exists"
    else
        echo -e "${RED}❌${NC} $file MISSING"
        OVERALL_SUCCESS=false
    fi
done

echo ""
echo "Checking file sizes (informational only; large files may be pre-existing)..."
oversized_files=$(find frontend/js -name "*.js" | xargs wc -l | awk '$1 > 300 {print $2 ": " $1 " lines"}' | grep -v total || true)

if [[ -n "$oversized_files" ]]; then
    echo -e "${YELLOW}⚠️  Files over 300 lines:${NC}"
    echo "$oversized_files"
else
    echo -e "${GREEN}✅${NC} No files over 300 lines"
fi

echo ""

# 6. Quick integration smoke test
echo -e "${YELLOW}=== Quick Integration Smoke Test ===${NC}"

echo "Starting test server on port 8000..."
python -m http.server 8000 --directory frontend >/dev/null 2>&1 &
SERVER_PID=$!

sleep 2

if curl -s http://localhost:8000 | grep -qi "chess\|tactics\|tabiya"; then
    echo -e "${GREEN}✅${NC} App loads successfully"
else
    echo -e "${RED}❌${NC} App failed to load"
    OVERALL_SUCCESS=false
fi

critical_endpoints=(
    "js/main.js"
    "js/api-client.js"
    "js/board.js"
    "css/style.css"
)

for endpoint in "${critical_endpoints[@]}"; do
    status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8000/$endpoint")
    if [[ "$status" == "200" ]]; then
        echo -e "${GREEN}✅${NC} /$endpoint serves correctly"
    else
        echo -e "${RED}❌${NC} /$endpoint failed to serve (HTTP $status)"
        OVERALL_SUCCESS=false
    fi
done

echo ""

echo "===================="
if [[ "$OVERALL_SUCCESS" == "true" ]]; then
    echo -e "${GREEN}🎉 ALL SMOKE TESTS PASSED${NC}"
    echo ""
    echo "The app has passed regression checks for:"
    echo "• Inline handler elimination"
    echo "• API centralization"
    echo "• Navigation/cancel behavior"
    echo "• FEN ownership centralization"
    echo "• Move count formatting"
    echo "• ECO/opening label centralization"
    echo "• Engine lifecycle management"
    echo "• Practice engine async safety"
    echo "• Save-current-position workflows"
    echo "• Rendering safety (innerHTML documentation)"
    echo "• Business logic centralization"
    echo ""
    echo "Manual testing still recommended for end-to-end workflows."
    exit 0
else
    echo -e "${RED}❌ SOME SMOKE TESTS FAILED${NC}"
    echo ""
    echo "Please review the failures above and fix before deploying."
    exit 1
fi
