### 2026-07-08: Red/black tree node colours are semantic but palette-aware
**By:** Brian
**What:** Red-black tree nodes keep recognizable red/black semantics, but tree layout now derives dark-theme detection from palette background/surface luminance, tunes black fills away from dark canvases, and chooses strokes/text by contrast against the resolved theme palette.
**Why:** The old fixed black fill blended into dark canvases. Theme-aware fills and palette-derived outlines preserve red-black meaning while making rb tree nodes and shared tree decorations readable in both light and dark renders.
