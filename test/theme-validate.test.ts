import { describe, it, expect } from 'vitest';
import { validateThemeInput, isBuiltinThemeName } from '../src/theme/validate.js';
import { validateThemeInput as validateThemeInputFromFrontend, isBuiltinThemeName as isBuiltinThemeNameFromFrontend } from '../src/frontend/index.js';
import { themePresetNames } from '../src/theme/preset.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ─── isBuiltinThemeName ───────────────────────────────────────────────────────

describe('isBuiltinThemeName', () => {
  it('returns true for all built-in preset names', () => {
    for (const name of themePresetNames) {
      expect(isBuiltinThemeName(name), `expected "${name}" to be built-in`).toBe(true);
    }
  });

  it('returns false for unknown names', () => {
    expect(isBuiltinThemeName('acme')).toBe(false);
    expect(isBuiltinThemeName('dark')).toBe(false);
    expect(isBuiltinThemeName('')).toBe(false);
    expect(isBuiltinThemeName('DEFAULT')).toBe(false); // case-sensitive
  });

  it('is re-exported from src/frontend/index.ts', () => {
    // acceptance criterion 9: same function reachable from package entry
    expect(isBuiltinThemeNameFromFrontend('default')).toBe(true);
    expect(isBuiltinThemeNameFromFrontend('acme')).toBe(false);
  });
});

// ─── validateThemeInput — basic shape ────────────────────────────────────────

