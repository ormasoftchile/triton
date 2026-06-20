# Makefile for Timeline Compiler Technical Specification
#
# Primary engine: tectonic (self-contained; runs bibtex internally, no external
# biber needed). Falls back to latexmk if tectonic is unavailable.
# Bibliography uses natbib + bibtex (see triton.tex).

REPO_ROOT := $(shell git -C . rev-parse --show-toplevel 2>/dev/null || echo ../..)
CORE_BUILD := $(REPO_ROOT)/packages/core/dist/index.js
CLI_BIN    := $(REPO_ROOT)/packages/cli/dist/index.js
TIMELINE   := node $(CLI_BIN)
SCALE      := 3

FIGURE_SRCS := $(wildcard figures/src/*.mmd)
FIGURE_PNGS := $(patsubst figures/src/%.mmd,figures/%.png,$(FIGURE_SRCS))

.PHONY: all pdf figures clean watch setup

all: figures pdf

# One-time setup: install all prerequisites for building the design doc.
# Works on macOS, Linux, and Windows (Git Bash / WSL).
setup:
	@echo "Checking prerequisites…"
	@command -v node >/dev/null 2>&1 || { echo "error: node not found — install from https://nodejs.org"; exit 1; }
	@command -v corepack >/dev/null 2>&1 || { echo "error: corepack not found (ships with Node >= 16)"; exit 1; }
	@corepack enable pnpm
	@command -v tectonic >/dev/null 2>&1 || { \
		echo "tectonic not found. Install it for your platform:"; \
		echo "  macOS:   brew install tectonic"; \
		echo "  Windows: winget install ArtifexSoftware.Tectonic"; \
		echo "  Linux:   see https://tectonic-typesetting.github.io/en-US/install.html"; \
		exit 1; \
	}
	@echo "Installing workspace dependencies…"
	@cd $(REPO_ROOT) && pnpm install
	@echo "Building compiler packages…"
	@cd $(REPO_ROOT) && pnpm -r build
	@echo "✓ Ready — run 'make' to build the PDF."

figures: $(FIGURE_PNGS)

# Build core + cli if the dist doesn't exist yet.
$(CLI_BIN):
	@echo "Building compiler packages…"
	cd $(REPO_ROOT) && pnpm -C packages/core build && pnpm -C packages/cli build

figures/%.png: figures/src/%.mmd $(CLI_BIN)
	@echo "  Rendering $< → $@"
	$(TIMELINE) render $< --format png --scale $(SCALE) -o $@

pdf: $(FIGURE_PNGS)
	@if command -v tectonic >/dev/null 2>&1; then \
		echo "Building with tectonic..."; \
		tectonic --keep-logs triton.tex; \
	elif command -v latexmk >/dev/null 2>&1; then \
		echo "Building with latexmk..."; \
		latexmk -pdf triton.tex; \
	else \
		echo "error: no LaTeX engine found (need tectonic or latexmk)"; exit 1; \
	fi

clean:
	@latexmk -C 2>/dev/null || true
	@rm -f *.aux *.bbl *.blg *.out *.toc *.log
	@rm -rf build

watch:
	latexmk -pdf -pvc triton.tex
