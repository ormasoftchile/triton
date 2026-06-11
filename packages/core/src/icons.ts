/**
 * @file icons.ts — Built-in icon set for the Timeline Compiler.
 *
 * All icons are original geometric designs on a 24×24 viewBox.
 * Paths use only M, L, A, C, Q, Z commands with deterministic numeric values.
 *
 * Export surface:
 *   - IconDef / IconPathDef: types consumed by layout engines
 *   - getIcon(name):  returns IconDef or undefined (unknown name → undefined)
 *   - hasIcon(name):  boolean existence check
 *
 * Icon names are case-insensitive; aliases are resolved before lookup.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IconPathDef {
  /** SVG path d attribute (absolute commands, 24×24 coordinate space). */
  d: string;
  /**
   * When true, the icon color is used as the `fill`; otherwise fill='none'.
   * Default: false (stroke-only icon).
   */
  fill?: boolean;
  /**
   * When true, the icon color is used as the `stroke`; otherwise no stroke.
   * Default: true (stroked icon).
   */
  stroke?: boolean;
}

export interface IconDef {
  paths: IconPathDef[];
  viewBox: '0 0 24 24';
}

// ---------------------------------------------------------------------------
// Full-circle helper (two 180° arcs — standard SVG circle workaround)
// ---------------------------------------------------------------------------
// Circle at (cx, cy) radius r: M (cx-r) cy A r r 0 1 0 (cx+r) cy A r r 0 1 0 (cx-r) cy
// where "0 1 0" = x-rot=0, large-arc=1, sweep=0 (counterclockwise in screen coords)

// ---------------------------------------------------------------------------
// Icon registry — original geometric designs
// ---------------------------------------------------------------------------

