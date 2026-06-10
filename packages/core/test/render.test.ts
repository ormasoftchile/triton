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
      expect(result.svg).toContain('Application Deadline');
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
});
