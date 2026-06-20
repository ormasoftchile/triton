/**
 * Overlay grammar tests — proves note/legend syntax in diagram text
 * flows through grammar → IR → layout → Scene correctly.
 */
import { describe, it, expect } from 'vitest';
import { flowchart } from '../src/diagrams/flowchart/index.js';
import { timeline } from '../src/diagrams/timeline/index.js';
import { defaultTheme } from '../src/theme/presets/default.js';
import { renderSVG } from '../src/render/svg.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Flowchart: note + legend in grammar
// ═══════════════════════════════════════════════════════════════════════════════

describe('flowchart overlay grammar', () => {
  it('parses note directive into IR overlays', () => {
    const doc = flowchart.parseMermaid(`flowchart LR
    A[Auth] --> B[API]
    note "Handles OAuth2" at A
`);
    expect(doc.overlays).toBeDefined();
    expect(doc.overlays).toHaveLength(1);
    expect(doc.overlays![0].type).toBe('note');
    if (doc.overlays![0].type === 'note') {
      expect(doc.overlays![0].text).toBe('Handles OAuth2');
      expect(doc.overlays![0].target).toBe('A');
    }
  });

  it('parses note with offset', () => {
    const doc = flowchart.parseMermaid(`flowchart LR
    A --> B
    note "Rate limited" at B offset 20,-80
`);
    expect(doc.overlays).toHaveLength(1);
    if (doc.overlays![0].type === 'note') {
      expect(doc.overlays![0].offset).toEqual({ dx: 20, dy: -80 });
    }
  });

  it('parses legend block into IR overlays', () => {
    const doc = flowchart.parseMermaid(`flowchart LR
    A --> B
    legend bottom-right "API Architecture"
        Version : 2.1.0
        Author : Engineering Team
    end
`);
    expect(doc.overlays).toBeDefined();
    const legendOverlay = doc.overlays!.find(o => o.type === 'legend');
    expect(legendOverlay).toBeDefined();
    if (legendOverlay?.type === 'legend') {
      expect(legendOverlay.corner).toBe('bottom-right');
      expect(legendOverlay.title).toBe('API Architecture');
      expect(legendOverlay.entries).toHaveLength(2);
      expect(legendOverlay.entries[0]).toEqual({ key: 'Version', value: '2.1.0' });
    }
  });

  it('parses both notes and legend together', () => {
    const doc = flowchart.parseMermaid(`flowchart LR
    A[Auth] --> B[API] --> C[DB]
    note "OAuth2 handler" at A
    note "Rate limited" at B
    legend top-right "System Info"
        Status : Production
    end
`);
    expect(doc.overlays).toHaveLength(3);
    const notes = doc.overlays!.filter(o => o.type === 'note');
    const legends = doc.overlays!.filter(o => o.type === 'legend');
    expect(notes).toHaveLength(2);
    expect(legends).toHaveLength(1);
  });

  it('layout resolves note positions from node positions', () => {
    const doc = flowchart.parseMermaid(`flowchart LR
    A[Auth] --> B[API]
    note "OAuth2 handler" at A
`);
    const scene = flowchart.layout(doc, defaultTheme);
    expect(scene.annotations).toBeDefined();
    expect(scene.annotations).toHaveLength(1);
    // Position should be resolved (absolute, not relative)
    const anno = scene.annotations![0];
    expect(anno.position.x).toBeGreaterThan(0);
    // Anchor should be resolved to a point (not elementId)
    expect('point' in anno.anchor).toBe(true);
  });

  it('layout reserves space for legend', () => {
    const docNoLegend = flowchart.parseMermaid(`flowchart LR
    A --> B --> C
`);
    const docWithLegend = flowchart.parseMermaid(`flowchart LR
    A --> B --> C
    legend bottom-right "Info"
        Status : Active
    end
`);
    const sceneNoLegend = flowchart.layout(docNoLegend, defaultTheme);
    const sceneWithLegend = flowchart.layout(docWithLegend, defaultTheme);

    // Legend causes larger viewBox
    expect(sceneWithLegend.viewBox.width).toBeGreaterThan(sceneNoLegend.viewBox.width);
    expect(sceneWithLegend.viewBox.height).toBeGreaterThan(sceneNoLegend.viewBox.height);
    expect(sceneWithLegend.legend).toBeDefined();
    expect(sceneWithLegend.legend!.corner).toBe('bottom-right');
  });

  it('full pipeline: text → parse → layout → SVG with overlays', () => {
    const doc = flowchart.parseMermaid(`flowchart LR
    A[Auth] --> B[API] --> C[DB]
    note "Secured endpoint" at B
    legend bottom-right "Architecture"
        Version : 3.0
    end
`);
    const scene = flowchart.layout(doc, defaultTheme);
    const svg = renderSVG(scene, defaultTheme);

    expect(svg).toContain('Secured endpoint');
    expect(svg).toContain('Architecture');
    expect(svg).toContain('Version');
    expect(svg).toContain('3.0');
  });

  it('no overlays when none in source', () => {
    const doc = flowchart.parseMermaid(`flowchart LR
    A --> B
`);
    expect(doc.overlays).toBeUndefined();
    const scene = flowchart.layout(doc, defaultTheme);
    expect(scene.annotations).toBeUndefined();
    expect(scene.legend).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Timeline: note + legend in grammar
// ═══════════════════════════════════════════════════════════════════════════════

describe('timeline overlay grammar', () => {
  it('parses note directive into IR overlays', () => {
    const doc = timeline.parseMermaid(`timeline
    2025-01 : Kickoff : milestone
    note "Critical date" at 2025-01
`);
    expect(doc.overlays).toBeDefined();
    expect(doc.overlays).toHaveLength(1);
    if (doc.overlays![0].type === 'note') {
      expect(doc.overlays![0].text).toBe('Critical date');
      expect(doc.overlays![0].target).toBe('2025-01');
    }
  });

  it('parses legend block into IR overlays', () => {
    const doc = timeline.parseMermaid(`timeline
    title Roadmap
    2025-01 : Kickoff : milestone
    legend top-right "Project Info"
        Team : Platform
        Sprint : 42
    end
`);
    const legendOverlay = doc.overlays!.find(o => o.type === 'legend');
    expect(legendOverlay).toBeDefined();
    if (legendOverlay?.type === 'legend') {
      expect(legendOverlay.title).toBe('Project Info');
      expect(legendOverlay.entries).toHaveLength(2);
    }
  });

  it('layout passes overlays to Scene', () => {
    const doc = timeline.parseMermaid(`timeline
    2025-01 : Kickoff : milestone
    note "Important" at 2025-01
    legend bottom-left "Info"
        Status : Active
    end
`);
    const scene = timeline.layout(doc, defaultTheme);
    expect(scene.annotations).toHaveLength(1);
    expect(scene.legend).toBeDefined();
    expect(scene.legend!.corner).toBe('bottom-left');
  });

  it('full pipeline: text → parse → layout → SVG', () => {
    const doc = timeline.parseMermaid(`timeline
    title Q1 Goals
    2025-01 : Kickoff : milestone
    2025-01 -- 2025-03 : Design : active
    note "Board approved" at 2025-01
    legend bottom-right "Project"
        Lead : Alice
    end
`);
    const scene = timeline.layout(doc, defaultTheme);
    const svg = renderSVG(scene, defaultTheme);
    expect(svg).toContain('Board approved');
    expect(svg).toContain('Project');
    expect(svg).toContain('Alice');
  });
});
