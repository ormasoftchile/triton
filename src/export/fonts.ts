import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error fontkit does not ship TypeScript declarations.
import * as fontkitModule from 'fontkit';

const fontkit = fontkitModule as Fontkit;

export interface ResolvedThemeFont {
  readonly buffers: Uint8Array[];
  readonly family: string;
}

export interface IndexedFontFace {
  readonly family: string;
  readonly subfamily: string;
  readonly fullName: string;
  readonly path: string;
  readonly bytes?: Uint8Array;
}

export interface BundledFontRegistration {
  readonly family: string;
  readonly faces: readonly BundledFontFaceRegistration[];
}

export interface BundledFontFaceRegistration {
  readonly subfamily: string;
  readonly fullName?: string;
  readonly bytes?: Uint8Array;
  readonly path?: string;
}

interface FontkitFont {
  readonly familyName?: string;
  readonly subfamilyName?: string;
  readonly fullName?: string;
  readonly postscriptName?: string;
}

interface FontkitCollection {
  readonly fonts?: readonly FontkitFont[];
}

interface Fontkit {
  openSync(path: string): FontkitFont | FontkitCollection;
}

const FONT_EXT_RE = /\.(?:ttf|otf|ttc|otc)$/i;
const GENERIC_FAMILIES = new Set(['serif', 'sans-serif', 'monospace', 'system-ui', '-apple-system', 'blinkmacsystemfont']);
let systemFontIndexPromise: Promise<readonly IndexedFontFace[]> | undefined;
let bundledFontFaces: readonly IndexedFontFace[] = defaultBundledFontFaces();

export async function resolveThemeFont(fontFamily: string): Promise<ResolvedThemeFont | undefined> {
  const index = await getFontIndex();
  return resolveThemeFontFromIndex(fontFamily, index);
}

export async function resolveThemeFontFromIndex(
  fontFamily: string,
  index: readonly IndexedFontFace[],
  loadFile: (path: string) => Promise<Uint8Array> = async (path) => new Uint8Array(await readFile(path)),
): Promise<ResolvedThemeFont | undefined> {
  const mergedIndex = [...bundledFontFaces, ...index];
  const byFamily = buildFamilyMap(mergedIndex);
  for (const requested of parseFontFamilyStack(fontFamily)) {
    const faceFamily = resolveFamilyName(requested, byFamily, index);
    if (faceFamily == null) continue;
    const faces = byFamily.get(normalizeFamily(faceFamily));
    if (!faces || faces.length === 0) continue;

    const selected = selectRegularAndBold(faces);
    const buffers: Uint8Array[] = [];
    const seen = new Set<string>();
    for (const face of selected) {
      if (seen.has(face.path)) continue;
      seen.add(face.path);
      try {
        buffers.push(face.bytes ?? await loadFile(face.path));
      } catch {
        // Font disappeared or is unreadable. Try the next face/file.
      }
    }
    if (buffers.length > 0) return { buffers, family: selected[0]?.family ?? faceFamily };
  }
  return undefined;
}

export function registerBundledFont(registration: BundledFontRegistration): void {
  const family = cleanName(registration.family);
  if (!family || registration.faces.length === 0) return;
  const key = normalizeFamily(family);
  const faces = registration.faces.flatMap((face, index): IndexedFontFace[] => {
    const subfamily = cleanName(face.subfamily) ?? '';
    const fullName = cleanName(face.fullName) ?? `${family} ${subfamily}`.trim();
    const path = face.path ?? `bundled:${key}:${index}:${normalizeFamily(subfamily || fullName)}`;
    if (face.bytes == null && face.path == null) return [];
    return [{ family, subfamily, fullName, path, ...(face.bytes != null ? { bytes: new Uint8Array(face.bytes) } : {}) }];
  });
  if (faces.length === 0) return;
  const next = bundledFontFaces.filter(face => normalizeFamily(face.family) !== key);
  bundledFontFaces = [...faces, ...next];
}

export function parseFontFamilyStack(fontFamily: string): string[] {
  const out: string[] = [];
  let current = '';
  let quote: '"' | "'" | undefined;
  for (const ch of fontFamily) {
    if (quote) {
      if (ch === quote) quote = undefined;
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === ',') {
      pushFamily(out, current);
      current = '';
    } else {
      current += ch;
    }
  }
  pushFamily(out, current);
  return out;
}

export async function enumerateInstalledFonts(): Promise<IndexedFontFace[]> {
  const files = new Set<string>();
  for (const dir of fontDirectories()) {
    await collectFontFiles(dir, files);
  }

  const faces: IndexedFontFace[] = [];
  for (const file of [...files].sort()) {
    try {
      const opened = fontkit.openSync(file);
      const fonts = 'fonts' in opened && Array.isArray(opened.fonts) ? opened.fonts : [opened as FontkitFont];
      for (const font of fonts) {
        const family = cleanName(font.familyName);
        if (!family) continue;
        faces.push({
          family,
          subfamily: cleanName(font.subfamilyName) ?? '',
          fullName: cleanName(font.fullName ?? font.postscriptName) ?? family,
          path: file,
        });
      }
    } catch {
      // Keep exports robust on machines with unreadable/corrupt installed fonts.
    }
  }
  return faces;
}

function getFontIndex(): Promise<readonly IndexedFontFace[]> {
  systemFontIndexPromise ??= enumerateInstalledFonts();
  return systemFontIndexPromise;
}

