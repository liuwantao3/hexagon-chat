<template>
  <div v-html="svgCode" class="svg-viewer" />
</template>

<script setup lang="ts">
defineProps<{ svgCode: string }>()
</script>

<style scoped>
.svg-viewer {
  max-width: 100%;
  overflow-x: auto;
}
.svg-viewer :deep(svg) {
  max-width: 100%;
  height: auto;
  display: block;
}
</style>
