/**
 * Contract conformance tests.
 *
 * These tests have no runtime behaviour — they exist purely to assert
 * type-level design invariants. Every `it()` block either:
 *
 *   - Uses `satisfies` to prove a well-formed object IS accepted, or
 *   - Uses `@ts-expect-error` to prove a malformed object IS rejected.
 *
 * If a `@ts-expect-error` comment becomes unnecessary (i.e. TypeScript no
 * longer reports an error on the line below it), tsc will fail with
 * "Unused '@ts-expect-error' directive" — meaning the contract was loosened
 * unintentionally.
 *
 * Run with: npx vitest run
 */

import { describe, it, expect } from 'vitest';
import type {
  Point,
  Rect,
  Scene,
  SceneElement,
  ResolvedTheme,
  ThemeInput,
  Router,
  RouteRequest,
  Route,
  RawOverlay,
  CompiledOverlays,
  DiagramParser,
  DiagramLayoutEngine,
  DiagramModule,
  BaseIR,
  Result,
  DiagramError,
  Renderer,
} from '../src/contracts/index.js';
import { ok, err } from '../src/contracts/index.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
// Minimal valid values used across multiple assertions.

type FakeIR = {
  readonly version: string;
  readonly metadata: Record<string, unknown>;
  readonly nodes: string[];
};

const aPoint: Point = { x: 0, y: 0 };
const aRect: Rect = { x: 0, y: 0, width: 100, height: 100 };

const aScene: Scene = {
  viewBox: aRect,
  elements: [],
};

const aTheme = {
  name: 'test',
  palette: {
    primary: '#000', secondary: '#111', background: '#fff',
    surface: '#eee', border: '#ccc', text: '#000', textMuted: '#666',
    success: '#0f0', warning: '#ff0', error: '#f00',
  },
  typography: {
    fontFamily: 'sans-serif', monoFamily: 'monospace',
    baseFontSize: 14, titleFontSize: 18, smallFontSize: 11, lineHeight: 1.4,
  },
  spacing: { unit: 8, nodePadding: 12, nodeGap: 40, diagramMargin: 24 },
  edges: { strokeWidth: 1.5, arrowSize: 8, labelFontSize: 12, curveTension: 0.4 },
} satisfies ResolvedTheme;

// ─── Primitives ───────────────────────────────────────────────────────────────

describe('Rect extends Point', () => {
  it('a Rect is assignable to a Point', () => {
    const _: Point = aRect;
  });
});

// ─── Scene ────────────────────────────────────────────────────────────────────

describe('Scene', () => {
  it('accepts a minimal scene with no elements', () => {
    const _: Scene = { viewBox: aRect, elements: [] } satisfies Scene;
  });

  it('accepts all SceneElement variants', () => {
    const elements: SceneElement[] = [
      { type: 'rect', bounds: aRect, fill: '#fff', stroke: '#000', strokeWidth: 1 },
      { type: 'circle', center: aPoint, radius: 10, fill: '#fff', stroke: '#000', strokeWidth: 1 },
      { type: 'path', d: 'M 0 0 L 10 10', stroke: '#000', strokeWidth: 1 },
      { type: 'text', content: 'hi', position: aPoint, fontSize: 14, fontFamily: 'sans-serif', fill: '#000' },
      { type: 'group', children: [] },
    ];
    const _: Scene = { viewBox: aRect, elements } satisfies Scene;
  });

  it('elements array is readonly — push is not allowed', () => {
    const scene: Scene = aScene;
    // @ts-expect-error — Scene.elements is readonly, push does not exist
    scene.elements.push({ type: 'group', children: [] });
  });

  it('viewBox is readonly — fields cannot be reassigned', () => {
    const scene: Scene = aScene;
    // @ts-expect-error — Rect fields are readonly
    scene.viewBox.x = 99;
  });
});

// ─── Theme ────────────────────────────────────────────────────────────────────

describe('ResolvedTheme', () => {
  it('requires all fields — omitting one is a type error', () => {
    // @ts-expect-error — missing edges
    const _: ResolvedTheme = {
      name: 'broken',
      palette: aTheme.palette,
      typography: aTheme.typography,
      spacing: aTheme.spacing,
    };
  });
});

