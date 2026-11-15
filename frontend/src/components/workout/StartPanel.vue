<script setup lang="ts">
// Главный экран, когда тренировка не идёт: неделя, карточка дня (вердикт тренера + главная кнопка), дела на сегодня
// (доп. тренировка, рутины, белок, тесты, часы), затем обзор (недельный отчёт, восстановление).
// Одна главная кнопка - всё остальное ниже по важности.
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import HalloweenSpider from '@/components/decor/HalloweenSpider.vue';
import { appearance } from '@/lib/theme';
import RecoveryCard from '@/components/RecoveryCard.vue';
import RoutinesToday from '@/components/RoutinesToday.vue';
import PlannedToday from '@/components/PlannedToday.vue';
import WeekStrip from '@/components/WeekStrip.vue';
import WeekReportCard from '@/components/WeekReportCard.vue';
import TodayHero from './TodayHero.vue';
import TodayTodo from './TodayTodo.vue';

const app = useAppStore();
const { tab } = storeToRefs(app);
const isField = computed(() => tab.value === 'Football');
</script>

<template>
  <section class="stagger start-panel relative mb-6" :class="{ 'hw-card': appearance.theme === 'halloween', 'st-card': appearance.theme === 'striker' }" data-test="start-panel">
      <HalloweenSpider v-if="appearance.theme === 'halloween'" />
      <h2 class="sr-only">{{ isField ? t('start.titleField') : t('start.title') }}</h2>
      <WeekStrip />
      <TodayHero />
      <div>
          <p class="section-label mt-6">{{ t('start.todayList') }}</p>
          <PlannedToday />
          <RoutinesToday />
          <TodayTodo />
      </div>
      <div>
          <WeekReportCard />
          <RecoveryCard />
      </div>
  </section>
</template>
