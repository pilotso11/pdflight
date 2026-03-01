import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { writeFileSync } from 'fs';

async function createMixedOrientationPdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  // Page 1: Portrait (595 x 842)
  const p1 = doc.addPage([595, 842]);
  p1.drawText('Portrait Page One', { x: 50, y: 780, size: 24, font, color: rgb(0, 0, 0) });
  p1.drawText('Lorem ipsum dolor sit amet, consectetur adipiscing elit.', { x: 50, y: 740, size: 12, font });
  p1.drawText('Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.', { x: 50, y: 720, size: 12, font });

  // Page 2: Landscape (842 x 595)
  const p2 = doc.addPage([842, 595]);
  p2.drawText('Landscape Page Two', { x: 50, y: 540, size: 24, font, color: rgb(0, 0, 0) });
  p2.drawText('This is a landscape page with ipsum text for search testing.', { x: 50, y: 500, size: 12, font });
  p2.drawText('Highlights should render horizontally on this wide page.', { x: 50, y: 480, size: 12, font });

  // Page 3: Portrait (595 x 842)
  const p3 = doc.addPage([595, 842]);
  p3.drawText('Portrait Page Three', { x: 50, y: 780, size: 24, font, color: rgb(0, 0, 0) });
  p3.drawText('Another portrait page with different ipsum content.', { x: 50, y: 740, size: 12, font });

  const bytes = await doc.save();
  writeFileSync('tests/fixtures/mixed-orientation.pdf', bytes);
  console.log('Created tests/fixtures/mixed-orientation.pdf');
}

createMixedOrientationPdf();
