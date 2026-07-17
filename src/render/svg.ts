import type { Scene, SceneElement, SceneIcon, Renderer, NodeAnchorRegistry } from '../contracts/index.js';
import type { IconTransforms } from '../contracts/icons.js';
import {
  animationDuration,
  colorCycleStrokeValues,
  drawDashoffsetValues,
  flowStopOffsetValues,
  formatNum,
  glowStrokeOpacityValues,
  marchDashoffsetValues,
  motionBeginSeconds,
  motionParticleSpecs,
  pathLengthApprox,
  pathPoints,
  pulseStrokeWidthValues,
} from '../animation/index.js';

/**
 * Render a fully-resolved Scene to an SVG string.
 *
 * Contract: the caller must have already incorporated all overlay geometry
 * into Scene.elements before calling this. The renderer is diagram-agnostic.
 */
export function renderSVG(scene: Scene): string {
  const { viewBox, background, elements, defs } = scene;
  const vb = `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;
  const markerMetrics = markerMetricsById(defs ?? []);

  const lines: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${viewBox.width}" height="${viewBox.height}">`,
  ];

  if (defs && defs.length > 0) {
    lines.push('  <defs>');
    for (const def of defs) lines.push(`    ${def}`);
    lines.push('  </defs>');
  }

  if (background) {
    // Use explicit x/width to cover the full viewBox, including negative x origins.
    lines.push(`  <rect x="${viewBox.x}" y="${viewBox.y}" width="${viewBox.width}" height="${viewBox.height}" fill="${background}" />`);
  }

  for (const el of elements) {
    lines.push(renderElement(el, 1, markerMetrics));
  }

  lines.push('</svg>');
  return lines.join('\n');
}

// ─── Element Rendering ────────────────────────────────────────────────────────