describe('ThemeInput', () => {
  it('accepts an empty object — every field is optional', () => {
    const _: ThemeInput = {} satisfies ThemeInput;
  });

  it('accepts a partial palette override', () => {
    const _: ThemeInput = { palette: { primary: '#ff0000' } } satisfies ThemeInput;
  });
});

// ─── Routing ──────────────────────────────────────────────────────────────────

describe('Router', () => {
  it('a valid router implementation satisfies the interface', () => {
    const _: Router = {
      route(_req: RouteRequest): Route {
        return {
          points: [],
          path: 'M 0 0',
          labelPosition: aPoint,
        };
      },
    } satisfies Router;
  });

  it('a plain function does not satisfy Router', () => {
    // @ts-expect-error — Router is an interface with a route() method, not a bare function
    const _: Router = (_req: RouteRequest): Route => ({
      points: [],
      path: 'M 0 0',
      labelPosition: aPoint,
    });
  });
});

// ─── Overlay ──────────────────────────────────────────────────────────────────

describe('RawOverlay', () => {
  it('RawNote satisfies RawOverlay', () => {
    const _: RawOverlay = { type: 'note', text: 'hello', target: 'nodeA' } satisfies RawOverlay;
  });

  it('RawLegend satisfies RawOverlay', () => {
    const _: RawOverlay = {
      type: 'legend', corner: 'bottom-right', entries: [{ key: 'version', value: '1.0' }],
    } satisfies RawOverlay;
  });

  it('unknown type does not satisfy RawOverlay', () => {
    // @ts-expect-error — 'badge' is not a valid RawOverlay type discriminant
    const _: RawOverlay = { type: 'badge', text: 'hello' };
  });
});

describe('CompiledOverlays', () => {
  it('accepts annotations-only (legend is optional)', () => {
    const _: CompiledOverlays = { annotations: [] } satisfies CompiledOverlays;
  });
});

// ─── Diagram Module Segregation ───────────────────────────────────────────────

describe('DiagramParser / DiagramLayoutEngine segregation', () => {
  it('a full implementation satisfies DiagramModule', () => {
    const _: DiagramModule<FakeIR> = {
      parseMermaid: (_input: string): FakeIR => ({ version: '1.0', metadata: {}, nodes: [] }),
      parseYaml: (_input: string): FakeIR => ({ version: '1.0', metadata: {}, nodes: [] }),
      layout: async (_ir: FakeIR, _theme: ResolvedTheme): Promise<Scene> => aScene,
    } satisfies DiagramModule<FakeIR>;
  });

  it('DiagramModule is assignable to DiagramParser', () => {
    const full: DiagramModule<FakeIR> = {
      parseMermaid: () => ({ version: '1.0', metadata: {}, nodes: [] }),
      parseYaml: () => ({ version: '1.0', metadata: {}, nodes: [] }),
      layout: async () => aScene,
    };
    const _parser: DiagramParser<FakeIR> = full;
  });

  it('DiagramModule is assignable to DiagramLayoutEngine', () => {
    const full: DiagramModule<FakeIR> = {
      parseMermaid: () => ({ version: '1.0', metadata: {}, nodes: [] }),
      parseYaml: () => ({ version: '1.0', metadata: {}, nodes: [] }),
      layout: async () => aScene,
    };
    const _engine: DiagramLayoutEngine<FakeIR> = full;
  });

  it('DiagramParser alone does not satisfy DiagramModule — missing layout()', () => {
    // @ts-expect-error — missing layout()
    const _: DiagramModule<FakeIR> = {
      parseMermaid: () => ({ version: '1.0', metadata: {}, nodes: [] }),
      parseYaml: () => ({ version: '1.0', metadata: {}, nodes: [] }),
    };
  });

  it('DiagramLayoutEngine alone does not satisfy DiagramModule — missing parse methods', () => {
    // @ts-expect-error — missing parseMermaid() and parseYaml()
    const _: DiagramModule<FakeIR> = {
      layout: async () => aScene,
    };
  });

  it('layout() must return Promise<Scene>, not a plain object', () => {
    // @ts-expect-error — return type missing required Scene fields
    const _: DiagramModule<FakeIR> = {
      parseMermaid: () => ({ version: '1.0', metadata: {}, nodes: [] }),
      parseYaml: () => ({ version: '1.0', metadata: {}, nodes: [] }),
      layout: async () => ({ width: 100, height: 100 }),
    };
  });

  it('DiagramModule accepts optional defaultThemeOverride', () => {
    const _: DiagramModule<FakeIR> = {
      parseMermaid: () => ({ version: '1.0', metadata: {}, nodes: [] }),
      parseYaml: () => ({ version: '1.0', metadata: {}, nodes: [] }),
      layout: async () => aScene,
      defaultThemeOverride: { palette: { primary: '#ff0' } },
    } satisfies DiagramModule<FakeIR>;
  });
});

