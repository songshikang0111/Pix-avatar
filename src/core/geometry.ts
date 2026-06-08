import { Box, Mask, Point } from "../types";

export const CANVAS_SIZE = 40;
export const DEFAULT_OUTPUT_SIZE = 32;

export function keyOf(x: number, y: number) {
  return `${x},${y}`;
}

export function pointFromKey(key: string): Point {
  const [x, y] = key.split(",").map(Number);
  return [x, y];
}

export function inBounds(x: number, y: number, width = CANVAS_SIZE, height = CANVAS_SIZE) {
  return x >= 0 && x < width && y >= 0 && y < height;
}

export function createMask(width = CANVAS_SIZE, height = CANVAS_SIZE): Mask {
  return { width, height, points: new Set<string>() };
}

export function addMaskPoint(mask: Mask, x: number, y: number) {
  if (inBounds(x, y, mask.width, mask.height)) {
    mask.points.add(keyOf(x, y));
  }
}

export function maskHas(mask: Mask | undefined, x: number, y: number) {
  if (!mask) return true;
  return mask.points.has(keyOf(x, y));
}

export function maskUnion(...masks: Mask[]): Mask {
  const mask = createMask(masks[0]?.width ?? CANVAS_SIZE, masks[0]?.height ?? CANVAS_SIZE);
  for (const source of masks) {
    for (const point of source.points) mask.points.add(point);
  }
  return mask;
}

export function maskIntersect(a: Mask, b: Mask): Mask {
  const mask = createMask(a.width, a.height);
  for (const point of a.points) {
    if (b.points.has(point)) mask.points.add(point);
  }
  return mask;
}

export function maskFromEllipse(cx: number, cy: number, rx: number, ry: number, width = CANVAS_SIZE, height = CANVAS_SIZE): Mask {
  const mask = createMask(width, height);
  const minX = Math.floor(cx - rx);
  const maxX = Math.ceil(cx + rx);
  const minY = Math.floor(cy - ry);
  const maxY = Math.ceil(cy + ry);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) addMaskPoint(mask, x, y);
    }
  }
  return mask;
}

export function maskFromRoundedRect(x: number, y: number, w: number, h: number, r: number): Mask {
  const mask = createMask();
  const x2 = x + w - 1;
  const y2 = y + h - 1;
  for (let yy = y; yy <= y2; yy += 1) {
    for (let xx = x; xx <= x2; xx += 1) {
      const cx = xx < x + r ? x + r : xx > x2 - r ? x2 - r : xx;
      const cy = yy < y + r ? y + r : yy > y2 - r ? y2 - r : yy;
      if ((xx - cx) ** 2 + (yy - cy) ** 2 <= r ** 2) addMaskPoint(mask, xx, yy);
    }
  }
  return mask;
}

export function maskFromRowProfile(top: number, bottom: number, centerX: number, halfWidthAt: (t: number) => number): Mask {
  const mask = createMask();
  for (let y = top; y <= bottom; y += 1) {
    const t = (y - top) / Math.max(1, bottom - top);
    const half = Math.max(0, halfWidthAt(t));
    const minX = Math.floor(centerX - half);
    const maxX = Math.ceil(centerX + half);
    for (let x = minX; x <= maxX; x += 1) addMaskPoint(mask, x, y);
  }
  return mask;
}

export function maskErode(source: Mask, amount: number): Mask {
  let current = source;
  for (let i = 0; i < amount; i += 1) {
    const next = createMask(source.width, source.height);
    for (const point of current.points) {
      const [x, y] = pointFromKey(point);
      if (
        current.points.has(keyOf(x + 1, y)) &&
        current.points.has(keyOf(x - 1, y)) &&
        current.points.has(keyOf(x, y + 1)) &&
        current.points.has(keyOf(x, y - 1))
      ) {
        next.points.add(point);
      }
    }
    current = next;
  }
  return current;
}

export function maskDilate(source: Mask, amount: number): Mask {
  let current = source;
  for (let i = 0; i < amount; i += 1) {
    const next = createMask(source.width, source.height);
    for (const point of current.points) {
      const [x, y] = pointFromKey(point);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) addMaskPoint(next, x + dx, y + dy);
      }
    }
    current = next;
  }
  return current;
}

export function maskEdge(source: Mask): Mask {
  const edge = createMask(source.width, source.height);
  for (const point of source.points) {
    const [x, y] = pointFromKey(point);
    if (
      !source.points.has(keyOf(x + 1, y)) ||
      !source.points.has(keyOf(x - 1, y)) ||
      !source.points.has(keyOf(x, y + 1)) ||
      !source.points.has(keyOf(x, y - 1))
    ) {
      edge.points.add(point);
    }
  }
  return edge;
}

export function maskBBox(mask: Mask): Box | undefined {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of mask.points) {
    const [x, y] = pointFromKey(point);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (!Number.isFinite(minX)) return undefined;
  return [minX, minY, maxX + 1, maxY + 1];
}

export function bboxFromPoints(points: Point[]): Box | undefined {
  if (points.length === 0) return undefined;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return [minX, minY, maxX + 1, maxY + 1];
}

export function bboxUnion(boxes: Array<Box | undefined>): Box | undefined {
  const present = boxes.filter(Boolean) as Box[];
  if (present.length === 0) return undefined;
  return [
    Math.min(...present.map((b) => b[0])),
    Math.min(...present.map((b) => b[1])),
    Math.max(...present.map((b) => b[2])),
    Math.max(...present.map((b) => b[3]))
  ];
}

export function countOverlap(mask: Mask, pixels: Iterable<string>) {
  let count = 0;
  for (const key of pixels) {
    if (mask.points.has(key)) count += 1;
  }
  return count;
}
