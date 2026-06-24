# Build the Triton specification PDF.
#
# The figures are DOGFOODED inline: every diagram is authored as Triton source
# inside a \begin{triton} block in the .tex and rendered to a vector PDF by
# Triton itself at compile time. That requires:
#   1. the @triton/latex CLI bundle (latex/dist/cli.cjs) to exist, and
#   2. LaTeX to run with shell-escape so the inline environment can shell out.
#
#   make cli   - build the @triton/latex CLI bundle the inline env shells out to
#   make pdf   - typeset triton.tex with tectonic (shell-escape enabled)
#   make       - cli, then pdf
#   make clean - remove LaTeX build artifacts and the inline render cache

REPO_ROOT := $(shell git -C . rev-parse --show-toplevel 2>/dev/null || echo ..)

.PHONY: all cli pdf clean

all: cli pdf

cli:
	cd $(REPO_ROOT) && pnpm -C latex build

pdf:
	tectonic -Z shell-escape -Z shell-escape-cwd=. triton.tex

clean:
	rm -f *.aux *.bbl *.blg *.out *.toc *.log *.xdv
	rm -rf *.triton-cache *.triton-src.triton
