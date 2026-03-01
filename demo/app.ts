import { PdfViewer, type SearchMatch, type Highlight } from '../src/index';

// DOM elements
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const demoPdfSelect = document.getElementById('demo-pdf') as HTMLSelectElement;
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const searchBtn = document.getElementById('search-btn') as HTMLButtonElement;
const searchResults = document.getElementById('search-results') as HTMLSpanElement;
const sidebarToggle = document.getElementById('sidebar-toggle') as HTMLInputElement;
const sidebar = document.getElementById('sidebar') as HTMLElement;
const thumbnails = document.getElementById('thumbnails') as HTMLElement;
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
    toolbar: true,
    tooltipContent: (h: Highlight) => `Highlight: ${h.id}`,
    showSearchMatchCounts: true,
  });
  console.log('[Demo App] PdfViewer created:', viewer);

  // Connect sidebar thumbnails container
  viewer.setSidebarContainer(thumbnails);

  // File input
  const openBtn = document.querySelector('.btn');
  openBtn?.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileSelect);

  // Demo PDF dropdown
  demoPdfSelect.addEventListener('change', handleDemoPdfSelect);

  // Search
  searchBtn.addEventListener('click', handleSearch);
  searchInput.addEventListener('keydown', (e) => e.key === 'Enter' && handleSearch());

  // Sidebar
  sidebarToggle.addEventListener('change', () => {
    sidebar.classList.toggle('hidden', !sidebarToggle.checked);
  });

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
    }
  });
}

async function handleFileSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file && viewer) {
    const arrayBuffer = await file.arrayBuffer();
    await viewer.load(arrayBuffer);
  }
}

async function handleDemoPdfSelect(e: Event) {
  const value = (e.target as HTMLSelectElement).value;
  console.log('[Demo App] handleDemoPdfSelect called with value:', value);
  if (value && viewer) {
    console.log('[Demo App] Loading PDF...');
    await viewer.load(`/tests/fixtures/${value}`);
    console.log('[Demo App] PDF loaded');
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

// Start
init();

// Expose for debugging
(window as any).viewer = viewer;
console.log('[Demo App] Initialized. Viewer:', viewer);

// Listen for unhandled rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Demo App] Unhandled rejection:', event.reason);
});
