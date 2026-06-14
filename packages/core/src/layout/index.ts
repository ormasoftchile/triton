/**
 * @file layout/index.ts — Layout family dispatcher.
 *
 * `layout(ir, theme, family?)` is the single entry point for the rendering
 * pipeline.  It delegates to the appropriate layout family module:
 *
 *   'horizontal'     → layout/horizontal.ts  (six-phase, T2/T4/T6 — default)
 *   'vertical-spine' → layout/vertical-spine.ts  (central-spine, T1/T3/T5)
 *   'serpentine'     → layout/serpentine.ts  (boustrophedon winding path, T4)
 *
 * CRITICAL: The horizontal path is byte-identical to its prior behaviour.
 * The golden guard (examples/golden/our-timeline.*) must remain unchanged.
 */

import type { IRDocument } from '../types.js';
import type { Scene } from '../scene.js';
import type { ResolvedTheme } from '../themes/types.js';
import { layoutHorizontal }       from './horizontal.js';
import { layoutSerpentine }       from './serpentine.js';
import { layoutVerticalSpine }    from './vertical-spine.js';
import { layoutRoadmap }          from './roadmap.js';
import { layoutGantt }            from './gantt.js';
import { layoutTimelineColumns }  from './timeline-columns.js';

export { layoutHorizontal }       from './horizontal.js';
export { layoutSerpentine }       from './serpentine.js';
export { layoutVerticalSpine }    from './vertical-spine.js';
export { layoutRoadmap }          from './roadmap.js';
export { layoutGantt }            from './gantt.js';
export { layoutTimelineColumns }  from './timeline-columns.js';

/**
 * Dispatch to the correct layout family.
 *
 * @param ir       Validated IRDocument.
 * @param theme    Resolved theme.
 * @param family   Layout family identifier.  Defaults to 'horizontal'.
 * @param baseDir  Base directory for resolving relative asset paths in the IR
 *                 (e.g. `metadata.logo.src`).  Passed through to layout engines.
 */
export function layout(
  ir:      IRDocument,
  theme:   ResolvedTheme,
  family?: 'horizontal' | 'vertical-spine' | 'serpentine' | 'roadmap' | 'gantt' | 'timeline-columns',
  baseDir?: string,
): Scene {
  if (family === 'vertical-spine') {
    return layoutVerticalSpine(ir, theme, baseDir);
  }
  if (family === 'serpentine') {
    return layoutSerpentine(ir, theme, baseDir);
  }
  if (family === 'roadmap') {
    return layoutRoadmap(ir, theme, baseDir);
  }
  if (family === 'gantt') {
    return layoutGantt(ir, theme, baseDir);
  }
  if (family === 'timeline-columns') {
    return layoutTimelineColumns(ir, theme, baseDir);
  }
  return layoutHorizontal(ir, theme, baseDir);
}
