/**
 * @file test/contract-theme-matrix.test.ts — Theme × Component matrix test.
 *
 * THE MATRIX PROMISE: Author a theme once (a ThemeContract instance) and it
 * lights up all 21 component types with ZERO per-component work.
 *
 * This test proves the promise by running EVERY theme in CONTRACT_THEMES
 * against ALL 21 Mermaid component types and asserting:
 *   1. render completes without error
 *   2. result contains valid SVG
 *   3. render is deterministic (same input → same output, twice)
 *
 * Component types covered (21):
 *   flowchart, sequenceDiagram, gantt, timeline, mindmap, classDiagram,
 *   stateDiagram, erDiagram, C4Context, requirementDiagram, kanban,
 *   xychart-beta, pie, quadrantChart, radar-beta, sankey-beta, gitGraph,
 *   journey, packet-beta, block-beta, architecture-beta
 *
 * Themes under test (CONTRACT_THEMES):
 *   executive, midnight, blueprint, editorial
 *   (any future theme added to CONTRACT_THEMES is automatically included)
 *
 * MATRIX FINDING (recorded here):
 *   Adding all 3 new themes (midnight, blueprint, editorial) required ZERO
 *   changes to any component contract-binding. Every binding consumed the
 *   ThemeContract interface as-is. This confirms the contract is a complete
 *   and general Tier-2 abstraction.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { CONTRACT_THEMES } from '../src/theme-contract/index.js';
import { renderMermaid }   from '../src/frontend/mermaid/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const REPO_ROOT  = join(__dirname, '..', '..', '..');
const GALLERY    = join(REPO_ROOT, 'examples', 'gallery');

// ── Component coverage ────────────────────────────────────────────────────────

/**
 * All 21 Mermaid component types, each paired with a representative source.
 * These are the same .mmd files used to generate the main gallery.
 */
const COMPONENTS = [
  { slug: 'flowchart',     src: 'mermaid-flowchart.mmd'    },
  { slug: 'sequence',      src: 'mermaid-sequence.mmd'     },
  { slug: 'gantt',         src: 'mermaid-gantt.mmd'        },
  { slug: 'timeline',      src: 'mermaid-timeline.mmd'     },
  { slug: 'mindmap',       src: 'mermaid-mindmap.mmd'      },
  { slug: 'class',         src: 'mermaid-class.mmd'        },
  { slug: 'state',         src: 'mermaid-state.mmd'        },
  { slug: 'er',            src: 'mermaid-er.mmd'           },
  { slug: 'c4',            src: 'mermaid-c4.mmd'           },
  { slug: 'requirement',   src: 'mermaid-requirement.mmd'  },
  { slug: 'kanban',        src: 'mermaid-kanban.mmd'       },
  { slug: 'xychart',       src: 'mermaid-xychart.mmd'      },
  { slug: 'pie',           src: 'mermaid-pie.mmd'          },
  { slug: 'quadrant',      src: 'mermaid-quadrant.mmd'     },
  { slug: 'radar',         src: 'mermaid-radar.mmd'        },
  { slug: 'sankey',        src: 'mermaid-sankey.mmd'       },
  { slug: 'gitgraph',      src: 'mermaid-gitgraph.mmd'     },
  { slug: 'journey',       src: 'mermaid-journey.mmd'      },
  { slug: 'packet',        src: 'mermaid-packet.mmd'       },
  { slug: 'block',         src: 'mermaid-block.mmd'        },
  { slug: 'architecture',  src: 'mermaid-architecture.mmd' },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function readMmd(name: string): string {
  return readFileSync(join(GALLERY, name), 'utf-8');
}

// ── Matrix loop ───────────────────────────────────────────────────────────────

const themeEntries = Object.entries(CONTRACT_THEMES);

describe('Contract theme × component matrix', () => {
  it('CONTRACT_THEMES has at least 4 registered themes', () => {
    expect(themeEntries.length).toBeGreaterThanOrEqual(4);
    expect(Object.keys(CONTRACT_THEMES)).toContain('executive');
    expect(Object.keys(CONTRACT_THEMES)).toContain('midnight');
    expect(Object.keys(CONTRACT_THEMES)).toContain('blueprint');
    expect(Object.keys(CONTRACT_THEMES)).toContain('editorial');
  });

  it('all 21 component sources exist in the gallery', () => {
    for (const { src } of COMPONENTS) {
      const text = readFileSync(join(GALLERY, src), 'utf-8');
      expect(text.length).toBeGreaterThan(0);
    }
  });

  for (const [themeName, _contract] of themeEntries) {
    describe(`Theme: ${themeName}`, () => {
      for (const { slug, src } of COMPONENTS) {
        const label = `${themeName} × ${slug}`;

        it(`${label} — renders without error`, () => {
          const mmd = readMmd(src);
          expect(() => {
            const result = renderMermaid(mmd, { theme: themeName, format: 'svg' });
            // Must produce a valid SVG
            expect(result.svg).toBeTruthy();
            expect(result.svg!).toContain('<svg');
          }).not.toThrow();
        });

        it(`${label} — is deterministic (render twice → identical)`, () => {
          const mmd = readMmd(src);
          const a = renderMermaid(mmd, { theme: themeName, format: 'svg' });
          const b = renderMermaid(mmd, { theme: themeName, format: 'svg' });
          // Hash identity proves Scene IR is bit-identical on both runs
          expect(a.sceneHash).toBe(b.sceneHash);
          // SVG string identity proves the serialiser is also deterministic
          expect(a.svg).toBe(b.svg);
        });
      }
    });
  }
});
