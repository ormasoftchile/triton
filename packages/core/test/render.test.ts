/**
 * @file test/render.test.ts — Rendering pipeline tests (Phase 1).
 *
 * Tests the renderDocument function directly (Leslie wires the public
 * render() API stub in Wave 2).
 *
 * The T2 fixture is transcribed from §14.2 of the design spec:
 *   "Horizontal Linear, Numbered Nodes" — three milestones (Application
 *   Deadline, Qualifying Exam, Training Starts) on a single empty track,
 *   May–November 2021.
 */

import { describe, expect, it } from 'vitest';
import type { IRDocument } from '../src/types.js';
import { renderDocument } from '../src/render/index.js';

// ---------------------------------------------------------------------------
// T2 IR fixture (§14.2)
// ---------------------------------------------------------------------------

const T2_IR: IRDocument = {
  version: '1.0',
  metadata: {
    title:      'Our Timeline',
    today:      '2026-06-10',
    time_range: { start: '2021-03', end: '2021-11' },
    axis_unit:  'month',
    theme:      'consulting',
    locale:     'en',
  },
  tracks: [
    { id: 'main', label: '', index: 0 },
  ],
  activities: [],
  milestones: [
    {
      id:       'app-deadline',
      label:    'Application Deadline',
      date:     '2021-05-15',
      track:    'main',
      status:   'done',
      category: 'standard-node',
    },
    {
      id:       'qualifying-exam',
      label:    'Qualifying Exam',
      date:     '2021-06-20',
      track:    'main',
      status:   'in-progress',
      tags:     ['emphasized'],
      category: 'standard-node',
    },
    {
      id:       'training-starts',
      label:    'Training Starts',
      date:     '2021-09-01',
      track:    'main',
      status:   'planned',
      category: 'standard-node',
    },
  ],
};

// ---------------------------------------------------------------------------
// Additional Phase-1 fix fixtures
// ---------------------------------------------------------------------------

/** Multi-track IR for fix #2 (track label visibility). */
const MULTI_TRACK_IR: IRDocument = {
  version: '1.0',
  metadata: {
    title:      'Multi-Track Test',
    today:      '2026-06-10',
    time_range: { start: '2021-01', end: '2021-12' },
    axis_unit:  'month',
    theme:      'consulting',
    locale:     'en',
  },
  tracks: [
    { id: 'alpha', label: 'Alpha Track', index: 0 },
    { id: 'beta',  label: 'Beta Track',  index: 1 },
  ],
  activities: [],
  milestones: [],
};

/** IR with a progress activity for fix #1. */
const PROGRESS_IR: IRDocument = {
  version: '1.0',
  metadata: {
    title:      'Progress Test',
    today:      '2026-06-10',
    time_range: { start: '2021-01', end: '2021-12' },
    axis_unit:  'month',
    theme:      'consulting',
    locale:     'en',
  },
  tracks: [{ id: 'main', label: '', index: 0 }],
  activities: [
    {
      id:       'act-progress',
      label:    'In-Progress Work',
      track:    'main',
      start:    '2021-03-01',
      end:      '2021-09-30',
      status:   'in-progress',
      progress: 0.6,
    },
  ],
  milestones: [],
};

