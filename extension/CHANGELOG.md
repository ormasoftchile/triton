# Changelog

All notable changes to the Triton VS Code extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2026-07-09

### Added

- First VS Code Marketplace release.
- Live preview for `.triton` and Mermaid files — deterministic SVG rendered by
  the Triton compiler.
- Markdown preview rendering of fenced ` ```triton ` (and, opt-in, ` ```mermaid `)
  code blocks.
- Diagnostics and completion support while editing Triton documents.
- Opt-in Mermaid handling via the `triton.enableMermaid` setting (off by default
  so Triton never conflicts with an already-installed Mermaid extension).
