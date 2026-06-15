import { describe, expect, it } from 'vitest';

import { executive } from '../src/theme-contract/index.js';
import { bindChartTheme } from '../src/grammars/chart/contract-binding.js';
import { bindSankeyTheme } from '../src/grammars/sankey/contract-binding.js';
import { bindGitGraphTheme } from '../src/grammars/gitgraph/contract-binding.js';
import { bindJourneyTheme } from '../src/grammars/journey/contract-binding.js';
import { bindKanbanTheme } from '../src/grammars/kanban/contract-binding.js';
import { bindMindmapTheme } from '../src/grammars/tree/contract-binding.js';
import { bindPacketTheme } from '../src/grammars/packet/contract-binding.js';

function tintColor(hex: string, t: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const tr = Math.round(r + (255 - r) * t);
  const tg = Math.round(g + (255 - g) * t);
  const tb = Math.round(b + (255 - b) * t);
  return `#${tr.toString(16).padStart(2, '0')}${tg.toString(16).padStart(2, '0')}${tb.toString(16).padStart(2, '0')}`;
}

describe('specialized contract bindings', () => {
  it('bindSankeyTheme uses contract background, label color, and categorical prefix', () => {
    const theme = bindSankeyTheme(executive);
    expect(theme.background).toBe(executive.palette.surface);
    expect(theme.labelColor).toBe(executive.palette.ink);
    expect(theme.nodePalette.slice(0, executive.dataPalette.categorical.length)).toEqual(executive.dataPalette.categorical);
  });

  it('bindSankeyTheme is deterministic', () => {
    expect(bindSankeyTheme(executive)).toEqual(bindSankeyTheme(executive));
  });

  it('bindGitGraphTheme uses categorical branch colors and surface background', () => {
    const theme = bindGitGraphTheme(executive);
    expect(theme.background).toBe(executive.palette.surface);
    expect(theme.branchColors).toEqual(executive.dataPalette.categorical);
  });

  it('bindGitGraphTheme is deterministic', () => {
    expect(bindGitGraphTheme(executive)).toEqual(bindGitGraphTheme(executive));
  });

  it('bindJourneyTheme creates a five-step score ramp and categorical actor palette', () => {
    const theme = bindJourneyTheme(executive);
    expect(theme.scoreFills).toHaveLength(5);
    expect(theme.scoreStrokes).toHaveLength(5);
    expect(theme.actorPalette).toEqual(executive.dataPalette.categorical);
  });

  it('bindJourneyTheme is deterministic', () => {
    expect(bindJourneyTheme(executive)).toEqual(bindJourneyTheme(executive));
  });

  it('bindKanbanTheme uses categorical header colors and surface cards', () => {
    const theme = bindKanbanTheme(executive);
    expect(theme.headerColors).toEqual(executive.dataPalette.categorical);
    expect(theme.cardFill).toBe(executive.palette.surface);
  });

  it('bindKanbanTheme is deterministic', () => {
    expect(bindKanbanTheme(executive)).toEqual(bindKanbanTheme(executive));
  });

  it('bindMindmapTheme maps the categorical palette into eight branch colors and accent root', () => {
    const theme = bindMindmapTheme(executive);
    expect(theme.branchPalette).toHaveLength(8);
    expect(theme.rootFill).toBe(executive.palette.accent);
    expect(theme.rootTextColor).toBe(executive.palette.inkInverse);
  });

  it('bindMindmapTheme is deterministic', () => {
    expect(bindMindmapTheme(executive)).toEqual(bindMindmapTheme(executive));
  });

  it('bindPacketTheme derives tinted primary and secondary field fills', () => {
    const theme = bindPacketTheme(executive);
    expect(theme.fieldFill).toBe(tintColor(executive.dataPalette.categorical[0]!, 0.80));
    expect(theme.altFieldFill).toBe(tintColor(executive.dataPalette.categorical[1]!, 0.80));
  });

  it('bindPacketTheme is deterministic', () => {
    expect(bindPacketTheme(executive)).toEqual(bindPacketTheme(executive));
  });

  it('bindChartTheme exposes the categorical palette for pie/quadrant/radar contract renders', () => {
    const theme = bindChartTheme(executive);
    expect(theme.piePalette).toEqual(executive.dataPalette.categorical);
    expect(theme.background).toBe(executive.palette.surface);
  });
});
