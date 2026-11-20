<script setup lang="ts">
// Kopf mit großem Titel des Bereichs (wie iOS) und eine schwebende Tab-Leiste unten, wo der Daumen ist.
// Die Leiste lässt sich wie bisher halten und durchziehen (lib/scrub.ts); beim Tippen in ein Feld blendet sie sich aus,
// damit sie nicht über der Tastatur klebt.
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import { storeToRefs } from 'pinia';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useAiStore } from '@/stores/ai';
import { tap } from '@/lib/native';
import { useScrub } from '@/lib/scrub';
import AppIcon from '@/components/AppIcon.vue';

const app = useAppStore();
const ai = useAiStore();
onMounted(() => { if (!ai.status) void ai.loadStatus(); });
const { online, pendingCount, syncState, syncing, tab } = storeToRefs(app);
const { openSettings, syncNow } = app;

// Reihenfolge = Position des gleitenden Markers
const TABS = [
  { key: 'Gym', label: 'nav.gym', icon: 'gym' }, { key: 'Football', label: 'nav.field', icon: 'field' },
  { key: 'Plan', label: 'nav.plan', icon: 'plan' }, { key: 'Data', label: 'nav.data', icon: 'data' },
] as const;
const index = computed(() => Math.max(0, TABS.findIndex((x) => x.key === tab.value)));
const title = computed(() => t(TABS[index.value]!.label));
function select(key: (typeof TABS)[number]['key']) {
  if (tab.value === key) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; } // erneut antippen = nach oben (wie iOS)
  tap();
  tab.value = key;
}

// Halten oder seitlich ziehen: Marker folgt dem Finger, Loslassen wählt
const bar = useTemplateRef<HTMLElement>('bar');
const scrub = useScrub(bar, { count: () => TABS.length, current: () => index.value, select: (i) => { tab.value = TABS[i]!.key; } });
const shown = computed(() => (scrub.dragging.value ? scrub.hover.value : index.value));
const markerStyle = computed(() => ({
  transform: scrub.dragging.value ? `translate3d(${scrub.offset.value}px, 0, 0)` : `translate3d(${index.value * 100}%, 0, 0)`,
}));

// Tastatur offen (Suche im Katalog o. Ä.): Leiste ausblenden
const typing = ref(false);
const isField = (el: EventTarget | null) => el instanceof HTMLElement && (el.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea, select') || el.isContentEditable);
const onFocusIn = (e: FocusEvent) => { typing.value = isField(e.target); };
const onFocusOut = (e: FocusEvent) => { if (!isField(e.relatedTarget)) typing.value = false; };
onMounted(() => { document.addEventListener('focusin', onFocusIn); document.addEventListener('focusout', onFocusOut); });
onBeforeUnmount(() => { document.removeEventListener('focusin', onFocusIn); document.removeEventListener('focusout', onFocusOut); });
</script>

<template>
  <header class="app-header">
      <h1 class="app-title display" data-test="app-title">{{ title }}</h1>
      <div class="flex flex-shrink-0 items-center gap-2">
          <!-- Synchron: ein ruhiger Punkt. Offen/offline/Fehler: Text - Antippen sendet sofort. -->
          <component :is="pendingCount ? 'button' : 'span'" :type="pendingCount ? 'button' : undefined"
                @click="pendingCount && !syncing ? syncNow() : undefined"
                class="sync-pill" :class="`is-${syncState.tone}`" data-test="sync-pill"
                :title="pendingCount ? t('sync.tapToSync') : online ? t('sync.connected') : t('sync.disconnected')"
                :aria-label="pendingCount ? `${syncState.label} - ${t('sync.tapToSync')}` : undefined">
              <span class="h-1.5 w-1.5 rounded-full bg-current" :class="{ 'animate-pulse': syncing || !online }"></span>
              <span :class="syncState.tone === 'green' ? 'sr-only' : ''">{{ syncState.label }}</span>
          </component>
          <!-- Coach: Trillerpfeife + Name - immer erreichbar, auf jedem Bereich -->
          <button v-if="ai.enabled" type="button" class="coach-pill" :aria-label="t('ai.open')" data-test="coach-ask" @click="ai.openChat()">
              <AppIcon name="coach" class="h-5 w-5" />
              <span>{{ t('nav.coach') }}</span>
          </button>
          <button type="button" class="header-btn" :aria-label="t('nav.settings')" @click="openSettings">
              <AppIcon name="settings" class="h-[22px] w-[22px]" />
          </button>
      </div>
  </header>

  <nav class="tabbar-wrap" :class="{ 'is-hidden': typing }" :aria-label="t('nav.main')">
      <div ref="bar" class="tabbar glass-float scrub-bar" :class="{ 'is-scrubbing': scrub.dragging.value }" role="tablist" data-test="main-tabs">
          <span class="tab-indicator" :style="markerStyle" aria-hidden="true"></span>
          <button v-for="(x, i) in TABS" :key="x.key" type="button" role="tab" :aria-selected="tab === x.key" @click="select(x.key)"
                  class="tab-btn" :class="{ 'tab-active': shown === i }">
              <AppIcon :name="x.icon" class="tab-icon" />
              <span class="tab-label">{{ t(x.label) }}</span>
          </button>
      </div>
  </nav>
</template>
