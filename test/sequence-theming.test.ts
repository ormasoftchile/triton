import { describe, it, expect } from 'vitest';
import { renderSync } from '../src/index.js';
import { bwLightTheme, defaultTheme, executiveTheme } from '../src/theme/preset.js';

describe('Sequence Diagram Theming & Contrast', () => {
  const sampleSequence = `sequenceDiagram
    autonumber
    actor User
    participant Server as App Server
    participant DB as Database

    User->>+Server: POST /login
    Server->>+DB: Query user
    DB-->>-Server: User row
    alt Successful auth
        Server-->>-User: 200 OK
    else Bad credentials
        Server-->>User: 401 Unauthorized
    end
    loop Heartbeat
        User->>Server: Ping
        Server-->>User: Pong
    end
    opt Optional audit
        Server->>DB: Log event
    end
    Note over User,Server: TLS encrypted
`;

  it('renders legible high-contrast fragment group tab labels in bw-light theme', () => {
    const res = renderSync(sampleSequence, undefined, 'svg', 'bw-light');
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const svg = res.value;

    // Group labels ALT, LOOP, OPT must use high-contrast dark text (#171717) on the surface tab,
    // rather than white (#FFFFFF) on light background.
    expect(svg).toMatch(/<text[^>]*>ALT<\/text>/);
    expect(svg).toMatch(/<text[^>]*>LOOP<\/text>/);
    expect(svg).toMatch(/<text[^>]*>OPT<\/text>/);

    // In bw-light, the tab text must be dark (#171717)
    expect(svg).toContain(`fill="${bwLightTheme.palette.text}" font-weight="bold">ALT</text>`);
    expect(svg).toContain(`fill="${bwLightTheme.palette.text}" font-weight="bold">LOOP</text>`);
    expect(svg).toContain(`fill="${bwLightTheme.palette.text}" font-weight="bold">OPT</text>`);

    // The group conditions [Successful auth], [Bad credentials], etc. must also be high-contrast
    expect(svg).toContain(`fill="${bwLightTheme.palette.text}" font-weight="bold">[Successful auth]</text>`);
    expect(svg).toContain(`fill="${bwLightTheme.palette.text}">[Bad credentials]</text>`);
  });

  it('renders visible lifelines and fragment borders in bw-light theme', () => {
    const res = renderSync(sampleSequence, undefined, 'svg', 'bw-light');
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const svg = res.value;

    // Lifelines should have a distinct stroke (#D4D4D4) and 1.5 stroke-width with 4 4 dash
    expect(svg).toContain(`stroke="${bwLightTheme.palette.border}" stroke-width="1.5" fill="none" stroke-dasharray="4 4"`);

    // Fragment outer boxes should have stroke-width="1.5"
    expect(svg).toContain(`stroke="${bwLightTheme.palette.border}" stroke-width="1.5" rx="4"`);

    // Fragment divider lines (else) should be visible
    expect(svg).toContain(`stroke="${bwLightTheme.palette.border}" stroke-width="1.2" fill="none" stroke-dasharray="5 4"`);
  });

  it('renders actor headers with readable text according to theme primary', () => {
    const resBwLight = renderSync(sampleSequence, undefined, 'svg', 'bw-light');
    expect(resBwLight.ok).toBe(true);
    if (!resBwLight.ok) return;

    // User is an actor, so filled with primary (#525252 in bw-light).
    // Text should be white (#FFFFFF) for high contrast on dark charcoal.
    expect(resBwLight.value).toContain(`fill="#FFFFFF" text-anchor="middle" font-weight="bold">User</text>`);

    const resExec = renderSync(sampleSequence, undefined, 'svg', 'executive');
    expect(resExec.ok).toBe(true);
    if (!resExec.ok) return;

    // In executive theme, actor text should also be readable on primary
    expect(resExec.value).toContain('User</text>');
  });

  it('scales arrowheads with theme.edges.arrowSize dynamically', () => {
    const resDefault = renderSync(sampleSequence, undefined, 'svg', 'default');
    expect(resDefault.ok).toBe(true);
    if (!resDefault.ok) return;

    // Default arrowSize is 8 -> markerWidth="8" markerHeight="5.6"
    expect(resDefault.value).toContain('id="seq-arrow" markerWidth="8" markerHeight="5.6" refX="7" refY="2.8"');
    expect(resDefault.value).toContain('id="seq-open" markerWidth="9" markerHeight="6.4" refX="8" refY="3.2"');

    // Custom arrowSize: 5
    const resCustom = renderSync(sampleSequence, { edges: { arrowSize: 5 } }, 'svg');
    expect(resCustom.ok).toBe(true);
    if (!resCustom.ok) return;

    expect(resCustom.value).toContain('id="seq-arrow" markerWidth="5" markerHeight="3.5" refX="4" refY="1.75"');
    expect(resCustom.value).toContain('id="seq-open" markerWidth="6" markerHeight="4" refX="5" refY="2"');
  });

  it('renders correctly across all built-in theme presets', () => {
    const themes = ['default', 'bw-light', 'bw-dark', 'executive', 'minimal', 'consulting', 'product', 'bytebytego'];
    for (const theme of themes) {
      const res = renderSync(sampleSequence, undefined, 'svg', theme);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value).toContain('<svg');
        expect(res.value).toContain('ALT</text>');
        expect(res.value).toContain('LOOP</text>');
        expect(res.value).toContain('OPT</text>');
      }
    }
  });
});
