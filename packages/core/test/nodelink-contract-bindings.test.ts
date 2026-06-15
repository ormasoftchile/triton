/**
 * @file test/nodelink-contract-bindings.test.ts — Node-link family Tier-3 binding tests.
 * Tests that all 7 node-link component bindings produce valid, deterministic themes.
 */
import { describe, expect, it } from 'vitest';
import { executive } from '../src/theme-contract/index.js';
import type { ThemeContract } from '../src/theme-contract/index.js';
import { bindClassTheme }        from '../src/grammars/class/contract-binding.js';
import { bindStateTheme }        from '../src/grammars/state/contract-binding.js';
import { bindErTheme }           from '../src/grammars/er/contract-binding.js';
import { bindC4Theme }           from '../src/grammars/c4/contract-binding.js';
import { bindRequirementTheme }  from '../src/grammars/requirement/contract-binding.js';
import { bindBlockTheme }        from '../src/grammars/block/contract-binding.js';
import { bindArchitectureTheme } from '../src/grammars/architecture/contract-binding.js';

function clone(c: ThemeContract): ThemeContract {
  return JSON.parse(JSON.stringify(c)) as ThemeContract;
}

const bindings = [
  { name: 'class',        fn: bindClassTheme },
  { name: 'state',        fn: bindStateTheme },
  { name: 'er',           fn: bindErTheme },
  { name: 'c4',           fn: bindC4Theme },
  { name: 'requirement',  fn: bindRequirementTheme },
  { name: 'block',        fn: bindBlockTheme },
  { name: 'architecture', fn: bindArchitectureTheme },
] as const;

for (const { name, fn } of bindings) {
  describe(`bind${name.charAt(0).toUpperCase() + name.slice(1)}Theme`, () => {
    it('produces a non-null object', () => {
      const t = fn(executive);
      expect(t).toBeTruthy();
      expect(typeof t).toBe('object');
    });

    it('background is the contract surface color', () => {
      const t = fn(executive);
      expect((t as Record<string, unknown>)['background']).toBe(executive.palette.surface);
    });

    it('fontFamily includes the contract typography family', () => {
      const t = fn(executive);
      expect((t as Record<string, unknown>)['fontFamily'] as string).toContain(executive.typography.family);
    });

    it('is deterministic (same input → same output)', () => {
      const a = fn(executive);
      const b = fn(clone(executive));
      expect(a).toEqual(b);
    });
  });
}
