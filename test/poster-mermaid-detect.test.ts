import { describe, it, expect } from 'vitest';
import { render } from '../src/frontend/index.js';

async function renderPosterCell(title: string, lines: readonly string[]) {
  const src = [
    'poster "Mermaid Detect"',
    '    columns 1',
    '',
    `    cell cell "${title}"`,
    ...lines.map(line => `        ${line}`),
    '    end',
    '',
  ].join('\n');

  const result = await render(src);
  if (!result.ok) throw new Error(`${title}: ${result.error.code} — ${result.error.message}`);
  return result.value;
}

describe('poster embedded Mermaid detection', () => {
  it('renders graph cells as flowcharts instead of degrading to text', async () => {
    const svg = await renderPosterCell('Graph', [
      'graph TD',
      '  Start[Poster Graph Start] --> Finish[Poster Graph Finish]',
    ]);

    expect(svg).toContain('Poster Graph Start');
    expect(svg).toContain('Poster Graph Finish');
    expect(svg).not.toContain('graph TD');
  });

  it('renders block-beta cells as block diagrams instead of degrading to text', async () => {
    const svg = await renderPosterCell('Block', [
      'block-beta',
      '  columns 2',
      '  Front["Poster Block Front"]',
      '  Back["Poster Block Back"]',
      '  Front --> Back',
    ]);

    expect(svg).toContain('Poster Block Front');
    expect(svg).toContain('Poster Block Back');
    expect(svg).not.toContain('block-beta');
  });

  it('renders C4Context cells as C4 diagrams instead of degrading to text', async () => {
    const svg = await renderPosterCell('C4', [
      'C4Context',
      '  title Poster C4 Context',
      '  Person(user, "Poster User", "Uses the poster app.")',
      '  System(app, "Poster App", "Renders embedded diagrams.")',
      '  Rel(user, app, "Uses")',
    ]);

    expect(svg).toContain('Poster User');
    expect(svg).toContain('Poster App');
    expect(svg).not.toContain('C4Context');
  });

  it('renders packet-beta cells as packet diagrams instead of degrading to text', async () => {
    const svg = await renderPosterCell('Packet', [
      'packet-beta',
      '  title Poster Packet',
      '  0-3: "Poster Offset"',
      '  16-31: "Poster Window"',
    ]);

    expect(svg).toContain('Poster Offset');
    expect(svg).toContain('Poster Window');
    expect(svg).not.toContain('packet-beta');
  });
});
