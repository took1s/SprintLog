/// <reference types="vite/client" />

/** Version aus package.json (vite.config.ts -> define). */
declare const __APP_VERSION__: string;

/** API-Basis-URL der nativen App (vite build --mode native), im Web leer. */
declare const __NATIVE_API__: string;