function defaultBundledFontFaces(): IndexedFontFace[] {
  const dir = join(process.cwd(), 'assets', 'fonts', 'inter');
  const regular = join(dir, 'Inter-Regular.ttf');
  const bold = join(dir, 'Inter-Bold.ttf');
  if (!existsSync(regular) || !existsSync(bold)) return [];
  return [
    { family: 'Inter', subfamily: 'Regular', fullName: 'Inter Regular', path: regular },
    { family: 'Inter', subfamily: 'Bold', fullName: 'Inter Bold', path: bold },
  ];
}

function fontDirectories(): string[] {
  const home = homedir();
  if (process.platform === 'darwin') {
    return [
      '/System/Library/Fonts',
      '/System/Library/Fonts/Supplemental',
      '/Library/Fonts',
      join(home, 'Library', 'Fonts'),
    ];
  }
  if (process.platform === 'win32') {
    const windir = process.env.WINDIR || 'C:\\Windows';
    return [
      join(windir, 'Fonts'),
      ...(process.env.LOCALAPPDATA ? [join(process.env.LOCALAPPDATA, 'Microsoft', 'Windows', 'Fonts')] : []),
    ];
  }
  return [
    '/usr/share/fonts',
    '/usr/local/share/fonts',
    join(home, '.fonts'),
    join(home, '.local', 'share', 'fonts'),
  ];
}

async function collectFontFiles(dir: string, out: Set<string>): Promise<void> {
  if (!existsSync(dir)) return;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await collectFontFiles(path, out);
    else if (entry.isFile() && FONT_EXT_RE.test(entry.name)) out.add(path);
  }
}

function buildFamilyMap(index: readonly IndexedFontFace[]): Map<string, IndexedFontFace[]> {
  const map = new Map<string, IndexedFontFace[]>();
  for (const face of index) {
    const key = normalizeFamily(face.family);
    const bucket = map.get(key);
    if (bucket) bucket.push(face);
    else map.set(key, [face]);
  }
  return map;
}

function resolveFamilyName(
  requested: string,
  byFamily: ReadonlyMap<string, readonly IndexedFontFace[]>,
  index: readonly IndexedFontFace[],
): string | undefined {
  const key = normalizeFamily(requested);
  if (!GENERIC_FAMILIES.has(key)) {
    return byFamily.get(key)?.[0]?.family;
  }

  for (const family of platformGenericCandidates(key)) {
    const resolved = byFamily.get(normalizeFamily(family))?.[0]?.family;
    if (resolved) return resolved;
  }
  const generic = key === 'serif' ? findSerif(index) : key === 'monospace' ? findMonospace(index) : findSans(index);
  return generic?.family;
}

function platformGenericCandidates(key: string): string[] {
  const sans = process.platform === 'darwin'
    ? ['SF Pro', 'SF Pro Text', '.AppleSystemUIFont', 'Helvetica Neue', 'Helvetica', 'Arial']
    : process.platform === 'win32'
      ? ['Segoe UI', 'Arial']
      : ['Noto Sans', 'DejaVu Sans', 'Liberation Sans', 'Arial'];
  if (key === 'system-ui' || key === '-apple-system' || key === 'blinkmacsystemfont' || key === 'sans-serif') return sans;
  if (key === 'serif') return process.platform === 'win32' ? ['Times New Roman', 'Georgia'] : ['Georgia', 'Times New Roman', 'Noto Serif', 'DejaVu Serif'];
  return process.platform === 'win32' ? ['Consolas', 'Courier New'] : ['JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'DejaVu Sans Mono'];
}

function selectRegularAndBold(faces: readonly IndexedFontFace[]): IndexedFontFace[] {
  const regular = faces.find(isRegularFace) ?? faces.find((face) => !isItalicFace(face)) ?? faces[0];
  const bold = faces.find(isBoldFace);
  return [regular, bold].filter((face, index, arr): face is IndexedFontFace => face != null && arr.findIndex((f) => f?.path === face.path) === index);
}

function isRegularFace(face: IndexedFontFace): boolean {
  const style = `${face.subfamily} ${face.fullName}`.toLowerCase();
  return /\bregular\b|\bbook\b|\broman\b/.test(style) && !isBoldFace(face) && !isItalicFace(face);
}

function isBoldFace(face: IndexedFontFace): boolean {
  return /\b(bold|black|heavy|semibold|demibold)\b/i.test(`${face.subfamily} ${face.fullName}`);
}

function isItalicFace(face: IndexedFontFace): boolean {
  return /\b(italic|oblique)\b/i.test(`${face.subfamily} ${face.fullName}`);
}

function findSans(index: readonly IndexedFontFace[]): IndexedFontFace | undefined {
  return index.find((face) => /sans|arial|helvetica|segoe|sf pro|ubuntu|cantarell/i.test(face.family));
}

function findSerif(index: readonly IndexedFontFace[]): IndexedFontFace | undefined {
  return index.find((face) => /serif|times|georgia|garamond|cambria/i.test(face.family));
}

function findMonospace(index: readonly IndexedFontFace[]): IndexedFontFace | undefined {
  return index.find((face) => /mono|code|consolas|courier|menlo|monaco/i.test(face.family));
}

function pushFamily(out: string[], value: string): void {
  const cleaned = value.trim().replace(/^['"]|['"]$/g, '').trim();
  if (cleaned) out.push(cleaned);
}

function normalizeFamily(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, '').toLowerCase();
}

function cleanName(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}