// ─── BaseIR ───────────────────────────────────────────────────────────────────

describe('BaseIR', () => {
  it('satisfies minimum required shape', () => {
    const _: BaseIR = {
      version: '1.0',
      metadata: { title: 'Test' },
    } satisfies BaseIR;
  });

  it('accepts optional overlays and themeOverride', () => {
    const _: BaseIR = {
      version: '1.0',
      metadata: {},
      overlays: [{ type: 'note', text: 'hi', target: 'a' }],
      themeOverride: { palette: { primary: '#f00' } },
    } satisfies BaseIR;
  });

  it('FakeIR extends BaseIR — a FakeIR is assignable to BaseIR', () => {
    const fake: FakeIR = { version: '1.0', metadata: {}, nodes: ['a'] };
    const _: BaseIR = fake;
  });

  it('missing version does not satisfy BaseIR', () => {
    // @ts-expect-error — missing version
    const _: BaseIR = { metadata: {} };
  });
});

// ─── Result ───────────────────────────────────────────────────────────────────

describe('Result<T>', () => {
  it('ok() produces a success result', () => {
    const r: Result<number> = ok(42);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(42);
  });

  it('err() produces a failure result', () => {
    const r: Result<never> = err('PARSE_ERROR', 'bad input');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('PARSE_ERROR');
      expect(r.error.message).toBe('bad input');
    }
  });

  it('err() with cause preserves it', () => {
    const cause = new Error('original');
    const r = err('LAYOUT_ERROR', 'layout failed', cause);
    if (!r.ok) expect(r.error.cause).toBe(cause);
  });

  it('err() without cause omits the field (exactOptionalPropertyTypes)', () => {
    const r = err('PARSE_ERROR', 'oops');
    if (!r.ok) expect('cause' in r.error).toBe(false);
  });

  it('ok result has no error field', () => {
    const r = ok('hello');
    // @ts-expect-error — ok result does not have .error
    const _: DiagramError = r.error;
  });

  it('success result is narrowable', () => {
    const r: Result<string> = ok('svg output');
    if (r.ok) {
      // TypeScript narrows to { ok: true; value: string } here
      const _: string = r.value;
    }
  });
});

// ─── Renderer ─────────────────────────────────────────────────────────────────

describe('Renderer<Output>', () => {
  it('a valid Renderer<string> satisfies the interface', () => {
    const _: Renderer<string> = {
      name: 'svg',
      render: (_scene: Scene): string => '<svg/>',
    } satisfies Renderer<string>;
  });

  it('Renderer<Buffer> is a valid specialisation', () => {
    const _: Renderer<Buffer> = {
      name: 'png',
      render: (_scene: Scene): Buffer => Buffer.alloc(0),
    } satisfies Renderer<Buffer>;
  });

  it('missing name does not satisfy Renderer', () => {
    // @ts-expect-error — missing name
    const _: Renderer<string> = { render: () => '' };
  });

  it('missing render() does not satisfy Renderer', () => {
    // @ts-expect-error — missing render()
    const _: Renderer<string> = { name: 'broken' };
  });
});
