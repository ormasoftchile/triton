# Makefile for Timeline Compiler Technical Specification
#
# Primary engine: tectonic (self-contained; runs bibtex internally, no external
# biber needed). Falls back to latexmk if tectonic is unavailable.
# Bibliography uses natbib + bibtex (see main.tex).

REPO_ROOT := $(shell git -C . rev-parse --show-toplevel 2>/dev/null || echo ../..)
CORE_BUILD := $(REPO_ROOT)/packages/core/dist/index.js
CLI_BIN    := $(REPO_ROOT)/packages/cli/dist/index.js
TIMELINE   := node $(CLI_BIN)
SCALE      := 3

FIGURE_SRCS := $(wildcard figures/src/*.mmd)
FIGURE_PNGS := $(patsubst figures/src/%.mmd,figures/%.png,$(FIGURE_SRCS))

.PHONY: all pdf figures clean watch

all: figures pdf

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
		tectonic --keep-logs main.tex; \
	elif command -v latexmk >/dev/null 2>&1; then \
		echo "Building with latexmk..."; \
		latexmk -pdf main.tex; \
	else \
		echo "error: no LaTeX engine found (need tectonic or latexmk)"; exit 1; \
	fi

clean:
	@latexmk -C 2>/dev/null || true
	@rm -f *.aux *.bbl *.blg *.out *.toc *.log
	@rm -rf build

watch:
	latexmk -pdf -pvc main.tex
