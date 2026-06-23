/**
 * Render — Output backends.
 *
 * Consumes a Scene and produces SVG, PNG, or PDF output.
 * Renderers are diagram-agnostic: they only know about Scene elements.
 */

import type { Scene, SceneElement } from '../scene/types.js';
import { layoutOverlays } from '../scene/overlays.js';
import type { ResolvedTheme } from '../theme/types.js';

// ─── SVG Renderer ──────────────────────────────────────────────────────────────

export function renderSVG(scene: Scene, theme?: ResolvedTheme): string {
  let { viewBox, background, elements, defs } = scene;
  let allElements = [...elements];

  // Process overlays if present and theme provided
  if (theme && (scene.annotations || scene.legend)) {
    const overlays = layoutOverlays(scene, theme);
    allElements = [...allElements, ...overlays.elements];
    viewBox = overlays.viewBox;
  }

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

  for (const el of allElements) {
    lines.push(renderElement(el, 1));
  }

  lines.push('</svg>');
  return lines.join('\n');
}

function renderElement(el: SceneElement, depth: number): string {
  const indent = '  '.repeat(depth);

  switch (el.type) {
    case 'rect': {
      const rx = el.rx ? ` rx="${el.rx}"` : '';
      const ry = el.ry ? ` ry="${el.ry}"` : '';
      return `${indent}<rect x="${el.bounds.x}" y="${el.bounds.y}" width="${el.bounds.width}" height="${el.bounds.height}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"${rx}${ry} />`;
    }
    case 'circle':
      return `${indent}<circle cx="${el.center.x}" cy="${el.center.y}" r="${el.radius}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" />`;
    case 'text': {
      const anchor = el.anchor ? ` text-anchor="${el.anchor}"` : '';
      const weight = el.fontWeight ? ` font-weight="${el.fontWeight}"` : '';
      return `${indent}<text x="${el.position.x}" y="${el.position.y}" font-size="${el.fontSize}" font-family="${el.fontFamily}" fill="${el.fill}"${anchor}${weight}>${escapeXml(el.content)}</text>`;
    }
    case 'path': {
      const dash = el.strokeDasharray ? ` stroke-dasharray="${el.strokeDasharray}"` : '';
      const mEnd = el.markerEnd ? ` marker-end="url(#${el.markerEnd})"` : '';
      const mStart = el.markerStart ? ` marker-start="url(#${el.markerStart})"` : '';
      const fill = el.fill ? ` fill="${el.fill}"` : ' fill="none"';
      return `${indent}<path d="${el.d}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"${fill}${dash}${mEnd}${mStart} />`;
    }
    case 'group': {
      const id = el.id ? ` id="${el.id}"` : '';
      const transform = el.transform ? ` transform="${el.transform}"` : '';
      const children = el.children.map(c => renderElement(c, depth + 1)).join('\n');
      return `${indent}<g${id}${transform}>\n${children}\n${indent}</g>`;
    }
  }
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