function renderElement(el: SceneElement, depth: number, markerMetrics: Map<string, MarkerMetrics>): string {
  const pad = '  '.repeat(depth);

  switch (el.type) {
    case 'rect': {
      const rx          = el.rx          != null ? ` rx="${el.rx}"` : '';
      const fillOpacity = el.fillOpacity != null ? ` fill-opacity="${el.fillOpacity}"` : '';
      const opacity     = el.opacity     != null ? ` opacity="${el.opacity}"` : '';
      return `${pad}<rect x="${el.bounds.x}" y="${el.bounds.y}" width="${el.bounds.width}" height="${el.bounds.height}" fill="${fillVal(el.fill)}"${fillOpacity} stroke="${el.stroke}" stroke-width="${el.strokeWidth}"${rx}${opacity} />`;
    }

    case 'circle': {
      const opacity = el.opacity != null ? ` opacity="${el.opacity}"` : '';
      return `${pad}<circle cx="${el.center.x}" cy="${el.center.y}" r="${el.radius}" fill="${fillVal(el.fill)}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"${opacity} />`;
    }

    case 'text': {
      const anchor  = el.anchor    != null ? ` text-anchor="${el.anchor}"` : '';
      const weight  = el.fontWeight != null ? ` font-weight="${el.fontWeight}"` : '';
      const opacity = el.opacity   != null ? ` opacity="${el.opacity}"` : '';
      return `${pad}<text x="${el.position.x}" y="${el.position.y}" font-size="${el.fontSize}" font-family="${escapeAttr(el.fontFamily)}" fill="${fillVal(el.fill)}"${anchor}${weight}${opacity}>${escapeXml(el.content)}</text>`;
    }

    case 'path': {
      const drawLength = el.animated === 'draw' ? pathLengthApprox(el.d) : undefined;
      const dashValue  = drawLength != null ? `${drawLength} ${drawLength}` : el.strokeDasharray;
      const dash       = dashValue          != null ? ` stroke-dasharray="${escapeAttr(dashValue)}"` : '';
      const mEnd       = el.markerEnd       != null ? ` marker-end="url(#${escapeAttr(el.markerEnd)})"` : '';
      const mStart     = el.markerStart     != null ? ` marker-start="url(#${escapeAttr(el.markerStart)})"` : '';
      const fill       = ` fill="${fillVal(el.fill)}"`;
      const opacity    = el.opacity         != null ? ` opacity="${el.opacity}"` : '';
      const stroke     = el.animated === 'flow' ? `url(#${flowGradientId(el.d, el.stroke)})` : el.stroke;
      const attrs      = `${pad}<path d="${escapeAttr(el.d)}" stroke="${escapeAttr(stroke)}" stroke-width="${el.strokeWidth}"${fill}${dash}${mEnd}${mStart}${opacity}`;
      if (el.animated === 'march' && el.strokeDasharray) {
        const values  = marchDashoffsetValues(el.strokeDasharray);
        const animate = `<animate attributeName="stroke-dashoffset" from="${values.from}" to="${values.to}" dur="${animationDuration('march')}" repeatCount="indefinite"/>`;
        return `${attrs}>\n${pad}  ${animate}\n${pad}</path>`;
      }
      if (el.animated === 'draw') {
        const values = drawDashoffsetValues(drawLength ?? pathLengthApprox(el.d));
        const animate = `<animate attributeName="stroke-dashoffset" values="${values.join(';')}" dur="${animationDuration('draw')}" repeatCount="indefinite"/>`;
        return `${attrs}>\n${pad}  ${animate}\n${pad}</path>`;
      }
      if (el.animated === 'pulse') {
        const values = pulseStrokeWidthValues(el.strokeWidth).map(formatNum);
        const animate = `<animate attributeName="stroke-width" values="${values.join(';')}" dur="${animationDuration('pulse')}" repeatCount="indefinite"/>`;
        return `${attrs}>\n${pad}  ${animate}\n${pad}</path>`;
      }
      if (el.animated === 'glow') {
        const animate = `<animate attributeName="stroke-opacity" values="${glowStrokeOpacityValues().join(';')}" dur="${animationDuration('glow')}" repeatCount="indefinite"/>`;
        return `${attrs}>\n${pad}  ${animate}\n${pad}</path>`;
      }
      if (el.animated === 'colorcycle') {
        const animate = `<animate attributeName="stroke" values="${colorCycleStrokeValues().join(';')}" dur="${animationDuration('colorcycle')}" repeatCount="indefinite"/>`;
        return `${attrs}>\n${pad}  ${animate}\n${pad}</path>`;
      }
      if (el.animated === 'flow') {
        const gradient = renderFlowGradient(el, pad);
        return `${gradient}\n${attrs} />`;
      }
      if (el.animated === 'particle') {
        const spec = motionParticleSpecs('particle')[0]!;
        const motionPath = trimMotionPathForArrowhead(el.d, motionArrowheadClearance(el, spec.radius, markerMetrics));
        const circle = renderMotionCircle(motionPath, el.stroke, spec, 'particle', pad);
        return `${attrs} />\n${circle}`;
      }
      if (el.animated === 'comet') {
        const specs = motionParticleSpecs('comet');
        const motionPath = trimMotionPathForArrowhead(el.d, motionArrowheadClearance(el, specs[0]!.radius, markerMetrics));
        const circles = specs.map(spec => renderMotionCircle(motionPath, el.stroke, spec, 'comet', pad)).join('\n');
        return `${attrs} />\n${circles}`;
      }
      if (el.animated === 'stream') {
        const specs = motionParticleSpecs('stream');
        const motionPath = trimMotionPathForArrowhead(el.d, motionArrowheadClearance(el, specs[0]!.radius, markerMetrics));
        const circles = specs.map(spec => renderMotionCircle(motionPath, el.stroke, spec, 'stream', pad)).join('\n');
        return `${attrs} />\n${circles}`;
      }
      return `${attrs} />`;
    }

    case 'icon': {
      return renderIcon(el, depth);
    }

    case 'group': {
      const id        = el.id        != null ? ` id="${escapeAttr(el.id)}"` : '';
      const transform = el.transform != null ? ` transform="${escapeAttr(el.transform)}"` : '';
      const opacity   = el.opacity   != null ? ` opacity="${el.opacity}"` : '';
      if (el.children.length === 0) {
        return `${pad}<g${id}${transform}${opacity} />`;
      }
      const inner = el.children.map(c => renderElement(c, depth + 1, markerMetrics)).join('\n');
      return `${pad}<g${id}${transform}${opacity}>\n${inner}\n${pad}</g>`;
    }
  }
}

// ─── Icon Rendering ───────────────────────────────────────────────────────────

/**
 * Module-level counter for namespacing brand icon gradient/clip IDs.
 * Incremented once per brand icon emitted; never reset (monotonic within a
 * process lifetime). Produces unique prefixes like "icn0-", "icn1-", etc.
 */
