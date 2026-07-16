import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { Resvg } from '@resvg/resvg-js';
import UPNG from 'upng-js';
import { ANIMATION_PERIOD_SECONDS, marchDashoffsetAt, pointAtPathFraction } from '../src/animation/index.js';
import { renderSync } from '../src/frontend/index.js';
import { bakeFrame, encodeApng, ExportCancelledError, exportAnimatedPng, exportStaticPng, initExportWasm, planLoop, renderToPng } from '../src/export/index.js';

const require = createRequire(import.meta.url);
const marchingAntsUrl = new URL('../examples/mermaid/animated/marching-ants.mmd', import.meta.url);

const animatedSvg = `<svg viewBox="0 0 120 40" width="120" height="40" xmlns="http://www.w3.org/2000/svg">
  <path d="M 0 10 L 100 10" stroke="#000" stroke-width="2" fill="none" stroke-dasharray="4 2">
    <animate attributeName="stroke-dashoffset" from="0" to="-6" dur="0.8s" repeatCount="indefinite"/>
  </path>
  <path d="M 0 20 L 100 20" stroke="#000" stroke-width="2" fill="none" stroke-dasharray="100 100">
    <animate attributeName="stroke-dashoffset" values="0;100;0" dur="2.4s" repeatCount="indefinite"/>
  </path>
  <defs>
    <linearGradient id="flow">
      <stop offset="20%" stop-color="#fff"><animate attributeName="offset" values="0%;60%;100%" dur="1.6s" repeatCount="indefinite"/></stop>
    </linearGradient>
  </defs>
  <circle r="4" fill="#000">
    <animateMotion dur="1.6s" begin="0s" repeatCount="indefinite" path="M 0 0 L 100 0"/>
  </circle>
</svg>`;

function expectResvgParses(svg: string): void {
  expect(() => new Resvg(svg)).not.toThrow();
}

async function renderMarchingAntsSvg(): Promise<string> {
  const source = await readFile(marchingAntsUrl, 'utf8');
  const rendered = renderSync(source);
  if (!rendered.ok) throw new Error(`${rendered.error.code}: ${rendered.error.message}`);
  return rendered.value;
}

