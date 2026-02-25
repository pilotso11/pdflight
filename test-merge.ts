import { mergeAdjacentRects, type Rect } from './src/utils/geometry.ts';

const rects: Rect[] = [
  { x: 100, y: 280, width: 35, height: 12 },
  { x: 135, y: 280, width: 42, height: 12 },
];

console.log('Input rects:', JSON.stringify(rects, null, 2));
const merged = mergeAdjacentRects(rects, 2);
console.log('Merged rects:', JSON.stringify(merged, null, 2));
console.log('Expected 1, got:', merged.length);
