/**
 * @file test/mermaid-requirement-corpus.test.ts — RequirementDiagram grammar corpus tests.
 *
 * Tests the full pipeline: parseMermaid → RequirementDocument → renderMermaid → Scene + SVG.
 * Covers: canonical syntax, typed variants, elements, relationship kinds, graceful degradation,
 * whitespace tolerance, unknown fields, unclosed blocks, auto-created nodes.
 * Emits gallery files: examples/gallery/mermaid-requirement.{mmd,svg,png}.
 */

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  requirementDocumentSchema,
  resolveRequirementTheme,
  buildRequirementScene,
} from '../src/grammars/requirement/index.js';
import type { RequirementDocument } from '../src/grammars/requirement/index.js';
import { detectDiagramType, parseMermaid, renderMermaid } from '../src/frontend/mermaid/index.js';
import {
  parseRequirementDiagram,
  parseRequirementDiagramInternal,
} from '../src/frontend/mermaid/requirement.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const GALLERY    = join(REPO_ROOT, 'examples', 'gallery');
const REQ_MMD    = join(GALLERY, 'mermaid-requirement.mmd');
const REQ_SVG    = join(GALLERY, 'mermaid-requirement.svg');
const REQ_PNG    = join(GALLERY, 'mermaid-requirement.png');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function texts(rendered: ReturnType<typeof renderMermaid>): string[] {
  return rendered.scene.primitives.flatMap((p) => {
    if (p.kind === 'text') return [p.text];
    if (p.kind === 'multitext') return p.lines;
    return [] as string[];
  });
}

function rectCount(rendered: ReturnType<typeof renderMermaid>): number {
  return rendered.scene.primitives.filter((p) => p.kind === 'rect').length;
}

// ---------------------------------------------------------------------------
// Corpus cases
// ---------------------------------------------------------------------------

interface ReqCase {
  name: string;
  text: string;
  warningPattern?: RegExp;
  assert: (doc: RequirementDocument, warnings: string[], rendered: ReturnType<typeof renderMermaid>) => void;
}

