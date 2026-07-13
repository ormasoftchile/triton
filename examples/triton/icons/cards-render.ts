/**
 * examples/triton/icons/cards-render.ts
 *
 * Visual verification example for P7 card node rendering.
 *
 * Produces an SVG of a small flowchart with three card nodes (two with icons,
 * one icon-free), connected by edges, exercising:
 *   - Two-region layout (icon LEFT, title+body RIGHT)
 *   - Per-node content-driven sizing
 *   - Title (bold) + wrapped body text
 *   - Monochrome icon tinted to palette.primary
 *   - Graceful fallback (card with no icon still renders title+body)
 *   - Edges connecting to card actual bounds
 *
 * Run:
 *   npx tsx examples/triton/icons/cards-render.ts > examples/triton/icons/cards.svg
 *   rsvg-convert -f png -w 1400 -o examples/triton/icons/cards.png examples/triton/icons/cards.svg
 *
 * Expected visual description:
 *   Three card boxes arranged vertically (TD flowchart).
 *   Card 1 "App Service": wide box, small server icon on left, bold title
 *     "App Service" top-right, muted body "Handles HTTP request routing and
 *     load balancing for web traffic" wrapping below.
 *   Card 2 "PostgreSQL": wide box, database icon on left, bold title
 *     "PostgreSQL", muted body "Primary relational data store used by all services".
 *   Card 3 "Cache Layer": no icon (text-only card), bold title "Cache Layer"
 *     vertically centred (no body text).
 *   Connecting arrows: App Service → PostgreSQL, App Service → Cache Layer.
 *   All cards have rounded corners (rx=6), surface fill with slight opacity.
 *   No <foreignObject> or <image> elements.
 */

import { renderSync } from '../../../src/frontend/index.js';
import type { IconPackMap, IconifyJSON } from '../../../src/contracts/icons.js';

// ─── Icon fixtures ─────────────────────────────────────────────────────────────

/** Minimal monochrome icon pack — server and database icons. */
const PACK: IconifyJSON = {
  prefix: 'mdi',
  icons: {
    server: {
      body: [
        '<rect fill="currentColor" x="2" y="2" width="20" height="8" rx="2"/>',
        '<rect fill="currentColor" x="2" y="14" width="20" height="8" rx="2"/>',
        '<circle fill="none" stroke="currentColor" stroke-width="1.5" cx="19" cy="6" r="1"/>',
        '<circle fill="none" stroke="currentColor" stroke-width="1.5" cx="19" cy="18" r="1"/>',
      ].join(''),
    },
    database: {
      body: [
        '<ellipse fill="currentColor" cx="12" cy="5" rx="9" ry="3"/>',
        '<path fill="currentColor" d="M3 5v4c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>',
        '<path fill="currentColor" d="M3 9v4c0 1.66 4.03 3 9 3s9-1.34 9-3V9"/>',
        '<path fill="currentColor" d="M3 13v4c0 1.66 4.03 3 9 3s9-1.34 9-3v-4"/>',
      ].join(''),
    },
  },
  width: 24,
  height: 24,
  left: 0,
  top: 0,
};

const PACK_MAP: IconPackMap = new Map([['mdi', PACK]]);

// ─── Diagram ──────────────────────────────────────────────────────────────────

// The \n inside labels separates title (bold) from body (wrapped, muted).
// @shape:card activates the two-region card layout.
// @icon:mdi:server / @icon:mdi:database resolve from PACK_MAP.
const DIAGRAM = `flowchart TD
  A ["App Service\\nHandles HTTP request routing and load balancing for web traffic"] @shape:card @icon:mdi:server
  B ["PostgreSQL\\nPrimary relational data store used by all backend services"] @shape:card @icon:mdi:database
  C ["Cache Layer\\nIn-memory key-value store"] @shape:card
  A -->|queries| B
  A -->|caches| C
`;

const result = renderSync(DIAGRAM, undefined, 'svg', undefined, PACK_MAP);

if (!result.ok) {
  process.stderr.write(`Render failed: ${result.error.message}\n`);
  process.exit(1);
}

process.stdout.write(result.value);
