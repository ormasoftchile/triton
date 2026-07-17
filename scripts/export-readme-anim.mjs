#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import UPNG from 'upng-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const require = createRequire(import.meta.url);

const sourcePath = join(root, 'examples', 'triton', 'poster', 'spanning.mmd');
const apngPath = join(root, 'extension', 'resources', 'spanning.animated.png');
const verifyPath = join(root, 'examples', 'exports', 'verify-readme-anim.png');

const darkReadmeTheme = {
  palette: {
    background: '#0F172A',
    surface: '#1E293B',
    border: '#475569',
    text: '#E2E8F0',
    textMuted: '#94A3B8',
  },
};

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: 'inherit' });
}

function copyParsers(srcDir, dstDir) {
  for (const entry of readdirSync(srcDir)) {
    const srcPath = join(srcDir, entry);
    const dstPath = join(dstDir, entry);
    if (statSync(srcPath).isDirectory()) {
      copyParsers(srcPath, dstPath);
    } else if (entry === 'parser.js') {
      mkdirSync(dstDir, { recursive: true });
      copyFileSync(srcPath, dstPath);
    }
  }
}

function byteSize(path) {
  return statSync(path).size;
}

function firstPixelRgba(png) {
  const decoded = UPNG.decode(png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength));
  const rgba = new Uint8Array(UPNG.toRGBA8(decoded)[0]);
  return [rgba[0], rgba[1], rgba[2], rgba[3]];
}

console.log('▸ Building grammars and TypeScript…');
run('pnpm', ['build:grammars']);
run('pnpm', ['exec', 'tsc', '--project', 'tsconfig.json', '--noEmit', 'false']);
copyParsers(join(root, 'src', 'diagrams'), join(root, 'packages', 'core', 'dist', 'diagrams'));

const bust = `?t=${Date.now()}`;
const frontend = await import(pathToFileURL(join(root, 'packages', 'core', 'dist', 'frontend', 'index.js')).href + bust);
const exportCore = await import(pathToFileURL(join(root, 'packages', 'core', 'dist', 'export', 'index.js')).href + bust);
const fontCore = await import(pathToFileURL(join(root, 'packages', 'core', 'dist', 'export', 'fonts.js')).href + bust);

const [regular, bold] = ['Inter-Regular.ttf', 'Inter-Bold.ttf'].map((name) =>
  readFileSync(join(root, 'assets', 'fonts', 'inter', name)),
);
fontCore.registerBundledFont({
  family: 'Inter',
  faces: [
    { subfamily: 'Regular', fullName: 'Inter Regular', bytes: regular },
    { subfamily: 'Bold', fullName: 'Inter Bold', bytes: bold },
  ],
});

const source = readFileSync(sourcePath, 'utf8');
const result = frontend.compileAndRenderWithThemeSync(source, darkReadmeTheme, 'svg');
if (!result.ok) {
  throw new Error(`[${result.error.code}] ${result.error.message}`);
}

const fonts = await fontCore.resolveThemeFont(result.value.theme.typography.fontFamily);
if (!fonts) {
  throw new Error(`Could not resolve theme font: ${result.value.theme.typography.fontFamily}`);
}

const wasmBytes = readFileSync(require.resolve('@resvg/resvg-wasm/index_bg.wasm'));
await exportCore.initExportWasm(wasmBytes);

mkdirSync(dirname(apngPath), { recursive: true });
mkdirSync(dirname(verifyPath), { recursive: true });

console.log('▸ Exporting README APNG…');
const apng = await exportCore.exportAnimatedPng(result.value.svg, {
  fonts,
  onProgress: (done, total) => {
    if (done === total || done % 30 === 0) console.log(`  frame ${done}/${total}`);
  },
});
writeFileSync(apngPath, apng);

console.log('▸ Writing verification first frame PNG…');
const verifyPng = await exportCore.exportStaticPng(result.value.svg, { fonts });
writeFileSync(verifyPath, verifyPng);

const pixel = firstPixelRgba(apng);
if (pixel[3] !== 255) {
  throw new Error(`Expected opaque first pixel, got rgba(${pixel.join(', ')})`);
}

if (!existsSync(apngPath) || !existsSync(verifyPath)) {
  throw new Error('Expected export outputs were not written');
}

console.log(`pixel(0,0) rgba(${pixel.join(', ')})`);
console.log(`${relative(root, apngPath)} ${byteSize(apngPath)} bytes`);
console.log(`${relative(root, verifyPath)} ${byteSize(verifyPath)} bytes`);
