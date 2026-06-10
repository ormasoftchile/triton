# Makefile for Timeline Compiler Technical Specification
#
# Primary engine: tectonic (self-contained; runs bibtex internally, no external
# biber needed). Falls back to latexmk if tectonic is unavailable.
# Bibliography uses natbib + bibtex (see main.tex).

.PHONY: all pdf clean watch

all: pdf

pdf:
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
