#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { build } from 'esbuild';
import { Resvg } from '@resvg/resvg-js';
import UPNG from 'upng-js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const positionalArgs = [];
const optionArgs = new Map();
for (const arg of process.argv.slice(2)) {
  const match = /^--([^=]+)=(.*)$/.exec(arg);
  if (match) optionArgs.set(match[1], match[2]);
  else positionalArgs.push(arg);
}
const demoName = positionalArgs[0] ?? 'comet';
const demos = {
  connectors: { file: join('examples', 'mermaid', 'block', 'connectors.mmd'), output: 'connectors', loopSeconds: 1.6, motionBlurSamples: 1 },
  comet: { file: join('examples', 'mermaid', 'block', 'comet.mmd'), output: 'comet', loopSeconds: 1.8, speed: 0.35, fps: 60, motionBlurSamples: 8, shutter: 0.75 },
  'comet-a': { file: join('examples', 'mermaid', 'block', 'comet.mmd'), output: 'comet-a', loopSeconds: 1.8, speed: 0.5, motionBlurSamples: 4, shutter: 0.5 },
  'comet-b': { file: join('examples', 'mermaid', 'block', 'comet.mmd'), output: 'comet-b', loopSeconds: 1.8, speed: 0.5, motionBlurSamples: 8, shutter: 0.5 },
  'comet-c': { file: join('examples', 'mermaid', 'block', 'comet.mmd'), output: 'comet-c', loopSeconds: 1.8, speed: 0.35, motionBlurSamples: 8, shutter: 0.75 },
};
const demo = demos[demoName];
if (!demo) throw new Error(`Unknown demo "${demoName}". Expected one of: ${Object.keys(demos).join(', ')}`);
const inputPath = join(root, demo.file);
const outDir = join(root, 'examples', 'exports');
const outputName = optionArgs.get('output') ?? demo.output;
const apngPath = join(outDir, `${outputName}.png`);

const LOOP_SECONDS = demo.loopSeconds;
const PLAYBACK_SPEED = parsePositiveNumber(optionArgs.get('speed') ?? process.env.TRITON_ANIM_EXPORT_SPEED ?? demo.speed ?? 1, 'speed');
if (!(PLAYBACK_SPEED > 0)) throw new Error(`Playback speed must be positive; got ${PLAYBACK_SPEED}`);
const EFFECTIVE_LOOP_SECONDS = LOOP_SECONDS / PLAYBACK_SPEED;
const APNG_FPS = parsePositiveNumber(optionArgs.get('fps') ?? process.env.TRITON_ANIM_EXPORT_FPS ?? demo.fps ?? 60, 'fps');
const SCALE = 2;
const MOTION_BLUR_SAMPLES = parsePositiveInteger(
  optionArgs.get('motion-blur-samples') ?? process.env.TRITON_MOTION_BLUR_SAMPLES ?? demo.motionBlurSamples ?? 1,
  'motionBlurSamples',
);
const SHUTTER = parseShutter(optionArgs.get('shutter') ?? process.env.TRITON_ANIM_EXPORT_SHUTTER ?? demo.shutter ?? 1);

function parsePositiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer; got ${value}`);
  return parsed;
}

function parsePositiveNumber(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${name} must be a positive number; got ${value}`);
  return parsed;
}

function parseShutter(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) throw new Error(`shutter must be in (0,1]; got ${value}`);
  return parsed;
}

function exactFrameCount(loopSeconds, targetFps) {
  const idealFrames = loopSeconds * targetFps;
  const frames = Math.max(1, Math.round(idealFrames));
  return {
    frames,
    frameSeconds: loopSeconds / frames,
    effectiveFps: frames / loopSeconds,
    exactAtTargetFps: Math.abs(idealFrames - frames) <= 1e-9,
  };
}

const APNG_TIMING = exactFrameCount(EFFECTIVE_LOOP_SECONDS, APNG_FPS);
const APNG_FRAMES = APNG_TIMING.frames;
const APNG_FRAME_SECONDS = APNG_TIMING.frameSeconds;
const APNG_DELAY_MS = APNG_FRAME_SECONDS * 1000;

const resolveTsJsPlugin = {
  name: 'resolve-ts-from-js',
  setup(builder) {
    builder.onResolve({ filter: /\.js$/ }, args => {
      if (args.kind === 'entry-point' || !args.path.startsWith('.')) return undefined;
      const abs = resolve(args.resolveDir, args.path);
      const ts = abs.replace(/\.js$/, '.ts');
      const tsx = abs.replace(/\.js$/, '.tsx');
      if (existsSync(ts)) return { path: ts };
      if (existsSync(tsx)) return { path: tsx };
      return undefined;
    });
  },
};

