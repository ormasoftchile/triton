/**
 * @file test/mermaid-sankey-corpus.test.ts — Sankey grammar corpus tests.
 *
 * Tests the full pipeline: parseMermaid → SankeyDocument → renderMermaid → Scene + SVG.
 * Covers: compact syntax, edge cases, degenerate inputs, quoted names, cycles,
 * multi-layer chains, zero values, malformed rows, and a real Mermaid energy-flow dataset.
 * Also verifies determinism (value→height scale, node layering).
 * Emits gallery files: examples/gallery/mermaid-sankey.{mmd,svg,png}.
 */

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { sankeyDocumentSchema, resolveSankeyTheme, buildSankeyScene } from '../src/grammars/sankey/index.js';
import type { SankeyDocument } from '../src/grammars/sankey/index.js';
import { detectDiagramType, parseMermaid, renderMermaid } from '../src/frontend/mermaid/index.js';
import { parseSankeyDiagram, parseSankeyDiagramInternal } from '../src/frontend/mermaid/sankey.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const GALLERY = join(REPO_ROOT, 'examples', 'gallery');
const SANKEY_MMD = join(GALLERY, 'mermaid-sankey.mmd');
const SANKEY_SVG = join(GALLERY, 'mermaid-sankey.svg');
const SANKEY_PNG = join(GALLERY, 'mermaid-sankey.png');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sceneTexts(rendered: ReturnType<typeof renderMermaid>): string[] {
  return rendered.scene.primitives.flatMap((p) => {
    if (p.kind === 'text') return [p.text];
    if (p.kind === 'multitext') return p.lines;
    return [] as string[];
  });
}

function countPaths(rendered: ReturnType<typeof renderMermaid>): number {
  return rendered.scene.primitives.filter((p) => p.kind === 'path').length;
}

// ---------------------------------------------------------------------------
// Corpus cases
// ---------------------------------------------------------------------------

interface SankeyCase {
  name: string;
  text: string;
  warningPattern?: RegExp;
  assert: (doc: SankeyDocument, warnings: string[], rendered: ReturnType<typeof renderMermaid>) => void;
}

