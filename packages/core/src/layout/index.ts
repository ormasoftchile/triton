/**
 * @file layout/index.ts — Layout family dispatcher.
 *
 * `layout(ir, theme, family?)` is the single entry point for the rendering
 * pipeline.  It delegates to the appropriate layout family module:
 *
 *   'horizontal'     → layout/horizontal.ts  (six-phase, T2/T4/T6 — default)
 *   'vertical-spine' → layout/vertical-spine.ts  (central-spine, T1/T3/T5)
 *
 * CRITICAL: The horizontal path is byte-identical to its prior behaviour.
 * The golden guard (examples/golden/our-timeline.*) must remain unchanged.
 */

import type { IRDocument } from '../types.js';
import type { Scene } from '../scene.js';
import type { ResolvedTheme } from '../themes/types.js';
import { layoutHorizontal }    from './horizontal.js';
import { layoutVerticalSpine } from './vertical-spine.js';

export { layoutHorizontal }    from './horizontal.js';
export { layoutVerticalSpine } from './vertical-spine.js';

/**
 * Dispatch to the correct layout family.
 *
 * @param ir       Validated IRDocument.
 * @param theme    Resolved theme.
 * @param family   Layout family identifier.  Defaults to 'horizontal'.
 */
export function layout(
  ir:      IRDocument,
  theme:   ResolvedTheme,
  family?: 'horizontal' | 'vertical-spine',
): Scene {
  if (family === 'vertical-spine') {
    return layoutVerticalSpine(ir, theme);
  }
  return layoutHorizontal(ir, theme);
}
