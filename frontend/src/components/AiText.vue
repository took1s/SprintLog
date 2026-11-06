<script setup lang="ts">
// Lange Antworten des KI-Coachs gut lesbar: Absätze, Zwischenüberschriften, Listen - als echte Elemente (kein v-html, CSP).
import { computed } from 'vue';
import { parseAiText } from '@/lib/aiText';

const props = defineProps<{ text: string }>();
const blocks = computed(() => parseAiText(props.text));
</script>

<template>
  <div class="space-y-2.5 break-words" data-test="ai-text">
      <template v-for="(b, i) in blocks" :key="i">
          <p v-if="b.kind === 'h'" class="pt-1 text-xs font-bold uppercase text-accent tracking-label first:pt-0" role="heading" aria-level="3">{{ b.text }}</p>
          <p v-else-if="b.kind === 'p'" class="whitespace-pre-line">{{ b.text }}</p>
          <ul v-else-if="b.kind === 'ul'" class="space-y-1.5">
              <li v-for="(item, j) in b.items" :key="j" class="flex gap-2"><span class="mt-[0.55em] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" aria-hidden="true"></span><span class="min-w-0">{{ item }}</span></li>
          </ul>
          <ol v-else class="space-y-1.5" :start="b.start">
              <li v-for="(item, j) in b.items" :key="j" class="flex gap-2"><span class="min-w-[1.25rem] flex-shrink-0 font-mono text-xs font-bold leading-[inherit] text-accent tabular-nums" aria-hidden="true">{{ b.start + j }}.</span><span class="min-w-0">{{ item }}</span></li>
          </ol>
      </template>
  </div>
</template>
