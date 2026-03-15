<script setup>
const { t } = useI18n()
</script>
<template>
  <div class="text-lg mx-auto max-w-6xl">
    <h1 class="font-bold text-2xl my-8">{{ t("home.welcome") }}</h1>
    <p v-html="t('home.description')"></p>
  </div>
</template>
