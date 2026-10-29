// Eigener Einstiegspunkt für das nachgeladene Sentry-SDK: nur benannte Importe,
// damit der Bundler alles Ungenutzte (Tracing, Replay, Feedback, ...) entfernen kann.
export { init, setUser } from '@sentry/vue';
