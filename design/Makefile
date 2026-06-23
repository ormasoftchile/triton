# Build the Triton specification PDF.
#
#   make figures  - render the dogfooded figures with the compiler (pnpm figures)
#   make pdf      - typeset triton.tex with tectonic
#   make          - figures, then pdf
#   make clean    - remove LaTeX build artifacts

REPO_ROOT := $(shell git -C . rev-parse --show-toplevel 2>/dev/null || echo ..)

.PHONY: all figures pdf clean

all: figures pdf

figures:
	cd $(REPO_ROOT) && pnpm figures

pdf:
	tectonic triton.tex

clean:
	rm -f *.aux *.bbl *.blg *.out *.toc *.log
