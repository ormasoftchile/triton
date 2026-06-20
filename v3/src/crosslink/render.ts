/**
 * Cross-Link Rendering
 *
 * Converts resolved cross-links into SceneElements (paths + labels)
 * that are layered on top of the poster's cell elements.
 *
 * Routes use the orthogonal router with port-direction hints from the
 * resolved link's fromSide/toSide.
 */

import type { SceneElement } from '../contracts/scene.js';
import type { ResolvedCrossLink, TraceRecord, CrossLinkEdgeStyle } from '../contracts/crosslink.js';
import type { CardinalSide, NodeAnchorRegistry } from '../contracts/anchors.js';
import type { PortDirection } from '../contracts/routing.js';
import type { Rect } from '../contracts/primitives.js';
import type { ResolvedTheme } from '../contracts/theme.js';
import { getRouter } from '../routing/registry.js';
import { defaultRouter } from '../routing/router.js';

// ─── Public API ───────────────────────────────────────────────────────────────

export interface CrossLinkRenderResult {
  /** SVG defs needed (e.g. arrowhead markers for cross-links). */
  readonly defs: string[];
  /** Scene elements: paths, labels, grouped per link. */
  readonly elements: SceneElement[];
}

const CROSSLINK_ARROW_ID = 'triton-crosslink-arrow';
const CROSSLINK_ARROW_BOTH_ID = 'triton-crosslink-arrow-both';

/**
 * Render resolved cross-links into scene elements.
 *
 * @param resolved — links with resolved port positions in poster space
 * @param traces  — trace records for colour assignment
 * @param theme   — for styling (colours, fonts, stroke widths)
 * @param anchors — full anchor registry for obstacle avoidance
 */
export function renderCrossLinks(
  resolved: readonly ResolvedCrossLink[],
  traces: readonly TraceRecord[],
  theme: ResolvedTheme,
  anchors?: NodeAnchorRegistry,
): CrossLinkRenderResult {
  const { palette, typography, edges: edgeTheme } = theme;
  const elements: SceneElement[] = [];
  const defs: string[] = [];
  let needsArrow = false;
  let needsBiArrow = false;

  // Extract obstacles from the anchor registry (all node bounds)
  const obstacles: Rect[] = [];
  if (anchors) {
    for (const anchor of Object.values(anchors)) {
      obstacles.push(anchor.bounds);
    }
  }

  // Build trace colour map
  const traceColors = new Map<string, string>();
  const categoricalPalette = [
    palette.primary, palette.success, palette.warning, palette.error,
    '#9333EA', '#0891B2', '#CA8A04', '#DC2626',
  ];
  for (let i = 0; i < traces.length; i++) {
    const t = traces[i]!;
    traceColors.set(t.id, t.color ?? categoricalPalette[i % categoricalPalette.length]!);
  }

  for (const rLink of resolved) {
    const { link, fromPort, toPort, fromSide, toSide } = rLink;

    // Colour: from trace, or default accent
    const color = link.traceId
      ? (traceColors.get(link.traceId) ?? palette.primary)
      : palette.primary;

    // Route
    const fromDir = sideToPortDir(fromSide);
    const toDir   = sideToPortDir(toSide);
    const router  = getRouter('orthogonal') ?? defaultRouter;
    const route   = router.route({
      from: fromPort,
      to: toPort,
      style: 'orthogonal',
      obstacles,
      padding: 12,
      fromDir,
      toDir,
    });

    // Stroke style
    const dash = edgeStyleToDash(link.style);

    // Marker ends
    let markerEnd: string | undefined;
    let markerStart: string | undefined;
    if (link.direction === 'directed') {
      markerEnd = CROSSLINK_ARROW_ID;
      needsArrow = true;
    } else if (link.direction === 'bidirectional') {
      markerEnd = CROSSLINK_ARROW_ID;
      markerStart = CROSSLINK_ARROW_BOTH_ID;
      needsArrow = true;
      needsBiArrow = true;
    }

    // Path element
    const pathEl: SceneElement = {
      type: 'path',
      d: route.path,
      stroke: color,
      strokeWidth: edgeTheme.strokeWidth + 0.5,
      ...(dash ? { strokeDasharray: dash } : {}),
      ...(markerEnd ? { markerEnd } : {}),
      ...(markerStart ? { markerStart } : {}),
    };
    elements.push(pathEl);

    // Label
    if (link.label) {
      elements.push({
        type: 'text',
        content: link.label,
        position: { x: route.labelPosition.x, y: route.labelPosition.y - 6 },
        fontSize: edgeTheme.labelFontSize,
        fontFamily: typography.fontFamily,
        fill: color,
        anchor: 'middle',
        fontWeight: 'bold',
      });
    }
  }

  // Build defs
  if (needsArrow) {
    const s = edgeTheme.arrowSize;
    defs.push(
      `<marker id="${CROSSLINK_ARROW_ID}" markerWidth="${s}" markerHeight="${s * 0.7}" refX="${s - 1}" refY="${s * 0.35}" orient="auto"><polygon points="0 0, ${s} ${s * 0.35}, 0 ${s * 0.7}" fill="currentColor" /></marker>`,
    );
  }
  if (needsBiArrow) {
    const s = edgeTheme.arrowSize;
    defs.push(
      `<marker id="${CROSSLINK_ARROW_BOTH_ID}" markerWidth="${s}" markerHeight="${s * 0.7}" refX="1" refY="${s * 0.35}" orient="auto"><polygon points="${s} 0, 0 ${s * 0.35}, ${s} ${s * 0.7}" fill="currentColor" /></marker>`,
    );
  }

  return { defs, elements };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sideToPortDir(side: CardinalSide): PortDirection {
  return side; // CardinalSide and PortDirection use same values
}

function edgeStyleToDash(style: CrossLinkEdgeStyle): string | undefined {
  switch (style) {
    case 'dashed': return '8 4';
    case 'dotted': return '4 3';
    default: return undefined;
  }
}