describe('validateThemeInput — basic shape', () => {
  // AC 1: empty partial is valid
  it('accepts empty object {}', () => {
    const r = validateThemeInput({});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({});
  });

  // AC 4: non-object inputs → err
  it('rejects string input', () => {
    const r = validateThemeInput('string');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('THEME_VALIDATION_ERROR');
      expect(r.error.message).toContain('string');
    }
  });

  it('rejects null input', () => {
    const r = validateThemeInput(null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('null');
  });

  it('rejects number input', () => {
    const r = validateThemeInput(42);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('number');
  });

  it('rejects array input', () => {
    const r = validateThemeInput([]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('array');
  });

  // AC 5: unknown top-level key → err (STRICT)
  it('rejects unknown top-level key', () => {
    const r = validateThemeInput({ foo: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('THEME_VALIDATION_ERROR');
      expect(r.error.message).toContain('foo');
    }
  });

  // AC 6: unknown nested key → err (STRICT)
  it('rejects unknown key inside palette', () => {
    const r = validateThemeInput({ palette: { bogus: '#fff' } });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('THEME_VALIDATION_ERROR');
      expect(r.error.message).toContain('bogus');
    }
  });

  it('is re-exported from src/frontend/index.ts', () => {
    const r = validateThemeInputFromFrontend({});
    expect(r.ok).toBe(true);
  });
});

// ─── name field ───────────────────────────────────────────────────────────────

describe('validateThemeInput — name field', () => {
  it('accepts valid slug name', () => {
    expect(validateThemeInput({ name: 'my-theme' }).ok).toBe(true);
    expect(validateThemeInput({ name: 'dark2' }).ok).toBe(true);
    expect(validateThemeInput({ name: 'a' }).ok).toBe(true);
  });

  it('rejects name that is not a string', () => {
    const r = validateThemeInput({ name: 123 });
    expect(r.ok).toBe(false);
  });

  it('rejects empty name', () => {
    const r = validateThemeInput({ name: '' });
    expect(r.ok).toBe(false);
  });

  it('rejects name longer than 64 chars', () => {
    const r = validateThemeInput({ name: 'a'.repeat(65) });
    expect(r.ok).toBe(false);
  });

  it('rejects name with uppercase letters', () => {
    const r = validateThemeInput({ name: 'MyTheme' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('name');
  });

  it('rejects name with spaces', () => {
    expect(validateThemeInput({ name: 'my theme' }).ok).toBe(false);
  });
});

// ─── base field ───────────────────────────────────────────────────────────────

describe('validateThemeInput — base field', () => {
  // AC 7
  it('accepts a known preset name', () => {
    const r = validateThemeInput({ base: 'executive' });
    expect(r.ok).toBe(true);
  });

  it('accepts all built-in preset names as base', () => {
    for (const name of themePresetNames) {
      const r = validateThemeInput({ base: name });
      expect(r.ok, `expected base="${name}" to be valid`).toBe(true);
    }
  });

  it('rejects an unknown preset name', () => {
    const r = validateThemeInput({ base: 'nope' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('THEME_VALIDATION_ERROR');
      expect(r.error.message).toContain('nope');
    }
  });

  it('rejects non-string base', () => {
    expect(validateThemeInput({ base: 42 }).ok).toBe(false);
  });
});

// ─── palette field ────────────────────────────────────────────────────────────

describe('validateThemeInput — palette field', () => {
  // AC 2: valid palette
  it('accepts valid palette with real primary field', () => {
    const r = validateThemeInput({ palette: { primary: '#FF0000' } });
    expect(r.ok).toBe(true);
  });

  it('accepts 3-digit hex colors', () => {
    expect(validateThemeInput({ palette: { border: '#abc' } }).ok).toBe(true);
  });

  it('accepts all palette fields when valid', () => {
    const r = validateThemeInput({
      palette: {
        primary: '#4A90D9',
        secondary: '#7C3AED',
        background: '#FFFFFF',
        surface: '#F8FAFC',
        border: '#CBD5E1',
        text: '#1E293B',
        textMuted: '#64748B',
        success: '#22C55E',
        warning: '#F59E0B',
        error: '#EF4444',
      },
    });
    expect(r.ok).toBe(true);
  });

  // AC 3: bad hex → err naming field
  it('rejects invalid hex color and names the field', () => {
    const r = validateThemeInput({ palette: { primary: 'red' } });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('THEME_VALIDATION_ERROR');
      expect(r.error.message).toContain('primary');
    }
  });

  it('rejects #RRGGBBAA (8-digit) hex', () => {
    const r = validateThemeInput({ palette: { primary: '#FF0000FF' } });
    expect(r.ok).toBe(false);
  });

  it('rejects palette that is not a plain object', () => {
    expect(validateThemeInput({ palette: 'red' }).ok).toBe(false);
  });

  it('rejects unknown palette key (STRICT)', () => {
    const r = validateThemeInput({ palette: { primaryColor: '#FF0000' } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('primaryColor');
  });
});

// ─── typography field ─────────────────────────────────────────────────────────

describe('validateThemeInput — typography field', () => {
  it('accepts valid typography override', () => {
    const r = validateThemeInput({ typography: { baseFontSize: 16 } });
    expect(r.ok).toBe(true);
  });

  it('accepts valid fontFamily string', () => {
    const r = validateThemeInput({ typography: { fontFamily: 'Inter, sans-serif' } });
    expect(r.ok).toBe(true);
  });

  // AC 8: font with url(...) → err
  it('rejects fontFamily containing url(', () => {
    const r = validateThemeInput({ typography: { fontFamily: 'url(http://evil.com/font.woff)' } });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('THEME_VALIDATION_ERROR');
      expect(r.error.message).toContain('fontFamily');
    }
  });

  it('rejects monoFamily containing expression(', () => {
    const r = validateThemeInput({ typography: { monoFamily: 'expression(alert(1))' } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('monoFamily');
  });

  it('rejects non-positive font size', () => {
    expect(validateThemeInput({ typography: { baseFontSize: 0 } }).ok).toBe(false);
    expect(validateThemeInput({ typography: { baseFontSize: -1 } }).ok).toBe(false);
  });

  it('rejects non-number font size', () => {
    expect(validateThemeInput({ typography: { baseFontSize: '16px' } }).ok).toBe(false);
  });

  it('rejects unknown typography key (STRICT)', () => {
    const r = validateThemeInput({ typography: { fontSize: 14 } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('fontSize');
  });
});

// ─── spacing field ────────────────────────────────────────────────────────────

describe('validateThemeInput — spacing field', () => {
  it('accepts valid spacing override', () => {
    expect(validateThemeInput({ spacing: { unit: 8 } }).ok).toBe(true);
    expect(validateThemeInput({ spacing: { nodePadding: 0 } }).ok).toBe(true); // 0 is valid
  });

  it('rejects negative spacing value', () => {
    const r = validateThemeInput({ spacing: { nodeGap: -1 } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('nodeGap');
  });

  it('rejects non-number spacing value', () => {
    expect(validateThemeInput({ spacing: { unit: '8px' } }).ok).toBe(false);
  });

  it('rejects unknown spacing key (STRICT)', () => {
    const r = validateThemeInput({ spacing: { padding: 10 } });
    expect(r.ok).toBe(false);
  });
});

// ─── edges field ──────────────────────────────────────────────────────────────

describe('validateThemeInput — edges field', () => {
  it('accepts valid edges override', () => {
    expect(validateThemeInput({ edges: { strokeWidth: 2 } }).ok).toBe(true);
    expect(validateThemeInput({ edges: { curveTension: 0.5 } }).ok).toBe(true);
  });

  it('accepts curveTension at 0 and 1 boundaries', () => {
    expect(validateThemeInput({ edges: { curveTension: 0 } }).ok).toBe(true);
    expect(validateThemeInput({ edges: { curveTension: 1 } }).ok).toBe(true);
  });

  it('rejects curveTension > 1', () => {
    const r = validateThemeInput({ edges: { curveTension: 1.1 } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('curveTension');
  });

  it('rejects curveTension < 0', () => {
    expect(validateThemeInput({ edges: { curveTension: -0.1 } }).ok).toBe(false);
  });

  it('rejects negative strokeWidth', () => {
    expect(validateThemeInput({ edges: { strokeWidth: -1 } }).ok).toBe(false);
  });

  it('rejects unknown edges key (STRICT)', () => {
    const r = validateThemeInput({ edges: { width: 2 } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('width');
  });
});

// ─── panel field ──────────────────────────────────────────────────────────────

describe('validateThemeInput — panel field', () => {
  it('accepts valid panel overrides', () => {
    expect(validateThemeInput({ panel: { titleAlign: 'center' } }).ok).toBe(true);
    expect(validateThemeInput({ panel: { titlePosition: 'on-border' } }).ok).toBe(true);
    expect(validateThemeInput({ panel: { titleChrome: 'pill' } }).ok).toBe(true);
  });

  it('accepts all valid enum values', () => {
    for (const align of ['left', 'center', 'right'] as const) {
      expect(validateThemeInput({ panel: { titleAlign: align } }).ok).toBe(true);
    }
    for (const pos of ['inside', 'on-border', 'above'] as const) {
      expect(validateThemeInput({ panel: { titlePosition: pos } }).ok).toBe(true);
    }
    for (const chrome of ['none', 'box', 'pill'] as const) {
      expect(validateThemeInput({ panel: { titleChrome: chrome } }).ok).toBe(true);
    }
  });

  it('rejects invalid titleAlign value', () => {
    const r = validateThemeInput({ panel: { titleAlign: 'justify' } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('titleAlign');
  });

  it('rejects invalid titlePosition value', () => {
    expect(validateThemeInput({ panel: { titlePosition: 'below' } }).ok).toBe(false);
  });

  it('rejects invalid titleChrome value', () => {
    expect(validateThemeInput({ panel: { titleChrome: 'badge' } }).ok).toBe(false);
  });

  it('rejects unknown panel key (STRICT)', () => {
    const r = validateThemeInput({ panel: { align: 'left' } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('align');
  });
});

// ─── schema.json ─────────────────────────────────────────────────────────────

describe('src/theme/schema.json', () => {
  // AC 10: schema parses as valid JSON
  it('parses as valid JSON', () => {
    const schemaPath = resolve('src/theme/schema.json');
    const raw = readFileSync(schemaPath, 'utf8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('has expected $id and $schema fields', () => {
    const schemaPath = resolve('src/theme/schema.json');
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
    expect(schema.$id).toBe('https://triton.dev/schemas/triton-theme.schema.json');
    expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#');
  });

  it('declares additionalProperties: false at top level', () => {
    const schema = JSON.parse(readFileSync(resolve('src/theme/schema.json'), 'utf8'));
    expect(schema.additionalProperties).toBe(false);
  });

  it('declares additionalProperties: false on all group objects', () => {
    const schema = JSON.parse(readFileSync(resolve('src/theme/schema.json'), 'utf8'));
    for (const group of ['palette', 'typography', 'spacing', 'edges', 'panel']) {
      expect(schema.properties[group].additionalProperties, `${group} should have additionalProperties: false`).toBe(false);
    }
  });

  it('schema base enum matches themePresetNames', () => {
    const schema = JSON.parse(readFileSync(resolve('src/theme/schema.json'), 'utf8'));
    expect(schema.properties.base.enum).toEqual([...themePresetNames]);
  });
});

// ─── Full combined valid input ────────────────────────────────────────────────

describe('validateThemeInput — full valid input', () => {
  it('accepts a complete valid ThemeInput', () => {
    const r = validateThemeInput({
      name: 'my-dark',
      base: 'default',
      palette: { primary: '#4A90D9', background: '#000' },
      typography: { baseFontSize: 14, fontFamily: 'Inter, sans-serif' },
      spacing: { unit: 8, nodeGap: 40 },
      edges: { strokeWidth: 1.5, curveTension: 0.4 },
      panel: { titleAlign: 'left', titlePosition: 'inside', titleChrome: 'none' },
    });
    expect(r.ok).toBe(true);
  });
});
