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
    lines.push(`  <rect width="100%" height="100%" fill="${background}" />`);
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
      const rx      = el.rx      != null ? ` rx="${el.rx}"` : '';
      const opacity = el.opacity != null ? ` opacity="${el.opacity}"` : '';
      return `${pad}<rect x="${el.bounds.x}" y="${el.bounds.y}" width="${el.bounds.width}" height="${el.bounds.height}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"${rx}${opacity} />`;
    }

    case 'circle': {
      const opacity = el.opacity != null ? ` opacity="${el.opacity}"` : '';
      return `${pad}<circle cx="${el.center.x}" cy="${el.center.y}" r="${el.radius}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"${opacity} />`;
    }

    case 'text': {
      const anchor  = el.anchor    != null ? ` text-anchor="${el.anchor}"` : '';
      const weight  = el.fontWeight != null ? ` font-weight="${el.fontWeight}"` : '';
      const opacity = el.opacity   != null ? ` opacity="${el.opacity}"` : '';
      return `${pad}<text x="${el.position.x}" y="${el.position.y}" font-size="${el.fontSize}" font-family="${escapeAttr(el.fontFamily)}" fill="${el.fill}"${anchor}${weight}${opacity}>${escapeXml(el.content)}</text>`;
    }

    case 'path': {
      const dash    = el.strokeDasharray != null ? ` stroke-dasharray="${el.strokeDasharray}"` : '';
      const mEnd    = el.markerEnd       != null ? ` marker-end="url(#${el.markerEnd})"` : '';
      const mStart  = el.markerStart     != null ? ` marker-start="url(#${el.markerStart})"` : '';
      const fill    = el.fill            != null ? ` fill="${el.fill}"` : ' fill="none"';
      const opacity = el.opacity         != null ? ` opacity="${el.opacity}"` : '';
      const attrs   = `${pad}<path d="${el.d}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"${fill}${dash}${mEnd}${mStart}${opacity}`;
      if (el.animated === 'march' && el.strokeDasharray) {
        const period  = parseDasharrayPeriod(el.strokeDasharray);
        const animate = `<animate attributeName="stroke-dashoffset" from="0" to="-${period}" dur="0.8s" repeatCount="indefinite"/>`;
        return `${attrs}>\n${pad}  ${animate}\n${pad}</path>`;
      }
      if (el.animated === 'particle') {
        // A filled circle travels along the path using animateMotion.
        // The path data is inlined in the path= attribute — no id needed.
        const circle = `${pad}<circle r="4" fill="${el.stroke}">\n${pad}  <animateMotion dur="1.5s" repeatCount="indefinite" rotate="auto" path="${el.d}"/>\n${pad}</circle>`;
        return `${attrs} />\n${circle}`;
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

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(text: string): string {
  return text.replace(/"/g, '&quot;');
}

// ─── Renderer object ──────────────────────────────────────────────────────────

/** The built-in SVG renderer. Registered by default in frontend/index.ts. */
export const svgRenderer: Renderer<string> = {
  name: 'svg',
  render: renderSVG,
};
