/**
 * Cross-Link Example
 *
 * Demonstrates the basics of cross-diagram linking within a poster.
 * Two flowchart cells share a cross-link that connects a node in
 * one diagram to a node in another.
 *
 * Usage:  npx tsx examples/cross-link/render.ts
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Import internals directly — example is tightly coupled to the engine
import { resolveTheme } from '../../src/theme/resolver.js';
import { defaultTheme } from '../../src/theme/preset.js';
import { layoutPoster } from '../../src/diagrams/poster/layout.js';
import { svgRenderer } from '../../src/render/svg.js';
import { flowchart } from '../../src/diagrams/flowchart/index.js';
import { registerDiagram } from '../../src/frontend/registry.js';
import { registerRouter } from '../../src/routing/registry.js';
import {
  straightRouter,
  orthogonalRouter,
  bezierRouter,
  polylineRouter,
} from '../../src/routing/router.js';

import type { PosterDocument } from '../../src/diagrams/poster/ir.js';
import type { CrossLink } from '../../src/contracts/crosslink.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Bootstrap registrations ──────────────────────────────────────────────────

registerDiagram('flowchart', flowchart);
registerRouter('straight', straightRouter);
registerRouter('orthogonal', orthogonalRouter);
registerRouter('bezier', bezierRouter);
registerRouter('polyline', polylineRouter);

// ─── Build Poster IR with Cross-Links ─────────────────────────────────────────

// Cell A: "Frontend Services"
const frontendFlow = flowchart.parseMermaid(`flowchart LR
  ui[Web UI] --> gateway[API Gateway]
  gateway --> auth[Auth Service]
`);

// Cell B: "Backend Services"
const backendFlow = flowchart.parseMermaid(`flowchart LR
  gateway[Gateway] --> orders[Order Service]
  orders --> db[(Database)]
  orders --> queue[Message Queue]
`);

// Cross-links: connect Frontend's "gateway" to Backend's "gateway"
// and Frontend's "auth" to Backend's "orders" (auth validates orders)
const links: CrossLink[] = [
  {
    from: { cellPath: ['A'], nodeId: 'gateway' },
    to:   { cellPath: ['B'], nodeId: 'gateway' },
    direction: 'directed',
    style: 'solid',
    label: 'routes to',
  },
  {
    from: { cellPath: ['A'], nodeId: 'auth' },
    to:   { cellPath: ['B'], nodeId: 'orders' },
    direction: 'directed',
    style: 'dashed',
    label: 'validates',
  },
];

const posterIR: PosterDocument = {
  version: '1.0',
  metadata: { title: 'Cross-Link Demo' },
  grid: { columns: 2 },
  cells: [
    {
      id: 'A',
      title: 'Frontend Services',
      content: { kind: 'diagram', diagramKind: 'flowchart', doc: frontendFlow },
    },
    {
      id: 'B',
      title: 'Backend Services',
      content: { kind: 'diagram', diagramKind: 'flowchart', doc: backendFlow },
    },
  ],
  links,
};

// ─── Render ───────────────────────────────────────────────────────────────────

async function main() {
  const theme = resolveTheme({}, defaultTheme);
  const result = await layoutPoster(posterIR, theme);
  const svg = svgRenderer.render(result.scene);

  mkdirSync(__dirname, { recursive: true });
  writeFileSync(join(__dirname, 'cross-link-demo.svg'), svg, 'utf-8');
  console.log('✓ cross-link-demo.svg');

  // Also dump the anchor registry for inspection
  const anchorDump = JSON.stringify(result.anchors, null, 2);
  writeFileSync(join(__dirname, 'anchors.json'), anchorDump, 'utf-8');
  console.log('✓ anchors.json (anchor registry dump)');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