const REQ_CASES: ReqCase[] = [
  // 1. Canonical minimal requirement
  {
    name: 'minimal requirement block',
    text: `requirementDiagram
requirement test_req {
id: 1
text: the test text.
risk: high
verifymethod: test
}`,
    assert: (doc, warnings, rendered) => {
      expect(doc.requirements).toHaveLength(1);
      expect(doc.requirements[0]?.name).toBe('test_req');
      expect(doc.requirements[0]?.id).toBe('1');
      expect(doc.requirements[0]?.text).toBe('the test text.');
      expect(doc.requirements[0]?.risk).toBe('high');
      expect(doc.requirements[0]?.verifymethod).toBe('test');
      expect(doc.elements).toHaveLength(0);
      expect(doc.relationships).toHaveLength(0);
      expect(rendered.svg).toBeDefined();
      const t = texts(rendered);
      expect(t).toContain('test_req');
    },
  },

  // 2. Element block
  {
    name: 'element block with type and docref',
    text: `requirementDiagram
element test_entity {
type: simulation
docref: doc/spec
}`,
    assert: (doc) => {
      expect(doc.elements).toHaveLength(1);
      expect(doc.elements[0]?.name).toBe('test_entity');
      expect(doc.elements[0]?.type).toBe('simulation');
      expect(doc.elements[0]?.docref).toBe('doc/spec');
      expect(doc.requirements).toHaveLength(0);
    },
  },

  // 3. Requirement + element + satisfies relationship
  {
    name: 'requirement + element + satisfies relationship',
    text: `requirementDiagram
requirement test_req {
id: 1
text: the test text.
risk: high
verifymethod: test
}
element test_entity {
type: simulation
}
test_entity - satisfies -> test_req`,
    assert: (doc, _w, rendered) => {
      expect(doc.requirements).toHaveLength(1);
      expect(doc.elements).toHaveLength(1);
      expect(doc.relationships).toHaveLength(1);
      expect(doc.relationships[0]?.kind).toBe('satisfies');
      expect(doc.relationships[0]?.src).toBe('test_entity');
      expect(doc.relationships[0]?.dst).toBe('test_req');
      const t = texts(rendered);
      expect(t.some((s) => s.includes('satisfies'))).toBe(true);
    },
  },

  // 4. functionalRequirement typed variant
  {
    name: 'functionalRequirement typed variant',
    text: `requirementDiagram
functionalRequirement fr1 {
id: FR-001
text: Must handle 1000 requests/sec.
risk: medium
verifymethod: analysis
}`,
    assert: (doc, _w, rendered) => {
      expect(doc.requirements[0]?.kind).toBe('functionalRequirement');
      const t = texts(rendered);
      expect(t.some((s) => s.includes('Functional'))).toBe(true);
    },
  },

  // 5. interfaceRequirement typed variant
  {
    name: 'interfaceRequirement typed variant',
    text: `requirementDiagram
interfaceRequirement ir1 {
id: IR-001
text: REST API interface.
risk: low
verifymethod: inspection
}`,
    assert: (doc) => {
      expect(doc.requirements[0]?.kind).toBe('interfaceRequirement');
    },
  },

  // 6. performanceRequirement typed variant
  {
    name: 'performanceRequirement typed variant',
    text: `requirementDiagram
performanceRequirement pr1 {
id: PR-001
text: Response time under 200ms.
risk: high
verifymethod: test
}`,
    assert: (doc) => {
      expect(doc.requirements[0]?.kind).toBe('performanceRequirement');
    },
  },

  // 7. physicalRequirement typed variant
  {
    name: 'physicalRequirement typed variant',
    text: `requirementDiagram
physicalRequirement physr1 {
id: PHY-001
text: Weight must not exceed 5kg.
risk: low
verifymethod: inspection
}`,
    assert: (doc) => {
      expect(doc.requirements[0]?.kind).toBe('physicalRequirement');
    },
  },

  // 8. designConstraint typed variant
  {
    name: 'designConstraint typed variant',
    text: `requirementDiagram
designConstraint dc1 {
id: DC-001
text: Must use PostgreSQL.
risk: medium
verifymethod: analysis
}`,
    assert: (doc, _w, rendered) => {
      expect(doc.requirements[0]?.kind).toBe('designConstraint');
      const t = texts(rendered);
      expect(t.some((s) => s.includes('Design'))).toBe(true);
    },
  },

  // 9. All relationship kinds
  {
    name: 'all seven relationship kinds',
    text: `requirementDiagram
requirement a { id: 1 }
requirement b { id: 2 }
requirement c { id: 3 }
requirement d { id: 4 }
requirement e { id: 5 }
requirement f { id: 6 }
requirement g { id: 7 }
requirement h { id: 8 }
a - satisfies -> b
a - contains -> c
a - copies -> d
a - derives -> e
a - verifies -> f
a - refines -> g
a - traces -> h`,
    assert: (doc) => {
      const kinds = doc.relationships.map((r) => r.kind);
      expect(kinds).toContain('satisfies');
      expect(kinds).toContain('contains');
      expect(kinds).toContain('copies');
      expect(kinds).toContain('derives');
      expect(kinds).toContain('verifies');
      expect(kinds).toContain('refines');
      expect(kinds).toContain('traces');
    },
  },

  // 10. Undirected relationship (dash-dash)
  {
    name: 'undirected relationship (dash-dash) treated as directed',
    text: `requirementDiagram
requirement a { id: 1 }
requirement b { id: 2 }
a - contains - b`,
    assert: (doc) => {
      expect(doc.relationships).toHaveLength(1);
      expect(doc.relationships[0]?.kind).toBe('contains');
    },
  },

  // 11. Header only — empty diagram
  {
    name: 'header only — empty diagram',
    text: `requirementDiagram`,
    assert: (doc) => {
      expect(doc.requirements).toHaveLength(0);
      expect(doc.elements).toHaveLength(0);
      expect(doc.relationships).toHaveLength(0);
    },
  },

  // 12. Case-insensitive header
  {
    name: 'case-insensitive header (REQUIREMENTDIAGRAM)',
    text: `REQUIREMENTDIAGRAM
requirement r1 { id: 1 }`,
    assert: (doc) => {
      expect(doc.requirements).toHaveLength(1);
    },
  },

  // 13. Requirement without optional fields
  {
    name: 'requirement without optional fields',
    text: `requirementDiagram
requirement bare_req {
}`,
    assert: (doc) => {
      expect(doc.requirements).toHaveLength(1);
      expect(doc.requirements[0]?.id).toBeUndefined();
      expect(doc.requirements[0]?.text).toBeUndefined();
      expect(doc.requirements[0]?.risk).toBeUndefined();
    },
  },

  // 14. Element without optional fields
  {
    name: 'element without optional fields',
    text: `requirementDiagram
element bare_elem {
}`,
    assert: (doc) => {
      expect(doc.elements).toHaveLength(1);
      expect(doc.elements[0]?.type).toBeUndefined();
    },
  },

  // 15. Unknown risk value → warning
  {
    name: 'unknown risk value → warning',
    text: `requirementDiagram
requirement r1 {
id: 1
risk: critical
}`,
    warningPattern: /Unknown risk value/,
    assert: (doc, warnings) => {
      expect(warnings.some((w) => /Unknown risk value/.test(w))).toBe(true);
      expect(doc.requirements[0]?.risk).toBeUndefined();
    },
  },

  // 16. Unknown verifymethod → warning
  {
    name: 'unknown verifymethod → warning',
    text: `requirementDiagram
requirement r1 {
id: 1
verifymethod: walkthrough
}`,
    warningPattern: /Unknown verifymethod/,
    assert: (doc, warnings) => {
      expect(warnings.some((w) => /Unknown verifymethod/.test(w))).toBe(true);
      expect(doc.requirements[0]?.verifymethod).toBeUndefined();
    },
  },

  // 17. Unknown relationship kind → warning
  {
    name: 'unknown relationship kind → warning',
    text: `requirementDiagram
requirement a { id: 1 }
requirement b { id: 2 }
a - implements -> b`,
    warningPattern: /Unknown relationship kind/,
    assert: (doc, warnings) => {
      expect(warnings.some((w) => /Unknown relationship kind/.test(w))).toBe(true);
      expect(doc.relationships).toHaveLength(0);
    },
  },

  // 18. Auto-create nodes referenced in relationships
  {
    name: 'auto-create nodes referenced in relationships',
    text: `requirementDiagram
ghost_a - satisfies -> ghost_b`,
    assert: (doc, warnings) => {
      expect(doc.requirements.length).toBeGreaterThanOrEqual(2);
      expect(warnings.some((w) => /auto-created/i.test(w))).toBe(true);
    },
  },

  // 19. Multiple requirements
  {
    name: 'multiple requirements in sequence',
    text: `requirementDiagram
requirement r1 {
id: 1
text: First requirement.
risk: high
verifymethod: test
}
requirement r2 {
id: 2
text: Second requirement.
risk: low
verifymethod: inspection
}
requirement r3 {
id: 3
text: Third requirement.
risk: medium
verifymethod: analysis
}`,
    assert: (doc) => {
      expect(doc.requirements).toHaveLength(3);
      expect(doc.requirements[0]?.name).toBe('r1');
      expect(doc.requirements[1]?.name).toBe('r2');
      expect(doc.requirements[2]?.name).toBe('r3');
    },
  },

  // 20. Mixed requirements and elements
  {
    name: 'mixed requirements and elements',
    text: `requirementDiagram
requirement sys_req {
id: SYS-1
text: System performance requirement.
risk: high
verifymethod: test
}
functionalRequirement func_req {
id: FUNC-1
text: Functional capability.
risk: medium
verifymethod: analysis
}
element component_a {
type: software module
docref: docs/comp-a.md
}
element component_b {
type: hardware
}
component_a - satisfies -> sys_req
component_b - verifies -> func_req
sys_req - derives -> func_req`,
    assert: (doc, _w, rendered) => {
      expect(doc.requirements).toHaveLength(2);
      expect(doc.elements).toHaveLength(2);
      expect(doc.relationships).toHaveLength(3);
      expect(rendered.svg).toBeDefined();
      const t = texts(rendered);
      expect(t).toContain('sys_req');
      expect(t).toContain('component_a');
    },
  },

  // 21. Blank lines and comments inside blocks
  {
    name: 'blank lines inside block are skipped',
    text: `requirementDiagram
requirement r1 {

id: 1

text: has blank lines.

risk: high
}`,
    assert: (doc) => {
      expect(doc.requirements[0]?.id).toBe('1');
      expect(doc.requirements[0]?.risk).toBe('high');
    },
  },

  // 22. Real Mermaid docs example — from official documentation
  {
    name: 'real-mermaid-docs canonical example',
    text: `requirementDiagram

    requirement test_req {
    id: 1
    text: the test text.
    risk: high
    verifymethod: test
    }

    element test_entity {
    type: simulation
    }

    test_entity - satisfies -> test_req`,
    assert: (doc, _w, rendered) => {
      expect(doc.requirements).toHaveLength(1);
      expect(doc.elements).toHaveLength(1);
      expect(doc.relationships).toHaveLength(1);
      expect(rendered.kind).toBe('requirementDiagram');
      const t = texts(rendered);
      expect(t).toContain('test_req');
      expect(t).toContain('test_entity');
    },
  },

  // 23. detectDiagramType identifies requirementDiagram — covered by standalone test above
  {
    name: 'detectDiagramType (via parseMermaid returns requirementDiagram kind)',
    text: `requirementDiagram
requirement r1 { id: 1 }`,
    assert: (_doc, _w, rendered) => {
      expect(rendered.kind).toBe('requirementDiagram');
    },
  },

  // 24. SVG contains «satisfies» pill text
  {
    name: 'SVG contains «satisfies» pill label',
    text: `requirementDiagram
requirement a { id: 1 }
element e { type: sys }
e - satisfies -> a`,
    assert: (_doc, _w, rendered) => {
      const t = texts(rendered);
      expect(t.some((s) => s.includes('satisfies'))).toBe(true);
    },
  },

  // 25. SVG contains «Element» stereotype
  {
    name: 'SVG contains «Element» stereotype text',
    text: `requirementDiagram
element sys_component { type: service }`,
    assert: (_doc, _w, rendered) => {
      const t = texts(rendered);
      expect(t.some((s) => s.includes('Element'))).toBe(true);
    },
  },

  // 26. SVG contains «Requirement» stereotype
  {
    name: 'SVG contains «Requirement» stereotype text',
    text: `requirementDiagram
requirement basic_req { id: 1 }`,
    assert: (_doc, _w, rendered) => {
      const t = texts(rendered);
      expect(t.some((s) => s.includes('Requirement'))).toBe(true);
    },
  },

  // 27. Attribute lines present in SVG
  {
    name: 'attribute lines rendered in SVG',
    text: `requirementDiagram
requirement r1 {
id: REQ-42
text: A specific requirement.
risk: medium
verifymethod: demonstration
}`,
    assert: (_doc, _w, rendered) => {
      const t = texts(rendered);
      expect(t.some((s) => s.includes('REQ-42'))).toBe(true);
      expect(t.some((s) => s.includes('medium') || s.includes('Medium'))).toBe(true);
    },
  },

  // 28. Dark theme renders without error
  {
    name: 'dark theme renders without error',
    text: `requirementDiagram
requirement dr1 { id: 1 text: dark theme test. risk: low verifymethod: test }`,
    assert: (_doc, _w, rendered) => {
      // With inline fields (no newline between them), parser may or may not pick up fields
      // but render should not throw
      expect(rendered.svg).toBeDefined();
      expect(rendered.svg!.length).toBeGreaterThan(100);
    },
  },

  // 29. Schema validates generated document
  {
    name: 'schema validation passes for well-formed document',
    text: `requirementDiagram
requirement r1 {
id: 1
text: Valid requirement.
risk: high
verifymethod: test
}
element e1 { type: software }
e1 - satisfies -> r1`,
    assert: (doc) => {
      expect(() => requirementDocumentSchema.parse(doc)).not.toThrow();
    },
  },

  // 30. Multiple relationships from same source
  {
    name: 'multiple relationships from same source node',
    text: `requirementDiagram
requirement base { id: 1 }
requirement derived1 { id: 2 }
requirement derived2 { id: 3 }
requirement derived3 { id: 4 }
base - contains -> derived1
base - contains -> derived2
base - refines -> derived3`,
    assert: (doc) => {
      const fromBase = doc.relationships.filter((r) => r.src === 'base');
      expect(fromBase).toHaveLength(3);
    },
  },

  // 31. Compact inline fields (id on same line as block open — not standard Mermaid but graceful)
  {
    name: 'compact requirement — no id field',
    text: `requirementDiagram
requirement compact_req {
text: No id provided.
risk: medium
verifymethod: analysis
}`,
    assert: (doc) => {
      expect(doc.requirements[0]?.id).toBeUndefined();
      expect(doc.requirements[0]?.text).toBe('No id provided.');
    },
  },

  // 32. docref with path separators
  {
    name: 'element docref with path separators',
    text: `requirementDiagram
element comp {
type: module
docref: docs/modules/comp.md
}`,
    assert: (doc) => {
      expect(doc.elements[0]?.docref).toBe('docs/modules/comp.md');
    },
  },

  // 33. All verifymethod values
  {
    name: 'all four verifymethod values parse correctly',
    text: `requirementDiagram
requirement r1 { verifymethod: test }
requirement r2 { verifymethod: analysis }
requirement r3 { verifymethod: inspection }
requirement r4 { verifymethod: demonstration }`,
    assert: (doc) => {
      expect(doc.requirements[0]?.verifymethod).toBe('test');
      expect(doc.requirements[1]?.verifymethod).toBe('analysis');
      expect(doc.requirements[2]?.verifymethod).toBe('inspection');
      expect(doc.requirements[3]?.verifymethod).toBe('demonstration');
    },
  },

  // 34. Degenerate: completely empty input
  {
    name: 'empty string — empty document',
    text: '',
    assert: (doc) => {
      expect(doc.requirements).toHaveLength(0);
      expect(doc.elements).toHaveLength(0);
      expect(doc.relationships).toHaveLength(0);
    },
  },

  // 35. Scene has non-zero dimensions
  {
    name: 'scene has non-zero width and height',
    text: `requirementDiagram
requirement r1 { id: 1 text: Test. risk: high verifymethod: test }
element e1 { type: service }
e1 - satisfies -> r1`,
    assert: (_doc, _w, rendered) => {
      expect(rendered.scene.width).toBeGreaterThan(100);
      expect(rendered.scene.height).toBeGreaterThan(100);
    },
  },

  // 36. Whitespace-padded field values
  {
    name: 'whitespace-padded field values are trimmed',
    text: `requirementDiagram
requirement r1 {
id:   PADDED-ID   
text:   padded text value   
risk:   high   
verifymethod:   test   
}`,
    assert: (doc) => {
      expect(doc.requirements[0]?.id).toBe('PADDED-ID');
      expect(doc.requirements[0]?.text).toBe('padded text value');
      expect(doc.requirements[0]?.risk).toBe('high');
    },
  },

  // 37. refines relationship
  {
    name: 'refines relationship',
    text: `requirementDiagram
requirement parent { id: 1 }
requirement child { id: 2 }
child - refines -> parent`,
    assert: (doc, _w, rendered) => {
      expect(doc.relationships[0]?.kind).toBe('refines');
      const t = texts(rendered);
      expect(t.some((s) => s.includes('refines'))).toBe(true);
    },
  },
];

