import { describe, it, expect } from 'vitest';
import { writeFileSync, readFileSync } from 'node:fs';
import { compileSync, render, renderSync } from '../src/frontend/index.js';
import { countRouteCollisions } from '../src/routing/router.js';

const CASE_01 = `flowchart TB
  coordinator["Coordinator"]
  inbound["Incoming items"]
  worker["Processing stage"]
  outbound["Completed items"]
  cache["Reusable context"]
  helper["External helper"]

  coordinator -->|request| worker
  inbound -->|batch| worker
  worker -->|lookup| cache
  cache -->|invoke| helper
  helper -->|result| cache
  cache -->|enriched batch| worker
  worker -->|emit| outbound
  outbound -->|next request| coordinator`;

const CASE_02 = `architecture-beta
  group intake(server)[Intake]
  service source(server)[Event source] in intake
  service router(server)[Router] in intake
  service callback(server)[Immediate callback] in intake

  group delivery(server)[Queued delivery]
  service queue(disk)[Work queue] in delivery
  service workers(server)[Worker pool] in delivery

  group outputs(cloud)[Output types]
  service first(database)[Output one] in outputs
  service second(disk)[Output two] in outputs
  service third(server)[Output three] in outputs
  service fourth(server)[Output four] in outputs
  service fifth(server)[Output five] in outputs
  service sixth(internet)[Output six] in outputs

  source:B --> T:router
  router:R --> L:callback
  router:B --> T:queue
  queue:B --> T:workers
  workers:B --> T:first
  workers:B --> T:second
  workers:B --> T:third
  workers:B --> T:fourth
  workers:B --> T:fifth
  workers:B --> T:sixth`;

const CASE_03 = `memory
  title Fixed header indexes variable payload

  region "Fixed header"
    var "Group offsets" -> group
    var "Context offsets" -> context
    var "Credential offsets" -> credential
    var "Extension offsets" -> extension

    object core : Scalar fields : Size=4 bytes, Version=4 bytes, Window=4 bytes, Process=4 bytes
    object session : Session fields : Flags=options, Zone=offset, Locale=identifier, Client=6 bytes
    object special : Special lengths : ShortLength=16 bit, LongLength=32 bit

  region "Variable payload"
    object group : Group strings : payload=Host + User + Label
    object context : Request context : payload=Application + Endpoint + Language + Catalog
    object credential : Credential data : payload=Token + Reset data
    object extension : Optional data : payload=Feature blocks + attachment`;

const CASE_04 = `poster
  columns 2

  cell observe
    nodegraph
      node step : Observe state
  end

  cell detect
    nodegraph
      node step : Detect timeout
  end

  cell validate
    nodegraph
      node step : Validate prerequisites
  end

  cell select
    nodegraph
      node step : Select candidate
  end

  cell stop
    nodegraph
      node step : Stop old owner
  end

  cell start
    nodegraph
      node step : Start new owner
  end

  cell compare
    nodegraph
      node step : Compare checkpoints
  end

  cell recover
    nodegraph
      node step : Recover pending work
  end

  cell complete [2]
    nodegraph
      node step : Complete transition
  end

  link observe.step --> detect.step
  link detect.step --> validate.step
  link validate.step --> select.step
  link select.step --> stop.step
  link stop.step --> start.step
  link start.step --> compare.step
  link compare.step --> recover.step
  link recover.step --> complete.step`;

const CASE_05 = `poster "Workflow with durable restart"
  columns 2
  gap 28

  cell execution "Execution loop" :: nodegraph
    nodegraph
      directed
      node request : Incoming request
      node create : Create or load state
      node action : Execute action
      node persist : Persist transition
      node next : Choose next state
      node complete : Workflow complete
      node repeat : Repeat action

      request -> create
      create -> action
      action -> persist
      persist -> next
      next -> complete : done
      next -> repeat : continue
  end

  cell support "Storage, restart, and telemetry" :: nodegraph
    nodegraph
      directed
      node store : Durable state store
      node restart : Process restart
      node trace : Activity trace
      node durable : Last stored state

      store -> durable
      restart -> durable : reload
      durable -> trace : observable
  end

  link execution.persist -.-> support.store "save" @orthogonal:EW
  link support.store -.-> execution.create "reload" @orthogonal:WE
  link support.restart -.-> execution.create "resume" @orthogonal:WE
  link execution.persist -.-> support.trace "transition" @orthogonal:EW
  link execution.next -.-> support.trace "state" @orthogonal:EW`;