describe('animated export core', () => {
  it('bakes animated SVG into static SVG and strips SMIL tags', () => {
    const baked = bakeFrame(animatedSvg, 0);
    expect(baked).toMatch(/^<svg /);
    expect(baked).toContain('</svg>');
    expect(baked).not.toMatch(/<animate\b|<animateMotion\b|<animateTransform\b/);
    expect(baked).toContain('stroke-dashoffset="0"');
    expect(baked).toContain('<circle r="4" fill="#000" cx="0" cy="0"/>');
  });

  it('bakes march dashoffset via shared animation math', () => {
    const t = ANIMATION_PERIOD_SECONDS.march / 2;
    const baked = bakeFrame(animatedSvg, t);
    expect(baked).toContain(`stroke-dashoffset="${marchDashoffsetAt(t, '4 2')}"`);
  });

  it('does not treat a self-closing path as an animated path block opener', () => {
    const svg = `<svg viewBox="0 0 120 40" width="120" height="40" xmlns="http://www.w3.org/2000/svg">
      <path d="M 0 5 L 100 5" stroke="#777" fill="none" marker-end="url(#arrow)" />
      <path d="M 0 10 L 100 10" stroke="#000" fill="none" stroke-dasharray="4 2">
        <animate attributeName="stroke-dashoffset" from="0" to="-6" dur="0.8s" repeatCount="indefinite"/>
      </path>
      <path d="M 0 20 L 100 20" stroke="#333" fill="none" stroke-dasharray="100 100">
        <animate attributeName="stroke-dashoffset" values="0;100;0" dur="2.4s" repeatCount="indefinite"/>
      </path>
    </svg>`;
    const baked = bakeFrame(svg, 0);
    expect(baked).toContain('<path d="M 0 5 L 100 5" stroke="#777" fill="none" marker-end="url(#arrow)" />');
    expect(baked).toContain('stroke-dashoffset="0"');
    expect(baked).not.toMatch(/\/\s+stroke-dashoffset=/);
    expect(baked).not.toMatch(/<animate\b/);
    expectResvgParses(baked);
  });

  it('bakes motion circles to their path start for static PNG export', () => {
    const svg = `<svg viewBox="0 0 120 40" width="120" height="40" xmlns="http://www.w3.org/2000/svg">
      <circle r="3" fill="#f00">
        <animateMotion dur="1.6s" begin="0s" repeatCount="indefinite" path="M 25 30 L 100 30"/>
      </circle>
    </svg>`;
    const baked = bakeFrame(svg, 0);
    expect(baked).toContain('<circle r="3" fill="#f00" cx="25" cy="30"/>');
    expect(baked).not.toMatch(/<animateMotion\b/);
    expectResvgParses(baked);
  });

  it('bakes rendered marching-ants frames into parseable SVG', async () => {
    const svg = await renderMarchingAntsSvg();
    for (const t of [0, ANIMATION_PERIOD_SECONDS.march / 3]) {
      const baked = bakeFrame(svg, t);
      expect(baked).not.toMatch(/\/\s+stroke-dashoffset=/);
      expectResvgParses(baked);
    }
  });

  it('plans exact integer frame counts over harmonic loops', () => {
    const single = planLoop(['draw'], 60);
    expect(single.loopSeconds).toBeLessThanOrEqual(2.4);
    expect(single.frameCount).toBe(Math.round((single.loopSeconds * 1000) / single.delayMs));

    const mixed = planLoop(['particle', 'draw'], 60);
    expect(mixed.loopSeconds).toBe(4.8);
    expect(mixed.frameCount).toBe(Math.round((mixed.loopSeconds * 1000) / mixed.delayMs));
  });

  it('samples motion paths at both endpoints', () => {
    const path = 'M 0 0 L 10 0 L 10 10';
    expect(pointAtPathFraction(path, 0)).toEqual({ x: 0, y: 0 });
    expect(pointAtPathFraction(path, 1)).toEqual({ x: 10, y: 10 });
  });

  it('rejects with ExportCancelledError when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(exportAnimatedPng(animatedSvg, { signal: controller.signal })).rejects.toBeInstanceOf(ExportCancelledError);
  });

  it('encodes APNG frames that decode with the same frame count', () => {
    const red = new Uint8Array([255, 0, 0, 255]);
    const blue = new Uint8Array([0, 0, 255, 255]);
    const apng = encodeApng([red, blue], [100, 100], { width: 1, height: 1 });
    const decoded = UPNG.decode(apng.buffer.slice(apng.byteOffset, apng.byteOffset + apng.byteLength));
    expect(decoded.width).toBe(1);
    expect(decoded.height).toBe(1);
    expect(decoded.tabs?.acTL?.num_frames).toBe(2);
  });

  it.skipIf(process.env.TRITON_TEST_RESVG_WASM !== '1')('reports progress once per rendered APNG frame', async () => {
    const wasmBytes = await readFile(require.resolve('@resvg/resvg-wasm/index_bg.wasm'));
    await initExportWasm(wasmBytes);
    const calls: Array<readonly [number, number]> = [];
    await exportAnimatedPng(animatedSvg, {
      fps: 5,
      speed: 10,
      width: 12,
      onProgress: (done, total) => calls.push([done, total]),
    });
    const total = calls[0]?.[1] ?? 0;
    expect(total).toBeGreaterThan(0);
    expect(calls).toHaveLength(total);
    expect(calls.map(([done]) => done)).toEqual(Array.from({ length: total }, (_, i) => i + 1));
    expect(calls.every(([, frameTotal]) => frameTotal === total)).toBe(true);
  });

  it.skipIf(process.env.TRITON_TEST_RESVG_WASM !== '1')('rasters a tiny SVG through resvg-wasm', async () => {
    const wasmBytes = await readFile(require.resolve('@resvg/resvg-wasm/index_bg.wasm'));
    await initExportWasm(wasmBytes);
    const png = await renderToPng('<svg viewBox="0 0 1 1" width="1" height="1" xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1" fill="#fff"/></svg>');
    expect(png.slice(1, 4)).toEqual(new Uint8Array([0x50, 0x4e, 0x47]));
  });

  it.skipIf(process.env.TRITON_TEST_RESVG_WASM !== '1')('static PNG export rasters a baked motion circle', async () => {
    const wasmBytes = await readFile(require.resolve('@resvg/resvg-wasm/index_bg.wasm'));
    await initExportWasm(wasmBytes);
    const png = await exportStaticPng(animatedSvg, { width: 12 });
    expect(png.slice(1, 4)).toEqual(new Uint8Array([0x50, 0x4e, 0x47]));
  });
});
