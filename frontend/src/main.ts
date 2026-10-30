import { createApp } from 'vue';
import { createPinia } from 'pinia';
import '@fontsource-variable/inter/wght.css';
// Theme-Schriften: Die CSS-Dateien sind klein, die Schriftdateien lädt der Browser erst, wenn ein Theme sie nutzt.
import '@fontsource-variable/oswald/wght.css';
import '@fontsource-variable/manrope/wght.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/600.css';
import './styles/app.css';
import { initAppearance } from './lib/theme';
import App from './App.vue';
import { useAppStore } from './stores/app';
import { initMonitoring } from './lib/monitoring';

// Theme vor dem ersten Rendern setzen (kein Aufflackern).
initAppearance();

const app = createApp(App);
const pinia = createPinia();
app.use(pinia).mount('#app');

// Fehler-Monitoring erst nach dem ersten Rendern starten - verzögert den App-Start nicht.
const store = useAppStore(pinia);
void initMonitoring(app, () => store.user?.userId);
