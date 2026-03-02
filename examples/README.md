# Framework Examples

pdflight is framework-agnostic — it works with any JavaScript framework or none at all. These examples show the integration pattern for each:

| Framework | File | Key pattern |
|---|---|---|
| [Vanilla JS](vanilla/index.html) | Single HTML file with `<script type="module">` | Direct API calls |
| [React](react/PdfViewerApp.tsx) | Component with `useRef` + `useEffect` | Ref holds viewer instance, cleanup on unmount |
| [Vue 3](vue/PdfViewerApp.vue) | Composition API with `ref` + `onMounted` | Template ref for container, cleanup on unmount |
| [Svelte](svelte/PdfViewerApp.svelte) | Component with `onMount` + `bind:this` | Bind container element, cleanup on destroy |

## The pattern

Every framework integration follows the same three steps:

1. **Mount** — pass a container DOM element to `new PdfViewer(element, options)`
2. **Use** — call `viewer.load()`, `viewer.search()`, `viewer.addHighlights()` etc.
3. **Cleanup** — call `viewer.destroy()` when the component unmounts

No wrapper library needed. The viewer manages its own DOM inside the container you provide.

## Install

```bash
npm install @pilotso11/pdflight
```

## CDN (no build tool)

The vanilla example can also use the CDN build:

```html
<script src="https://pilotso11.github.io/pdflight/pdflight.iife.js"></script>
<script>
  const viewer = new pdflight.PdfViewer(document.getElementById('viewer'));
  viewer.load('/sample.pdf');
</script>
```