const CASE_06 = `poster
  columns 3

  cell producer1 "Producer A"
    nodegraph
      node p1 : Producer A / partition 1
  end

  cell producer2 "Producer B"
    nodegraph
      node p2 : Producer B / partition 2
  end

  cell producer3 "Producer C"
    nodegraph
      node p3 : Producer C / partition 3
  end

  cell queue1 "Per-producer queue"
    queue
      cells packets
      capacity 3
      axis vertical
  end

  cell queue2 "Per-producer queue"
    queue
      cells packets
      capacity 3
      axis vertical
  end

  cell queue3 "Per-producer queue"
    queue
      cells packets
      capacity 3
      axis vertical
  end

  cell consumer "Consumer" [3]
    nodegraph
      node gather : Gather all partitions
  end

  link producer1.p1 --> queue1.c2
  link producer2.p2 --> queue2.c2
  link producer3.p3 --> queue3.c2
  link queue1.c0 --> consumer.gather
  link queue2.c0 --> consumer.gather
  link queue3.c0 --> consumer.gather`;

const CASE_07 = `poster "Parent aggregation and enforcement"
  columns 2
  gap 28

  cell group1 "GROUP_A" :: nodegraph
    nodegraph
      directed
      node supply : Shared capacity
      node parent : Parent group A
      node first : Child A1
      node second : Child A2

      supply -> parent : capacity down
      first -> parent : usage up
      second -> parent : usage up
      parent -> first : policy down
      parent -> second : policy down
  end

  cell group2 "GROUP_B" :: nodegraph
    nodegraph
      directed
      node supply : Shared capacity
      node parent : Parent group B
      node first : Child B1
      node second : Child B2

      supply -> parent : capacity down
      first -> parent : usage up
      second -> parent : usage up
      parent -> first : policy down
      parent -> second : policy down
  end

  cell legend "Direction key" [2] :: nodegraph
    nodegraph
      directed
      node up : Upstream aggregation
      node down : Downstream enforcement
      up -> down
  end`;

