import { PdfViewer, type PdfViewerOptions, type SearchMatch, type Highlight } from '../src/index';
import Prism from 'prismjs';
import 'prismjs/components/prism-typescript';
import 'prismjs/themes/prism-tomorrow.min.css';

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
const applyConfigBtn = document.getElementById('apply-config') as HTMLButtonElement;
const codeSnippetEl = document.getElementById('code-snippet')!.querySelector('code')!;
const prevMatchBtn = document.getElementById('prev-match') as HTMLButtonElement;
const nextMatchBtn = document.getElementById('next-match') as HTMLButtonElement;
const matchCounter = document.getElementById('match-counter') as HTMLSpanElement;

// Row API DOM elements
const rowPage = document.getElementById('row-page') as HTMLInputElement;
const getRowsBtn = document.getElementById('get-rows') as HTMLButtonElement;
const rowCount = document.getElementById('row-count') as HTMLSpanElement;
const rowNum = document.getElementById('row-num') as HTMLInputElement;
const highlightRowBtn = document.getElementById('highlight-row') as HTMLButtonElement;
const findTextInput = document.getElementById('find-text-input') as HTMLInputElement;
const findNearRow = document.getElementById('find-near-row') as HTMLInputElement;
const findTextBtn = document.getElementById('find-text-btn') as HTMLButtonElement;
const rowOutput = document.getElementById('row-output') as HTMLDivElement;

// Config DOM elements
const cfgToolbar = document.getElementById('cfg-toolbar') as HTMLInputElement;
const cfgToolbarPos = document.getElementById('cfg-toolbar-pos') as HTMLSelectElement;
const cfgFitMode = document.getElementById('cfg-fit-mode') as HTMLSelectElement;
const cfgStepper = document.getElementById('cfg-stepper') as HTMLInputElement;
const cfgZoom = document.getElementById('cfg-zoom') as HTMLInputElement;
const cfgRotate = document.getElementById('cfg-rotate') as HTMLInputElement;
const cfgFit = document.getElementById('cfg-fit') as HTMLInputElement;
const cfgMatchCounts = document.getElementById('cfg-match-counts') as HTMLInputElement;
const cfgTooltips = document.getElementById('cfg-tooltips') as HTMLInputElement;
const cfgSearchNav = document.getElementById('cfg-search-nav') as HTMLInputElement;
const cfgThumbnailWidth = document.getElementById('cfg-thumbnail-width') as HTMLInputElement;
const cfgActiveMatchMode = document.getElementById('cfg-active-match-mode') as HTMLSelectElement;
const cfgActiveMatchColor = document.getElementById('cfg-active-match-color') as HTMLInputElement;

const pdfViewerContainer = document.getElementById('pdf-viewer')!;

// State
let viewer: PdfViewer | null = null;
let currentSearchResults: SearchMatch[] = [];
let currentHighlightColor = '#ffff0080'; // 50% opacity yellow
let lastLoadedSource: string | ArrayBuffer | null = null;

function readConfig() {
  return {
    toolbar: cfgToolbar.checked,
    toolbarPos: cfgToolbarPos.value as 'top' | 'bottom',
    fitMode: cfgFitMode.value as 'width' | 'page' | 'none',
    stepper: cfgStepper.checked,
    zoom: cfgZoom.checked,
    rotate: cfgRotate.checked,
    fit: cfgFit.checked,
    searchNav: cfgSearchNav.checked,
    matchCounts: cfgMatchCounts.checked,
    tooltips: cfgTooltips.checked,
    thumbnails: sidebarToggle.checked,
    thumbnailWidth: Number(cfgThumbnailWidth.value) || 150,
    activeMatchMode: cfgActiveMatchMode.value as 'highlight' | 'outline',
    activeMatchColor: cfgActiveMatchColor.value,
  };
}

