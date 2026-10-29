/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { serviceWorker } from './build/service-worker';
import pkg from '../package.json' with { type: 'json' };

const api = process.env.SPRINTLOG_API ?? 'http://localhost:5111'; // dotnet run bzw. npm run mock

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [vue(), serviceWorker()],
  // Version der Web-App (package.json) - wird als X-Client-Version an die API geschickt und in den Logs angezeigt.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  css: { postcss: fileURLToPath(new URL('./postcss.config.cjs', import.meta.url)) },
  build: {
    outDir: fileURLToPath(new URL('../SprintLog.Api/wwwroot', import.meta.url)),
    emptyOutDir: true,
    // Keine data:-URLs für Schriften/Bilder - passt zur strikten Content-Security-Policy.
    assetsInlineLimit: 0,
    sourcemap: true,
    target: 'es2022',
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        sw: fileURLToPath(new URL('./src/sw.ts', import.meta.url)),
      },
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
});
