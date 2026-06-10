# .latexmkrc — Latexmk configuration for Timeline Compiler spec
# Produces PDF output and runs bibtex (natbib) for the bibliography.
# Primary engine is tectonic (see Makefile); latexmk is an alternative.

$pdf_mode = 1;        # Generate PDF
$bibtex_use = 2;      # Run bibtex when needed, delete .bbl on clean
