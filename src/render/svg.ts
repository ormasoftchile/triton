import type { Scene, SceneElement, Renderer } from '../contracts/index.js';

/**
 * Render a fully-resolved Scene to an SVG string.
 *
 * Contract: the caller must have already incorporated all overlay geometry
 * into Scene.elements before calling this. The renderer is diagram-agnostic.
 */
export function renderSVG(scene: Scene): string {
  const { viewBox, background, elements, defs } = scene;
  const vb = `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;

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
    lines.push(renderElement(el, 1));
  }

  lines.push('</svg>');
  return lines.join('\n');
}

// ─── Element Rendering ────────────────────────────────────────────────────────

function renderElement(el: SceneElement, depth: number): string {
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
        const period  = parseDasharrayPeriod(el.strokeDasharray);
        const animate = `<animate attributeName="stroke-dashoffset" from="0" to="-${period}" dur="0.8s" repeatCount="indefinite"/>`;
        return `${attrs}>\n${pad}  ${animate}\n${pad}</path>`;
      }
      if (el.animated === 'draw') {
        const animate = `<animate attributeName="stroke-dashoffset" values="0;${drawLength};0" dur="2s" repeatCount="indefinite"/>`;
        return `${attrs}>\n${pad}  ${animate}\n${pad}</path>`;
      }
      if (el.animated === 'pulse') {
        const wide = formatNum(el.strokeWidth * 2);
        const animate = `<animate attributeName="stroke-width" values="${el.strokeWidth};${wide};${el.strokeWidth}" dur="1.4s" repeatCount="indefinite"/>`;
        return `${attrs}>\n${pad}  ${animate}\n${pad}</path>`;
      }
      if (el.animated === 'glow') {
        const animate = '<animate attributeName="stroke-opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite"/>';
        return `${attrs}>\n${pad}  ${animate}\n${pad}</path>`;
      }
      if (el.animated === 'colorcycle') {
        const animate = '<animate attributeName="stroke" values="#4A90D9;#9b51e0;#e54444;#2ecc71;#4A90D9" dur="3s" repeatCount="indefinite"/>';
        return `${attrs}>\n${pad}  ${animate}\n${pad}</path>`;
      }
      if (el.animated === 'flow') {
        const gradient = renderFlowGradient(el, pad);
        return `${gradient}\n${attrs} />`;
      }
      if (el.animated === 'particle') {
        const motionPath = trimMotionPathForArrowhead(el.d);
        const circle = renderMotionCircle(motionPath, el.stroke, 4, undefined, '1.5s', '0s', pad);
        return `${attrs} />\n${circle}`;
      }
      if (el.animated === 'comet') {
        const motionPath = trimMotionPathForArrowhead(el.d);
        const circles = [
          renderMotionCircle(motionPath, el.stroke, 4.2, 0.95, '1.8s', '0s', pad),
          renderMotionCircle(motionPath, el.stroke, 3.1, 0.45, '1.8s', '-0.18s', pad),
          renderMotionCircle(motionPath, el.stroke, 2.2, 0.22, '1.8s', '-0.36s', pad),
        ].join('\n');
        return `${attrs} />\n${circles}`;
      }
      if (el.animated === 'stream') {
        const motionPath = trimMotionPathForArrowhead(el.d);
        const circles = [0, 1, 2, 3]
          .map(i => renderMotionCircle(motionPath, el.stroke, 3.2, 0.9, '2s', i === 0 ? '0s' : `-${formatNum(i * 0.5)}s`, pad))
          .join('\n');
        return `${attrs} />\n${circles}`;
      }
      return `${attrs} />`;
    }

    case 'group': {
      const id        = el.id        != null ? ` id="${escapeAttr(el.id)}"` : '';
      const transform = el.transform != null ? ` transform="${escapeAttr(el.transform)}"` : '';
      const opacity   = el.opacity   != null ? ` opacity="${el.opacity}"` : '';
      if (el.children.length === 0) {
        return `${pad}<g${id}${transform}${opacity} />`;
      }
      const inner = el.children.map(c => renderElement(c, depth + 1)).join('\n');
      return `${pad}<g${id}${transform}${opacity}>\n${inner}\n${pad}</g>`;
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Sum all values in a stroke-dasharray string — one full animation period. */
function parseDasharrayPeriod(dasharray: string): number {
  return dasharray
    .trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter(n => !isNaN(n) && n > 0)
    .reduce((sum, n) => sum + n, 0);
}

function renderMotionCircle(
  path: string,
  fill: string,
  radius: number,
  opacity: number | undefined,
  dur: string,
  begin: string,
  pad: string,
): string {
  const opacityAttr = opacity != null ? ` opacity="${opacity}"` : '';
  return `${pad}<circle r="${radius}" fill="${escapeAttr(fill)}"${opacityAttr}>\n${pad}  <animateMotion dur="${dur}" begin="${begin}" repeatCount="indefinite" rotate="auto" path="${escapeAttr(path)}"/>\n${pad}</circle>`;
}

const MOTION_ARROWHEAD_CLEARANCE = 12;
const MIN_MOTION_SEGMENT_LENGTH = 1;

function trimMotionPathForArrowhead(path: string): string {
  const pts = pathPoints(path);
  if (pts.length < 2) return path;

  const end = pts[pts.length - 1]!;
  const prev = pts[pts.length - 2]!;
  const dx = end.x - prev.x;
  const dy = end.y - prev.y;
  const segmentLength = Math.hypot(dx, dy);
  if (segmentLength === 0) return path;

  const remainingLength = segmentLength > MIN_MOTION_SEGMENT_LENGTH
    ? Math.max(MIN_MOTION_SEGMENT_LENGTH, segmentLength - MOTION_ARROWHEAD_CLEARANCE)
    : segmentLength / 2;
  const unitX = dx / segmentLength;
  const unitY = dy / segmentLength;
  const trimmedEnd = {
    x: prev.x + unitX * remainingLength,
    y: prev.y + unitY * remainingLength,
  };
  const motionPts = [...pts.slice(0, -1), trimmedEnd];
  return motionPts
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${formatNum(pt.x)} ${formatNum(pt.y)}`)
    .join(' ');
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
    `${pad}      <animate attributeName="offset" values="0%;60%;100%" dur="1.6s" repeatCount="indefinite"/>`,
    `${pad}    </stop>`,
    `${pad}    <stop offset="35%" stop-color="#FFFFFF" stop-opacity="1">`,
    `${pad}      <animate attributeName="offset" values="10%;70%;100%" dur="1.6s" repeatCount="indefinite"/>`,
    `${pad}    </stop>`,
    `${pad}    <stop offset="50%" stop-color="${base}" stop-opacity="0.85">`,
    `${pad}      <animate attributeName="offset" values="20%;80%;100%" dur="1.6s" repeatCount="indefinite"/>`,
    `${pad}    </stop>`,
    `${pad}    <stop offset="100%" stop-color="${base}" stop-opacity="0.75"/>`,
    `${pad}  </linearGradient>`,
    `${pad}</defs>`,
  ].join('\n');
}

function flowGradientId(path: string, stroke: string): string {
  return `triton-flow-${hashString(`${path}|${stroke}`)}`;
}

function pathLengthApprox(path: string): number {
  const pts = pathPoints(path);
  if (pts.length < 2) return 1000;
  let length = 0;
  for (let i = 1; i < pts.length; i++) {
    length += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
  }
  return Math.max(1, Number(formatNum(length)));
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

function pathPoints(path: string): Array<{ x: number; y: number }> {
  const nums = [...path.matchAll(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi)].map(m => Number(m[0]));
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = nums[i]!;
    const y = nums[i + 1]!;
    if (Number.isFinite(x) && Number.isFinite(y)) pts.push({ x, y });
  }
  return pts;
}

function formatNum(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value * 1000) / 1000) : '0';
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

// ─── Renderer object ──────────────────────────────────────────────────────────

/** The built-in SVG renderer. Registered by default in frontend/index.ts. */
export const svgRenderer: Renderer<string> = {
  name: 'svg',
  render: renderSVG,
};
