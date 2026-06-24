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

# triton.sty lives in ../latex (the package source). We do NOT commit a symlink
# here: a git symlink degrades to a plain text file on checkouts without symlink
# support (e.g. Windows), which breaks \usepackage{triton}. We also can't rely on
# TEXINPUTS — tectonic does not honor it for .sty resolution. So we COPY the
# package in as a build step (gitignored) — a plain file copy is portable
# everywhere a symlink isn't.
pdf: triton.sty
	tectonic -Z shell-escape -Z shell-escape-cwd=. triton.tex

triton.sty: ../latex/triton.sty
	cp $< $@

clean:
	rm -f *.aux *.bbl *.blg *.out *.toc *.log *.xdv triton.sty
	rm -rf *.triton-cache *.triton-src.triton
