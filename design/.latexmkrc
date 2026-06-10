# .latexmkrc — Latexmk configuration for Timeline Compiler spec
# Produces PDF output using pdflatex and runs biber for bibliography

$pdf_mode = 1;        # Generate PDF via pdflatex
$bibtex_use = 2;      # Run biber when needed, delete .bbl on clean
