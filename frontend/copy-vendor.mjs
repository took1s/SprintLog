// Kopiert die benötigten Browser-Builds aus node_modules nach wwwroot/vendor.
// Die Dateien werden eingecheckt, damit die App ohne CDN (und damit offline) funktioniert.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'SprintLog.Api', 'wwwroot', 'vendor');
mkdirSync(target, { recursive: true });

const files = [
  ['node_modules/vue/dist/vue.esm-browser.prod.js', 'vue.esm-browser.prod.js'],
  ['node_modules/chart.js/dist/chart.umd.js', 'chart.umd.js'],
  ['node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', 'inter-latin-wght-normal.woff2'],
  ['node_modules/@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2', 'inter-latin-ext-wght-normal.woff2'],
];

for (const [from, to] of files) {
  copyFileSync(join(root, from), join(target, to));
  console.log(`vendor: ${to}`);
}
