<script setup lang="ts">
// Abschnitte im Datenbereich: Segmentleiste mit Symbolen, bleibt beim Scrollen oben kleben, lässt sich durchziehen.
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import { t } from '@/i18n';
import type { DataTab } from '@/stores/app';
import { useScrub } from '@/lib/scrub';
import { tap } from '@/lib/native';

const props = defineProps<{ tabs: readonly DataTab[]; modelValue: DataTab }>();
const emit = defineEmits<{ 'update:modelValue': [DataTab] }>();

const index = computed(() => Math.max(0, props.tabs.indexOf(props.modelValue)));
function select(tab: DataTab) {
  if (tab === props.modelValue) return;
  tap();
  emit('update:modelValue', tab);
}

const bar = useTemplateRef<HTMLElement>('bar');
const scrub = useScrub(bar, {
  count: () => props.tabs.length,
  current: () => index.value,
  select: (i) => emit('update:modelValue', props.tabs[i]!),
});
const shown = computed(() => (scrub.dragging.value ? scrub.hover.value : index.value));
const columns = computed(() => ({ gridTemplateColumns: `repeat(${props.tabs.length}, minmax(0, 1fr))` }));
const markerStyle = computed(() => ({
  width: `calc((100% - 8px) / ${props.tabs.length})`,
  transform: scrub.dragging.value ? `translate3d(${scrub.offset.value}px, 0, 0)` : `translate3d(${index.value * 100}%, 0, 0)`,
}));

// Klebt die Leiste oben? Dann bekommt sie einen Hintergrund (vorher wirkt sie wie Teil der Seite)
const sentinel = useTemplateRef<HTMLElement>('sentinel');
const stuck = ref(false);
let observer: IntersectionObserver | null = null;
onMounted(() => {
  if (!sentinel.value || typeof IntersectionObserver === 'undefined') return;
  observer = new IntersectionObserver(([entry]) => { stuck.value = !!entry && !entry.isIntersecting && entry.boundingClientRect.top < 0; });
  observer.observe(sentinel.value);
});
onBeforeUnmount(() => observer?.disconnect());

/** Nach dem Wechsel weiter unten: zum Anfang des neuen Abschnitts springen (sonst landet man mitten darin). */
function revealTop() {
  const node = sentinel.value;
  if (!node) return;
  const safe = parseFloat(getComputedStyle(document.body).paddingTop) || 0;
  const y = node.getBoundingClientRect().top + window.scrollY - safe;
  if (window.scrollY > y + 1) window.scrollTo({ top: y });
}
defineExpose({ revealTop });

// Symbole (24er Raster, Strichstärke 2) - Farbe kommt über currentColor aus den Tokens
const ICONS: Record<DataTab, string[]> = {
  overview: ['M4 13h6v7H4z', 'M14 4h6v16h-6z', 'M4 4h6v5H4z'],
  ai: ['M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z', 'M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z'],
  history: ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v5h5', 'M12 7v5l3 2'],
  progress: ['M3 17l6-6 4 4 8-8', 'M15 7h6v6'],
  records: ['M8 21h8', 'M12 17v4', 'M7 4h10v5a5 5 0 0 1-10 0z', 'M17 6h3v1a3 3 0 0 1-3 3', 'M7 6H4v1a3 3 0 0 0 3 3'],
  calendar: ['M4 6h16v14H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
};
</script>

<template>
  <div ref="sentinel" class="h-px" aria-hidden="true"></div>
  <div class="data-tabs" :class="{ 'is-stuck': stuck }">
    <div ref="bar" class="data-tabbar scrub-bar" :class="{ 'is-scrubbing': scrub.dragging.value }" :style="columns"
         role="tablist" :aria-label="t('data.tabsLabel')" data-test="data-tabs">
      <span class="data-tab-marker" :style="markerStyle" aria-hidden="true"></span>
      <button v-for="(tab_, i) in tabs" :key="tab_" type="button" role="tab" :aria-selected="modelValue === tab_"
              :aria-label="t(`data.tabs.${tab_}`)" :data-subtab="tab_" @click="select(tab_)"
              class="data-tab" :class="{ 'data-tab-active': shown === i }">
        <svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path v-for="d in ICONS[tab_]" :key="d" :d="d" />
        </svg>
        <span class="data-tab-label">{{ t(`data.tabsShort.${tab_}`) }}</span>
      </button>
    </div>
  </div>
</template>
