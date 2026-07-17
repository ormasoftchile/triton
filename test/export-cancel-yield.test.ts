import { describe, expect, it, vi } from 'vitest';

const renderStats = vi.hoisted(() => ({ renders: 0 }));

vi.mock('@resvg/resvg-wasm', () => ({
  initWasm: vi.fn(async () => undefined),
  Resvg: class {
    render() {
      renderStats.renders += 1;
      return {
        pixels: new Uint8Array([255, 0, 0, 255]).buffer,
        asPng: () => new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
        width: 1,
        height: 1,
        free() {},
      };
    }

    free() {}
  },
}));

import { ExportCancelledError, exportAnimatedPng } from '../src/export/index.js';

const animatedSvg = `<svg viewBox="0 0 10 10" width="10" height="10" xmlns="http://www.w3.org/2000/svg">
  <path d="M 0 5 L 10 5" stroke="#000" stroke-width="1" fill="none" stroke-dasharray="4 2">
    <animate attributeName="stroke-dashoffset" from="0" to="-6" dur="2s" repeatCount="indefinite"/>
  </path>
</svg>`;

describe('animated export event-loop yielding', () => {
  it('observes macrotask cancellation between APNG frames without rendering the whole loop', async () => {
    renderStats.renders = 0;
    const controller = new AbortController();
    const progress: Array<readonly [number, number]> = [];

    await expect(exportAnimatedPng(animatedSvg, {
      fps: 5,
      signal: controller.signal,
      onProgress: (done, total) => {
        progress.push([done, total]);
        if (done === 1) setImmediate(() => controller.abort());
      },
    })).rejects.toBeInstanceOf(ExportCancelledError);

    const total = progress[0]?.[1] ?? 0;
    expect(total).toBeGreaterThan(1);
    expect(renderStats.renders).toBeLessThan(total);
    expect(progress.length).toBeLessThan(total);
  });
});
