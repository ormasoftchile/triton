import { describe, it, expect } from 'vitest';
import { renderSync, compileSync, getThemePreset } from '../src/index.js';

describe('Editorial Theme & Focal Highlighting', () => {
  it('provides editorial and editorial-dark presets', () => {
    const light = getThemePreset('editorial');
    expect(light.name).toBe('editorial');
    expect(light.palette.background).toBe('#F5F5F5');
    expect(light.palette.primary).toBe('#EB6C36');

    const dark = getThemePreset('editorial-dark');
    expect(dark.name).toBe('editorial-dark');
    expect(dark.palette.background).toBe('#2D3142');
    expect(dark.palette.primary).toBe('#F08A59');
  });

  it('renders flowchart in editorial theme with focal node', () => {
    const src = `---
theme: editorial
---
flowchart LR
  A[Client] --> B[API Gateway]:::focal
  B --> C[Service]
`;
    const res = renderSync(src);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toContain('#F5F5F5');
      expect(res.value).toContain('#EB6C36');
    }
  });

  it('renders callout overlay with italic serif styling', () => {
    const src = `timeline
  title Product Evolution
  callout "Key milestone achieved" at Launch
  2024 : Launch
`;
    const res = renderSync(src);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toContain('Key milestone achieved');
      expect(res.value).toContain('Instrument Serif');
    }
  });

  it('renders callout overlay in flowchart', () => {
    const src = `flowchart LR
  A[Client] --> B[API Gateway]
  callout "Bottleneck under peak load" at B
`;
    const res = renderSync(src);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toContain('Bottleneck under peak load');
      expect(res.value).toContain('Instrument Serif');
    }
  });
});

describe('Fishbone Diagram', () => {
  it('renders a fishbone diagram with categories and causes', () => {
    const src = `fishbone
  title "Delivery Delay Root Cause Analysis"
  effect "Late Deliveries"

  category Machine
    "GPS routing glitch"
    "Vehicle maintenance"

  category Method
    "Manual dispatching"
    "No live tracking"

  category People
    "Driver shortage"
`;
    const res = renderSync(src);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toContain('Late Deliveries');
      expect(res.value).toContain('Delivery Delay Root Cause Analysis');
      expect(res.value).toContain('Machine');
      expect(res.value).toContain('GPS routing glitch');
      expect(res.value).toContain('People');
    }
  });
});

describe('Pyramid & Funnel Diagram', () => {
  it('renders a pyramid diagram', () => {
    const src = `pyramid
  title "Data Maturity"
  "Self-Service AI" :focal
  "Data Pipelines"
  "Raw Storage"
`;
    const res = renderSync(src);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toContain('Self-Service AI');
      expect(res.value).toContain('Data Pipelines');
      expect(res.value).toContain('Raw Storage');
    }
  });

  it('renders a funnel diagram with values', () => {
    const src = `funnel
  title "Sales Pipeline"
  "10k Leads" : 10000
  "2k Qualified" : 2000
  "500 Deals" : 500
  "100 Won" : 100
`;
    const res = renderSync(src);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toContain('10k Leads');
      expect(res.value).toContain('100 Won');
      expect(res.value).toContain('10000');
    }
  });
});

describe('Loop / Flywheel Diagram', () => {
  it('renders a reinforcing loop with shared hub', () => {
    const src = `loop
  title "Customer Engagement Loop"
  hub "Customer 360 Hub"

  step "Collect Telemetry"
  step "Train Models" :focal
  step "Personalize Experience"
  step "Boost Retention"
`;
    const res = renderSync(src);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toContain('Customer 360 Hub');
      expect(res.value).toContain('Collect Telemetry');
      expect(res.value).toContain('Train Models');
      expect(res.value).toContain('Boost Retention');
    }
  });
});