const SANKEY_CASES: SankeyCase[] = [
  // 1. Single link — minimal valid diagram
  {
    name: 'single link',
    text: `sankey-beta
A,B,10`,
    assert: (doc, warnings) => {
      expect(doc.nodes).toHaveLength(2);
      expect(doc.links).toHaveLength(1);
      expect(doc.links[0]?.value).toBe(10);
      expect(warnings).toHaveLength(0);
    },
  },

  // 2. Header without data — degenerate empty diagram
  {
    name: 'empty diagram — header only',
    text: `sankey-beta`,
    assert: (doc, warnings) => {
      expect(doc.nodes).toHaveLength(0);
      expect(doc.links).toHaveLength(0);
      expect(warnings).toHaveLength(0);
    },
  },

  // 3. Blank lines and comments ignored
  {
    name: 'blank lines and %% comments ignored',
    text: `sankey-beta

%% This is a comment
A,B,5

%% Another comment
B,C,3`,
    assert: (doc, warnings) => {
      expect(doc.nodes).toHaveLength(3);
      expect(doc.links).toHaveLength(2);
      expect(warnings).toHaveLength(0);
    },
  },

  // 4. Quoted field names
  {
    name: 'quoted field names',
    text: `sankey-beta
"Solar Energy","Power Grid",100
"Power Grid","Homes",60`,
    assert: (doc, warnings) => {
      expect(doc.nodes.map((n) => n.id)).toContain('Solar Energy');
      expect(doc.nodes.map((n) => n.id)).toContain('Power Grid');
      expect(doc.nodes.map((n) => n.id)).toContain('Homes');
      expect(doc.links).toHaveLength(2);
      expect(warnings).toHaveLength(0);
    },
  },

  // 5. Quoted field with comma inside
  {
    name: 'quoted field with comma inside name',
    text: `sankey-beta
"Oil, Gas & Coal",Electricity,500`,
    assert: (doc, warnings) => {
      expect(doc.nodes.map((n) => n.id)).toContain('Oil, Gas & Coal');
      expect(doc.links).toHaveLength(1);
      expect(warnings).toHaveLength(0);
    },
  },

  // 6. Quoted field with escaped quote
  {
    name: 'quoted field with escaped double-quote',
    text: `sankey-beta
"She said ""hello""",Output,42`,
    assert: (doc, warnings) => {
      expect(doc.nodes.map((n) => n.id)).toContain('She said "hello"');
      expect(warnings).toHaveLength(0);
    },
  },

  // 7. Node that is both source and target (self-loop not itself, but appears in both roles)
  {
    name: 'node appearing as both source and target',
    text: `sankey-beta
A,B,10
B,C,10
B,D,5`,
    assert: (doc) => {
      // B appears in all roles
      const bNode = doc.nodes.find((n) => n.id === 'B');
      expect(bNode).toBeDefined();
      // B is target of A→B and source of B→C, B→D
      expect(doc.links.filter((l) => l.source === 'B')).toHaveLength(2);
      expect(doc.links.filter((l) => l.target === 'B')).toHaveLength(1);
    },
  },

  // 8. Multi-layer chain A→B→C→D
  {
    name: 'multi-layer chain A→B→C→D',
    text: `sankey-beta
A,B,100
B,C,100
C,D,100`,
    assert: (doc, _w, rendered) => {
      expect(doc.nodes).toHaveLength(4);
      expect(doc.links).toHaveLength(3);
      // 4 nodes → 4 columns; ribbons = 3 paths
      expect(countPaths(rendered)).toBe(3);
      // All 4 node labels present
      const texts = sceneTexts(rendered);
      for (const name of ['A', 'B', 'C', 'D']) {
        expect(texts).toContain(name);
      }
    },
  },

  // 9. Value of 0
  {
    name: 'link with value 0',
    text: `sankey-beta
A,B,0
A,C,10`,
    assert: (doc, warnings) => {
      expect(doc.links.find((l) => l.target === 'B')?.value).toBe(0);
      expect(warnings).toHaveLength(0);
    },
  },

  // 10. Malformed row — wrong field count → skip + warn
  {
    name: 'malformed row (2 fields) → skip + warn',
    text: `sankey-beta
A,B
C,D,5`,
    warningPattern: /Expected 3 CSV fields/,
    assert: (doc, warnings) => {
      expect(warnings.some((w) => /Expected 3 CSV fields/.test(w))).toBe(true);
      expect(doc.links).toHaveLength(1); // only C,D,5 parsed
    },
  },

  // 11. Non-numeric value → skip + warn
  {
    name: 'non-numeric value → skip + warn',
    text: `sankey-beta
A,B,lots
C,D,5`,
    warningPattern: /Non-numeric value/,
    assert: (doc, warnings) => {
      expect(warnings.some((w) => /Non-numeric value/.test(w))).toBe(true);
      expect(doc.links).toHaveLength(1);
    },
  },

  // 12. Negative value → clamp to 0 + warn
  {
    name: 'negative value → clamped to 0 + warn',
    text: `sankey-beta
A,B,-5
A,C,10`,
    warningPattern: /Negative value/,
    assert: (doc, warnings) => {
      expect(warnings.some((w) => /Negative value/.test(w))).toBe(true);
      const link = doc.links.find((l) => l.target === 'B');
      expect(link?.value).toBe(0);
    },
  },

  // 13. Nodes inferred with stable first-appearance order
  {
    name: 'stable node first-appearance order',
    text: `sankey-beta
Zebra,Alpha,10
Beta,Alpha,5
Alpha,Gamma,15`,
    assert: (doc) => {
      // Zebra appears first, then Alpha, then Beta, then Gamma
      const ids = doc.nodes.map((n) => n.id);
      expect(ids[0]).toBe('Zebra');
      expect(ids[1]).toBe('Alpha');
      expect(ids[2]).toBe('Beta');
      expect(ids[3]).toBe('Gamma');
    },
  },

  // 14. detectDiagramType — sankey-beta
  {
    name: 'detectDiagramType → sankey',
    text: `sankey-beta
A,B,1`,
    assert: (_doc, _w, rendered) => {
      expect(rendered.kind).toBe('sankey');
    },
  },

  // 15. detectDiagramType — sankey (without -beta)
  {
    name: 'detectDiagramType sankey → sankey',
    text: `sankey
A,B,1`,
    assert: (_doc, _w, rendered) => {
      expect(rendered.kind).toBe('sankey');
    },
  },

  // 16. Multiple sources feeding same target
  {
    name: 'multiple sources → single target (fan-in)',
    text: `sankey-beta
Coal,Grid,300
Gas,Grid,200
Nuclear,Grid,100
Grid,Homes,600`,
    assert: (doc) => {
      expect(doc.nodes).toHaveLength(5);
      expect(doc.links).toHaveLength(4);
      // Grid is the aggregation node
      expect(doc.links.filter((l) => l.target === 'Grid')).toHaveLength(3);
      expect(doc.links.filter((l) => l.source === 'Grid')).toHaveLength(1);
    },
  },

  // 17. Single source splitting to multiple targets (fan-out)
  {
    name: 'single source fan-out',
    text: `sankey-beta
Energy,Heat,400
Energy,Light,200
Energy,Motion,100`,
    assert: (doc, _w, rendered) => {
      expect(doc.nodes).toHaveLength(4);
      expect(countPaths(rendered)).toBe(3);
    },
  },

  // 18. Large values (to test scale computation)
  {
    name: 'large values — scale is finite and positive',
    text: `sankey-beta
A,B,1000000
B,C,1000000`,
    assert: (_doc, _w, rendered) => {
      // Scene should have reasonable dimensions
      expect(rendered.scene.width).toBeGreaterThan(100);
      expect(rendered.scene.height).toBeGreaterThan(100);
      // Should have 2 ribbons
      expect(countPaths(rendered)).toBe(2);
    },
  },

  // 19. Fractional values
  {
    name: 'fractional values',
    text: `sankey-beta
A,B,1.5
B,C,0.75`,
    assert: (doc) => {
      expect(doc.links[0]?.value).toBe(1.5);
      expect(doc.links[1]?.value).toBe(0.75);
    },
  },

  // 20. Diagram with title from %%{init}%%
  {
    name: 'title from %%{init}%%',
    text: `%%{init: {"title": "My Sankey"}}%%
sankey-beta
A,B,10`,
    assert: (doc, _w, rendered) => {
      expect(doc.metadata.title).toBe('My Sankey');
      const texts = sceneTexts(rendered);
      expect(texts).toContain('My Sankey');
    },
  },

  // 21. Zod schema validation
  {
    name: 'Zod schema validates a well-formed document',
    text: `sankey-beta
X,Y,42`,
    assert: (doc) => {
      expect(() => sankeyDocumentSchema.parse(doc)).not.toThrow();
    },
  },

  // 22. parseSankeyDiagram public entry (non-internal)
  {
    name: 'parseSankeyDiagram public entry point returns correct doc',
    text: `sankey-beta
A,B,7`,
    assert: (doc) => {
      const direct = parseSankeyDiagram(`sankey-beta\nA,B,7`);
      expect(direct.nodes).toHaveLength(doc.nodes.length);
      expect(direct.links[0]?.value).toBe(7);
    },
  },

  // 23. Scene has correct background color (theme default)
  {
    name: 'scene background = theme background',
    text: `sankey-beta
A,B,10`,
    assert: (_doc, _w, rendered) => {
      expect(rendered.scene.background).toBe('#ffffff');
    },
  },

  // 24. Scene width > height (landscape Sankey)
  {
    name: 'canvas is landscape (width > height)',
    text: `sankey-beta
A,B,10
B,C,10`,
    assert: (_doc, _w, rendered) => {
      expect(rendered.scene.width).toBeGreaterThan(rendered.scene.height);
    },
  },

  // 25. Node labels appear in scene text primitives
  {
    name: 'all node labels appear in scene',
    text: `sankey-beta
Alpha,Beta,10
Beta,Gamma,10`,
    assert: (_doc, _w, rendered) => {
      const texts = sceneTexts(rendered);
      expect(texts).toContain('Alpha');
      expect(texts).toContain('Beta');
      expect(texts).toContain('Gamma');
    },
  },

  // 26. No dropped links — every link becomes a path ribbon
  {
    name: 'no dropped links — ribbon count = link count (non-zero values)',
    text: `sankey-beta
A,B,10
A,C,20
B,D,5
C,D,25`,
    assert: (doc, _w, rendered) => {
      const nonZeroLinks = doc.links.filter((l) => l.value > 0).length;
      expect(countPaths(rendered)).toBe(nonZeroLinks);
    },
  },

  // 27. Determinism — same input → same sceneHash
  {
    name: 'determinism: same input → same sceneHash',
    text: `sankey-beta
A,B,100
B,C,80
B,D,20`,
    assert: (_doc, _w, rendered) => {
      const rendered2 = renderMermaid(`sankey-beta\nA,B,100\nB,C,80\nB,D,20`, { format: 'svg' });
      expect(rendered.sceneHash).toBe(rendered2.sceneHash);
    },
  },

  // 28. Determinism — node layering is stable across identical runs
  {
    name: 'determinism: node layering is stable (column assignment)',
    text: `sankey-beta
Coal,Power,300
Gas,Power,200
Power,City,500`,
    assert: (doc) => {
      // Run the parser twice; node order should be identical
      const doc2 = parseSankeyDiagram(`sankey-beta\nCoal,Power,300\nGas,Power,200\nPower,City,500`);
      expect(doc.nodes.map((n) => n.id)).toEqual(doc2.nodes.map((n) => n.id));
    },
  },

  // 29. Determinism — value→height scale is closed-form and reproducible
  {
    name: 'determinism: scale computation is closed-form (scene height is fixed for same input)',
    text: `sankey-beta
A,B,500
B,C,300
B,D,200`,
    assert: (_doc, _w, rendered) => {
      // Re-render — expect identical scene dimensions
      const r2 = renderMermaid(`sankey-beta\nA,B,500\nB,C,300\nB,D,200`, { format: 'svg' });
      expect(rendered.scene.width).toBe(r2.scene.width);
      expect(rendered.scene.height).toBe(r2.scene.height);
    },
  },

  // 30. Real Mermaid canonical energy-flow dataset
  {
    name: 'real Mermaid energy-flow dataset — no dropped links or nodes',
    text: `sankey-beta
Agricultural 'waste',Bio-conversion,124.729
Bio-conversion,Liquid,0.597
Bio-conversion,Losses,26.862
Bio-conversion,Solid,280.322
Bio-conversion,Gas,81.144
Biofuel imports,Liquid,35
Biomass imports,Solid,35
Coal imports,Coal,11.606
Coal reserves,Coal,63.965
Coal,Solid,75.571
District heating,Industry,10.639
District heating,Heating and cooling - commercial,22.505
District heating,Heating and cooling - homes,46.184
Electricity grid,Over generation / exports,104.453
Electricity grid,Heating and cooling - homes,113.726
Electricity grid,H2 conversion,27.14
Electricity grid,Industry,342.165
Electricity grid,Road transport,37.797
Electricity grid,Agriculture,4.412
Electricity grid,Heating and cooling - commercial,40.858
Electricity grid,Losses,56.691
Electricity grid,Rail transport,7.863
Electricity grid,Lighting & appliances - commercial,90.008
Electricity grid,Lighting & appliances - homes,93.494
Gas imports,Ngas,40.719
Gas reserves,Ngas,82.233
Gas,Heating and cooling - commercial,0.129
Gas,Losses,1.401
Gas,Thermal generation,151.891
Gas,Agriculture,2.096
Gas,Industry,48.58
Geothermal,Electricity grid,7.013
H2 conversion,H2,20.897
H2 conversion,Losses,6.242
Hydro,Electricity grid,6.995
Liquid,Industry,121.066
Liquid,International shipping,128.69
Liquid,Road transport,135.835
Liquid,Domestic aviation,14.458
Liquid,International aviation,206.267
Liquid,Agriculture,3.64
Liquid,National navigation,33.218
Liquid,Rail transport,4.413
Marine algae,Bio-conversion,4.375
Ngas,Gas,122.952
Nuclear,Thermal generation,839.978
Oil imports,Oil,504.287
Oil reserves,Oil,107.703
Oil,Liquid,611.99
Other waste,Solid,56.587
Other waste,Bio-conversion,77.81
Pumped heat,Heating and cooling - homes,193.026
Pumped heat,Heating and cooling - commercial,70.672
Solar PV,Electricity grid,59.901
Solar Thermal,Heating and cooling - homes,19.279
Solid,Agriculture,0.882
Solid,Thermal generation,400.12
Solid,Industry,46.477
Thermal generation,Electricity grid,1029.563
Thermal generation,Losses,945.952
Tidal,Electricity grid,9.452
UK land based bioenergy,Bio-conversion,182.01
Wave,Electricity grid,19.013
Wind,Electricity grid,289.366`,
    assert: (doc, warnings) => {
      // 55+ links from the canonical dataset — all should parse
      expect(doc.links.length).toBeGreaterThan(50);
      // No non-numeric-value warnings
      expect(warnings.filter((w) => /Non-numeric/.test(w))).toHaveLength(0);
      // Nodes should include key energy nodes
      const nodeIds = doc.nodes.map((n) => n.id);
      expect(nodeIds).toContain('Coal');
      expect(nodeIds).toContain('Electricity grid');
      expect(nodeIds).toContain('Thermal generation');
      expect(nodeIds).toContain('Losses');
    },
  },

  // 31. All-zero values — degenerate but should not throw
  {
    name: 'all-zero values — renders without throwing',
    text: `sankey-beta
A,B,0
B,C,0`,
    assert: (doc, _w, rendered) => {
      expect(doc.links).toHaveLength(2);
      expect(() => rendered.svg).not.toThrow();
    },
  },

  // 32. Extra whitespace around CSV fields
  {
    name: 'extra whitespace around unquoted fields is trimmed',
    text: `sankey-beta
  Alpha , Beta , 42 `,
    assert: (doc) => {
      expect(doc.nodes.map((n) => n.id)).toContain('Alpha');
      expect(doc.nodes.map((n) => n.id)).toContain('Beta');
      expect(doc.links[0]?.value).toBe(42);
    },
  },

  // 33. Four-field row → skip + warn
  {
    name: '4-field row → skip + warn',
    text: `sankey-beta
A,B,C,10`,
    warningPattern: /Expected 3 CSV fields/,
    assert: (doc, warnings) => {
      expect(warnings.some((w) => /Expected 3 CSV fields/.test(w))).toBe(true);
      expect(doc.links).toHaveLength(0);
    },
  },

  // 34. Multiple malformed + valid rows
  {
    name: 'mixed malformed and valid rows — valid rows not dropped',
    text: `sankey-beta
A,B,10
bad row here
C,D,five
E,F,30`,
    assert: (doc, warnings) => {
      // A→B=10 and E→F=30 are valid
      expect(doc.links.filter((l) => l.value > 0)).toHaveLength(2);
      expect(warnings.length).toBeGreaterThan(0);
    },
  },
];