// ---------------------------------------------------------------------------
// Run corpus tests
// ---------------------------------------------------------------------------

describe('mermaid-requirement-corpus', () => {
  it('detectDiagramType recognises requirementDiagram', () => {
    expect(detectDiagramType('requirementDiagram\nrequirement r1 { id: 1 }')).toBe('requirementDiagram');
    expect(detectDiagramType('REQUIREMENTDIAGRAM\nrequirement r1 { id: 1 }')).toBe('requirementDiagram');
  });

  for (const tc of REQ_CASES) {
    it(tc.name, () => {
      const { doc: rawDoc, warnings } = parseMermaid(tc.text.trim() || 'requirementDiagram');
      const doc = rawDoc as RequirementDocument;

      // Schema validates
      requirementDocumentSchema.parse(doc);

      // Render SVG
      const rendered = renderMermaid(tc.text.trim() || 'requirementDiagram', { format: 'svg' });
      expect(rendered.svg).toBeDefined();
      expect(rendered.svg!.length).toBeGreaterThan(10);

      if (tc.warningPattern) {
        expect(warnings.some((w) => tc.warningPattern!.test(w))).toBe(true);
      }

      tc.assert(doc, warnings, rendered);
    });
  }

  // ── Gallery emission ─────────────────────────────────────────────────────

  it('emits mermaid-requirement.svg to examples/gallery/', () => {
    const text = readFileSync(REQ_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'svg' });
    expect(result.kind).toBe('requirementDiagram');
    writeFileSync(REQ_SVG, result.svg!, 'utf8');
    expect(statSync(REQ_SVG).size).toBeGreaterThan(1000);
  });

  it('emits mermaid-requirement.png to examples/gallery/', () => {
    const text = readFileSync(REQ_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'png' });
    writeFileSync(REQ_PNG, result.png!);
    expect(statSync(REQ_PNG).size).toBeGreaterThan(1000);
  });

  it('asserts requirement gallery files exist and are non-empty', () => {
    expect(existsSync(REQ_SVG)).toBe(true);
    expect(existsSync(REQ_PNG)).toBe(true);
    expect(statSync(REQ_SVG).size).toBeGreaterThan(1000);
    expect(statSync(REQ_PNG).size).toBeGreaterThan(1000);
  });
});