let iconEmitCounter = 0;

/** Render a SceneIcon as a nested <svg> element. */
function renderIcon(el: SceneIcon, depth: number): string {
  const pad = '  '.repeat(depth);
  const { icon, x, y, size } = el;
  const { viewBox, transforms, colorMode } = icon;

  const vbW = viewBox.width;
  const vbH = viewBox.height;
  const vbL = viewBox.left;
  const vbT = viewBox.top;

  // Scale to fit size×size box preserving aspect ratio; center inside box.
  const scale   = Math.min(size / vbW, size / vbH);
  const scaledW = formatNum(vbW * scale);
  const scaledH = formatNum(vbH * scale);
  const offX    = formatNum(x + (size - vbW * scale) / 2);
  const offY    = formatNum(y + (size - vbH * scale) / 2);

  // Monochrome tint via CSS color inheritance.
  const styleAttr  = colorMode === 'monochrome' && el.color
    ? ` style="color:${escapeAttr(el.color)}"`
    : '';
  const opacityAttr = el.opacity != null ? ` opacity="${el.opacity}"` : '';

  // Build body — namespace brand IDs or use verbatim.
  const body = colorMode === 'brand'
    ? namespaceIconIds(icon.body, `icn${iconEmitCounter++}`)
    : icon.body;

  // Transform (rotate/flip) applied inside the icon's viewBox coordinate space.
  const cx = vbL + vbW / 2;
  const cy = vbT + vbH / 2;
  const innerTransform = buildIconTransform(transforms, cx, cy);

  const vbAttr = `${vbL} ${vbT} ${formatNum(vbW)} ${formatNum(vbH)}`;
  const inner  = innerTransform
    ? `${pad}  <g transform="${innerTransform}">${body}</g>`
    : `${pad}  ${body}`;

  return [
    `${pad}<svg x="${offX}" y="${offY}" width="${scaledW}" height="${scaledH}" viewBox="${vbAttr}"${styleAttr}${opacityAttr}>`,
    inner,
    `${pad}</svg>`,
  ].join('\n');
}

/**
 * Build an SVG transform string that applies rotate then flip around (cx, cy).
 * Returns null when no transform is needed (identity).
 *
 * Transform order (icon spec): rotate first, then flips.
 * SVG applies transforms right-to-left, so the string is:
 *   translate(cx cy) scale(sf vf) rotate(deg) translate(-cx -cy)
 * which maps to: move center to origin → rotate → flip → move back.
 */
function buildIconTransform(t: IconTransforms, cx: number, cy: number): string | null {
  if (t.rotate === 0 && !t.hFlip && !t.vFlip) return null;

  const deg = t.rotate * 90;
  const sf  = t.hFlip ? -1 : 1;
  const vf  = t.vFlip ? -1 : 1;
  const cxs = formatNum(cx);
  const cys = formatNum(cy);

  const parts: string[] = [];
  parts.push(`translate(${cxs} ${cys})`);
  if (t.hFlip || t.vFlip) parts.push(`scale(${sf} ${vf})`);
  if (t.rotate !== 0)     parts.push(`rotate(${deg})`);
  parts.push(`translate(${formatNum(-cx)} ${formatNum(-cy)})`);

  return parts.join(' ');
}

/**
 * Namespace all id="..." values in a brand icon body and rewrite matching
 * url(#id) and href="#id" references. Prevents ID collisions when multiple
 * brand icons with gradients or clip-paths appear in the same SVG document.
 *
 * Strategy: collect all id= values, then globally replace them and their refs.
 * Uses a per-emit prefix (e.g. "icn3") generated from the module counter.
 */
