#!/usr/bin/env bash
# test-e2e-latex.sh — clean-room Docker test of @cristianormazabal/triton-latex
#
# Tests the full end-user workflow:
#   1. npm i -g @cristianormazabal/triton-latex
#   2. triton-latex CLI works (render, render-dir)
#   3. triton.sty + inline authoring works with pdflatex -shell-escape
#   4. Precompiled workflow works
#
# Usage:  ./test/e2e-latex/test-e2e-latex.sh
# Requires: Docker

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IMAGE_NAME="triton-latex-e2e"

echo "═══════════════════════════════════════════════════"
echo "  Triton LaTeX — End-to-End Clean Room Test"
echo "═══════════════════════════════════════════════════"
echo ""

# Build the Docker image
echo "► Building Docker image (node + texlive)…"
docker build -t "$IMAGE_NAME" -f "$SCRIPT_DIR/Dockerfile" "$SCRIPT_DIR"

echo ""
echo "► Running end-to-end test inside container…"
docker run --rm "$IMAGE_NAME"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ All tests passed"
echo "═══════════════════════════════════════════════════"