async function loadTritonFrontend() {
  const bundled = await build({
    entryPoints: [join(root, 'src', 'frontend', 'index.ts')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    write: false,
    logLevel: 'silent',
    plugins: [resolveTsJsPlugin],
  });
  const code = bundled.outputFiles[0]?.text;
  if (!code) throw new Error('Failed to bundle Triton frontend for POC render');
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  return import(moduleUrl);
}

function formatNum(value) {
  return Number.isFinite(value) ? String(Math.round(value * 1000) / 1000) : '0';
}

function replaceAttr(attrs, name, value) {
  const escaped = String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const attr = `${name}="${escaped}"`;
  const re = new RegExp(`\\s${name}="[^"]*"`);
  return re.test(attrs) ? attrs.replace(re, ` ${attr}`) : `${attrs} ${attr}`;
}

function parseAttrs(attrs) {
  const parsed = new Map();
  for (const match of attrs.matchAll(/([\w:-]+)="([^"]*)"/g)) {
    parsed.set(match[1], match[2].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
  }
  return parsed;
}

function parseSeconds(value, fallback = 0) {
  if (value == null) return fallback;
  const match = /^([+-]?\d+(?:\.\d+)?)s$/.exec(value.trim());
  if (!match) throw new Error(`Unsupported SMIL time value "${value}"`);
  return Number(match[1]);
}

function linearValuesAt(values, durSeconds, tSeconds) {
  const parsed = values.split(';').map(v => {
    const trimmed = v.trim();
    const number = Number.parseFloat(trimmed);
    if (!Number.isFinite(number)) throw new Error(`Invalid SMIL value "${trimmed}"`);
    return { number, suffix: trimmed.replace(/^[+-]?\d+(?:\.\d+)?/, '') };
  });
  if (parsed.length < 2) throw new Error(`Need at least two SMIL values: ${values}`);
  const time = ((tSeconds % durSeconds) + durSeconds) % durSeconds;
  const segmentCount = parsed.length - 1;
  const segmentDuration = durSeconds / segmentCount;
  const segment = Math.min(segmentCount - 1, Math.floor(time / segmentDuration));
  const local = (time - segment * segmentDuration) / segmentDuration;
  const a = parsed[segment];
  const b = parsed[segment + 1];
  if (a.suffix !== b.suffix) throw new Error(`Mixed SMIL value units: ${values}`);
  return `${formatNum(a.number + (b.number - a.number) * local)}${a.suffix}`;
}

function tokenizePath(d) {
  return d.match(/[AaCcHhLlMmQqTtVvZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? [];
}

function isCommand(token) {
  return /^[A-Za-z]$/.test(token);
}

function cubicAt(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  return mt ** 3 * p0 + 3 * mt ** 2 * t * p1 + 3 * mt * t ** 2 * p2 + t ** 3 * p3;
}

function quadAt(p0, p1, p2, t) {
  const mt = 1 - t;
  return mt ** 2 * p0 + 2 * mt * t * p1 + t ** 2 * p2;
}

function flattenPath(d) {
  const tokens = tokenizePath(d);
  const points = [];
  let i = 0;
  let cmd = '';
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;

  const needNumber = () => {
    const token = tokens[i++];
    if (token == null || isCommand(token)) throw new Error(`Invalid SVG path near token ${i}: ${d}`);
    return Number(token);
  };
  const hasNumber = () => tokens[i] != null && !isCommand(tokens[i]);
  const push = (px, py) => {
    points.push({ x: px, y: py });
    x = px;
    y = py;
  };

  while (i < tokens.length) {
    if (isCommand(tokens[i])) cmd = tokens[i++];
    if (!cmd) throw new Error(`SVG path starts without a command: ${d}`);
    const rel = cmd === cmd.toLowerCase();
    const op = cmd.toUpperCase();

    if (op === 'M') {
      const nx = needNumber();
      const ny = needNumber();
      push(rel ? x + nx : nx, rel ? y + ny : ny);
      startX = x;
      startY = y;
      cmd = rel ? 'l' : 'L';
      continue;
    }
    if (op === 'Z') {
      push(startX, startY);
      continue;
    }
    while (hasNumber()) {
      if (op === 'L') {
        const nx = needNumber();
        const ny = needNumber();
        push(rel ? x + nx : nx, rel ? y + ny : ny);
      } else if (op === 'H') {
        const nx = needNumber();
        push(rel ? x + nx : nx, y);
      } else if (op === 'V') {
        const ny = needNumber();
        push(x, rel ? y + ny : ny);
      } else if (op === 'C') {
        const x0 = x;
        const y0 = y;
        const x1 = needNumber();
        const y1 = needNumber();
        const x2 = needNumber();
        const y2 = needNumber();
        const x3 = needNumber();
        const y3 = needNumber();
        const p1 = { x: rel ? x + x1 : x1, y: rel ? y + y1 : y1 };
        const p2 = { x: rel ? x + x2 : x2, y: rel ? y + y2 : y2 };
        const p3 = { x: rel ? x + x3 : x3, y: rel ? y + y3 : y3 };
        for (let step = 1; step <= 48; step++) {
          const t = step / 48;
          points.push({ x: cubicAt(x0, p1.x, p2.x, p3.x, t), y: cubicAt(y0, p1.y, p2.y, p3.y, t) });
        }
        x = p3.x;
        y = p3.y;
      } else if (op === 'Q') {
        const x0 = x;
        const y0 = y;
        const x1 = needNumber();
        const y1 = needNumber();
        const x2 = needNumber();
        const y2 = needNumber();
        const p1 = { x: rel ? x + x1 : x1, y: rel ? y + y1 : y1 };
        const p2 = { x: rel ? x + x2 : x2, y: rel ? y + y2 : y2 };
        for (let step = 1; step <= 32; step++) {
          const t = step / 32;
          points.push({ x: quadAt(x0, p1.x, p2.x, t), y: quadAt(y0, p1.y, p2.y, t) });
        }
        x = p2.x;
        y = p2.y;
      } else {
        throw new Error(`Unsupported SVG path command "${cmd}" in motion path "${d}"`);
      }
    }
  }

  return points;
}

function pointAtPathFraction(path, fraction) {
  const points = flattenPath(path);
  if (points.length === 0) throw new Error(`Empty SVG path: ${path}`);
  if (points.length === 1) return points[0];
  const segments = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length > 0) {
      segments.push({ a, b, length });
      total += length;
    }

  }
  if (total === 0) return points[0];
  let remaining = (((fraction % 1) + 1) % 1) * total;
  for (const segment of segments) {
    if (remaining <= segment.length) {
      const local = remaining / segment.length;
      return {
        x: segment.a.x + (segment.b.x - segment.a.x) * local,
        y: segment.a.y + (segment.b.y - segment.a.y) * local,
      };
    }
    remaining -= segment.length;
  }
  return segments[segments.length - 1].b;
}

function pathLength(path) {
  const points = flattenPath(path);
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

function effectiveAnimationTime(tSeconds, durSeconds, beginSeconds = 0) {
  const effectiveDurSeconds = durSeconds / PLAYBACK_SPEED;
  const effectiveBeginSeconds = beginSeconds / PLAYBACK_SPEED;
  return ((tSeconds - effectiveBeginSeconds) % effectiveDurSeconds + effectiveDurSeconds) % effectiveDurSeconds;
}

function bakeStaticSvg(animatedSvg, tSeconds) {
  let marchCount = 0;
  let flowCount = 0;
  let motionCount = 0;
  const motionSamples = [];
  let svg = animatedSvg.replace(
    /<path\b([^>]*)>\s*<animate\s+attributeName="stroke-dashoffset"\s+from="0"\s+to="-([^"]+)"\s+dur="0\.8s"\s+repeatCount="indefinite"\s*\/>\s*<\/path>/g,
    (_match, attrs, periodText) => {
      marchCount++;
      const period = Number.parseFloat(periodText);
      if (!Number.isFinite(period)) throw new Error(`Invalid march period: ${periodText}`);
      const effectiveDurSeconds = 0.8 / PLAYBACK_SPEED;
      const phase = effectiveAnimationTime(tSeconds, 0.8) / effectiveDurSeconds;
      return `<path${replaceAttr(attrs, 'stroke-dashoffset', formatNum(-period * phase))} />`;
    },
  );

  svg = svg.replace(
    /<stop\b([^>]*)>\s*<animate\s+attributeName="offset"\s+values="([^"]+)"\s+dur="1\.6s"\s+repeatCount="indefinite"\s*\/>\s*<\/stop>/g,
    (_match, attrs, values) => {
      flowCount++;
      return `<stop${replaceAttr(attrs, 'offset', linearValuesAt(values, 1.6 / PLAYBACK_SPEED, tSeconds))}/>`;
    },
  );

  svg = svg.replace(/<circle\b([^>]*)>\s*<animateMotion\b([^>]*)\/>\s*<\/circle>/g, (_match, circleAttrs, motionAttrs) => {
    const attrs = parseAttrs(motionAttrs);
    const path = attrs.get('path');
    if (!path) throw new Error('animateMotion without inline path is not supported by this POC');
    const durSeconds = parseSeconds(attrs.get('dur'), 1.8);
    const beginSeconds = parseSeconds(attrs.get('begin'), 0);
    const effectiveDurSeconds = durSeconds / PLAYBACK_SPEED;
    const motionTime = effectiveAnimationTime(tSeconds, durSeconds, beginSeconds);
    const point = pointAtPathFraction(path, motionTime / effectiveDurSeconds);
    motionCount++;
    motionSamples.push({ x: point.x, y: point.y, durSeconds, effectiveDurSeconds, beginSeconds, path });
    return `<circle${replaceAttr(replaceAttr(circleAttrs, 'cx', formatNum(point.x)), 'cy', formatNum(point.y))}/>`;
  });
  if (/<animate\b|<animateMotion\b/.test(svg)) {
    throw new Error('Baked SVG still contains SMIL animation nodes');
  }
  return { svg, marchCount, flowCount, motionCount, motionSamples };
}

