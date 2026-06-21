import { compile } from '../../src/frontend/index.js';
import { readFileSync } from 'fs';
import { resolveCrossLinks } from '../../src/crosslink/resolve.js';

const input = readFileSync('examples/cross-link/complex.mmd', 'utf-8');
const result = await compile(input);
const { anchors } = result.value!;

const redis = anchors['DATA.redis'] as any;
const catalog = anchors['API.catalog'] as any;

// Manually evaluate all port pairs for catalog → redis
const SIDES = ['N', 'S', 'E', 'W'] as const;
const allBounds = Object.values(anchors).map((a: any) => a.bounds);

function availPorts(anchor: any) {
  const b = anchor.bounds;
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  const defaults: any = { N:{x:cx,y:b.y}, S:{x:cx,y:b.y+b.height}, E:{x:b.x+b.width,y:cy}, W:{x:b.x,y:cy} };
  return SIDES.map(s => ({ side: s, pt: anchor.ports?.[s] ?? defaults[s] }));
}

function simRoute(from: any, to: any, fSide: string, tSide: string) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const midX = (from.x + to.x) / 2, midY = (from.y + to.y) / 2;
  if (Math.abs(dx) < 1 || Math.abs(dy) < 1) return [[from, to]];
  const exitH = fSide === 'E' || fSide === 'W';
  const entryH = tSide === 'E' || tSide === 'W';
  if (exitH && entryH) {
    const v1 = {x:midX, y:from.y}, v2 = {x:midX, y:to.y};
    return [[from,v1],[v1,v2],[v2,to]];
  } else if (!exitH && !entryH) {
    const v1 = {x:from.x, y:midY}, v2 = {x:to.x, y:midY};
    return [[from,v1],[v1,v2],[v2,to]];
  } else if (exitH) {
    const c = {x:to.x, y:from.y};
    return [[from,c],[c,to]];
  } else {
    const c = {x:from.x, y:to.y};
    return [[from,c],[c,to]];
  }
}

function segHitsRect(p1: any, p2: any, r: any) {
  const dx = p2.x-p1.x, dy = p2.y-p1.y;
  let tmin=0, tmax=1;
  const edges = [{p:-dx,q:p1.x-r.x},{p:dx,q:r.x+r.width-p1.x},{p:-dy,q:p1.y-r.y},{p:dy,q:r.y+r.height-p1.y}];
  for (const {p,q} of edges) {
    if (Math.abs(p)<1e-10) { if(q<0) return false; }
    else { const t=q/p; if(p<0) tmin=Math.max(tmin,t); else tmax=Math.min(tmax,t); if(tmin>tmax) return false; }
  }
  return true; // NOTE: tmin <= tmax means intersection
}

const fromPorts = availPorts(catalog);
const toPorts = availPorts(redis);

console.log('Port pair scoring (catalog → redis):');
for (const fp of fromPorts) {
  for (const tp of toPorts) {
    const segments = simRoute(fp.pt, tp.pt, fp.side, tp.side);
    let crossings = 0;
    for (const [p1,p2] of segments) {
      for (const obs of allBounds) {
        if (segHitsRect(p1, p2, obs)) crossings++;
      }
    }
    const dx = tp.pt.x - fp.pt.x, dy = tp.pt.y - fp.pt.y;
    const dist = dx*dx + dy*dy;
    const score = dist + crossings * 1_000_000;
    if (crossings > 0 || (fp.side === 'W' && tp.side === 'E') || (fp.side === 'W' && tp.side === 'W')) {
      console.log(`  ${fp.side}->${tp.side}: dist2=${dist.toFixed(0)} crossings=${crossings} score=${score.toFixed(0)}`);
    }
  }
}