function namespaceIconIds(body: string, prefix: string): string {
  const idRe  = /\bid="([^"]+)"/g;
  const ids   = new Set<string>();
  let m: RegExpExecArray | null;

  while ((m = idRe.exec(body)) !== null) {
    ids.add(m[1]!);
  }
  if (ids.size === 0) return body;

  let result = body;
  for (const id of ids) {
    const newId = `${prefix}-${id}`;
    // id declarations
    result = result.split(`id="${id}"`).join(`id="${newId}"`);
    // url(#id) fill/stroke refs
    result = result.split(`url(#${id})`).join(`url(#${newId})`);
    // href="#id" (xlink or plain)
    result = result.split(`href="#${id}"`).join(`href="#${newId}"`);
    result = result.split(`href='#${id}'`).join(`href='#${newId}'`);
  }
  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderMotionCircle(
  path: string,
  fill: string,
  spec: { readonly radius: number; readonly opacity?: number; readonly phase: number },
  animation: 'particle' | 'comet' | 'stream',
  pad: string,
): string {
  const opacityAttr = spec.opacity != null ? ` opacity="${spec.opacity}"` : '';
  const beginSeconds = motionBeginSeconds(animation, spec.phase);
  const begin = beginSeconds === 0 ? '0s' : `${formatNum(beginSeconds)}s`;
  return `${pad}<circle r="${spec.radius}" fill="${escapeAttr(fill)}"${opacityAttr}>\n${pad}  <animateMotion dur="${animationDuration(animation)}" begin="${begin}" repeatCount="indefinite" rotate="auto" path="${escapeAttr(path)}"/>\n${pad}</circle>`;
}

interface MarkerMetrics {
  readonly refX: number;
  readonly markerUnits: 'strokeWidth' | 'userSpaceOnUse';
}

const DEFAULT_MARKER_REF_X = 7;
const MIN_MOTION_SEGMENT_LENGTH = 1;

function trimMotionPathForArrowhead(path: string, clearance: number): string {
  if (clearance <= 0) return path;
  const pts = pathPoints(path);
  if (pts.length < 2) return path;

  const end = pts[pts.length - 1]!;
  for (let i = pts.length - 2; i >= 0; i--) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const distA = Math.hypot(end.x - a.x, end.y - a.y);
    const distB = Math.hypot(end.x - b.x, end.y - b.y);
    if (distA >= clearance && distB <= clearance) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const fx = a.x - end.x;
      const fy = a.y - end.y;
      const qa = dx * dx + dy * dy;
      const qb = 2 * (fx * dx + fy * dy);
      const qc = fx * fx + fy * fy - clearance * clearance;
      const discriminant = qb * qb - 4 * qa * qc;
      if (qa > 0 && discriminant >= 0) {
        const roots = [
          (-qb - Math.sqrt(discriminant)) / (2 * qa),
          (-qb + Math.sqrt(discriminant)) / (2 * qa),
        ].filter(t => t >= 0 && t <= 1);
        const t = roots.sort((left, right) => right - left)[0];
        if (t != null) {
          return [...pts.slice(0, i + 1), { x: a.x + dx * t, y: a.y + dy * t }]
            .map((pt, j) => `${j === 0 ? 'M' : 'L'} ${formatNum(pt.x)} ${formatNum(pt.y)}`)
            .join(' ');
        }
      }
    }
  }

  let totalLength = 0;
  const segmentLengths: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const segmentLength = Math.hypot(b.x - a.x, b.y - a.y);
    segmentLengths.push(segmentLength);
    totalLength += segmentLength;
  }
  if (totalLength === 0) return path;

  const targetLength = totalLength > MIN_MOTION_SEGMENT_LENGTH
    ? Math.max(MIN_MOTION_SEGMENT_LENGTH, totalLength - clearance)
    : totalLength / 2;
  let walked = 0;
  const motionPts = [pts[0]!];
  for (let i = 1; i < pts.length; i++) {
    const segmentLength = segmentLengths[i - 1]!;
    if (segmentLength === 0) continue;
    const a = pts[i - 1]!;
    const b = pts[i]!;
    if (walked + segmentLength >= targetLength) {
      const t = (targetLength - walked) / segmentLength;
      motionPts.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      });
      break;
    }
    motionPts.push(b);
    walked += segmentLength;
  }
  return motionPts
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${formatNum(pt.x)} ${formatNum(pt.y)}`)
    .join(' ');
}

function motionArrowheadClearance(
  el: Extract<SceneElement, { type: 'path' }>,
  dotRadius: number,
  markerMetrics: Map<string, MarkerMetrics>,
): number {
  if (el.markerEnd == null) return 0;
  const marker = markerMetrics.get(el.markerEnd) ?? { refX: DEFAULT_MARKER_REF_X, markerUnits: 'strokeWidth' as const };
  const markerBackOffset = marker.markerUnits === 'strokeWidth'
    ? marker.refX * el.strokeWidth
    : marker.refX;
  return markerBackOffset + dotRadius;
}

function markerMetricsById(defs: readonly string[]): Map<string, MarkerMetrics> {
  const markers = new Map<string, MarkerMetrics>();
  for (const def of defs) {
    for (const match of def.matchAll(/<marker\b[^>]*>/g)) {
      const marker = match[0];
      const id = attrValue(marker, 'id');
      const refX = attrNumber(marker, 'refX');
      if (id == null || refX == null) continue;
      const markerUnits = attrValue(marker, 'markerUnits') === 'userSpaceOnUse' ? 'userSpaceOnUse' : 'strokeWidth';
      markers.set(id, { refX, markerUnits });
    }
  }
  return markers;
}

function attrValue(text: string, name: string): string | undefined {
  return text.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]+)"`))?.[1]
    ?? text.match(new RegExp(`\\b${name}\\s*=\\s*'([^']+)'`))?.[1];
}

