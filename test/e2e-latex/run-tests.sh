#!/usr/bin/env bash
# run-tests.sh — executed INSIDE the Docker container
set -euo pipefail

PASS=0
FAIL=0

pass() { echo "  ✅ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ❌ $1: $2"; FAIL=$((FAIL + 1)); }

echo ""
echo "── Test 1: triton-latex is on PATH ──"
if command -v triton-latex >/dev/null 2>&1; then
    pass "triton-latex found at $(which triton-latex)"
else
    fail "triton-latex not on PATH" "npm global bin not in PATH?"
fi

echo ""
echo "── Test 2: triton-latex --help ──"
if triton-latex --help 2>&1 | grep -q "render"; then
    pass "CLI help shows render command"
else
    fail "CLI help" "unexpected output"
fi

echo ""
echo "── Test 3: triton-latex render (single file → PDF) ──"
cat > /tmp/simple.mmd << 'EOF'
flowchart LR
  A --> B --> C
EOF
if triton-latex render /tmp/simple.mmd -o /tmp/simple.pdf 2>&1; then
    if [ -f /tmp/simple.pdf ] && [ -s /tmp/simple.pdf ]; then
        SIZE=$(stat -c%s /tmp/simple.pdf)
        pass "Rendered PDF ($SIZE bytes)"
    else
        fail "render" "PDF file missing or empty"
    fi
else
    fail "render" "CLI exited with error"
fi

echo ""
echo "── Test 4: triton-latex render (single file → SVG) ──"
if triton-latex render /tmp/simple.mmd -o /tmp/simple.svg 2>&1; then
    if grep -q "<svg" /tmp/simple.svg 2>/dev/null; then
        pass "Rendered SVG"
    else
        fail "render SVG" "no <svg> tag in output"
    fi
else
    fail "render SVG" "CLI exited with error"
fi

echo ""
echo "── Test 5: triton-latex render-dir (batch) ──"
mkdir -p /tmp/figures
if triton-latex render-dir diagrams/ -o /tmp/figures/ 2>&1; then
    if [ -f /tmp/figures/tree.pdf ] && [ -s /tmp/figures/tree.pdf ]; then
        pass "Batch rendered diagrams/tree.mmd → figures/tree.pdf"
    else
        fail "render-dir" "tree.pdf missing or empty"
    fi
else
    fail "render-dir" "CLI exited with error"
fi

echo ""
echo "── Test 6: triton.sty is present ──"
if [ -f triton.sty ]; then
    pass "triton.sty found ($(wc -c < triton.sty) bytes)"
else
    fail "triton.sty" "not found in working directory"
fi

echo ""
echo "── Test 7: pdflatex -shell-escape (inline authoring) ──"
# Copy precompiled figures for Test 4 in the .tex
cp -r /tmp/figures .
if pdflatex -shell-escape -interaction=nonstopmode test-triton.tex > /tmp/pdflatex.log 2>&1; then
    if [ -f test-triton.pdf ] && [ -s test-triton.pdf ]; then
        SIZE=$(stat -c%s test-triton.pdf)
        pass "pdflatex produced test-triton.pdf ($SIZE bytes)"
    else
        fail "pdflatex" "PDF missing or empty"
    fi
else
    echo "    pdflatex log (last 30 lines):"
    tail -30 /tmp/pdflatex.log | sed 's/^/    /'
    fail "pdflatex" "exited with error (see log above)"
fi

echo ""
echo "── Test 8: Cache works (second compile should skip renders) ──"
if pdflatex -shell-escape -interaction=nonstopmode test-triton.tex > /tmp/pdflatex2.log 2>&1; then
    # Check that the cache dir exists and has PDFs
    CACHE_DIR="test-triton.triton-cache"
    if [ -d "$CACHE_DIR" ]; then
        CACHED=$(ls "$CACHE_DIR"/*.pdf 2>/dev/null | wc -l)
        pass "Cache dir has $CACHED cached PDFs"
    else
        fail "cache" "cache directory not created"
    fi
else
    fail "second compile" "pdflatex failed on second run"
fi

echo ""
echo "══════════════════════════════════════════"
echo "  Results: $PASS passed, $FAIL failed"
echo "══════════════════════════════════════════"

[ "$FAIL" -eq 0 ] || exit 1