function renderRgba(svg) {
  const rendered = new Resvg(svg, {
    fitTo: { mode: 'zoom', value: SCALE },
    font: { loadSystemFonts: true },
  }).render();
  return { rgba: new Uint8Array(rendered.pixels), width: rendered.width, height: rendered.height };
}

function averageRgbaFrames(renderedFrames) {
  if (renderedFrames.length === 1) return renderedFrames[0];

  const { width, height } = renderedFrames[0];
  const byteLength = renderedFrames[0].rgba.length;
  const accumR = new Float64Array(byteLength / 4);
  const accumG = new Float64Array(byteLength / 4);
  const accumB = new Float64Array(byteLength / 4);
  const accumA = new Float64Array(byteLength / 4);

  for (const frame of renderedFrames) {
    if (frame.width !== width || frame.height !== height || frame.rgba.length !== byteLength) {
      throw new Error('Motion blur sub-frame dimensions changed during a frame');
    }
    const { rgba } = frame;
    for (let src = 0, px = 0; src < byteLength; src += 4, px++) {
      const alpha = rgba[src + 3] / 255;
      accumR[px] += rgba[src] * alpha;
      accumG[px] += rgba[src + 1] * alpha;
      accumB[px] += rgba[src + 2] * alpha;
      accumA[px] += alpha;
    }
  }

  const out = new Uint8Array(byteLength);
  for (let dst = 0, px = 0; dst < byteLength; dst += 4, px++) {
    const alphaSum = accumA[px];
    out[dst + 3] = Math.round((alphaSum / renderedFrames.length) * 255);
    if (alphaSum > 0) {
      out[dst] = Math.round(accumR[px] / alphaSum);
      out[dst + 1] = Math.round(accumG[px] / alphaSum);
      out[dst + 2] = Math.round(accumB[px] / alphaSum);
    }
  }
  return { rgba: out, width, height };
}

