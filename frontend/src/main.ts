import { createApp } from 'vue';
import { createPinia } from 'pinia';
import '@fontsource-variable/inter/wght.css';
import './styles/app.css';
import App from './App.vue';
import { useAppStore } from './stores/app';
import { initMonitoring } from './lib/monitoring';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia).mount('#app');

// Fehler-Monitoring erst nach dem ersten Rendern starten - verzögert den App-Start nicht.
const store = useAppStore(pinia);
void initMonitoring(app, () => store.user?.userId);