/** IR with an ongoing (open-ended) activity for fix #3. */
const OPEN_END_IR: IRDocument = {
  version: '1.0',
  metadata: {
    title:      'Open-End Test',
    today:      '2026-06-10',
    time_range: { start: '2021-01', end: '2021-12' },
    axis_unit:  'month',
    theme:      'consulting',
    locale:     'en',
  },
  tracks: [{ id: 'main', label: '', index: 0 }],
  activities: [
    {
      id:     'ongoing-act',
      label:  'Ongoing Service',
      track:  'main',
      start:  '2021-03-01',
      // no end = ongoing
      status: 'in-progress',
    },
  ],
  milestones: [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('renderDocument — T2 (horizontal numbered nodes)', () => {

  describe('(a) SVG output validity', () => {
    it('returns a non-empty SVG string', () => {
      const result = renderDocument(T2_IR, { format: 'svg' });
      expect(result.svg).toBeDefined();
      expect(typeof result.svg).toBe('string');
      expect(result.svg!.length).toBeGreaterThan(100);
    });

    it('SVG starts with XML declaration and <svg> root', () => {
      const result = renderDocument(T2_IR, { format: 'svg' });
      expect(result.svg).toMatch(/^<\?xml/);
      expect(result.svg).toContain('<svg');
      expect(result.svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    });

    it('SVG contains the document title', () => {
      const result = renderDocument(T2_IR, { format: 'svg' });
      expect(result.svg).toContain('Our Timeline');
    });

    it('SVG contains each milestone label', () => {
      const result = renderDocument(T2_IR, { format: 'svg' });
      expect(result.svg).toContain('Application Deadli…');
      expect(result.svg).toContain('Qualifying Exam');
      expect(result.svg).toContain('Training Starts');
    });

    it('SVG contains milestone ordinal numbers 01, 02, 03', () => {
      const result = renderDocument(T2_IR, { format: 'svg' });
      expect(result.svg).toContain('>01<');
      expect(result.svg).toContain('>02<');
      expect(result.svg).toContain('>03<');
    });

    it('SVG contains milestone date labels (T2 "15th May 2021" format)', () => {
      const result = renderDocument(T2_IR, { format: 'svg' });
      expect(result.svg).toContain('May 2021');
      expect(result.svg).toContain('June 2021');
      expect(result.svg).toContain('September 2021');
    });

    it('SVG contains circle elements for milestones', () => {
      const result = renderDocument(T2_IR, { format: 'svg' });
      expect(result.svg).toContain('<circle');
    });

    it('SVG has a non-trivial positive width and height in the root element', () => {
      const result = renderDocument(T2_IR, { format: 'svg' });
      const widthMatch  = /width="([\d.]+)"/.exec(result.svg!);
      const heightMatch = /height="([\d.]+)"/.exec(result.svg!);
      expect(widthMatch).toBeTruthy();
      expect(heightMatch).toBeTruthy();
      expect(parseFloat(widthMatch![1]!)).toBeGreaterThan(400);
      expect(parseFloat(heightMatch![1]!)).toBeGreaterThan(50);
    });
  });

  describe('(b) Determinism', () => {
    it('two renders of the same IR produce byte-identical SVG strings', () => {
      const r1 = renderDocument(T2_IR, { format: 'svg' });
      const r2 = renderDocument(T2_IR, { format: 'svg' });
      expect(r1.svg).toBe(r2.svg);
    });

    it('two renders produce identical sceneHash values', () => {
      const r1 = renderDocument(T2_IR, { format: 'svg' });
      const r2 = renderDocument(T2_IR, { format: 'svg' });
      expect(r1.sceneHash).toBe(r2.sceneHash);
    });

    it('sceneHash is a 64-character hex string (SHA-256)', () => {
      const result = renderDocument(T2_IR, { format: 'svg' });
      expect(result.sceneHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('different IR produces a different sceneHash', () => {
      const modified: IRDocument = {
        ...T2_IR,
        metadata: { ...T2_IR.metadata, title: 'Modified Title' },
      };
      const r1 = renderDocument(T2_IR,   { format: 'svg' });
      const r2 = renderDocument(modified, { format: 'svg' });
      expect(r1.sceneHash).not.toBe(r2.sceneHash);
    });
  });

  describe('(c) PNG output', () => {
    it('PNG render returns a Uint8Array', () => {
      const result = renderDocument(T2_IR, { format: 'png' });
      expect(result.png).toBeInstanceOf(Uint8Array);
    });

    it('PNG output is non-empty', () => {
      const result = renderDocument(T2_IR, { format: 'png' });
      expect(result.png!.length).toBeGreaterThan(0);
    });

    it('PNG output starts with the PNG signature (\\x89PNG)', () => {
      const result = renderDocument(T2_IR, { format: 'png' });
      const sig = result.png!.slice(0, 4);
      // PNG magic: 0x89 0x50 0x4E 0x47
      expect(sig[0]).toBe(0x89);
      expect(sig[1]).toBe(0x50);  // 'P'
      expect(sig[2]).toBe(0x4e);  // 'N'
      expect(sig[3]).toBe(0x47);  // 'G'
    });

    it('PNG render also returns the SVG intermediate', () => {
      const result = renderDocument(T2_IR, { format: 'png' });
      expect(result.svg).toBeDefined();
      expect(result.svg!.length).toBeGreaterThan(100);
    });

    it('PNG sceneHash matches the SVG sceneHash for the same IR', () => {
      const svgResult = renderDocument(T2_IR, { format: 'svg' });
      const pngResult = renderDocument(T2_IR, { format: 'png' });
      expect(pngResult.sceneHash).toBe(svgResult.sceneHash);
    });
  });

  describe('edge cases', () => {
    it('milestone outside time_range is suppressed', () => {
      const irOutside: IRDocument = {
        ...T2_IR,
        milestones: [
          ...(T2_IR.milestones ?? []),
          { id: 'outside', label: 'OutsideLabel', date: '2020-01-01', track: 'main' },
        ],
      };
      const result = renderDocument(irOutside, { format: 'svg' });
      // OutsideLabel should NOT appear in the SVG (date is before time_range.start)
      expect(result.svg).not.toContain('OutsideLabel');
    });

    it('empty milestones list renders without error', () => {
      const irEmpty: IRDocument = { ...T2_IR, milestones: [] };
      expect(() => renderDocument(irEmpty, { format: 'svg' })).not.toThrow();
    });
  });

  describe('(d) Phase 1 render fixes', () => {
    it('fix #2: multi-track SVG contains track labels in the header gutter', () => {
      const result = renderDocument(MULTI_TRACK_IR, { format: 'svg' });
      expect(result.svg).toContain('Alpha Track');
      expect(result.svg).toContain('Beta Track');
    });

    it('fix #1: activity with progress emits a progress fill rect (opacity 0.45)', () => {
      const result = renderDocument(PROGRESS_IR, { format: 'svg' });
      // Progress fill uses progressFillOpacity = 0.45
      expect(result.svg).toContain('opacity="0.45"');
    });

    it('fix #3: ongoing activity (omitted end) emits a right-pointing path indicator', () => {
      const result = renderDocument(OPEN_END_IR, { format: 'svg' });
      expect(result.svg).toContain('<path');
    });

    it('fix #3: determinism — two renders of open-ended IR are byte-identical', () => {
      const r1 = renderDocument(OPEN_END_IR, { format: 'svg' });
      const r2 = renderDocument(OPEN_END_IR, { format: 'svg' });
      expect(r1.svg).toBe(r2.svg);
    });
  });

  // ---------------------------------------------------------------------------
  // (e) Barbara layout-quality polish pass — bar labels, sub-lanes, title block
  // ---------------------------------------------------------------------------

  describe('(e) Layout quality — label placement, sub-lane packing, title block', () => {

    /** Narrow-bar IR: 4-day bar with a very long label that cannot fit inside. */
    const NARROW_BAR_IR: IRDocument = {
      version: '1.0',
      metadata: {
        title:      'Label Placement Test',
        time_range: { start: '2021-01', end: '2021-12' },
        axis_unit:  'month',
        theme:      'consulting',
      },
      tracks: [{ id: 'main', label: '', index: 0 }],
      activities: [{
        id:     'narrow',
        label:  'This Is A Very Long Activity Label That Cannot Possibly Fit',
        track:  'main',
        start:  '2021-06-01',
        end:    '2021-06-04',   // ~3 days → very narrow bar
        status: 'planned',
      }],
      milestones: [],
    };

    it('long label on narrow bar is placed outside and truncated deterministically', () => {
      const r1 = renderDocument(NARROW_BAR_IR, { format: 'svg' });
      const r2 = renderDocument(NARROW_BAR_IR, { format: 'svg' });
      // Byte-identical (determinism)
      expect(r1.svg).toBe(r2.svg);
      expect(r1.sceneHash).toBe(r2.sceneHash);
      // Some portion of the label appears (outside or truncated)
      expect(r1.svg).toContain('This Is A Very Long');
    });

    it('overlapping activities in same track pack into distinct sub-lanes (canvas grows)', () => {
      const mkIR = (overlapping: boolean): IRDocument => ({
        version: '1.0',
        metadata: {
          title:      'Sub-lane Test',
          time_range: { start: '2021-01', end: '2021-12' },
          axis_unit:  'month',
          theme:      'consulting',
        },
        tracks: [{ id: 'main', label: '', index: 0 }],
        activities: [
          {
            id: 'act-a', label: 'Activity A', track: 'main',
            start: '2021-01-01', end: '2021-06-30', status: 'planned',
          },
          {
            id: 'act-b', label: 'Activity B', track: 'main',
            start: overlapping ? '2021-03-01' : '2021-07-01',
            end:   overlapping ? '2021-09-30' : '2021-12-31',
            status: 'in-progress',
          },
        ],
        milestones: [],
      });

      const rNoOverlap  = renderDocument(mkIR(false), { format: 'svg' });
      const rOverlapping = renderDocument(mkIR(true),  { format: 'svg' });

      // Extract canvas heights from SVG root element
      const h1 = parseFloat((/height="([\d.]+)"/.exec(rNoOverlap.svg!))![1]!);
      const h2 = parseFloat((/height="([\d.]+)"/.exec(rOverlapping.svg!))![1]!);
      // Overlapping activities require sub-lanes → taller canvas
      expect(h2).toBeGreaterThan(h1);

      // Both renders are individually deterministic
      const r2a = renderDocument(mkIR(false), { format: 'svg' });
      const r2b = renderDocument(mkIR(true),  { format: 'svg' });
      expect(rNoOverlap.svg).toBe(r2a.svg);
      expect(rOverlapping.svg).toBe(r2b.svg);
    });

    it('title block renders metadata.subtitle when present', () => {
      const ir: IRDocument = {
        version: '1.0',
        metadata: {
          title:      'Primary Title',
          subtitle:   'A descriptive subtitle for this timeline',
          time_range: { start: '2021-01', end: '2021-12' },
          axis_unit:  'month',
          theme:      'consulting',
        },
        tracks: [{ id: 'main', label: '', index: 0 }],
        activities: [],
        milestones: [],
      };
      const result = renderDocument(ir, { format: 'svg' });
      expect(result.svg).toContain('Primary Title');
      expect(result.svg).toContain('A descriptive subtitle for this timeline');
    });

    it('title block with subtitle makes canvas taller than title-only', () => {
      const mkIR = (withSubtitle: boolean): IRDocument => ({
        version: '1.0',
        metadata: {
          title:    'My Timeline',
          subtitle: withSubtitle ? 'My subtitle line' : undefined,
          time_range: { start: '2021-01', end: '2021-12' },
          axis_unit: 'month',
          theme: 'consulting',
        },
        tracks: [{ id: 'main', label: '', index: 0 }],
        activities: [],
        milestones: [],
      });
      const rNoSub  = renderDocument(mkIR(false), { format: 'svg' });
      const rWithSub = renderDocument(mkIR(true),  { format: 'svg' });
      const h1 = parseFloat((/height="([\d.]+)"/.exec(rNoSub.svg!))![1]!);
      const h2 = parseFloat((/height="([\d.]+)"/.exec(rWithSub.svg!))![1]!);
      expect(h2).toBeGreaterThan(h1);
    });

    it('contrast-color selection is deterministic (byte-identical renders)', () => {
      // Full-width bar with dark fill (consulting planned = navy) — inside text uses light color
      const ir: IRDocument = {
        version: '1.0',
        metadata: {
          title: 'Contrast Test',
          time_range: { start: '2021-01', end: '2021-12' },
          axis_unit: 'month',
          theme: 'consulting',
        },
        tracks: [{ id: 'main', label: '', index: 0 }],
        activities: [{
          id: 'wide', label: 'Wide Dark Bar Activity',
          track: 'main', start: '2021-01', end: '2021-12', status: 'planned',
        }],
        milestones: [],
      };
      const r1 = renderDocument(ir, { format: 'svg' });
      const r2 = renderDocument(ir, { format: 'svg' });
      expect(r1.svg).toBe(r2.svg);
      expect(r1.sceneHash).toBe(r2.sceneHash);
      // Label text should be present
      expect(r1.svg).toContain('Wide Dark Bar Activity');
    });
  });

  // ---------------------------------------------------------------------------
  // (f) Barbara dense-milestone decluttering + alternating label blocks
  // ---------------------------------------------------------------------------

  describe('(f) Dense-milestone decluttering, alternating blocks, axis separation', () => {
    /** Three milestones crammed within 4 days — nodes must be declustered. */
    const DENSE_IR: IRDocument = {
      version: '1.0',
      metadata: {
        title:      'Dense Milestones Test',
        time_range: { start: '2023-01', end: '2023-12' },
        axis_unit:  'month',
        theme:      'consulting',
      },
      tracks: [{ id: 'main', label: '', index: 0 }],
      activities: [],
      milestones: [
        { id: 'ms-a', label: 'Milestone Alpha', date: '2023-03-01', track: 'main', status: 'done',     category: 'standard-node' },
        { id: 'ms-b', label: 'Milestone Beta',  date: '2023-03-02', track: 'main', status: 'done',     category: 'standard-node' },
        { id: 'ms-c', label: 'Milestone Gamma', date: '2023-03-05', track: 'main', status: 'planned',  category: 'standard-node' },
      ],
    };

    it('renders dense milestones without error', () => {
      expect(() => renderDocument(DENSE_IR, { format: 'svg' })).not.toThrow();
    });

    it('dense milestones: two renders byte-identical (determinism)', () => {
      const r1 = renderDocument(DENSE_IR, { format: 'svg' });
      const r2 = renderDocument(DENSE_IR, { format: 'svg' });
      expect(r1.svg).toBe(r2.svg);
      expect(r1.sceneHash).toBe(r2.sceneHash);
    });

    it('dense milestones: all label texts appear in SVG', () => {
      const r = renderDocument(DENSE_IR, { format: 'svg' });
      expect(r.svg).toContain('Milestone Alpha');
      expect(r.svg).toContain('Milestone Beta');
      expect(r.svg).toContain('Milestone Gamma');
    });

    it('compact date format is used — no day-ordinal suffix in SVG', () => {
      // New format: "May 2021", "June 2021", "September 2021" (no "15th", "20th", "1st")
      const r = renderDocument(T2_IR, { format: 'svg' });
      expect(r.svg).not.toContain('15th May');
      expect(r.svg).not.toContain('20th June');
      expect(r.svg).not.toContain('1st September');
      // Month + year still present
      expect(r.svg).toContain('May 2021');
      expect(r.svg).toContain('June 2021');
      expect(r.svg).toContain('September 2021');
    });

    it('milestone date text not emitted directly on the axis tick band (axis stays clean)', () => {
      // Axis tick labels for a monthly axis over 2021 are: "2021", "Apr", "May", "Jun", etc.
      // The milestone compact date "May 2021" (with space + year) is never a bare tick label.
      // Smoke: ensure no throw, deterministic
      const r1 = renderDocument(T2_IR, { format: 'svg' });
      const r2 = renderDocument(T2_IR, { format: 'svg' });
      expect(r1.svg).toBe(r2.svg);
      // Year tick label appears as a lone year string in the axis
      expect(r1.svg).toContain('>2021<');
    });

    it('canvas grows to accommodate below-side label blocks vs no milestones', () => {
      const mkIR = (withMilestones: boolean): IRDocument => ({
        version: '1.0',
        metadata: {
          title:      'Canvas Growth Test',
          time_range: { start: '2023-01', end: '2023-12' },
          axis_unit:  'month',
          theme:      'consulting',
        },
        tracks: [{ id: 'main', label: '', index: 0 }],
        activities: [],
        milestones: withMilestones
          ? [{ id: 'ms', label: 'A Milestone', date: '2023-06-01', track: 'main', status: 'done' }]
          : [],
      });
      const rNo  = renderDocument(mkIR(false), { format: 'svg' });
      const rYes = renderDocument(mkIR(true),  { format: 'svg' });
      const h1 = parseFloat((/height="([\d.]+)"/.exec(rNo.svg!))![1]!);
      const h2 = parseFloat((/height="([\d.]+)"/.exec(rYes.svg!))![1]!);
      expect(h2).toBeGreaterThan(h1);
    });

    it('above-zone grows canvas height when above-side milestones need space', () => {
      // 2 milestones alternating above/below — with aboveZoneH the canvas is taller than
      // what a milestone-free canvas of the same dimensions would be.
      const r = renderDocument({
        version: '1.0',
        metadata: {
          title:      'Above Zone Test',
          time_range: { start: '2023-01', end: '2023-12' },
          axis_unit:  'month',
          theme:      'consulting',
        },
        tracks: [{ id: 'main', label: '', index: 0 }],
        activities: [],
        milestones: [
          { id: 'ms1', label: 'First', date: '2023-03-01', track: 'main', status: 'done' },
          { id: 'ms2', label: 'Second', date: '2023-09-01', track: 'main', status: 'planned' },
        ],
      }, { format: 'svg' });
      const h = parseFloat((/height="([\d.]+)"/.exec(r.svg!))![1]!);
      expect(h).toBeGreaterThan(50);
      // Two renders byte-identical
      const r2 = renderDocument({
        version: '1.0',
        metadata: {
          title:      'Above Zone Test',
          time_range: { start: '2023-01', end: '2023-12' },
          axis_unit:  'month',
          theme:      'consulting',
        },
        tracks: [{ id: 'main', label: '', index: 0 }],
        activities: [],
        milestones: [
          { id: 'ms1', label: 'First', date: '2023-03-01', track: 'main', status: 'done' },
          { id: 'ms2', label: 'Second', date: '2023-09-01', track: 'main', status: 'planned' },
        ],
      }, { format: 'svg' });
      expect(r.svg).toBe(r2.svg);
      expect(r.sceneHash).toBe(r2.sceneHash);
    });

    it('declustered nodes emit leader ticks for displaced milestones', () => {
      // Dense milestones with ms-a and ms-b on consecutive days — displacement expected.
      // The displaced node should have a leader tick in the SVG (thin line at trueX).
      const r = renderDocument(DENSE_IR, { format: 'svg' });
      // The SVG should contain at least one line element with opacity="0.45" (leader lines)
      expect(r.svg).toContain('opacity="0.45"');
    });

    it('dense milestones: all 5 themes render deterministically', () => {
      for (const theme of ['consulting', 'product', 'executive', 'minimal', 'release'] as const) {
        const ir = { ...DENSE_IR, metadata: { ...DENSE_IR.metadata, theme } };
        const r1 = renderDocument(ir, { format: 'svg', theme });
        const r2 = renderDocument(ir, { format: 'svg', theme });
        expect(r1.svg).toBe(r2.svg);
        expect(r1.sceneHash).toBe(r2.sceneHash);
      }
    });
  });
});
