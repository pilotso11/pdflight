import { PdfViewer, type SearchMatch, type Highlight } from '../src/index';

// DOM elements
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const demoPdfSelect = document.getElementById('demo-pdf') as HTMLSelectElement;
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const searchBtn = document.getElementById('search-btn') as HTMLButtonElement;
const searchResults = document.getElementById('search-results') as HTMLSpanElement;
const zoomIn = document.getElementById('zoom-in') as HTMLButtonElement;
const zoomOut = document.getElementById('zoom-out') as HTMLButtonElement;
const zoomLevel = document.getElementById('zoom-level') as HTMLSpanElement;
const fitMode = document.getElementById('fit-mode') as HTMLSelectElement;
const sidebarToggle = document.getElementById('sidebar-toggle') as HTMLInputElement;
const stepperToggle = document.getElementById('stepper-toggle') as HTMLInputElement;
const sidebar = document.getElementById('sidebar') as HTMLElement;
const thumbnails = document.getElementById('thumbnails') as HTMLElement;
const pageStepper = document.getElementById('page-stepper') as HTMLElement;
const prevPage = document.getElementById('prev-page') as HTMLButtonElement;
const nextPage = document.getElementById('next-page') as HTMLButtonElement;
const pageInfo = document.getElementById('page-info') as HTMLSpanElement;
const highlightAll = document.getElementById('highlight-all') as HTMLButtonElement;
const clearHighlights = document.getElementById('clear-highlights') as HTMLButtonElement;
const highlightColor = document.getElementById('highlight-color') as HTMLInputElement;
const exportJson = document.getElementById('export-json') as HTMLButtonElement;
const importJson = document.getElementById('import-json') as HTMLButtonElement;
const jsonIo = document.getElementById('json-io') as HTMLTextAreaElement;

const pdfViewerContainer = document.getElementById('pdf-viewer')!;

// State
let viewer: PdfViewer | null = null;
let currentSearchResults: SearchMatch[] = [];
let currentHighlightColor = '#ffff0080'; // 50% opacity yellow

// Initialize
function init() {
  console.log('[Demo App] init() called');
  console.log('[Demo App] pdfViewerContainer:', pdfViewerContainer);

  viewer = new PdfViewer(pdfViewerContainer, {
    tooltipContent: (h: Highlight) => `Highlight: ${h.id}`,
  });
  console.log('[Demo App] PdfViewer created:', viewer);

  // File input
  const openBtn = document.querySelector('.btn');
  openBtn?.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileSelect);

  // Demo PDF dropdown
  demoPdfSelect.addEventListener('change', handleDemoPdfSelect);

  // Search
  searchBtn.addEventListener('click', handleSearch);
  searchInput.addEventListener('keydown', (e) => e.key === 'Enter' && handleSearch());

  // Zoom
  zoomIn.addEventListener('click', () => {
    if (viewer) viewer.setZoom(viewer.getZoom() + 0.25);
  });
  zoomOut.addEventListener('click', () => {
    if (viewer) viewer.setZoom(Math.max(0.25, viewer.getZoom() - 0.25));
  });
  viewer?.on('zoomchange', (zoom: number) => {
    zoomLevel.textContent = `${Math.round(zoom * 100)}%`;
  });

  // Fit mode
  fitMode.addEventListener('change', () => {
    viewer?.setFitMode(fitMode.value as 'width' | 'page' | 'none');
  });

  // Sidebar
  sidebarToggle.addEventListener('change', () => {
    sidebar.classList.toggle('hidden', !sidebarToggle.checked);
  });

  // Stepper
  stepperToggle.addEventListener('change', () => {
    pageStepper.classList.toggle('hidden', !stepperToggle.checked);
  });

  // Navigation
  prevPage.addEventListener('click', () => {
    if (viewer) viewer.goToPage(viewer.getCurrentPage() - 1);
  });
  nextPage.addEventListener('click', () => {
    if (viewer) viewer.goToPage(viewer.getCurrentPage() + 1);
  });
  viewer?.on('pagechange', updatePageInfo);

  // Highlights
  highlightAll.addEventListener('click', highlightAllResults);
  clearHighlights.addEventListener('click', () => {
    viewer?.removeAllHighlights();
    currentSearchResults = [];
    searchResults.textContent = '';
  });
  highlightColor.addEventListener('input', () => {
    currentHighlightColor = highlightColor.value + '80'; // Add 50% opacity
  });

  // Serialize
  exportJson.addEventListener('click', () => {
    if (viewer) jsonIo.value = viewer.serializeHighlights();
  });
  importJson.addEventListener('click', () => {
    if (viewer && jsonIo.value) {
      viewer.deserializeHighlights(jsonIo.value);
      currentSearchResults = viewer.getHighlights().map((h: Highlight) => ({
        page: h.page,
        startChar: h.startChar,
        endChar: h.endChar,
        text: '',
      }));
      updatePageInfo();
    }
  });
}

async function handleFileSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file && viewer) {
    const arrayBuffer = await file.arrayBuffer();
    await viewer.load(arrayBuffer);
    updatePageInfo();
  }
}

async function handleDemoPdfSelect(e: Event) {
  const value = (e.target as HTMLSelectElement).value;
  console.log('[Demo App] handleDemoPdfSelect called with value:', value);
  if (value && viewer) {
    console.log('[Demo App] Loading PDF...');
    await viewer.load(`/tests/fixtures/${value}`);
    console.log('[Demo App] PDF loaded');
    updatePageInfo();
  }
}

async function handleSearch() {
  if (!viewer) return;
  const query = searchInput.value.trim();
  if (!query) return;

  currentSearchResults = await viewer.search(query);
  searchResults.textContent = `${currentSearchResults.length} match${currentSearchResults.length !== 1 ? 'es' : ''}`;
}

function highlightAllResults() {
  if (!viewer) return;
  viewer.removeAllHighlights();

  const highlights: Highlight[] = currentSearchResults.map((match, i) => ({
    id: `highlight-${i}`,
    page: match.page,
    startChar: match.startChar,
    endChar: match.endChar,
    color: currentHighlightColor,
  }));
  viewer.addHighlights(highlights);
}

function updatePageInfo() {
  if (!viewer) return;
  pageInfo.textContent = `Page ${viewer.getCurrentPage()} of ${viewer.getPageCount()}`;
}

// Start
init();

// Expose for debugging
(window as any).viewer = viewer;
console.log('[Demo App] Initialized. Viewer:', viewer);

// Listen for unhandled rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Demo App] Unhandled rejection:', event.reason);
});
