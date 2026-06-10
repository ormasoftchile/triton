# Makefile for Timeline Compiler Technical Specification
# Requires: latexmk, pdflatex, biber (standard TeX Live install)

.PHONY: all pdf clean watch

all: pdf

pdf:
	latexmk -pdf main.tex

clean:
	latexmk -C

watch:
	latexmk -pdf -pvc main.tex
