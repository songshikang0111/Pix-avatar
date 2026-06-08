import { PixelImage } from "../types";
import { keyOf } from "./geometry";

export type PixelMatrixColor = string;
export type PixelMatrix = PixelMatrixColor[][];

export const TRANSPARENT_PIXEL = "transparent";

export function pixelImageToMatrix(image: PixelImage, fill = TRANSPARENT_PIXEL): PixelMatrix {
  return Array.from({ length: image.height }, (_, y) =>
    Array.from({ length: image.width }, (_, x) => image.pixels.get(keyOf(x, y))?.color ?? fill)
  );
}

export function countMatrixPixels(matrix: PixelMatrix, fill = TRANSPARENT_PIXEL) {
  let count = 0;
  for (const row of matrix) {
    for (const color of row) {
      if (color !== fill) count += 1;
    }
  }
  return count;
}

export function resizeMatrixDominant(matrix: PixelMatrix, width: number, height: number): PixelMatrix {
  assertRectangularMatrix(matrix);
  const sourceHeight = matrix.length;
  const sourceWidth = matrix[0]?.length ?? 0;
  if (sourceWidth === 0 || sourceHeight === 0) throw new Error("Cannot resize an empty matrix.");

  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      const x0 = Math.floor((x / width) * sourceWidth);
      const x1 = Math.max(x0 + 1, Math.ceil(((x + 1) / width) * sourceWidth));
      const y0 = Math.floor((y / height) * sourceHeight);
      const y1 = Math.max(y0 + 1, Math.ceil(((y + 1) / height) * sourceHeight));
      return dominantMatrixColor(matrix, x0, y0, Math.min(x1, sourceWidth), Math.min(y1, sourceHeight));
    })
  );
}

export function assertMatrixSize(matrix: PixelMatrix, width: number, height: number) {
  if (matrix.length !== height) throw new Error(`Expected ${height} rows, got ${matrix.length}.`);
  for (const [index, row] of matrix.entries()) {
    if (row.length !== width) throw new Error(`Expected row ${index} to have ${width} columns, got ${row.length}.`);
  }
}

function assertRectangularMatrix(matrix: PixelMatrix) {
  if (matrix.length === 0) return;
  const width = matrix[0].length;
  for (const [index, row] of matrix.entries()) {
    if (row.length !== width) throw new Error(`Expected row ${index} to have ${width} columns, got ${row.length}.`);
  }
}

function dominantMatrixColor(matrix: PixelMatrix, x0: number, y0: number, x1: number, y1: number) {
  const counts = new Map<PixelMatrixColor, number>();
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const color = matrix[y][x];
      counts.set(color, (counts.get(color) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? TRANSPARENT_PIXEL;
}
