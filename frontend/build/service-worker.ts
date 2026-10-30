// Vite-Plugin: setzt die Precache-Liste und eine Build-Version in den Service Worker ein.
// Der Service Worker (src/sw.ts) ist ein eigener Rollup-Einstiegspunkt ohne Imports und landet unter /sw.js.

import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

/** Schriftschnitte, die offline sofort verfügbar sein sollen (andere werden bei Bedarf nachgeladen und gecacht). */
const FONT_SUBSETS = /inter-(latin|latin-ext|cyrillic|cyrillic-ext)-wght-normal-[\w-]+\.woff2$/;

export function serviceWorker({ publicFiles = ['manifest.json', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'favicon.svg'] } = {}): Plugin {
  return {
    name: 'sprintlog-service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const sw = Object.values(bundle).find((f) => f.type === 'chunk' && f.fileName === 'sw.js');
      if (!sw || sw.type !== 'chunk') this.error('sw.js entry chunk not found');

      const assets = Object.values(bundle)
        .map((f) => f.fileName)
        .filter((name) => name !== 'sw.js' && !name.endsWith('.map'))
        .filter((name) => !name.endsWith('.woff2') || FONT_SUBSETS.test(name))
        .filter((name) => !name.endsWith('.woff')) // ältere Formate braucht kein unterstützter Browser
        .sort();

      const manifest = ['/', ...assets.map((n) => `/${n}`), ...publicFiles.map((n) => `/${n}`)];
      const version = createHash('sha256').update(manifest.join('\n')).digest('hex').slice(0, 12);

      if (sw.code.includes('import ') || sw.code.includes('export ')) this.error('sw.js must not import or export anything');
      sw.code = sw.code
        .replaceAll('__PRECACHE_MANIFEST__', JSON.stringify(manifest))
        .replaceAll('__BUILD_VERSION__', JSON.stringify(version));
    },
  };
}
