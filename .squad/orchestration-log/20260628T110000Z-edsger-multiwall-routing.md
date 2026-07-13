# Edsger — Multi-Wall Routing Spec

**Date:** 2026-06-28T11:00:00Z  
**Agent:** Edsger (Layout Algorithms)  
**Status:** COMPLETE  
**Deliverable:** `.squad/decisions/edsger-multiwall-routing.md`

## Output

Comprehensive specification for multi-candidate skip-edge routing optimizer targeting TB layouts. Defines LayeredResult extensions (dummySweepXs, dummyChainIds), RoutedSegment interface, candidate generation logic, and unified scoring function with box-intersection and overlap penalties. Includes degenerate-case handlers, complexity analysis, and implementation roadmap.

**Key sections:**
- §3: Data structure changes (dummySweepXs, dummyChainIds)
- §5: Skip-edge optimizer loop with geometry helpers
- §8: Complexity bounds and practical performance analysis
- §10: File change summary with line numbers

**Status:** Spec ready for implementation (target: Brian).
