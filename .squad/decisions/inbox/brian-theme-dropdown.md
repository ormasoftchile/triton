### 2026-07-08: Preview theme dropdown override precedence
**By:** Brian
**What:** The VS Code preview webview now stores `triton.previewTheme` in workspace state, treats an empty selection as Auto, and passes named selections as a forced base preset through `render()`/`renderSync()`.
**Why:** Auto must preserve editor/diagram-driven behavior, while explicit user selections need to override diagram `theme:` metadata and still blend with the editor by clearing only the SVG background.
