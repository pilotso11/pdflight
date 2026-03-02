// Example React component for pdflight integration.
// Requires: npm install @pilotso11/pdflight react react-dom
import { useRef, useEffect, useState, useCallback } from 'react';
import { PdfViewer } from '@pilotso11/pdflight';

export default function PdfViewerApp({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<PdfViewer | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const viewer = new PdfViewer(containerRef.current!, {
      toolbar: true,
      sidebar: true,
    });
    viewerRef.current = viewer;
    viewer.load(url);

    return () => viewer.destroy();
  }, [url]);

  const handleSearch = useCallback(async () => {
    const viewer = viewerRef.current;
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
  }, [query]);

  const handleClear = useCallback(() => {
    viewerRef.current?.removeAllHighlights();
    setQuery('');
  }, []);

  return (
    <div>
      <div style={{ padding: 12, display: 'flex', gap: 8 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search..."
          style={{ flex: 1, padding: '6px 10px', fontSize: 14 }}
        />
        <button onClick={handleSearch}>Search</button>
        <button onClick={handleClear}>Clear</button>
      </div>
      <div ref={containerRef} style={{ width: '100%', height: 'calc(100vh - 48px)' }} />
    </div>
  );
}
