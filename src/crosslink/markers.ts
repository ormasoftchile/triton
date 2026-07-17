const HASH_OFFSET = 0x811c9dc5;
const HASH_PRIME = 0x01000193;

export function crossLinkMarkerId(baseId: string, color: string): string {
  return `${baseId}-${colorToken(color)}`;
}

function colorToken(color: string): string {
  const normalized = color.trim().toLowerCase();
  const hex = normalized.match(/^#([0-9a-f]+)$/);
  if (hex) return hex[1]!;

  let hash = HASH_OFFSET;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, HASH_PRIME) >>> 0;
  }
  return `c${hash.toString(36)}`;
}