function renderFrameRgba(animatedSvg, frameIndex, frameSeconds, motionBlurSamples, shutter) {
  if (motionBlurSamples === 1) {
    const { svg } = bakeStaticSvg(animatedSvg, frameIndex * frameSeconds);
    return renderRgba(svg);
  }

  const exposureStart = frameIndex * frameSeconds;
  const exposureSeconds = shutter * frameSeconds;
  const renderedFrames = [];
  for (let k = 0; k < motionBlurSamples; k++) {
    const t = exposureStart + ((k + 0.5) * exposureSeconds) / motionBlurSamples;
    const { svg } = bakeStaticSvg(animatedSvg, t);
    renderedFrames.push(renderRgba(svg));
  }
  return averageRgbaFrames(renderedFrames);
}

function arrayBufferFor(view) {
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
}

async function encodeApng(animatedSvg) {
  const frames = [];
  let width = 0;
  let height = 0;
  for (let i = 0; i < APNG_FRAMES; i++) {
    const rendered = renderFrameRgba(animatedSvg, i, APNG_FRAME_SECONDS, MOTION_BLUR_SAMPLES, SHUTTER);
    width = rendered.width;
    height = rendered.height;
    frames.push(arrayBufferFor(rendered.rgba));
  }
  const delays = Array(APNG_FRAMES).fill(APNG_DELAY_MS);
  return Buffer.from(UPNG.encode(frames, width, height, 0, delays));
}

