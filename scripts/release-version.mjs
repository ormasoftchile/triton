/**
 * Release version-sync script.
 *
 * Single source of truth: the ROOT package.json `version` field. This script
 * computes a new lockstep version and writes the SAME version into all three
 * package.json files:
 *   ./package.json
 *   ./packages/core/package.json
 *   ./latex/package.json
 *
 * Usage:
 *   node scripts/release-version.mjs <patch|minor|major>
 *   node scripts/release-version.mjs --set <x.y.z>
 *
 * Formatting is preserved (2-space indent + trailing newline, key order intact)
 * because we only mutate the `version` value in place. Dependency-free.
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const TARGETS = [
  join(rootDir, 'package.json'),
  join(rootDir, 'packages', 'core', 'package.json'),
  join(rootDir, 'latex', 'package.json'),
];

function fail(msg) {
  console.error(`release-version: ${msg}`);
  process.exit(1);
}

function parseSemver(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v).trim());
  if (!m) fail(`invalid semver version: "${v}" (expected x.y.z, no prerelease)`);
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function bump({ major, minor, patch }, level) {
  switch (level) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      fail(`unknown level: "${level}" (expected patch|minor|major)`);
  }
}

// Read the current version from the root package.json (source of truth).
const rootRaw = readFileSync(TARGETS[0], 'utf8');
const current = JSON.parse(rootRaw).version;
if (!current) fail('root package.json has no "version" field');

const args = process.argv.slice(2);
let newVersion;
let level;

if (args[0] === '--set') {
  if (!args[1]) fail('--set requires a version argument (x.y.z)');
  parseSemver(args[1]); // validate
  newVersion = args[1].trim();
  level = 'set';
} else if (args.length === 1 && ['patch', 'minor', 'major'].includes(args[0])) {
  level = args[0];
  newVersion = bump(parseSemver(current), level);
} else {
  fail('usage: node scripts/release-version.mjs <patch|minor|major> | --set <x.y.z>');
}

// Write the same new version into every target, mutating only the `version`
// value so formatting, key order, and trailing newline are preserved.
for (const file of TARGETS) {
  const raw = readFileSync(file, 'utf8');
  const replaced = raw.replace(
    /("version"\s*:\s*")[^"]*(")/,
    `$1${newVersion}$2`,
  );
  if (replaced === raw && !raw.includes(`"version": "${newVersion}"`)) {
    fail(`could not find a "version" field to update in ${file}`);
  }
  writeFileSync(file, replaced);
  console.error(`  updated ${file} -> ${newVersion}`);
}

// Machine-readable outputs (consumed by CI via `>> "$GITHUB_OUTPUT"`).
console.log(`level=${level}`);
console.log(`version=${newVersion}`);
