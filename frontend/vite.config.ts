/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import { serviceWorker } from './build/service-worker';
import pkg from '../package.json' with { type: 'json' };

const api = process.env.SPRINTLOG_API ?? 'http://localhost:5111'; // dotnet run bzw. npm run mock

/** API der iPhone-App (vite build --mode native). */
const nativeApi = process.env.SPRINTLOG_NATIVE_API ?? 'https://sprintlog-api.onrender.com';

/**
 * App-Build: Content-Security-Policy als meta-Tag (die Dateien kommen aus dem App-Paket, nicht vom Server mit Headern).
 * Gleiche Regeln wie im Web, nur die API liegt auf einem anderen Host.
 */
function nativeCsp(apiOrigin: string): Plugin {
  const policy = [
    "default-src 'self'", "script-src 'self'", "style-src 'self'", "img-src 'self' data: blob:", "font-src 'self'",
    `connect-src 'self' ${apiOrigin}`, "object-src 'none'", "base-uri 'none'", "form-action 'none'",
  ].join('; ');
  return {
      name: 'sprintlog-native-csp',
      transformIndexHtml: (html) => html
        .replace('<meta charset="UTF-8">', `<meta charset="UTF-8">\n    <meta http-equiv="Content-Security-Policy" content="${policy}">`)
        // kein Web-Manifest in der App
        .replace(/\s*<link rel="manifest"[^>]*>/, ''),
  };
}

export default defineConfig(({ mode }) => {
  const native = mode === 'native';
  const input: Record<string, string> = { index: fileURLToPath(new URL('./index.html', import.meta.url)) };
  if (!native) input.sw = fileURLToPath(new URL('./src/sw.ts', import.meta.url));

  return {
    root: fileURLToPath(new URL('.', import.meta.url)),
    plugins: native ? [vue(), nativeCsp(new URL(nativeApi).origin)] : [vue(), serviceWorker()],
    define: {
      // Version der Web-App (package.json) - wird als X-Client-Version an die API geschickt und in den Logs angezeigt.
      __APP_VERSION__: JSON.stringify(pkg.version),
      // App: absolute API-URL; Web: leer (gleicher Origin)
      __NATIVE_API__: JSON.stringify(native ? new URL(nativeApi).origin : ''),
    },
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    css: { postcss: fileURLToPath(new URL('./postcss.config.cjs', import.meta.url)) },
    build: {
      // App: eigener Ordner, den Capacitor ins iOS-Projekt kopiert (npx cap sync)
      outDir: fileURLToPath(new URL(native ? './native-dist' : '../SprintLog.Api/wwwroot', import.meta.url)),
      emptyOutDir: true,
      // Keine data:-URLs für Schriften/Bilder - passt zur strikten Content-Security-Policy.
      assetsInlineLimit: 0,
      sourcemap: !native, // App-Paket klein halten
      target: 'es2022',
      rollupOptions: {
        input,
        output: {
          entryFileNames: (chunk) => (chunk.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js'),
        },
      },
    },
    // Entwicklung: "npm run dev" + API (dotnet run oder "npm run mock") - /api wird weitergeleitet.
    server: {
      port: 5173,
      proxy: { '/api': api, '/health': api },
    },
    test: {
      root: fileURLToPath(new URL('.', import.meta.url)),
      include: ['tests/**/*.test.ts'],
      environment: 'node', // Komponenten-Tests schalten per Kommentar auf happy-dom um
    },
  };
});
