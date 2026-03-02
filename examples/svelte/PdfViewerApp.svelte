<!-- Example Svelte component for pdflight integration. -->
<!-- Requires: npm install @pilotso11/pdflight -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { PdfViewer } from '@pilotso11/pdflight';

  export let url: string;

  let container: HTMLDivElement;
  let viewer: PdfViewer | null = null;
  let query = '';

  onMount(() => {
    viewer = new PdfViewer(container, {
      toolbar: true,
      sidebar: true,
    });
    viewer.load(url);
  });

  onDestroy(() => {
    viewer?.destroy();
    viewer = null;
  });

  async function handleSearch() {
    if (!viewer || !query.trim()) return;

    viewer.removeAllHighlights();
    const matches = await viewer.search(query);
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
    query = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleSearch();
  }
</script>

<div>
  <div style="padding: 12px; display: flex; gap: 8px;">
    <input
      bind:value={query}
      on:keydown={handleKeydown}
      placeholder="Search..."
      style="flex: 1; padding: 6px 10px; font-size: 14px;"
    />
    <button on:click={handleSearch}>Search</button>
    <button on:click={handleClear}>Clear</button>
  </div>
  <div bind:this={container} style="width: 100%; height: calc(100vh - 48px);" />
</div>
