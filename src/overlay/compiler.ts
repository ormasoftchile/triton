import type {
  RawOverlay,
  CompiledOverlays,
  Annotation,
  Legend,
  LegendCorner,
} from '../contracts/index.js';

/**
 * Convert raw grammar-emitted overlay directives into resolved overlay types.
 *
 * Position resolution for notes is deferred — positions are relative offsets
 * from the anchor element. The overlay layout function resolves these to
 * absolute coordinates once node positions are known.
 */
export function compileOverlays(raw: readonly RawOverlay[]): CompiledOverlays {
  const annotations: Annotation[] = [];
  let legend: Legend | undefined;

  for (const item of raw) {
    switch (item.type) {
      case 'note': {
        const dx = item.offset?.dx ?? 0;
        const dy = item.offset?.dy ?? -60;
        annotations.push({
          id: `note-${slugify(item.target)}-${annotations.length}`,
          text: item.text,
          // position is the offset from the anchor; absolute coords resolved at layout time
          position: { x: dx, y: dy },
          anchor: { elementId: item.target },
        });
        break;
      }

      case 'legend': {
        legend = {
          ...(item.title !== undefined ? { title: item.title } : {}),
          entries: item.entries,
          corner: parseLegendCorner(item.corner),
        };
        break;
      }
    }
  }

  return { annotations, ...(legend !== undefined ? { legend } : {}) };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseLegendCorner(raw: string): LegendCorner {
  const valid: LegendCorner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  return valid.includes(raw as LegendCorner) ? (raw as LegendCorner) : 'bottom-right';
}
