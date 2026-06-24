# Makefile — Triton LaTeX integration demo.
#
#   make figures   render diagrams/*.mmd → figures/*.pdf  (vector PDF)
#   make pdf       compile demo.tex → demo.pdf
#   make           figures + pdf
#   make clean     remove LaTeX aux files (keeps committed figures)
#
# `figures` runs the @triton/latex CLI from the parent package. Build it once
# with `node ../esbuild.mjs` (or `pnpm --dir .. build`) before the first render.

CLI      := node ../dist/cli.cjs
DIAGRAMS := diagrams
FIGURES  := figures

# Prefer tectonic (self-contained); fall back to pdflatex if unavailable.
LATEX := $(shell command -v tectonic >/dev/null 2>&1 && echo "tectonic" || echo "pdflatex")

.PHONY: all figures pdf clean

all: figures pdf

figures:
	$(CLI) render-dir $(DIAGRAMS) -o $(FIGURES)

pdf: figures
ifeq ($(LATEX),tectonic)
	tectonic demo.tex
else
	pdflatex -interaction=nonstopmode demo.tex
endif

clean:
	rm -f demo.aux demo.log demo.out demo.toc