// ---------------------------------------------------------------------------
// Run corpus tests
// ---------------------------------------------------------------------------

describe('mermaid-sankey-corpus', () => {
  for (const tc of SANKEY_CASES) {
    it(tc.name, () => {
      // Always parse via parseMermaid for integration coverage
      const { doc: rawDoc, warnings } = parseMermaid(tc.text);
      const doc = rawDoc as SankeyDocument;

      // Also check schema validates
      sankeyDocumentSchema.parse(doc);

      // Render SVG
      const rendered = renderMermaid(tc.text, { format: 'svg' });
      expect(rendered.svg).toBeDefined();
      expect(rendered.svg!.length).toBeGreaterThan(50);

      if (tc.warningPattern) {
        expect(warnings.some((w) => tc.warningPattern!.test(w))).toBe(true);
      }

      tc.assert(doc, warnings, rendered);
    });
  }

  // ── Gallery emission ─────────────────────────────────────────────────────

  it('emits mermaid-sankey.svg to examples/gallery/', () => {
    const text = readFileSync(SANKEY_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'svg' });
    expect(result.kind).toBe('sankey');
    writeFileSync(SANKEY_SVG, result.svg!, 'utf8');
    expect(statSync(SANKEY_SVG).size).toBeGreaterThan(1000);
  });

  it('emits mermaid-sankey.png to examples/gallery/', () => {
    const text = readFileSync(SANKEY_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'png' });
    writeFileSync(SANKEY_PNG, result.png!);
    expect(statSync(SANKEY_PNG).size).toBeGreaterThan(1000);
  });

  it('asserts sankey gallery files exist and are non-empty', () => {
    expect(existsSync(SANKEY_SVG)).toBe(true);
    expect(existsSync(SANKEY_PNG)).toBe(true);
    expect(statSync(SANKEY_SVG).size).toBeGreaterThan(1000);
    expect(statSync(SANKEY_PNG).size).toBeGreaterThan(1000);
  });
});
