// Quick debug: patch layered.js to trace BK sweep values for dummy nodes
import { readFileSync, writeFileSync } from 'fs';

const layeredPath = './packages/core/dist/graph/layered.js';
let src = readFileSync(layeredPath, 'utf8');

// Add debug after xss.set(vert + horiz, xs)
src = src.replace(
  /xss\.set\(vert \+ horiz, xs\);/,
  `xss.set(vert + horiz, xs);
        // DEBUG
        for (const [id, x] of xs) {
          if (id.startsWith('__dummy_')) {
            console.log('  sweep ' + vert + horiz + ' dummy=' + id + ' x=' + x);
          }
          if (id === 'Customer' || id === 'Order') {
            console.log('  sweep ' + vert + horiz + ' ' + id + '.x=' + x);
          }
        }`
);

writeFileSync(layeredPath + '.debug.mjs', src.replace(/^/, 'export * from "./layered.js";\n'));
console.log('Done - no good way to patch. Use test directly.');
