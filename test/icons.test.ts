import { describe, it, expect } from 'vitest';
import { validateIconPack } from '../src/icons/validate.js';
import { parseIconRef, resolveIcon, detectColorMode } from '../src/icons/resolver.js';
import type { IconPackMap, IconifyJSON } from '../src/contracts/icons.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MINIMAL_PACK = {
  prefix: 'mdi',
  icons: {
    server: { body: '<path fill="currentColor" d="M4 1h16v14H4z"/>' },
  },
};

const FULL_PACK = {
  prefix: 'azure',
  icons: {
    'app-service': {
      body: '<rect fill="#0078D4" x="0" y="0" width="18" height="18"/>',
      width: 18,
      height: 18,
    },
    'virtual-network': {
      body: '<circle fill="currentColor" cx="8" cy="8" r="8"/>',
    },
  },
  aliases: {
    'app-svc': { parent: 'app-service' },
    'vnet':    { parent: 'virtual-network', hFlip: true },
  },
  width:  24,
  height: 24,
  left:   0,
  top:    0,
};

// ─── validateIconPack — basic shape ──────────────────────────────────────────

describe('validateIconPack — basic shape', () => {
  it('accepts a minimal valid pack', () => {
    const r = validateIconPack(MINIMAL_PACK);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.prefix).toBe('mdi');
      expect(r.value.icons['server']?.body).toContain('currentColor');
    }
  });

  it('accepts a full valid pack with aliases and dimensions', () => {
    const r = validateIconPack(FULL_PACK);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.aliases?.['app-svc']?.parent).toBe('app-service');
      expect(r.value.width).toBe(24);
    }
  });

  it('rejects null input', () => {
    const r = validateIconPack(null);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('ICON_VALIDATION_ERROR');
      expect(r.error.message).toContain('null');
    }
  });

  it('rejects array input', () => {
    const r = validateIconPack([]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('array');
  });

  it('rejects string input', () => {
    const r = validateIconPack('oops');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('string');
  });

  it('rejects unknown top-level key (STRICT)', () => {
    const r = validateIconPack({ ...MINIMAL_PACK, bogusKey: true });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('ICON_VALIDATION_ERROR');
      expect(r.error.message).toContain('bogusKey');
    }
  });
});

// ─── validateIconPack — prefix ────────────────────────────────────────────────