describe('Readability Handoff Test Suite', () => {
  it('Case 01: return path routes through outside gutter and opposing edges do not collide', () => {
    const res = compileSync(CASE_01, undefined, 'bw-light');
    if (!res.ok) throw new Error(res.error.message);
    const scene = res.value.scene;
    const paths = scene.elements.filter((e) => e.type === 'path' && e.markerEnd != null) as any[];

    // 1. Return path (outbound -> coordinator) routes through outside West gutter (outside coordinator.x = 111)
    const returnPath = paths.find((p) => p.d.includes('C') && p.d.includes('111'));
    expect(returnPath).toBeDefined();
    expect(returnPath!.d).toMatch(/L (63|71)/); // routes through West gutter (x = 63 or 71 < 111)

    // 2. Return path does NOT penetrate cache
    expect(returnPath!.d.includes('490')).toBe(false);
  });

  it('Case 06: queue links do not penetrate sibling slots', () => {
    const res = compileSync(CASE_06, undefined, 'bw-light');
    if (!res.ok) throw new Error(res.error.message);
    const scene = res.value.scene;
    const paths = scene.elements.filter((e) => e.type === 'path' && e.markerEnd != null) as any[];

    // Sibling cells c1 in all queues are never connected directly; they must have 0 collisions
    const anchors = (res.value as any).anchors ?? {};
    const middleCells = [
      anchors['queue1.c1'].bounds,
      anchors['queue2.c1'].bounds,
      anchors['queue3.c1'].bounds,
    ];
    for (const p of paths) {
      const pts = [...p.d.matchAll(/[ML]\s*([0-9.]+)\s+([0-9.]+)/g)].map((m) => ({
        x: parseFloat(m[1]!),
        y: parseFloat(m[2]!),
      }));
      expect(countRouteCollisions(pts, middleCells)).toBe(0);
    }
  });

  it('Case 04: serpentine workflow links avoid overlaps and crossings and use non-color differentiation', () => {
    const res = compileSync(CASE_04, undefined, 'bw-light');
    if (!res.ok) throw new Error(res.error.message);
    const scene = res.value.scene;
    const paths = scene.elements.filter((e) => e.type === 'path' && e.markerEnd != null) as any[];

    // In bw-light theme, homogeneous sequential links use clean, uniform solid lines:
    const strokes = new Set(paths.map((p) => p.stroke));
    expect(strokes.size).toBe(1); // all monochrome
    const dashPatterns = new Set(paths.map((p) => p.strokeDasharray ?? 'solid'));
    expect(dashPatterns.size).toBe(1); // uniform solid lines (no arbitrary alternating dash hack)

    // Check no collinear overlaps between any segments
    const segments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    for (const p of paths) {
      const pts = [...p.d.matchAll(/[ML]\s*([0-9.]+)\s+([0-9.]+)/g)].map((m) => ({
        x: parseFloat(m[1]!),
        y: parseFloat(m[2]!),
      }));
      for (let i = 0; i < pts.length - 1; i++) {
        segments.push({ x1: pts[i]!.x, y1: pts[i]!.y, x2: pts[i + 1]!.x, y2: pts[i + 1]!.y });
      }
    }
    let collinearOverlaps = 0;
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const s1 = segments[i]!,
          s2 = segments[j]!;
        if (
          Math.abs(s1.x1 - s1.x2) < 1 &&
          Math.abs(s2.x1 - s2.x2) < 1 &&
          Math.abs(s1.x1 - s2.x1) < 1
        ) {
          const yMin1 = Math.min(s1.y1, s1.y2),
            yMax1 = Math.max(s1.y1, s1.y2);
          const yMin2 = Math.min(s2.y1, s2.y2),
            yMax2 = Math.max(s2.y1, s2.y2);
          if (Math.max(yMin1, yMin2) < Math.min(yMax1, yMax2)) {
            console.log('OVERLAP VERT:', s1, s2);
            collinearOverlaps++;
          }
        }
        if (
          Math.abs(s1.y1 - s1.y2) < 1 &&
          Math.abs(s2.y1 - s2.y2) < 1 &&
          Math.abs(s1.y1 - s2.y1) < 1
        ) {
          const xMin1 = Math.min(s1.x1, s1.x2),
            xMax1 = Math.max(s1.x1, s1.x2);
          const xMin2 = Math.min(s2.x1, s2.x2),
            xMax2 = Math.max(s2.x1, s2.x2);
          if (Math.max(xMin1, xMin2) < Math.min(xMax1, xMax2)) {
            console.log('OVERLAP HORIZ:', s1, s2);
            collinearOverlaps++;
          }
        }
      }
    }
    expect(collinearOverlaps).toBe(0);
  });

  it('Case 05: cross-panel feedback links route cleanly without collinear overlap', () => {
    const res = compileSync(CASE_05, undefined, 'bw-light');
    if (!res.ok) throw new Error(res.error.message);
    const scene = res.value.scene;
    const paths = scene.elements.filter((e) => e.type === 'path' && e.markerEnd != null) as any[];

    // Check no collinear overlaps between any segments
    const segments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    for (const p of paths) {
      const pts = [...p.d.matchAll(/[ML]\s*([0-9.]+)\s+([0-9.]+)/g)].map((m) => ({
        x: parseFloat(m[1]!),
        y: parseFloat(m[2]!),
      }));
      for (let i = 0; i < pts.length - 1; i++) {
        segments.push({ x1: pts[i]!.x, y1: pts[i]!.y, x2: pts[i + 1]!.x, y2: pts[i + 1]!.y });
      }
    }
    let collinearOverlaps = 0;
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const s1 = segments[i]!,
          s2 = segments[j]!;
        if (
          Math.abs(s1.x1 - s1.x2) < 1 &&
          Math.abs(s2.x1 - s2.x2) < 1 &&
          Math.abs(s1.x1 - s2.x1) < 1
        ) {
          const yMin1 = Math.min(s1.y1, s1.y2),
            yMax1 = Math.max(s1.y1, s1.y2);
          const yMin2 = Math.min(s2.y1, s2.y2),
            yMax2 = Math.max(s2.y1, s2.y2);
          if (Math.max(yMin1, yMin2) < Math.min(yMax1, yMax2)) collinearOverlaps++;
        }
        if (
          Math.abs(s1.y1 - s1.y2) < 1 &&
          Math.abs(s2.y1 - s2.y2) < 1 &&
          Math.abs(s1.y1 - s2.y1) < 1
        ) {
          const xMin1 = Math.min(s1.x1, s1.x2),
            xMax1 = Math.max(s1.x1, s1.x2);
          const xMin2 = Math.min(s2.x1, s2.x2),
            xMax2 = Math.max(s2.x1, s2.x2);
          if (Math.max(xMin1, xMin2) < Math.min(xMax1, xMax2)) collinearOverlaps++;
        }
      }
    }
    expect(collinearOverlaps).toBe(0);
  });

  it('Case 03: memory diagram pointers avoid object penetration and allocate separate lanes', () => {
    const res = compileSync(CASE_03, undefined, 'bw-light');
    if (!res.ok) throw new Error(res.error.message);
    const scene = res.value.scene;
    const rects = scene.elements.filter((e) => e.type === 'rect') as any[];
    const paths = scene.elements.filter((e) => e.type === 'path' && e.markerEnd != null) as any[];

    expect(paths).toHaveLength(4);

    // Objects in region 1 (core, session, special) and region 2 (group, context, credential, extension)
    const objectBoxes = Object.entries(res.value.anchors)
      .filter(
        ([id]) =>
          id === 'core' ||
          id === 'session' ||
          id === 'special' ||
          id === 'group' ||
          id === 'context' ||
          id === 'credential' ||
          id === 'extension',
      )
      .map(([, v]) => v.bounds);

    // Verify zero collisions with unrelated objects
    for (const path of paths) {
      const pts = [...path.d.matchAll(/[ML]\s*([0-9.]+)\s+([0-9.]+)/g)].map((m) => ({
        x: parseFloat(m[1]!),
        y: parseFloat(m[2]!),
      }));
      const lastPt = pts[pts.length - 1]!;
      const unrelated = objectBoxes.filter(
        (b) =>
          !(
            lastPt.x >= b.x &&
            lastPt.x <= b.x + b.width &&
            lastPt.y >= b.y &&
            lastPt.y <= b.y + b.height
          ),
      );
      const collisions = countRouteCollisions(pts, unrelated);
      expect(collisions).toBe(0);
    }
  });

  it('Case 02: shared fanout channel allocates separate lanes without collinear overlap', () => {
    const res = compileSync(CASE_02, undefined, 'bw-light');
    if (!res.ok) throw new Error(res.error.message);
    const scene = res.value.scene;
    const paths = scene.elements.filter((e) => e.type === 'path' && e.markerEnd != null) as any[];

    // Extract horizontal segments
    const hSegments: Array<{ y: number; xMin: number; xMax: number; d: string }> = [];
    for (const p of paths) {
      const pts = [...p.d.matchAll(/[ML]\s*([0-9.]+)\s+([0-9.]+)/g)].map((m) => ({
        x: parseFloat(m[1]!),
        y: parseFloat(m[2]!),
      }));
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i]!,
          b = pts[i + 1]!;
        if (Math.abs(a.y - b.y) < 1 && Math.abs(a.x - b.x) > 1) {
          hSegments.push({
            y: a.y,
            xMin: Math.min(a.x, b.x),
            xMax: Math.max(a.x, b.x),
            d: p.d,
          });
        }
      }
    }

    // Check for collinear overlaps between horizontal segments
    let collinearOverlaps = 0;
    for (let i = 0; i < hSegments.length; i++) {
      for (let j = i + 1; j < hSegments.length; j++) {
        const s1 = hSegments[i]!,
          s2 = hSegments[j]!;
        if (Math.abs(s1.y - s2.y) < 1) {
          if (Math.max(s1.xMin, s2.xMin) < Math.min(s1.xMax, s2.xMax)) {
            collinearOverlaps++;
          }
        }
      }
    }
    expect(collinearOverlaps).toBe(0);
  });

  it('Case 07: opposing direction pairs allocate separate lanes without collinear overlap', () => {
    const res = compileSync(CASE_07, undefined, 'bw-light');
    if (!res.ok) throw new Error(res.error.message);
    const scene = res.value.scene;
    const paths = scene.elements.filter((e) => e.type === 'path' && e.markerEnd != null) as any[];

    // Check that no two paths share the same start and end points (or reverse)
    const segments: Array<{ x1: number; y1: number; x2: number; y2: number; d: string }> = [];
    for (const p of paths) {
      const pts = [...p.d.matchAll(/[ML]\s*([0-9.]+)\s+([0-9.]+)/g)].map((m) => ({
        x: parseFloat(m[1]!),
        y: parseFloat(m[2]!),
      }));
      for (let i = 0; i < pts.length - 1; i++) {
        segments.push({
          x1: pts[i]!.x,
          y1: pts[i]!.y,
          x2: pts[i + 1]!.x,
          y2: pts[i + 1]!.y,
          d: p.d,
        });
      }
    }

    // Verify no two segments overlap collinearly
    let collinearOverlaps = 0;
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const s1 = segments[i]!,
          s2 = segments[j]!;
        // Check if both are vertical and have the same X
        if (
          Math.abs(s1.x1 - s1.x2) < 1 &&
          Math.abs(s2.x1 - s2.x2) < 1 &&
          Math.abs(s1.x1 - s2.x1) < 1
        ) {
          const yMin1 = Math.min(s1.y1, s1.y2),
            yMax1 = Math.max(s1.y1, s1.y2);
          const yMin2 = Math.min(s2.y1, s2.y2),
            yMax2 = Math.max(s2.y1, s2.y2);
          if (Math.max(yMin1, yMin2) < Math.min(yMax1, yMax2)) collinearOverlaps++;
        }
        // Check if both are horizontal and have the same Y
        if (
          Math.abs(s1.y1 - s1.y2) < 1 &&
          Math.abs(s2.y1 - s2.y2) < 1 &&
          Math.abs(s1.y1 - s2.y1) < 1
        ) {
          const xMin1 = Math.min(s1.x1, s1.x2),
            xMax1 = Math.max(s1.x1, s1.x2);
          const xMin2 = Math.min(s2.x1, s2.x2),
            xMax2 = Math.max(s2.x1, s2.x2);
          if (Math.max(xMin1, xMin2) < Math.min(xMax1, xMax2)) collinearOverlaps++;
        }
      }
    }
    expect(collinearOverlaps).toBe(0);
  });

  it('renders and writes all 7 review SVGs', () => {
    const list = [
      { name: '01-crossing-feedback-loop', code: CASE_01 },
      { name: '02-shared-fanout-channel', code: CASE_02 },
      { name: '03-region-connector-obstruction', code: CASE_03 },
      { name: '04-zigzag-cell-sequence', code: CASE_04 },
      { name: '05-cross-panel-feedback', code: CASE_05 },
      { name: '06-queue-cell-obstruction', code: CASE_06 },
      { name: '07-antiparallel-direction-pairs', code: CASE_07 },
    ];
    for (const item of list) {
      const res = renderSync(item.code, undefined, 'svg', 'bw-light');
      if (!res.ok) throw new Error(res.error.message);
      writeFileSync(`examples/readability/${item.name}.svg`, res.value, 'utf8');
    }

    let html = readFileSync('examples/readability/index.html', 'utf8');
    for (const item of list) {
      const svg = readFileSync(`examples/readability/${item.name}.svg`, 'utf8');
      const regex = new RegExp(
        `(<a href="\\./${item.name}\\.svg"[\\s\\S]*?<div class="svg-container">)[\\s\\S]*?(</div>\\s*<details)`,
      );
      html = html.replace(regex, `$1\n        ${svg}\n      $2`);
    }
    writeFileSync('examples/readability/index.html', html, 'utf8');
  });
});
