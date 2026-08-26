import { describe, it, expect } from 'vitest';
import { render } from '../src/frontend/index.js';
import { poster } from '../src/diagrams/triton/poster/index.js';
import { layoutPoster } from '../src/diagrams/triton/poster/layout.js';
import { defaultTheme } from '../src/theme/preset.js';

describe('poster with packet-beta', () => {
  it('case 1: standard cell with packet-beta and title', async () => {
    const src = `poster "Packet Poster"
  columns 1
  cell "TCP Packet"
    packet-beta
    title TCP Header
    0-15: "Source Port"
    16-31: "Dest Port"
  end
`;
    const res = await render(src);
    expect(res.ok).toBe(true);
    if (!res.ok) console.error(res.error);
    expect(res.ok ? res.value : '').toContain('Source Port');
    expect(res.ok ? res.value : '').toContain('Dest Port');
  });

  it('case 2: cell with packet-beta without title', async () => {
    const src = `poster "Packet Poster"
  columns 1
  cell "TCP Packet"
    packet-beta
    0-15: "Source Port"
    16-31: "Dest Port"
  end
`;
    const res = await render(src);
    expect(res.ok).toBe(true);
    if (!res.ok) console.error(res.error);
    expect(res.ok ? res.value : '').toContain('Source Port');
  });

  it('case 3: cell with bare labels', async () => {
    const src = `poster "Packet Poster"
  columns 1
  cell "TCP Packet"
    packet-beta
    0-15: Source Port
    16-31: Dest Port
  end
`;
    const res = await render(src);
    expect(res.ok).toBe(true);
    if (!res.ok) console.error(res.error);
    expect(res.ok ? res.value : '').toContain('Source Port');
  });

  it('case 4: explicit :: packet-beta annotation without inner packet-beta header', async () => {
    const src = `poster "Packet Poster"
  columns 1
  cell "TCP Packet" :: packet-beta
    0-15: "Source Port"
    16-31: "Dest Port"
  end
`;
    const res = await render(src);
    expect(res.ok).toBe(true);
    if (!res.ok) console.error(res.error);
    expect(res.ok ? res.value : '').toContain('Source Port');
  });

  it('case 5: explicit :: packet annotation without inner header', async () => {
    const src = `poster "Packet Poster"
  columns 1
  cell "TCP Packet" :: packet
    0-15: "Source Port"
    16-31: "Dest Port"
  end
`;
    const res = await render(src);
    expect(res.ok).toBe(true);
    if (!res.ok) console.error(res.error);
    expect(res.ok ? res.value : '').toContain('Source Port');
  });

  it('case 6: packet header without -beta (packet)', async () => {
    const src = `poster "Packet Poster"
  columns 1
  cell "TCP Packet"
    packet
    0-15: "Source Port"
    16-31: "Dest Port"
  end
`;
    const res = await render(src);
    expect(res.ok).toBe(true);
    if (!res.ok) console.error(res.error);
    expect(res.ok ? res.value : '').toContain('Source Port');
  });

  it('case 7: packet-beta with comments inside', async () => {
    const src = `poster "Packet Poster"
  columns 1
  cell "TCP Packet"
    %% Comment before
    packet-beta
    %% Comment after header
    0-15: "Source Port"
    %% Comment between fields
    16-31: "Dest Port"
  end
`;
    const res = await render(src);
    expect(res.ok).toBe(true);
    if (!res.ok) console.error(res.error);
    expect(res.ok ? res.value : '').toContain('Source Port');
  });

  it('case 8: packet-beta with single bit flags and ranges', async () => {
    const src = `poster "Packet Poster"
  columns 1
  cell "TCP Packet"
    packet-beta
    0-3: "Data Offset"
    4-9: "Reserved"
    10: "URG"
    11: "ACK"
    12: "PSH"
    13: "RST"
    14: "SYN"
    15: "FIN"
    16-31: "Window Size"
  end
`;
    const res = await render(src);
    expect(res.ok).toBe(true);
    if (!res.ok) console.error(res.error);
    expect(res.ok ? res.value : '').toContain('URG');
    expect(res.ok ? res.value : '').toContain('Window Size');
  });

  it('case 9: direct poster.parseMermaid and layout without preprocessComments', async () => {
    const src = `poster "Direct Parse"
  columns 1
  cell "TCP Packet"
    packet-beta
    0-15: "Source"
    16-31: "Dest"
  end
`;
    const doc = poster.parseMermaid(src);
    expect(doc.cells[0]?.content.kind).toBe('diagram');
    const layout = layoutPoster(doc, defaultTheme);
    expect(layout.scene.elements.length).toBeGreaterThan(0);
  });

  it('case 10: direct poster.parseMermaid with comments in cell', async () => {
    const src = `poster "Direct Parse"
  columns 1
  cell "TCP Packet"
    packet-beta
    %% note
    0-15: "Source"
    16-31: "Dest"
  end
`;
    const doc = poster.parseMermaid(src);
    expect(doc.cells[0]?.content.kind).toBe('diagram');
  });

  it('case 11: packet-beta with multi-row fields spanning > 32 bits', async () => {
    const src = `poster "Packet Multi-row"
  columns 1
  cell "IP & TCP"
    packet-beta
    0-15: "Source Port"
    16-31: "Dest Port"
    32-63: "Sequence Number"
  end
`;
    const res = await render(src);
    expect(res.ok).toBe(true);
    if (!res.ok) console.error(res.error);
    expect(res.ok ? res.value : '').toContain('Sequence Number');
  });

  it('case 12: cell ID and title in 2-column poster with flowchart and packet-beta', async () => {
    const src = `poster "System Overview"
  columns 2

  cell pipeline "Pipeline" :: flow
    flowchart LR
      Ingest --> Parse --> Validate
  end

  cell pkt "Packet Layout" :: packet-beta
    0-7: "Type"
    8-15: "Code"
    16-31: "Checksum"
  end
`;
    const res = await render(src);
    expect(res.ok).toBe(true);
    if (!res.ok) console.error(res.error);
    expect(res.ok ? res.value : '').toContain('Ingest');
    expect(res.ok ? res.value : '').toContain('Checksum');
  });

  it('case 13: cell with caption and note annotations', async () => {
    const src = `poster "Annotated Packet"
  columns 1

  cell pkt "Frame Format"
    packet-beta
    0-15: "Header"
    16-31: "Payload"
    caption "Ethernet Frame"
    note "Fixed size" at top-right
  end
`;
    const res = await render(src);
    expect(res.ok).toBe(true);
    if (!res.ok) console.error(res.error);
    expect(res.ok ? res.value : '').toContain('Ethernet Frame');
    expect(res.ok ? res.value : '').toContain('Fixed size');
  });

  it('case 14: spaces around dash in range: 0 - 15: "Source"', async () => {
    const src = `poster "Spaced Range"
  columns 1
  cell "TCP"
    packet-beta
    0 - 15: "Source"
    16 - 31: "Dest"
  end
`;
    const res = await render(src);
    expect(res.ok).toBe(true);
    if (!res.ok) console.error(res.error);
  });

  it('case 15: title with colon: title: TCP Header', async () => {
    const src = `poster "Title Colon"
  columns 1
  cell "TCP"
    packet-beta
    title: TCP Header
    0-15: "Source"
  end
`;
    const res = await render(src);
    expect(res.ok).toBe(true);
    if (!res.ok) console.error(res.error);
  });

  it('case 16: cell without :: but with id matching diagram keyword', async () => {
    const src = `poster "Keyword Cell"
  columns 1
  cell packet-beta
    0-15: "Source"
    16-31: "Dest"
  end
`;
    const res = await render(src);
    expect(res.ok).toBe(true);
    if (!res.ok) console.error(res.error);
    const doc = poster.parseMermaid(src);
    expect(doc.cells[0]?.content.kind).toBe('diagram');
  });

  it('case 17: renders network-packet.mmd example file and saves network-packet.svg', async () => {
    const { readFileSync, writeFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const mmdPath = resolve('examples/triton/poster/network-packet.mmd');
    const svgPath = resolve('examples/triton/poster/network-packet.svg');
    const src = readFileSync(mmdPath, 'utf8');
    const res = await render(src);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toContain('TCP Segment Header');
      expect(res.value).toContain('Packet Processing Pipeline');
      expect(res.value).toContain('10 Gbps');
      writeFileSync(svgPath, res.value, 'utf8');
    }
  });
});