describe('validateIconPack — prefix', () => {
  it('accepts valid prefix slugs', () => {
    expect(validateIconPack({ ...MINIMAL_PACK, prefix: 'mdi' }).ok).toBe(true);
    expect(validateIconPack({ ...MINIMAL_PACK, prefix: 'my-pack' }).ok).toBe(true);
    expect(validateIconPack({ ...MINIMAL_PACK, prefix: 'lucide2' }).ok).toBe(true);
  });

  it('rejects prefix starting with a digit', () => {
    const r = validateIconPack({ ...MINIMAL_PACK, prefix: '2pack' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('prefix');
  });

  it('rejects prefix with uppercase letters', () => {
    const r = validateIconPack({ ...MINIMAL_PACK, prefix: 'MDI' });
    expect(r.ok).toBe(false);
  });

  it('rejects prefix with spaces', () => {
    expect(validateIconPack({ ...MINIMAL_PACK, prefix: 'my pack' }).ok).toBe(false);
  });

  it('rejects missing prefix', () => {
    const { prefix: _, ...noPrefixPack } = MINIMAL_PACK;
    const r = validateIconPack(noPrefixPack);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('prefix');
  });

  it('rejects non-string prefix', () => {
    const r = validateIconPack({ ...MINIMAL_PACK, prefix: 42 });
    expect(r.ok).toBe(false);
  });
});

// ─── validateIconPack — icons ─────────────────────────────────────────────────

describe('validateIconPack — icons', () => {
  it('rejects empty icons object', () => {
    const r = validateIconPack({ prefix: 'mdi', icons: {} });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('at least one');
  });

  it('rejects missing icons field', () => {
    const r = validateIconPack({ prefix: 'mdi' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('icons');
  });

  it('rejects icon name starting with uppercase', () => {
    const r = validateIconPack({
      prefix: 'mdi',
      icons: { Server: { body: '<path/>' } },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('Server');
  });

  it('rejects icon with missing body', () => {
    const r = validateIconPack({
      prefix: 'mdi',
      icons: { server: {} },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('ICON_VALIDATION_ERROR');
      expect(r.error.message).toContain('body');
    }
  });

  it('rejects icon with empty body string', () => {
    const r = validateIconPack({
      prefix: 'mdi',
      icons: { server: { body: '' } },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('body');
  });

  it('rejects icon with non-positive width', () => {
    const r = validateIconPack({
      prefix: 'mdi',
      icons: { server: { body: '<path/>', width: 0 } },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('width');
  });

  it('rejects icon with unknown key (STRICT)', () => {
    const r = validateIconPack({
      prefix: 'mdi',
      icons: { server: { body: '<path/>', unknownField: true } },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('unknownField');
  });
});

// ─── validateIconPack — rotate validation ─────────────────────────────────────

describe('validateIconPack — rotate', () => {
  it('accepts valid rotate values 0–3', () => {
    for (const rotate of [0, 1, 2, 3] as const) {
      const r = validateIconPack({
        prefix: 'mdi',
        icons: { server: { body: '<path/>', rotate } },
      });
      expect(r.ok, `rotate=${rotate} should be valid`).toBe(true);
    }
  });

  it('rejects rotate=4', () => {
    const r = validateIconPack({
      prefix: 'mdi',
      icons: { server: { body: '<path/>', rotate: 4 } },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('rotate');
  });

  it('rejects rotate=-1', () => {
    expect(
      validateIconPack({ prefix: 'mdi', icons: { server: { body: '<path/>', rotate: -1 } } }).ok,
    ).toBe(false);
  });

  it('rejects rotate=1.5 (non-integer)', () => {
    expect(
      validateIconPack({ prefix: 'mdi', icons: { server: { body: '<path/>', rotate: 1.5 } } }).ok,
    ).toBe(false);
  });
});

// ─── validateIconPack — aliases ───────────────────────────────────────────────

describe('validateIconPack — aliases', () => {
  it('accepts valid aliases', () => {
    const r = validateIconPack({
      prefix: 'mdi',
      icons: { server: { body: '<path/>' } },
      aliases: { srv: { parent: 'server' }, srv2: { parent: 'server', rotate: 1, hFlip: true } },
    });
    expect(r.ok).toBe(true);
  });

  it('rejects alias missing parent', () => {
    const r = validateIconPack({
      prefix: 'mdi',
      icons: { server: { body: '<path/>' } },
      aliases: { srv: {} },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('parent');
  });

  it('rejects alias with unknown key (STRICT)', () => {
    const r = validateIconPack({
      prefix: 'mdi',
      icons: { server: { body: '<path/>' } },
      aliases: { srv: { parent: 'server', extra: true } },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('extra');
  });
});

// ─── parseIconRef ─────────────────────────────────────────────────────────────

describe('parseIconRef — valid tokens', () => {
  it('parses "mdi:server"', () => {
    const r = parseIconRef('mdi:server');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.prefix).toBe('mdi');
      expect(r.value.name).toBe('server');
    }
  });

  it('parses "azure:app-service"', () => {
    const r = parseIconRef('azure:app-service');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.prefix).toBe('azure');
      expect(r.value.name).toBe('app-service');
    }
  });

  it('parses token with numeric start in name', () => {
    const r = parseIconRef('lucide:0-circle');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.name).toBe('0-circle');
  });
});

describe('parseIconRef — malformed tokens', () => {
  it('rejects token with no colon', () => {
    const r = parseIconRef('mdisserver');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('ICON_NOT_FOUND');
      expect(r.error.message).toContain('prefix:name');
    }
  });

  it('rejects empty string', () => {
    const r = parseIconRef('');
    expect(r.ok).toBe(false);
  });

  it('rejects token with multiple colons', () => {
    const r = parseIconRef('a:b:c');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('too many colons');
  });

  it('rejects empty prefix (":name")', () => {
    const r = parseIconRef(':server');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('prefix');
  });

  it('rejects empty name ("prefix:")', () => {
    const r = parseIconRef('mdi:');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('name');
  });

  it('rejects uppercase in prefix', () => {
    expect(parseIconRef('MDI:server').ok).toBe(false);
  });

  it('rejects prefix starting with digit', () => {
    expect(parseIconRef('2pack:icon').ok).toBe(false);
  });

  it('rejects uppercase in name', () => {
    expect(parseIconRef('mdi:Server').ok).toBe(false);
  });

  it('rejects name starting with hyphen', () => {
    expect(parseIconRef('mdi:-server').ok).toBe(false);
  });
});

// ─── resolveIcon — hit / miss ─────────────────────────────────────────────────

describe('resolveIcon — pack lookup', () => {
  const packs: IconPackMap = new Map([
    ['mdi', MINIMAL_PACK as IconifyJSON],
    ['azure', FULL_PACK as IconifyJSON],
  ]);

  it('resolves a direct icon hit', () => {
    const r = resolveIcon({ prefix: 'mdi', name: 'server' }, packs);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.body).toContain('currentColor');
      expect(r.value.colorMode).toBe('monochrome');
    }
  });

  it('returns ICON_NOT_FOUND for unknown pack', () => {
    const r = resolveIcon({ prefix: 'unknown', name: 'server' }, packs);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('ICON_NOT_FOUND');
      expect(r.error.message).toContain('unknown');
    }
  });

  it('returns ICON_NOT_FOUND for unknown icon in known pack', () => {
    const r = resolveIcon({ prefix: 'mdi', name: 'nope' }, packs);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('ICON_NOT_FOUND');
      expect(r.error.message).toContain('nope');
    }
  });
});

// ─── resolveIcon — viewBox default merging ────────────────────────────────────

describe('resolveIcon — viewBox merging', () => {
  it('uses icon-level dims when present', () => {
    const packs: IconPackMap = new Map([['azure', FULL_PACK as IconifyJSON]]);
    const r = resolveIcon({ prefix: 'azure', name: 'app-service' }, packs);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.viewBox.width).toBe(18);
      expect(r.value.viewBox.height).toBe(18);
    }
  });

  it('falls back to pack-level dims when icon has none', () => {
    const packs: IconPackMap = new Map([['azure', FULL_PACK as IconifyJSON]]);
    const r = resolveIcon({ prefix: 'azure', name: 'virtual-network' }, packs);
    expect(r.ok).toBe(true);
    if (r.ok) {
      // virtual-network has no icon-level dims; FULL_PACK has width=24, height=24
      expect(r.value.viewBox.width).toBe(24);
      expect(r.value.viewBox.height).toBe(24);
    }
  });

  it('uses system defaults (16×16) when no dims at any level', () => {
    const packNoDefaults: IconifyJSON = {
      prefix: 'test',
      icons: { icon: { body: '<path/>' } },
    };
    const packs: IconPackMap = new Map([['test', packNoDefaults]]);
    const r = resolveIcon({ prefix: 'test', name: 'icon' }, packs);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.viewBox.width).toBe(16);
      expect(r.value.viewBox.height).toBe(16);
      expect(r.value.viewBox.left).toBe(0);
      expect(r.value.viewBox.top).toBe(0);
    }
  });
});

// ─── resolveIcon — alias following ───────────────────────────────────────────

describe('resolveIcon — alias following', () => {
  it('resolves an alias to its parent icon', () => {
    const packs: IconPackMap = new Map([['azure', FULL_PACK as IconifyJSON]]);
    const r = resolveIcon({ prefix: 'azure', name: 'app-svc' }, packs);
    expect(r.ok).toBe(true);
    if (r.ok) {
      // app-svc is alias for app-service
      expect(r.value.body).toBe(FULL_PACK.icons['app-service']?.body);
      expect(r.value.colorMode).toBe('brand');
    }
  });

  it('composes alias hFlip transform with parent icon transforms', () => {
    const packs: IconPackMap = new Map([['azure', FULL_PACK as IconifyJSON]]);
    // vnet aliases virtual-network with hFlip: true
    const r = resolveIcon({ prefix: 'azure', name: 'vnet' }, packs);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.transforms.hFlip).toBe(true);
      expect(r.value.transforms.vFlip).toBe(false);
    }
  });

  it('follows a two-level alias chain', () => {
    const pack: IconifyJSON = {
      prefix: 'test',
      icons: { base: { body: '<path fill="currentColor"/>' } },
      aliases: {
        mid:  { parent: 'base', rotate: 1 },
        top:  { parent: 'mid',  hFlip: true },
      },
    };
    const packs: IconPackMap = new Map([['test', pack]]);
    // "top" → "mid" → "base"
    const r = resolveIcon({ prefix: 'test', name: 'top' }, packs);
    expect(r.ok).toBe(true);
    if (r.ok) {
      // top's transforms: hFlip=true; mid adds rotate=1 but top's alias resolves on top of base
      // Since top is the topAlias, its dims/transforms compose with the base icon
      expect(r.value.transforms.hFlip).toBe(true);
    }
  });

  it('returns ICON_NOT_FOUND for alias with broken parent', () => {
    const pack: IconifyJSON = {
      prefix: 'test',
      icons: { base: { body: '<path/>' } },
      aliases: { broken: { parent: 'nonexistent' } },
    };
    const packs: IconPackMap = new Map([['test', pack]]);
    const r = resolveIcon({ prefix: 'test', name: 'broken' }, packs);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('ICON_NOT_FOUND');
  });
});

// ─── detectColorMode ─────────────────────────────────────────────────────────

describe('detectColorMode — monochrome', () => {
  it('classifies currentColor fill as monochrome', () => {
    expect(detectColorMode('<path fill="currentColor" d="M0 0h24v24H0z"/>')).toBe('monochrome');
  });

  it('classifies fill=none as monochrome', () => {
    expect(detectColorMode('<circle fill="none" stroke="currentColor" cx="12" cy="12" r="10"/>')).toBe('monochrome');
  });

  it('classifies fill=inherit as monochrome', () => {
    expect(detectColorMode('<rect fill="inherit"/>')).toBe('monochrome');
  });

  it('classifies body with no fill/stroke attributes as monochrome', () => {
    expect(detectColorMode('<g><path d="M0 0z"/></g>')).toBe('monochrome');
  });

  it('is case-insensitive for currentColor', () => {
    expect(detectColorMode('<path fill="CurrentColor"/>')).toBe('monochrome');
  });
});

describe('detectColorMode — brand', () => {
  it('classifies hardcoded hex fill as brand', () => {
    expect(detectColorMode('<rect fill="#0078D4" x="0" y="0" width="18" height="18"/>')).toBe('brand');
  });

  it('classifies rgb() fill as brand', () => {
    expect(detectColorMode('<path fill="rgb(0,120,212)"/>')).toBe('brand');
  });

  it('classifies hardcoded stroke color as brand', () => {
    expect(detectColorMode('<path stroke="#FF0000" fill="none"/>')).toBe('brand');
  });

  it('classifies linearGradient body as brand (regardless of fill values)', () => {
    const body = '<defs><linearGradient id="a"><stop offset="0%" stop-color="#0078D4"/></linearGradient></defs><rect fill="url(#a)"/>';
    expect(detectColorMode(body)).toBe('brand');
  });

  it('classifies radialGradient body as brand', () => {
    const body = '<defs><radialGradient id="b"/></defs><circle fill="url(#b)"/>';
    expect(detectColorMode(body)).toBe('brand');
  });

  it('classifies mixed body (currentColor + hardcoded) as brand', () => {
    expect(detectColorMode('<path fill="currentColor"/><path fill="#FF0000"/>')).toBe('brand');
  });
});

// ─── schema.json ─────────────────────────────────────────────────────────────

describe('src/icons/schema.json', () => {
  it('parses as valid JSON', () => {
    const schemaPath = resolve('src/icons/schema.json');
    const raw = readFileSync(schemaPath, 'utf8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('has expected $id and $schema fields', () => {
    const schema = JSON.parse(readFileSync(resolve('src/icons/schema.json'), 'utf8'));
    expect(schema.$id).toBe('https://triton.dev/schemas/triton-icons.schema.json');
    expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#');
  });

  it('declares additionalProperties: false at top level', () => {
    const schema = JSON.parse(readFileSync(resolve('src/icons/schema.json'), 'utf8'));
    expect(schema.additionalProperties).toBe(false);
  });

  it('requires prefix and icons fields', () => {
    const schema = JSON.parse(readFileSync(resolve('src/icons/schema.json'), 'utf8'));
    expect(schema.required).toContain('prefix');
    expect(schema.required).toContain('icons');
  });

  it('prefix pattern matches token grammar', () => {
    const schema = JSON.parse(readFileSync(resolve('src/icons/schema.json'), 'utf8'));
    expect(schema.properties.prefix.pattern).toBe('^[a-z][a-z0-9-]*$');
  });

  it('IconData definition requires body', () => {
    const schema = JSON.parse(readFileSync(resolve('src/icons/schema.json'), 'utf8'));
    expect(schema.definitions.IconData.required).toContain('body');
  });
});
