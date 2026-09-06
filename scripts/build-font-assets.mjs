import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const fontDir = new URL('../assets/fonts/source-sans-3/', import.meta.url);
const license = readFileSync(new URL('OFL.txt', fontDir), 'utf8').trim();
const rules = [400, 700].map(weight => {
  const file = new URL(`source-sans-3-latin-${weight}-normal.woff2`, fontDir);
  const data = readFileSync(file).toString('base64');
  return `@font-face{font-family:'Source Sans 3';font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${data}) format('woff2');}`;
});
const css = `/* ${license} */\n${rules.join('\n')}`;
const output = new URL('../src/theme/sourceSans3.generated.ts', import.meta.url);
writeFileSync(output, `export const sourceSans3FontCss = ${JSON.stringify(css)};\n`);
console.log(`Generated ${fileURLToPath(output)}`);