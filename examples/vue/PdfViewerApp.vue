<!-- Example Vue 3 component for pdflight integration. -->
<!-- Requires: npm install @pilotso11/pdflight vue -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { PdfViewer } from '@pilotso11/pdflight';

const props = defineProps<{ url: string }>();

const containerRef = ref<HTMLDivElement>();
const query = ref('');
let viewer: PdfViewer | null = null;

onMounted(() => {
  viewer = new PdfViewer(containerRef.value!, {
    toolbar: true,
    sidebar: true,
  });
  viewer.load(props.url);
});

onUnmounted(() => {
  viewer?.destroy();
  viewer = null;
});

async function handleSearch() {
  if (!viewer || !query.value.trim()) return;

  viewer.removeAllHighlights();
  const matches = await viewer.search(query.value);
  viewer.addHighlights(matches.map((m, i) => ({
    id: `h-${i}`,
    page: m.page,
    startChar: m.startChar,
    endChar: m.endChar,
    color: 'rgba(255, 255, 0, 0.4)',
  })));
}

function handleClear() {
  viewer?.removeAllHighlights();
  query.value = '';
}
</script>

<template>
  <div>
    <div style="padding: 12px; display: flex; gap: 8px">
      <input
        v-model="query"
        @keydown.enter="handleSearch"
        placeholder="Search..."
        style="flex: 1; padding: 6px 10px; font-size: 14px"
      />
      <button @click="handleSearch">Search</button>
      <button @click="handleClear">Clear</button>
    </div>
    <div ref="containerRef" style="width: 100%; height: calc(100vh - 48px)" />
  </div>
</template>
