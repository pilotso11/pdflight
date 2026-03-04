// Copyright (c) 2026 Seth Osher. MIT License.
import type { PageTextIndex } from '../types';
import type { RowInfo } from './types';

/**
 * Build a row index from a page text index.
 *
 * Clusters text items into visual rows by y-proximity:
 * 1. Extract each item's effective y-coordinate (topmost point for rotated items)
 * 2. Sort items by y descending (top of page first)
 * 3. Cluster items within 0.5 × avgFontHeight of each other
 * 4. Map each cluster to its character range in the normalized text
 * 5. Number rows 1-based from the top
 */
export function buildRowIndex(pageTextIndex: PageTextIndex): RowInfo[] {
  const { items, charMap, normalizedText, pageNumber } = pageTextIndex;
  if (items.length === 0 || normalizedText.length === 0) return [];

  // Step 1: Compute effective y and font height for each item.
  const itemInfo: Array<{ itemIndex: number; y: number; fontSize: number }> = [];
  for (let i = 0; i < items.length; i++) {
    if (items[i].str.length === 0) continue;
    const item = items[i];
    const [a, b, , d, , ty] = item.transform;
    const rotation = Math.atan2(b, a);

    let effectiveY: number;
    if (Math.abs(rotation) < 1e-6) {
      // Non-rotated: y = ty (baseline)
      effectiveY = ty;
    } else {
      // Rotated: use topmost point of the bounding box.
      const fontSize = Math.sqrt(item.transform[2] ** 2 + d ** 2);
      const sinR = Math.sin(rotation);
      const cosR = Math.cos(rotation);
      const yFromWidth = item.width * sinR;
      const yFromHeight = fontSize * cosR;
      effectiveY = ty + Math.max(0, yFromWidth) + Math.max(0, yFromHeight);
    }

    const fontSize = Math.abs(d) || Math.sqrt(a * a + b * b) || 12;
    itemInfo.push({ itemIndex: i, y: effectiveY, fontSize });
  }

  if (itemInfo.length === 0) return [];

  // Step 2: Compute clustering tolerance = 0.5 × average font height.
  const avgFontSize = itemInfo.reduce((s, info) => s + info.fontSize, 0) / itemInfo.length;
  const tolerance = avgFontSize * 0.5;

  // Step 3: Sort by y descending (highest y = top of page in PDF coords).
  itemInfo.sort((a, b) => b.y - a.y);

  // Step 4: Cluster items into rows by y-proximity.
  const clusters: Array<{ itemIndices: number[]; y: number }> = [];
  for (const info of itemInfo) {
    const lastCluster = clusters[clusters.length - 1];
    if (lastCluster && Math.abs(info.y - lastCluster.y) < tolerance) {
      lastCluster.itemIndices.push(info.itemIndex);
    } else {
      clusters.push({ itemIndices: [info.itemIndex], y: info.y });
    }
  }

  // Step 5: For each cluster, sort items by x (left-to-right) and find char range.
  const rows: RowInfo[] = [];
  for (let clusterIdx = 0; clusterIdx < clusters.length; clusterIdx++) {
    const cluster = clusters[clusterIdx];

    // Sort items within cluster by x-coordinate.
    cluster.itemIndices.sort((a, b) => items[a].transform[4] - items[b].transform[4]);

    // Find the character range in normalizedText that belongs to this cluster's items.
    const itemSet = new Set(cluster.itemIndices);
    let startChar = -1;
    let endChar = -1;

    for (let ci = 0; ci < charMap.length; ci++) {
      if (itemSet.has(charMap[ci].itemIndex)) {
        if (startChar === -1) startChar = ci;
        endChar = ci + 1;
      }
    }

    if (startChar === -1) continue;

    // Trim leading/trailing whitespace from the row's text range.
    while (startChar < endChar && normalizedText[startChar] === ' ') startChar++;
    while (endChar > startChar && normalizedText[endChar - 1] === ' ') endChar--;

    if (startChar >= endChar) continue;

    rows.push({
      page: pageNumber,
      row: clusterIdx + 1,
      startChar,
      endChar,
      text: normalizedText.slice(startChar, endChar),
      y: cluster.y,
    });
  }

  return rows;
}

/**
 * Compute the average vertical spacing between adjacent rows.
 * Returns the mean y-distance between consecutive rows, or the
 * first row's font-size estimate if there's only one row.
 */
export function avgLineSpacing(rows: RowInfo[]): number {
  if (rows.length <= 1) return rows.length === 1 ? Math.abs(rows[0].y) * 0.02 || 12 : 12;
  let totalDist = 0;
  let count = 0;
  for (let i = 1; i < rows.length; i++) {
    const gap = Math.abs(rows[i - 1].y - rows[i].y);
    // Skip abnormally large gaps (images, page breaks) — more than 4× the
    // running average so far — so they don't inflate the spacing estimate.
    if (count > 0 && gap > 4 * (totalDist / count)) continue;
    totalDist += gap;
    count++;
  }
  return count > 0 ? totalDist / count : 12;
}

/**
 * Find which row a character index falls in.
 * Returns the 1-based row number, or 0 if not found.
 */
export function charToRow(rows: RowInfo[], charIndex: number): number {
  for (const row of rows) {
    if (charIndex >= row.startChar && charIndex < row.endChar) {
      return row.row;
    }
  }
  return 0;
}
