<template>
  <div class="h-full">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <UModals />
    <ClientOnly>
      <CodeExecutor />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import CodeExecutor from '~/components/CodeExecutor.vue'
</script>
