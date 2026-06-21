/**
 * Geometric collision checker for cross-link SVGs.
 * Runs after rendering to detect paths crossing through nodes.
 *
 * Usage:  npx tsx examples/cross-link/check-collisions.ts [file.mmd ...]
 *         Defaults to all .mmd files in the directory.
 */
import { compile } from '../../src/frontend/index.js';
import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';

const dir = 'examples/cross-link';
const args = process.argv.slice(2);
const files = args.length > 0
  ? args
  : readdirSync(dir).filter(f => f.endsWith('.mmd')).map(f => join(dir, f));

function segmentsFromPath(d: string) {
  const parts = d.trim().split(/\s+/);
  const points: {x:number,y:number}[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === 'M' || parts[i] === 'L') {
      points.push({ x: parseFloat(parts[i+1]!), y: parseFloat(parts[i+2]!) });
      i += 2;
    }
  }
  return points;
}

function segIntersectsRect(p1: {x:number,y:number}, p2: {x:number,y:number}, r: {x:number,y:number,width:number,height:number}) {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const xmin = r.x + 3, xmax = r.x + r.width - 3;
  const ymin = r.y + 3, ymax = r.y + r.height - 3;
  if (xmin >= xmax || ymin >= ymax) return false;
  let tmin = 0, tmax = 1;
  const edges = [
    { p: -dx, q: p1.x - xmin },
    { p: dx, q: xmax - p1.x },
    { p: -dy, q: p1.y - ymin },
    { p: dy, q: ymax - p1.y },
  ];
  for (const { p, q } of edges) {
    if (Math.abs(p) < 1e-10) { if (q < 0) return false; }
    else {
      const t = q / p;
      if (p < 0) tmin = Math.max(tmin, t);
      else tmax = Math.min(tmax, t);
      if (tmin > tmax) return false;
    }
  }
  return tmin < tmax;
}

let totalCollisions = 0;

for (const file of files) {
  const name = basename(file, '.mmd');
  const svgFile = file.replace(/\.mmd$/, '.svg');
  const input = readFileSync(file, 'utf-8');
  const result = await compile(input);
  if (!result.ok) { console.error(`✗ ${name}: ${result.error}`); continue; }

  const { anchors } = result.value;
  const svg = readFileSync(svgFile, 'utf-8');

  console.log(`\n=== ${name.toUpperCase()} ===`);
  console.log('  NODE BOUNDS:');
  for (const [id, a] of Object.entries(anchors) as any[]) {
    const b = a.bounds;
    console.log(`    ${id}: x=[${b.x.toFixed(1)}, ${(b.x+b.width).toFixed(1)}] y=[${b.y.toFixed(1)}, ${(b.y+b.height).toFixed(1)}]`);
  }

  const allPaths = [...svg.matchAll(/<path d="([^"]+)"[^/]*stroke-width="2"[^/]*\/>/g)];
  if (allPaths.length === 0) {
    allPaths.push(...svg.matchAll(/<path[^>]*stroke-width="2"[^>]*d="([^"]+)"[^/]*\/>/g));
  }

  console.log(`  PATHS: ${allPaths.length}`);

  let fileCollisions = 0;
  for (const m of allPaths) {
    const pts = segmentsFromPath(m[1]);
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i]!, p2 = pts[i+1]!;
      for (const [id, a] of Object.entries(anchors) as any[]) {
        if (segIntersectsRect(p1, p2, a.bounds)) {
          console.log(`    ✗ COLLISION: (${p1.x.toFixed(1)},${p1.y.toFixed(1)})→(${p2.x.toFixed(1)},${p2.y.toFixed(1)}) hits ${id}`);
          fileCollisions++;
        }
      }
    }
  }

  if (fileCollisions === 0) {
    console.log('  ✓ All paths clear');
  } else {
    console.log(`  ✗ ${fileCollisions} collision(s)`);
  }
  totalCollisions += fileCollisions;
}

console.log(`\n${'='.repeat(40)}`);
if (totalCollisions === 0) {
  console.log('✓ ALL CLEAR — no collisions in any file');
} else {
  console.log(`✗ ${totalCollisions} total collision(s) found`);
  process.exit(1);
}
