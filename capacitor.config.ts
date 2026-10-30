import type { CapacitorConfig } from '@capacitor/cli';

// iPhone-App: dieselbe Vue-App, gebaut mit "npm run build:native" nach frontend/native-dist.
// Die Oberfläche liegt im App-Paket (startet sofort, auch offline), Daten kommen von der API auf Render.
const config: CapacitorConfig = {
  appId: 'com.took1s.sprintlog',
  appName: 'SprintLog',
  webDir: 'frontend/native-dist',
  // Kein Zugriff auf andere Hosts außer der API (siehe CSP im App-Build).
  ios: {
    // Inhalt reicht bis unter die Statusleiste; Abstände kommen aus env(safe-area-inset-*) im CSS.
    contentInset: 'never',
    backgroundColor: '#0e1311',
    // Kein Zurück-Wischen in die leere WebView-Historie
    allowsLinkPreview: false,
    scrollEnabled: true,
  },
  plugins: {
    LocalNotifications: { iconColor: '#c6ff3d' },
  },
};

export default config;
