### 2026-07-08: Animated connector dots stop before arrowheads
**By:** Brian
**What:** Particle, comet, and stream connector animations now use a renderer-local motion path trimmed 12px back from the final connector endpoint. The visible connector path and marker geometry remain unchanged; only each `<animateMotion path>` is shortened, with short final segments clamped to a non-inverted remaining segment: at least 1px where possible, or half the segment if it is shorter than 1px.
**Why:** Moving dots previously traveled to the connector endpoint, which is also the arrowhead marker tip, causing overlap in the animation gallery. Trimming the SMIL motion path by roughly the arrow marker length keeps dots clear of arrowheads without changing line routing or other animation modes.