function buildViewerOptions(): PdfViewerOptions {
  const cfg = readConfig();
  const options: PdfViewerOptions = {
    toolbar: cfg.toolbar
      ? {
          position: cfg.toolbarPos,
          stepper: cfg.stepper,
          zoom: cfg.zoom,
          rotate: cfg.rotate,
          fit: cfg.fit,
          searchNav: cfg.searchNav,
        }
      : false,
    sidebar: { thumbnailWidth: cfg.thumbnailWidth },
    fitMode: cfg.fitMode,
    showSearchMatchCounts: cfg.matchCounts,
    activeMatchStyle: {
      mode: cfg.activeMatchMode,
      color: cfg.activeMatchColor,
    },
    onMatchChange: (match, index, total) => {
      matchCounter.textContent = `${index + 1}/${total}`;
      console.log(`[Demo] Match ${index + 1}/${total}: "${match.text}" on page ${match.page}`);
    },
  };
  if (cfg.tooltips) {
    options.tooltipContent = (h: Highlight) => `Highlight: ${h.id}`;
  }
  return options;
}

function generateCodeSnippet(): string {
  const cfg = readConfig();
  const optionLines: string[] = [];

  if (cfg.toolbar) {
    optionLines.push(
      `  toolbar: {`,
      `    position: '${cfg.toolbarPos}',`,
      `    stepper: ${cfg.stepper},`,
      `    zoom: ${cfg.zoom},`,
      `    rotate: ${cfg.rotate},`,
      `    fit: ${cfg.fit},`,
      `    searchNav: ${cfg.searchNav},`,
      `  },`,
    );
  } else {
    optionLines.push(`  toolbar: false,`);
  }

  optionLines.push(
    `  fitMode: '${cfg.fitMode}',`,
    `  showSearchMatchCounts: ${cfg.matchCounts},`,
    `  activeMatchStyle: {`,
    `    mode: '${cfg.activeMatchMode}',`,
    `    color: '${cfg.activeMatchColor}',`,
    `  },`,
  );

  if (cfg.tooltips) {
    optionLines.push(`  tooltipContent: (h) => \`Highlight: \${h.id}\`,`);
  }

  optionLines.push(`  onMatchChange: (match, index, total) => {`);
  optionLines.push(`    console.log(\`Match \${index + 1}/\${total}: "\${match.text}"\`);`);
  optionLines.push(`  },`);

  const lines = [
    `const viewer = new PdfViewer(container, {`,
    ...optionLines,
    `});`,
  ];

  if (cfg.thumbnails) {
    if (cfg.thumbnailWidth !== 150) {
      lines.push(`// sidebar config: { thumbnailWidth: ${cfg.thumbnailWidth} } passed in options`);
    }
    lines.push(`viewer.setSidebarContainer(thumbnailsElement);`);
  }

  return lines.join('\n');
}

function updateCodeSnippet() {
  codeSnippetEl.textContent = generateCodeSnippet();
  Prism.highlightElement(codeSnippetEl);
}

function clearContainer(el: HTMLElement) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

function updateSidebarWidth() {
  const cfg = readConfig();
  // thumbnail width + container padding (8px * 2) + scrollbar
  sidebar.style.width = `${cfg.thumbnailWidth + 16 + 12}px`;
}

function createViewer() {
  viewer = new PdfViewer(pdfViewerContainer, buildViewerOptions());

  // Always connect sidebar so highlight indicators work;
  // visibility is controlled separately via the aside's hidden class
  viewer.setSidebarContainer(thumbnails);
  sidebar.classList.toggle('hidden', !sidebarToggle.checked);
  updateSidebarWidth();

  (window as any).viewer = viewer;
}

async function applyConfig() {
  // Save current state
  const savedHighlights = viewer?.serializeHighlights();

  // Destroy old viewer
  viewer?.destroy();
  clearContainer(pdfViewerContainer);

  // Create new viewer with updated config
  createViewer();

  // Reload the PDF if one was loaded
  if (lastLoadedSource && viewer) {
    await viewer.load(lastLoadedSource);

    // Restore highlights
    if (savedHighlights) {
      viewer.deserializeHighlights(savedHighlights);
    }
  }

  updateCodeSnippet();
}

// Mobile controls drawer toggle + mobile-friendly defaults
function initControlsDrawer() {
  const controlsPanel = document.getElementById('controls-panel')!;
  const toggleBtn = document.getElementById('controls-toggle')!;

  if (window.matchMedia('(max-width: 600px)').matches) {
    // Start with drawer collapsed
    controlsPanel.classList.add('collapsed');
    // Disable thumbnails on mobile — they obscure the PDF
    sidebarToggle.checked = false;
    sidebar.classList.add('hidden');
  }

  toggleBtn.addEventListener('click', () => {
    controlsPanel.classList.toggle('collapsed');
  });
}