function attrNumber(text: string, name: string): number | undefined {
  const value = attrValue(text, name);
  if (value == null) return undefined;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
}

function renderFlowGradient(el: Extract<SceneElement, { type: 'path' }>, pad: string): string {
  const id = flowGradientId(el.d, el.stroke);
  const { start, end } = pathEndpoints(el.d);
  const base = escapeAttr(el.stroke);
  return [
    `${pad}<defs>`,
    `${pad}  <linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}">`,
    `${pad}    <stop offset="0%" stop-color="${base}" stop-opacity="0.75"/>`,
    `${pad}    <stop offset="20%" stop-color="${base}" stop-opacity="0.85">`,
    `${pad}      <animate attributeName="offset" values="${flowStopOffsetValues(0).map(v => `${v}%`).join(';')}" dur="${animationDuration('flow')}" repeatCount="indefinite"/>`,
    `${pad}    </stop>`,
    `${pad}    <stop offset="35%" stop-color="#FFFFFF" stop-opacity="1">`,
    `${pad}      <animate attributeName="offset" values="${flowStopOffsetValues(1).map(v => `${v}%`).join(';')}" dur="${animationDuration('flow')}" repeatCount="indefinite"/>`,
    `${pad}    </stop>`,
    `${pad}    <stop offset="50%" stop-color="${base}" stop-opacity="0.85">`,
    `${pad}      <animate attributeName="offset" values="${flowStopOffsetValues(2).map(v => `${v}%`).join(';')}" dur="${animationDuration('flow')}" repeatCount="indefinite"/>`,
    `${pad}    </stop>`,
    `${pad}    <stop offset="100%" stop-color="${base}" stop-opacity="0.75"/>`,
    `${pad}  </linearGradient>`,
    `${pad}</defs>`,
  ].join('\n');
}

function flowGradientId(path: string, stroke: string): string {
  return `triton-flow-${hashString(`${path}|${stroke}`)}`;
}

function pathEndpoints(path: string): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const pts = pathPoints(path);
  const start = pts[0] ?? { x: 0, y: 0 };
  const end = pts[pts.length - 1] ?? { x: 1, y: 0 };
  if (start.x === end.x && start.y === end.y) {
    return { start, end: { x: end.x + 1, y: end.y } };
  }
  return { start, end };
}

function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function fillVal(fill: string | null | undefined): string {
  return fill != null && fill.trim() !== '' ? fill : 'none';
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── Anchor manifest embed ────────────────────────────────────────────────────

/**
 * Embed a JSON anchor manifest into an SVG string as an inert data script tag,
 * immediately before the closing `</svg>`.
 *
 * The JSON object has keys sorted deterministically so the output is stable
 * across invocations. Any `</` sequences inside the JSON are escaped as `<\/`
 * so they cannot accidentally terminate the script element.
 */
export function embedAnchorManifest(svg: string, anchors: NodeAnchorRegistry): string {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(anchors).sort()) {
    sorted[key] = anchors[key];
  }
  const json = JSON.stringify(sorted).replace(/<\//g, '<\\/');
  const block = `<script type="application/json" id="triton-anchors">${json}</script>`;
  return svg.replace('</svg>', `${block}\n</svg>`);
}

// ─── Renderer object ──────────────────────────────────────────────────────────

/** The built-in SVG renderer. Registered by default in frontend/index.ts. */
export const svgRenderer: Renderer<string> = {
  name: 'svg',
  render: renderSVG,
};
