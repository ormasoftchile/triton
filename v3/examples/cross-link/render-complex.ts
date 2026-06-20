/**
 * Complex Cross-Link Demo
 *
 * A 4-cell poster demonstrating:
 *  - Multiple cross-links across non-adjacent cells
 *  - All three directions: directed, bidirectional, undirected
 *  - All three styles: solid, dashed, dotted
 *  - Named traces with categorical colours
 *  - Labels on links
 *
 * Usage:  npx tsx examples/cross-link/render-complex.ts
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
import type { CrossLink, TraceRecord } from '../../src/contracts/crosslink.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Bootstrap ────────────────────────────────────────────────────────────────

registerDiagram('flowchart', flowchart);
registerRouter('straight', straightRouter);
registerRouter('orthogonal', orthogonalRouter);
registerRouter('bezier', bezierRouter);
registerRouter('polyline', polylineRouter);

// ─── Cell Diagrams ────────────────────────────────────────────────────────────

// Cell A (top-left): User-facing frontend
const uiLayer = flowchart.parseMermaid(`flowchart LR
  app[Mobile App] --> bff[BFF]
  web[Web App] --> bff
`);

// Cell B (top-right): API & orchestration
const apiLayer = flowchart.parseMermaid(`flowchart LR
  gw[API Gateway] --> auth[Auth]
  gw --> catalog[Catalog]
  gw --> orders[Orders]
`);

// Cell C (bottom-left): Data stores
const dataLayer = flowchart.parseMermaid(`flowchart LR
  pg[(Postgres)] --> replica[(Read Replica)]
  redis[Redis Cache] --> pg
`);

// Cell D (bottom-right): Async & observability
const asyncLayer = flowchart.parseMermaid(`flowchart LR
  kafka[Kafka] --> consumer[Consumer]
  consumer --> metrics[Metrics]
`);

// ─── Traces ───────────────────────────────────────────────────────────────────

const traces: TraceRecord[] = [
  {
    id: 'user-purchase',
    name: 'User Purchase Flow',
    type: 'triggers',
    hops: [
      { cellPath: ['UI'], nodeId: 'bff' },
      { cellPath: ['API'], nodeId: 'gw' },
      { cellPath: ['API'], nodeId: 'orders' },
      { cellPath: ['DATA'], nodeId: 'pg' },
    ],
    color: '#E11D48', // rose
  },
  {
    id: 'cache-read',
    name: 'Cache Read Path',
    type: 'reads',
    hops: [
      { cellPath: ['API'], nodeId: 'catalog' },
      { cellPath: ['DATA'], nodeId: 'redis' },
    ],
    color: '#16A34A', // green
  },
];

// ─── Cross-Links ─────────────────────────────────────────────────────────────

// Trace-derived links (purchase flow)
const purchaseLinks: CrossLink[] = [
  {
    from: { cellPath: ['UI'], nodeId: 'bff' },
    to:   { cellPath: ['API'], nodeId: 'gw' },
    direction: 'directed',
    style: 'solid',
    label: 'request',
    traceId: 'user-purchase',
  },
  {
    from: { cellPath: ['API'], nodeId: 'orders' },
    to:   { cellPath: ['DATA'], nodeId: 'pg' },
    direction: 'directed',
    style: 'solid',
    label: 'persist',
    traceId: 'user-purchase',
  },
];

// Cache read path
const cacheLinks: CrossLink[] = [
  {
    from: { cellPath: ['API'], nodeId: 'catalog' },
    to:   { cellPath: ['DATA'], nodeId: 'redis' },
    direction: 'directed',
    style: 'dashed',
    label: 'cache hit?',
    traceId: 'cache-read',
  },
];

// Event-driven links (orders → kafka, bidirectional)
const eventLinks: CrossLink[] = [
  {
    from: { cellPath: ['API'], nodeId: 'orders' },
    to:   { cellPath: ['ASYNC'], nodeId: 'kafka' },
    direction: 'directed',
    style: 'solid',
    label: 'publishes',
  },
  {
    from: { cellPath: ['ASYNC'], nodeId: 'metrics' },
    to:   { cellPath: ['API'], nodeId: 'gw' },
    direction: 'bidirectional',
    style: 'dotted',
    label: 'health',
  },
];

const allLinks: CrossLink[] = [...purchaseLinks, ...cacheLinks, ...eventLinks];

// ─── Poster Document ──────────────────────────────────────────────────────────

const posterIR: PosterDocument = {
  version: '1.0',
  metadata: { title: 'Microservices Architecture — Cross-Link Map' },
  grid: { columns: 2 },
  cells: [
    {
      id: 'UI',
      title: 'UI Layer',
      content: { kind: 'diagram', diagramKind: 'flowchart', doc: uiLayer },
    },
    {
      id: 'API',
      title: 'API & Orchestration',
      content: { kind: 'diagram', diagramKind: 'flowchart', doc: apiLayer },
    },
    {
      id: 'DATA',
      title: 'Data Stores',
      content: { kind: 'diagram', diagramKind: 'flowchart', doc: dataLayer },
    },
    {
      id: 'ASYNC',
      title: 'Async & Observability',
      content: { kind: 'diagram', diagramKind: 'flowchart', doc: asyncLayer },
    },
  ],
  links: allLinks,
  traces,
};

// ─── Render ───────────────────────────────────────────────────────────────────

async function main() {
  const theme = resolveTheme({}, defaultTheme);
  const result = await layoutPoster(posterIR, theme);
  const svg = svgRenderer.render(result.scene);

  mkdirSync(__dirname, { recursive: true });
  writeFileSync(join(__dirname, 'cross-link-complex-demo.svg'), svg, 'utf-8');
  console.log('✓ cross-link-complex-demo.svg');

  // Dump anchors for debugging
  writeFileSync(join(__dirname, 'anchors-complex.json'), JSON.stringify(result.anchors, null, 2), 'utf-8');
  console.log('✓ anchors-complex.json');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
