/**
 * Architecture grammar — parse-level unit tests.
 *
 * Covers: nested groups, junctions (with/without `in`), all 4 arrow forms,
 * group-edge {group} modifier on both endpoints, align row/column directives,
 * and iconify-style `prefix:name` tokens in the icon slot.
 *
 * Most tests are parse/IR assertions; connector tests also cover render output.
 */

import { describe, it, expect } from 'vitest';
import * as parser from '../src/diagrams/mermaid/architecture/parser.js';
import type { ArchitectureDocument, ArchEdge, ArchIconAlign, ArchJunction, ArchGroup } from '../src/diagrams/mermaid/architecture/ir.js';
import type { ScenePath, SceneRect, SceneText } from '../src/contracts/index.js';
import { layoutArchitecture } from '../src/diagrams/mermaid/architecture/layout.js';
import { defaultTheme } from '../src/theme/preset.js';
import { CONNECTOR_ANIMATIONS } from '../src/contracts/animations.js';

function parse(src: string): ArchitectureDocument {
  return parser.parse(src) as ArchitectureDocument;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function header(body: string): string {
  return `architecture-beta\n${body}\n`;
}

// ── Nested groups ─────────────────────────────────────────────────────────────

describe('nested groups (in parentId)', () => {
  it('parses a group with explicit in clause', () => {
    const ir = parse(header('group outer(cloud)[Outer]\ngroup inner(server)[Inner] in outer'));
    expect(ir.groups).toHaveLength(2);
    const inner = ir.groups.find(g => g.id === 'inner') as ArchGroup;
    expect(inner).toBeDefined();
    expect(inner.parent).toBe('outer');
  });

  it('leaves parent undefined for a top-level group', () => {
    const ir = parse(header('group top(cloud)[Top]'));
    expect(ir.groups[0].parent).toBeUndefined();
  });

  it('preserves icon and label on nested group', () => {
    const ir = parse(header('group parent_g(globe)[Parent]\ngroup child_g(server)[Child] in parent_g'));
    const child = ir.groups.find(g => g.id === 'child_g') as ArchGroup;
    expect(child.icon).toBe('server');
    expect(child.label).toBe('Child');
  });
});

// ── Junctions ─────────────────────────────────────────────────────────────────

describe('junction', () => {
  it('parses a bare junction (no in clause)', () => {
    const ir = parse(header('junction jx1'));
    expect(ir.junctions).toHaveLength(1);
    const jx = ir.junctions[0] as ArchJunction;
    expect(jx.id).toBe('jx1');
    expect(jx.group).toBeUndefined();
  });

  it('parses a junction with in clause', () => {
    const ir = parse(header('group g1(cloud)[G1]\njunction jx2 in g1'));
    const jx = ir.junctions.find(j => j.id === 'jx2') as ArchJunction;
    expect(jx.group).toBe('g1');
  });

  it('assigns junction to group via indentation (no explicit in)', () => {
    const ir = parse(header('group g1(cloud)[G1]\n  junction jx_indent'));
    const jx = ir.junctions.find(j => j.id === 'jx_indent') as ArchJunction;
    expect(jx.group).toBe('g1');
  });

  it('populates the junctions array in the document', () => {
    const ir = parse(header('junction j1\njunction j2 in someGroup'));
    expect(ir.junctions).toHaveLength(2);
  });
});

// ── Arrow forms ───────────────────────────────────────────────────────────────

describe('arrow direction', () => {
  function edge(arrowStr: string): ArchEdge {
    const ir = parse(header(`service a(s)[A]\nservice b(s)[B]\na:R ${arrowStr} L:b`));
    expect(ir.edges).toHaveLength(1);
    return ir.edges[0] as ArchEdge;
  }

  it('-- produces arrowLeft=false, arrowRight=false', () => {
    const e = edge('--');
    expect(e.arrowLeft).toBe(false);
    expect(e.arrowRight).toBe(false);
    expect(e.style).toBe('solid');
    expect(e.startMarker).toBe('none');
    expect(e.endMarker).toBe('none');
  });

  it('--> produces arrowLeft=false, arrowRight=true', () => {
    const e = edge('-->');
    expect(e.arrowLeft).toBe(false);
    expect(e.arrowRight).toBe(true);
    expect(e.style).toBe('solid');
    expect(e.startMarker).toBe('none');
    expect(e.endMarker).toBe('arrow');
  });

  it('<-- produces arrowLeft=true, arrowRight=false', () => {
    const e = edge('<--');
    expect(e.arrowLeft).toBe(true);
    expect(e.arrowRight).toBe(false);
    expect(e.style).toBe('solid');
    expect(e.startMarker).toBe('arrow');
    expect(e.endMarker).toBe('none');
  });

  it('<--> produces arrowLeft=true, arrowRight=true', () => {
    const e = edge('<-->');
    expect(e.arrowLeft).toBe(true);
    expect(e.arrowRight).toBe(true);
    expect(e.style).toBe('solid');
    expect(e.startMarker).toBe('arrow');
    expect(e.endMarker).toBe('arrow');
  });

  it.each([
    ['-.->', 'dotted', false, true],
    ['-_->', 'dashed', false, true],
    ['==>', 'thick', false, true],
    ['-~->', 'wavy', false, true],
    ['-.-', 'dotted', false, false],
    ['-_-', 'dashed', false, false],
    ['===', 'thick', false, false],
    ['-~-', 'wavy', false, false],
    ['---', 'solid', false, false],
    ['<-.->', 'dotted', true, true],
    ['<-_->', 'dashed', true, true],
    ['<==>', 'thick', true, true],
    ['<-~->', 'wavy', true, true],
  ] as const)('parses Triton connector %s as %s', (token, style, left, right) => {
    const e = edge(token);
    expect(e.style).toBe(style);
    expect(e.arrowLeft).toBe(left);
    expect(e.arrowRight).toBe(right);
    expect(e.startMarker).toBe(left ? 'arrow' : 'none');
    expect(e.endMarker).toBe(right ? 'arrow' : 'none');
  });
});

// ── Connector rendering ──────────────────────────────────────────────────────

describe('connector rendering', () => {
  function layoutFor(token: string, tail = '') {
    const ir = parse(header(`service a(foo)[A]\nservice b(bar)[B]\na:R ${token} L:b${tail}`));
    return layoutArchitecture(ir, defaultTheme).scene;
  }

  function edgePath(token: string, tail = ''): ScenePath {
    const scene = layoutFor(token, tail);
    const paths = scene.elements.filter((el): el is ScenePath => el.type === 'path');
    expect(paths).toHaveLength(1);
    return paths[0]!;
  }

  function serviceRects(tail = '') {
    const scene = layoutFor('-->', tail);
    return scene.elements
      .filter((el): el is SceneRect => el.type === 'rect')
      .map(el => el.bounds)
      .filter(bounds => bounds.width === 130 && bounds.height === 56);
  }

  it('keeps plain Mermaid --> rendering unstyled except for the existing arrow marker', () => {
    const path = edgePath('-->');
    expect(path.strokeDasharray).toBeUndefined();
    expect(path.strokeWidth).toBe(1.6);
    expect(path.markerEnd).toBe('arch-arrow-end');
    expect(path.markerStart).toBeUndefined();
  });

  it('renders dotted connectors with a dotted dash pattern', () => {
    const path = edgePath('-.->');
    expect(path.strokeDasharray).toBe('6 3');
    expect(path.strokeWidth).toBe(1.6);
  });

  it('renders dashed connectors with a dashed dash pattern', () => {
    const path = edgePath('-_->');
    expect(path.strokeDasharray).toBe('8 4');
    expect(path.strokeWidth).toBe(1.6);
  });

  it('renders thick connectors with a wider stroke', () => {
    const path = edgePath('==>');
    expect(path.strokeDasharray).toBeUndefined();
    expect(path.strokeWidth).toBe(3.2);
  });

  it('renders wavy connectors by replacing the orthogonal polyline with a curved wave path', () => {
    const solid = edgePath('-->');
    const wavy = edgePath('-~->');
    expect(wavy.strokeDasharray).toBeUndefined();
    expect(wavy.strokeWidth).toBe(1.6);
    expect(wavy.d).not.toBe(solid.d);
    expect(wavy.d).toContain('C');
  });

  it.each(CONNECTOR_ANIMATIONS)('parses @anim:%s and renders it on the connector path', (anim) => {
    const ir = parse(header(`service a(foo)[A]\nservice b(bar)[B]\na:R --> L:b @anim:${anim}`));
    expect(ir.edges[0]!.animation).toBe(anim);
    expect(edgePath('-->', ` @anim:${anim}`).animated).toBe(anim);
  });

  it('parses property-block animation form', () => {
    const ir = parse(header('service a(foo)[A]\nservice b(bar)[B]\na:R --> L:b { anim: pulse }'));
    expect(ir.edges[0]!.animation).toBe('pulse');
    expect(edgePath('-->', ' { anim: pulse }').animated).toBe('pulse');
  });

  it('@anim wins over { anim: ... } on conflict', () => {
    const ir = parse(header('service a(foo)[A]\nservice b(bar)[B]\na:R --> L:b @anim:flow { anim: pulse }'));
    expect(ir.edges[0]!.animation).toBe('flow');
    expect(edgePath('-->', ' @anim:flow { anim: pulse }').animated).toBe('flow');
  });

  it('tolerates multiple animation annotations on one edge', () => {
    const ir = parse(header('service a(foo)[A]\nservice b(bar)[B]\na:R --> L:b @anim:pulse @anim:glow'));
    expect(ir.edges[0]!.animation).toBe('glow');
    expect(edgePath('-->', ' @anim:pulse @anim:glow').animated).toBe('glow');
  });

  it('omitted animation and explicit none render as static paths', () => {
    expect(edgePath('-->').animated).toBeUndefined();
    expect(edgePath('-->', ' @anim:none').animated).toBeUndefined();
    expect(edgePath('-->', ' { anim: none }').animated).toBeUndefined();
  });

  it('rejects invalid animation names', () => {
    expect(() => parse(header('service a(foo)[A]\nservice b(bar)[B]\na:R --> L:b @anim:spin'))).toThrow();
    expect(() => parse(header('service a(foo)[A]\nservice b(bar)[B]\na:R --> L:b { anim: spin }'))).toThrow();
  });

  it.each(['straight', 'orthogonal', 'bezier', 'polyline'] as const)('parses @route:%s', (style) => {
    const ir = parse(header(`service a(foo)[A]\nservice b(bar)[B]\na:R --> L:b @route:${style}`));
    expect(ir.edges[0]!.routing).toBe(style);
  });

  it('parses property-block route form', () => {
    const ir = parse(header('service a(foo)[A]\nservice b(bar)[B]\na:R --> L:b { route: bezier }'));
    expect(ir.edges[0]!.routing).toBe('bezier');
  });

  it('@route wins over { route: ... } on conflict', () => {
    const ir = parse(header('service a(foo)[A]\nservice b(bar)[B]\na:R --> L:b @route:bezier { route: straight }'));
    expect(ir.edges[0]!.routing).toBe('bezier');
    expect(edgePath('-->', ' @route:bezier { route: straight }').d).toContain('C');
  });

  it('renders route styles through the selected router', () => {
    const straight = edgePath('-->', ' @route:straight');
    const orthogonal = edgePath('-->', ' @route:orthogonal @orthogonal:SS');
    const bezier = edgePath('-->', ' @route:bezier');
    const polyline = edgePath('-->', ' @route:polyline');
    expect(straight.d).not.toContain('C');
    expect(orthogonal.d).not.toBe(straight.d);
    expect(bezier.d).toContain('C');
    expect(polyline.d).toBe(straight.d);
  });

  it('parses @orthogonal wall hints and changes only path geometry', () => {
    const hinted = parse(header('service a(foo)[A]\nservice b(bar)[B]\na:R --> L:b @orthogonal:SS'));
    expect(hinted.edges[0]!.routing).toBe('orthogonal');
    expect(hinted.edges[0]!.exitWall).toBe('S');
    expect(hinted.edges[0]!.entryWall).toBe('S');

    const plainPath = edgePath('-->').d;
    const hintedPath = edgePath('-->', ' @orthogonal:SS').d;
    expect(hintedPath).not.toBe(plainPath);
    expect(serviceRects(' @orthogonal:SS')).toEqual(serviceRects());
  });

  it('allows animation and route annotations on the same edge', () => {
    const ir = parse(header('service a(foo)[A]\nservice b(bar)[B]\na:R -.-> L:b @anim:flow @route:bezier'));
    expect(ir.edges[0]!.animation).toBe('flow');
    expect(ir.edges[0]!.routing).toBe('bezier');
    const path = edgePath('-.->', ' @anim:flow @route:bezier');
    expect(path.animated).toBe('flow');
    expect(path.d).toContain('C');
  });

  it('rejects invalid route styles and wall hints', () => {
    expect(() => parse(header('service a(foo)[A]\nservice b(bar)[B]\na:R --> L:b @route:spin'))).toThrow();
    expect(() => parse(header('service a(foo)[A]\nservice b(bar)[B]\na:R --> L:b { route: spin }'))).toThrow();
    expect(() => parse(header('service a(foo)[A]\nservice b(bar)[B]\na:R --> L:b @orthogonal:EQ'))).toThrow();
  });

  it('omitted routing remains the same as explicit orthogonal default', () => {
    expect(parse(header('service a(foo)[A]\nservice b(bar)[B]\na:R --> L:b')).edges[0]!.routing).toBeUndefined();
    expect(edgePath('-->').d).toBe(edgePath('-->', ' @route:orthogonal').d);
  });
});

// ── Group-edge {group} modifier ───────────────────────────────────────────────

describe('group-edge {group} modifier', () => {
  const snippet = header(
    'group g1(cloud)[G1]\n  service svc(server)[Svc]\nservice ext(internet)[Ext]\nsvc{group}:R --> L:ext\next:R <--> L:svc{group}',
  );

  it('fromGroup is true when from endpoint has {group}', () => {
    const ir = parse(snippet);
    const e1 = ir.edges.find(e => e.from === 'svc') as ArchEdge;
    expect(e1.fromGroup).toBe(true);
    expect(e1.toGroup).toBe(false);
  });

  it('toGroup is true when to endpoint has {group}', () => {
    const ir = parse(snippet);
    const e2 = ir.edges.find(e => e.from === 'ext') as ArchEdge;
    expect(e2.toGroup).toBe(true);
    expect(e2.fromGroup).toBe(false);
  });

  it('fromGroup and toGroup default to false when no modifier', () => {
    const ir = parse(header('service a(s)[A]\nservice b(s)[B]\na:R --> L:b'));
    expect(ir.edges[0].fromGroup).toBe(false);
    expect(ir.edges[0].toGroup).toBe(false);
  });
});

// ── Align directives ──────────────────────────────────────────────────────────

describe('align directives', () => {
  it('parses align row with 2 members', () => {
    const ir = parse(header('service a(s)[A]\nservice b(s)[B]\nalign row a b'));
    expect(ir.aligns).toHaveLength(1);
    expect(ir.aligns[0].axis).toBe('row');
    expect(ir.aligns[0].members).toEqual(['a', 'b']);
  });

  it('parses align column with 3 members', () => {
    const ir = parse(header('service a(s)[A]\nservice b(s)[B]\nservice c(s)[C]\nalign column a b c'));
    const al = ir.aligns.find(a => a.axis === 'column');
    expect(al).toBeDefined();
    expect(al!.members).toEqual(['a', 'b', 'c']);
  });

  it('parses multiple align lines', () => {
    const ir = parse(header('service a(s)[A]\nservice b(s)[B]\nservice c(s)[C]\nalign row a b\nalign column b c'));
    expect(ir.aligns).toHaveLength(2);
  });

  it('axis is lowercase regardless of input case', () => {
    const ir = parse(header('service a(s)[A]\nservice b(s)[B]\nalign ROW a b'));
    expect(ir.aligns[0].axis).toBe('row');
  });

  it('aligns array is empty when no align lines present', () => {
    const ir = parse(header('service a(s)[A]'));
    expect(ir.aligns).toHaveLength(0);
  });
});

// ── Iconify-style prefix:name tokens ─────────────────────────────────────────

describe('iconify prefix:name icon tokens', () => {
  it('accepts prefix:name in service icon slot', () => {
    const ir = parse(header('service db(logos:aws-s3)[Database]'));
    expect(ir.services[0].icon).toBe('logos:aws-s3');
  });

  it('accepts prefix:name in group icon slot', () => {
    const ir = parse(header('group net(azure:virtual-network)[Network]'));
    expect(ir.groups[0].icon).toBe('azure:virtual-network');
  });

  it('accepts multi-segment token (prefix:set:name)', () => {
    const ir = parse(header('service svc(mdi:server-security)[Secure Server]'));
    expect(ir.services[0].icon).toBe('mdi:server-security');
  });

  it('plain icon names (no colon) still work', () => {
    const ir = parse(header('service api(server)[API]'));
    expect(ir.services[0].icon).toBe('server');
  });
});

// ── Icon alignment ───────────────────────────────────────────────────────────

describe('icon alignment', () => {
  const aligns: readonly ArchIconAlign[] = ['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW', 'C'];

  function serviceIconScene(align?: string) {
    const suffix = align ? ` ${align}` : '';
    const ir = parse(header(`service a(custom)[A]${suffix}`));
    return layoutArchitecture(ir, defaultTheme).scene;
  }

  function serviceRect(scene = serviceIconScene()) {
    return scene.elements.find((el): el is SceneRect =>
      el.type === 'rect' && el.bounds.width === 130 && el.bounds.height === 56,
    )!;
  }

  function iconRect(scene = serviceIconScene()) {
    return scene.elements.find((el): el is SceneRect =>
      el.type === 'rect' && el.bounds.width === 18 && el.bounds.height === 18,
    )!;
  }

  function expectedIconRect(r: SceneRect['bounds'], align: ArchIconAlign) {
    const centers: Record<ArchIconAlign, { x: number; y: number }> = {
      N:  { x: r.x + r.width / 2, y: r.y + 24 },
      S:  { x: r.x + r.width / 2, y: r.y + r.height - 24 },
      E:  { x: r.x + r.width - 24, y: r.y + r.height / 2 },
      W:  { x: r.x + 24, y: r.y + r.height / 2 },
      NE: { x: r.x + r.width - 24, y: r.y + 24 },
      NW: { x: r.x + 24, y: r.y + 24 },
      SE: { x: r.x + r.width - 24, y: r.y + r.height - 24 },
      SW: { x: r.x + 24, y: r.y + r.height - 24 },
      C:  { x: r.x + r.width / 2, y: r.y + r.height / 2 },
    };
    const c = centers[align];
    return { x: c.x - 9, y: c.y - 9, width: 18, height: 18 };
  }

  it.each(aligns)('parses service @iconalign:%s', (align) => {
    const ir = parse(header(`service a(custom)[A] @iconalign:${align}`));
    expect(ir.services[0]!.iconAlign).toBe(align);
  });

  it.each(aligns)('parses group @iconalign:%s', (align) => {
    const ir = parse(header(`group g(custom)[G] @iconalign:${align}`));
    expect(ir.groups[0]!.iconAlign).toBe(align);
  });

  it.each(aligns)('places service icon for %s', (align) => {
    const scene = serviceIconScene(`@iconalign:${align}`);
    expect(iconRect(scene).bounds).toEqual(expectedIconRect(serviceRect(scene).bounds, align));
  });

  it('keeps omitted service icon alignment at the old fixed top-center position', () => {
    const scene = serviceIconScene();
    const r = serviceRect(scene).bounds;
    expect(iconRect(scene).bounds).toEqual({ x: r.x + r.width / 2 - 9, y: r.y + 24 - 9, width: 18, height: 18 });
  });

  it('@iconalign wins over { iconalign: ... } on services and adjusts the label away from side icons', () => {
    const ir = parse(header('service a(custom)[A] @iconalign:E { iconalign: W }'));
    expect(ir.services[0]!.iconAlign).toBe('E');
    const scene = serviceIconScene('@iconalign:E { iconalign: W }');
    const label = scene.elements.find((el): el is SceneText => el.type === 'text' && el.content === 'A')!;
    expect(label.anchor).toBe('end');
  });

  it('property-block iconalign works on groups and renders the group icon when specified', () => {
    const ir = parse(header('group g(custom)[G] { iconalign: NW }\n  service a(server)[A]'));
    expect(ir.groups[0]!.iconAlign).toBe('NW');
    const scene = layoutArchitecture(ir, defaultTheme).scene;
    const groupIcon = scene.elements.find((el): el is SceneRect =>
      el.type === 'rect' && el.bounds.width === 18 && el.bounds.height === 18,
    );
    expect(groupIcon).toBeDefined();
  });

  it('rejects invalid icon alignment', () => {
    expect(() => parse(header('service a(custom)[A] @iconalign:TOP'))).toThrow();
    expect(() => parse(header('group g(custom)[G] { iconalign: TOP }'))).toThrow();
  });
});

// ── Backward-compatibility: existing example ──────────────────────────────────

describe('existing architecture example', () => {
  const src = `architecture-beta
  group cloud_grp(cloud)[Cloud Services]
    service api(server)[API Server]
    service db(database)[Database]
  service client(internet)[Client]
  service storage(disk)[Storage]
  client:R --> B:api
  api:R --> L:db
  api:B --> T:storage
`;

  it('parses to 1 group, 4 services, 3 edges', () => {
    const ir = parse(src);
    expect(ir.groups).toHaveLength(1);
    expect(ir.services).toHaveLength(4);
    expect(ir.edges).toHaveLength(3);
    expect(ir.junctions).toHaveLength(0);
    expect(ir.aligns).toHaveLength(0);
  });

  it('edge arrowRight is true for --> edges', () => {
    const ir = parse(src);
    for (const e of ir.edges) {
      expect(e.arrowRight).toBe(true);
      expect(e.arrowLeft).toBe(false);
    }
  });

  it('services indented inside group are assigned to that group', () => {
    const ir = parse(src);
    const api = ir.services.find(s => s.id === 'api');
    const db = ir.services.find(s => s.id === 'db');
    expect(api?.group).toBe('cloud_grp');
    expect(db?.group).toBe('cloud_grp');
  });
});
