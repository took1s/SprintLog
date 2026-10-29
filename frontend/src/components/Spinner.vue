<script setup lang="ts">
import { t } from '@/i18n';
</script>

<template>
  <div class="flex justify-center py-20" role="status" :aria-label="t('common.loading')">
    <div class="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
  </div>
</template>