// Initialize
function init() {
  createViewer();
  updateCodeSnippet();
  initControlsDrawer();

  // File input — label[for="file-input"] natively triggers the input
  fileInput.addEventListener('change', handleFileSelect);

  // Demo PDF dropdown
  demoPdfSelect.addEventListener('change', handleDemoPdfSelect);

  // Search
  searchBtn.addEventListener('click', handleSearch);
  searchInput.addEventListener('keydown', (e) => e.key === 'Enter' && handleSearch());

  // Sidebar toggle
  sidebarToggle.addEventListener('change', () => {
    sidebar.classList.toggle('hidden', !sidebarToggle.checked);
    if (sidebarToggle.checked && viewer) {
      viewer.setSidebarContainer(thumbnails);
    }
    updateCodeSnippet();
  });

  // Match navigation
  prevMatchBtn.addEventListener('click', () => viewer?.prevMatch());
  nextMatchBtn.addEventListener('click', () => viewer?.nextMatch());

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

  // Config controls — update code snippet on any change
  const configInputs = [cfgToolbar, cfgToolbarPos, cfgFitMode, cfgStepper, cfgZoom, cfgRotate, cfgFit, cfgSearchNav, cfgMatchCounts, cfgTooltips, cfgThumbnailWidth, cfgActiveMatchMode, cfgActiveMatchColor];
  for (const el of configInputs) {
    el.addEventListener('change', updateCodeSnippet);
  }

  // Apply config button
  applyConfigBtn.addEventListener('click', applyConfig);

  // Row API
  getRowsBtn.addEventListener('click', async () => {
    if (!viewer) return;
    const page = Number(rowPage.value) || 1;
    const rows = await viewer.getRows(page);
    rowCount.textContent = `${rows.length} rows`;
    rowOutput.textContent = rows.map(r => `Row ${r.row}: "${r.text}"`).join('\n');
  });

  highlightRowBtn.addEventListener('click', async () => {
    if (!viewer) return;
    const page = Number(rowPage.value) || 1;
    const row = Number(rowNum.value) || 1;
    const rowInfo = await viewer.getRow(page, row);
    if (!rowInfo) {
      rowOutput.textContent = `Row ${row} not found on page ${page}`;
      return;
    }
    viewer.addHighlight({
      id: `row-hl-${page}-${row}`,
      page: rowInfo.page,
      startChar: rowInfo.startChar,
      endChar: rowInfo.endChar,
      color: currentHighlightColor,
    });
    rowOutput.textContent = `Highlighted row ${row}: "${rowInfo.text}"`;
  });

  findTextBtn.addEventListener('click', async () => {
    if (!viewer) return;
    const text = findTextInput.value.trim();
    if (!text) return;
    const page = Number(rowPage.value) || undefined;
    const nearRow = Number(findNearRow.value) || undefined;
    const matches = await viewer.findText(text, { page, nearRow });
    rowOutput.textContent = `${matches.length} match${matches.length !== 1 ? 'es' : ''}`;
    if (matches.length > 0) {
      viewer.addHighlights(matches.map((m, i) => ({
        id: `find-${i}`,
        page: m.page,
        startChar: m.startChar,
        endChar: m.endChar,
        color: currentHighlightColor,
      })));
    }
  });
}

async function handleFileSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file && viewer) {
    const arrayBuffer = await file.arrayBuffer();
    lastLoadedSource = arrayBuffer;
    await viewer.load(arrayBuffer);
  }
}

async function handleDemoPdfSelect(e: Event) {
  const value = (e.target as HTMLSelectElement).value;
  if (value && viewer) {
    const url = `/tests/fixtures/${value}`;
    lastLoadedSource = url;
    await viewer.load(url);
  }
}

async function handleSearch() {
  if (!viewer) return;
  const query = searchInput.value.trim();
  if (!query) return;

  currentSearchResults = await viewer.search(query);
  searchResults.textContent = `${currentSearchResults.length} match${currentSearchResults.length !== 1 ? 'es' : ''}`;

  const hasResults = currentSearchResults.length > 0;
  prevMatchBtn.disabled = !hasResults;
  nextMatchBtn.disabled = !hasResults;
  matchCounter.textContent = hasResults ? `0/${currentSearchResults.length}` : '0/0';
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

// Listen for unhandled rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Demo App] Unhandled rejection:', event.reason);
});