const REGISTRY: Record<string, IconDef> = {

  // ── flag ──────────────────────────────────────────────────────────────────
  // Vertical pole on the left; filled triangular pennant extending right.
  flag: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M 4 2 L 4 21 L 6 21 L 6 17 L 18 11 L 6 5 Z',
        fill: true, stroke: false,
      },
    ],
  },

  // ── star ──────────────────────────────────────────────────────────────────
  // 5-pointed star, outer radius 9, inner radius 4, centred at (12,12).
  star: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M 12 3 L 14.4 8.8 L 20.6 9.2 L 15.8 13.2 L 17.3 19.3 L 12 16 L 6.7 19.3 L 8.2 13.2 L 3.4 9.2 L 9.6 8.8 Z',
        fill: true, stroke: false,
      },
    ],
  },

  // ── check (check-circle) ──────────────────────────────────────────────────
  // Clean checkmark (no surrounding circle — the node shape provides the border).
  check: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M 4 12 L 9.5 17.5 L 20 7',
        fill: false, stroke: true,
      },
    ],
  },

  // ── x (cancel / close) ───────────────────────────────────────────────────
  x: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M 5 5 L 19 19 M 5 19 L 19 5',
        fill: false, stroke: true,
      },
    ],
  },

  // ── warning (alert triangle) ──────────────────────────────────────────────
  // Equilateral triangle outline + vertical exclamation-mark body.
  warning: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M 12 3 L 22 21 L 2 21 Z M 12 9 L 12 15',
        fill: false, stroke: true,
      },
    ],
  },

  // ── rocket (launch) ───────────────────────────────────────────────────────
  // Rocket body (tapered nose + cylindrical hull) + two swept fins, filled.
  rocket: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M 12 2 L 16 11 L 15 11 L 15 18 L 9 18 L 9 11 L 8 11 Z M 9 18 L 6 22 L 9 16 Z M 15 18 L 18 22 L 15 16 Z',
        fill: true, stroke: false,
      },
    ],
  },

  // ── target (goal / bullseye) ──────────────────────────────────────────────
  // Three concentric rings, stroke only.
  target: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M 3 12 A 9 9 0 1 0 21 12 A 9 9 0 1 0 3 12 M 7 12 A 5 5 0 1 0 17 12 A 5 5 0 1 0 7 12 M 10 12 A 2 2 0 1 0 14 12 A 2 2 0 1 0 10 12',
        fill: false, stroke: true,
      },
    ],
  },

  // ── calendar ──────────────────────────────────────────────────────────────
  // Rectangle + top bar + binding pins + day-cell marks.
  calendar: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M 2 5 L 2 22 L 22 22 L 22 5 Z M 2 10 L 22 10 M 8 2 L 8 7 M 16 2 L 16 7 M 6 14 L 9 14 M 13 14 L 16 14 M 6 18 L 9 18 M 13 18 L 16 18',
        fill: false, stroke: true,
      },
    ],
  },

  // ── clock ─────────────────────────────────────────────────────────────────
  // Circular outline + hour hand (12 o'clock) + minute hand (pointing ~2).
  clock: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M 2 12 A 10 10 0 1 0 22 12 A 10 10 0 1 0 2 12 M 12 7 L 12 12 L 17 14',
        fill: false, stroke: true,
      },
    ],
  },

  // ── gear (settings) ───────────────────────────────────────────────────────
  // Small centre circle + 8 radial cog teeth.
  gear: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M 8 12 A 4 4 0 1 0 16 12 A 4 4 0 1 0 8 12 M 22 12 L 20 12 M 19.1 4.9 L 17.7 6.3 M 12 2 L 12 4 M 4.9 4.9 L 6.3 6.3 M 2 12 L 4 12 M 4.9 19.1 L 6.3 17.7 M 12 22 L 12 20 M 19.1 19.1 L 17.7 17.7',
        fill: false, stroke: true,
      },
    ],
  },

  // ── lock (security) ───────────────────────────────────────────────────────
  // Padlock: shackle arc + rectangular body + small keyhole circle.
  lock: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M 8 11 L 8 8 A 4 4 0 0 1 16 8 L 16 11 M 4 11 L 4 22 L 20 22 L 20 11 Z M 10 15 A 2 2 0 1 0 14 15 A 2 2 0 1 0 10 15',
        fill: false, stroke: true,
      },
    ],
  },

  // ── cloud ─────────────────────────────────────────────────────────────────
  // Smooth cloud outline built with three arc bumps + curved base.
  cloud: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M 6 19 L 18 19 A 4 4 0 0 0 18 12 A 5 5 0 0 0 11 8 A 4 4 0 0 0 4 12 A 4 4 0 0 0 6 19 Z',
        fill: false, stroke: true,
      },
    ],
  },

  // ── database (data) ───────────────────────────────────────────────────────
  // Cylinder: elliptical top + vertical sides + bottom rim + mid-divider.
  database: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M 4 7 A 8 2.5 0 0 1 20 7 A 8 2.5 0 0 1 4 7 L 4 17 A 8 2.5 0 0 0 20 17 L 20 7 M 4 12 A 8 2.5 0 0 1 20 12',
        fill: false, stroke: true,
      },
    ],
  },

  // ── code ─────────────────────────────────────────────────────────────────
  // The classic < / > code bracket symbol.
  code: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M 9 7 L 3 12 L 9 17 M 15 7 L 21 12 L 15 17 M 13 5 L 11 19',
        fill: false, stroke: true,
      },
    ],
  },

  // ── milestone (diamond) ───────────────────────────────────────────────────
  // Simple axis-aligned diamond, filled.
  milestone: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M 12 2 L 22 12 L 12 22 L 2 12 Z',
        fill: true, stroke: false,
      },
    ],
  },

  // ── play ─────────────────────────────────────────────────────────────────
  // Right-pointing filled triangle — universally understood as "start/play".
  play: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M 5 3 L 21 12 L 5 21 Z',
        fill: true, stroke: false,
      },
    ],
  },

  // ── bolt (zap / lightning) ────────────────────────────────────────────────
  // Lightning-bolt polygon, filled.
  bolt: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M 14 2 L 6 13 L 12 13 L 10 22 L 18 11 L 12 11 Z',
        fill: true, stroke: false,
      },
    ],
  },

  // ── people (team) ─────────────────────────────────────────────────────────
  // Two overlapping figure outlines — one larger foreground, one smaller background.
  people: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M 4 7 A 3 3 0 1 0 10 7 A 3 3 0 1 0 4 7 M 1 22 A 6 6 0 0 1 13 22 M 14.5 8 A 2.5 2.5 0 1 0 19.5 8 A 2.5 2.5 0 1 0 14.5 8 M 14 22 A 5 5 0 0 1 22 22',
        fill: false, stroke: true,
      },
    ],
  },

  // ── doc (file / document) ─────────────────────────────────────────────────
  // Document outline with folded top-right corner and horizontal rule lines.
  doc: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M 4 2 L 15 2 L 20 7 L 20 22 L 4 22 Z M 15 2 L 15 7 L 20 7 M 7 11 L 17 11 M 7 15 L 17 15 M 7 19 L 13 19',
        fill: false, stroke: true,
      },
    ],
  },

  // ── pin (location) ────────────────────────────────────────────────────────
  // Map-pin teardrop: curved top arc + bezier sides converging to a point, with an inner hole.
  pin: {
    viewBox: '0 0 24 24',
    paths: [
      {
        d: 'M 6 9 A 6 6 0 0 1 18 9 C 18 15 12 22 12 22 C 12 22 6 15 6 9 Z M 10 9 A 2 2 0 1 0 14 9 A 2 2 0 1 0 10 9',
        fill: false, stroke: true,
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Alias table  (canonical → canonical name; all lowercase)
// ---------------------------------------------------------------------------

const ALIASES: Record<string, string> = {
  'check-circle': 'check',
  'tick':         'check',
  'cancel':       'x',
  'close':        'x',
  'cross':        'x',
  'alert':        'warning',
  'triangle':     'warning',
  'launch':       'rocket',
  'goal':         'target',
  'bullseye':     'target',
  'settings':     'gear',
  'cog':          'gear',
  'security':     'lock',
  'padlock':      'lock',
  'data':         'database',
  'storage':      'database',
  'zap':          'bolt',
  'lightning':    'bolt',
  'team':         'people',
  'users':        'people',
  'person':       'people',
  'file':         'doc',
  'document':     'doc',
  'location':     'pin',
  'marker':       'pin',
  'diamond':      'milestone',
  'start':        'play',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve `name` (case-insensitive, alias-aware) to an IconDef.
 * Returns `undefined` for unknown names — callers must fall back gracefully.
 */
export function getIcon(name: string): IconDef | undefined {
  const key = name.toLowerCase().trim();
  const resolved = ALIASES[key] ?? key;
  return REGISTRY[resolved];
}

/** Returns `true` if `name` maps to a known icon. */
export function hasIcon(name: string): boolean {
  return getIcon(name) !== undefined;
}

/** Returns a sorted, deduplicated list of all canonical icon names. */
export function listIcons(): string[] {
  return Object.keys(REGISTRY).sort();
}