async function main() {
  const started = performance.now();
  const input = await readFile(inputPath, 'utf8');
  const { compileAndRenderSync } = await loadTritonFrontend();
  const result = compileAndRenderSync(input, undefined, 'svg');
  if (!result.ok) throw new Error(`${result.code}: ${result.message}`);

  const animatedSvg = result.value.svg;
  const initialBake = bakeStaticSvg(animatedSvg, 0);
  const secondBake = bakeStaticSvg(animatedSvg, APNG_FRAME_SECONDS);
  const midBake = bakeStaticSvg(animatedSvg, EFFECTIVE_LOOP_SECONDS / 2);
  const wrapBake = bakeStaticSvg(animatedSvg, EFFECTIVE_LOOP_SECONDS);
  const apngLast = (APNG_FRAMES - 1) * APNG_FRAME_SECONDS;
  const apngLoopError = Math.abs(apngLast + APNG_FRAME_SECONDS - EFFECTIVE_LOOP_SECONDS);
  if (apngLoopError > 1e-9) throw new Error('APNG last frame is not one delay before loop end');
  const lastExposureEnd = apngLast + SHUTTER * APNG_FRAME_SECONDS;
  if (lastExposureEnd - EFFECTIVE_LOOP_SECONDS > 1e-9) throw new Error('APNG shutter exposure extends past loop end');
  const first = initialBake.motionSamples[0];
  const second = secondBake.motionSamples[0];
  const mid = midBake.motionSamples[0];
  const lastBake = bakeStaticSvg(animatedSvg, apngLast);
  const last = lastBake.motionSamples[0];
  const wrap = wrapBake.motionSamples[0];
  if (first && second && Math.hypot(second.x - first.x, second.y - first.y) <= 0.001) {
    throw new Error('Motion sample did not move between frame 0 and frame 1');
  }
  if (first && wrap && Math.hypot(wrap.x - first.x, wrap.y - first.y) > 0.001) {
    throw new Error('Motion sample at t=L did not wrap back to t=0');
  }

  await mkdir(outDir, { recursive: true });
  const apng = await encodeApng(animatedSvg);
  await writeFile(apngPath, apng);
  const apngStat = await stat(apngPath);
  const elapsedSeconds = (performance.now() - started) / 1000;

  console.log(`Rendered ${demoName} via compileAndRenderSync; baked ${initialBake.marchCount} march path(s), ${initialBake.flowCount} flow stop animation(s), ${initialBake.motionCount} motion circle(s).`);
  console.log(`Source loop length: ${LOOP_SECONDS}s; playback speed: ${PLAYBACK_SPEED}x; effective loop length: ${EFFECTIVE_LOOP_SECONDS}s`);
  console.log(`Motion blur: ${MOTION_BLUR_SAMPLES} temporal sample(s) per output frame; shutter ${SHUTTER}; ${MOTION_BLUR_SAMPLES === 1 ? 'disabled' : 'midpoint sampled across the shutter window'}.`);
  console.log(`APNG: ${APNG_FRAMES} frames @ ${formatNum(APNG_TIMING.effectiveFps)}fps target ${APNG_FPS}fps (${formatNum(APNG_DELAY_MS)}ms), ${apngStat.size} bytes -> ${pathToFileURL(apngPath).pathname}`);
  if (!APNG_TIMING.exactAtTargetFps) {
    console.log(`Timing note: target ${APNG_FPS}fps does not exactly divide L'; using nearest exact seamless frame count.`);
  }
  if (first && second && mid && last && wrap) {
    const length = pathLength(first.path);
    const svgStep = length / APNG_FRAMES;
    console.log(`Motion path: ${formatNum(length)}px; APNG step ${formatNum(svgStep)} SVG px/frame (${formatNum(svgStep * SCALE)} rendered px/frame) at ${APNG_FPS}fps; render scale ${SCALE}x.`);
    console.log(`Motion check: first=(${formatNum(first.x)},${formatNum(first.y)}), mid=(${formatNum(mid.x)},${formatNum(mid.y)}), last=(${formatNum(last.x)},${formatNum(last.y)}), t=L'=(${formatNum(wrap.x)},${formatNum(wrap.y)}).`);
  }
  console.log(`Seamless check: APNG windows tile [0,L'); last t=${formatNum(apngLast)}s, last shutter end=${formatNum(lastExposureEnd)}s, frame interval end=${formatNum(apngLast + APNG_FRAME_SECONDS)}s.`);
  console.log(`Render time: ${formatNum(elapsedSeconds)}s.`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
