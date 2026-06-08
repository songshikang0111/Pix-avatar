import { Box, Mask, PixelCell, PixelImage, PixelMeta, PixelStackEntry, Point, RenderLayer } from "../types";
import { CANVAS_SIZE, bboxFromPoints, keyOf, pointFromKey, inBounds, maskHas } from "./geometry";
import { zForLayer } from "./layers";

export class MutableLayer implements RenderLayer {
  id: string;
  z: number;
  width: number;
  height: number;
  private designWidth: number;
  private designHeight: number;
  pixels = new Map<string, PixelCell>();

  constructor(id: string, z = zForLayer(id), width = CANVAS_SIZE, height = CANVAS_SIZE, designWidth = CANVAS_SIZE, designHeight = CANVAS_SIZE) {
    this.id = id;
    this.z = z;
    this.width = width;
    this.height = height;
    this.designWidth = designWidth;
    this.designHeight = designHeight;
  }

  set(x: number, y: number, color: string, meta: Partial<PixelMeta> = {}, clip?: Mask) {
    const px = Math.round(x);
    const py = Math.round(y);
    if (!inBounds(px, py, this.designWidth, this.designHeight) || !maskHas(clip, px, py) || color === "transparent") return;
    const [mappedX, mappedY] = this.mapPoint(px, py);
    if (!inBounds(mappedX, mappedY, this.width, this.height)) return;
    const key = keyOf(mappedX, mappedY);
    this.pixels.set(key, {
      x: mappedX,
      y: mappedY,
      color,
      meta: { layer: this.id, ...meta }
    });
  }

  setOutput(x: number, y: number, color: string, meta: Partial<PixelMeta> = {}) {
    const px = Math.round(x);
    const py = Math.round(y);
    if (!inBounds(px, py, this.width, this.height) || color === "transparent") return;
    const key = keyOf(px, py);
    this.pixels.set(key, {
      x: px,
      y: py,
      color,
      meta: { layer: this.id, ...meta }
    });
  }

  erase(x: number, y: number, w = 1, h = 1, clip?: Mask) {
    for (let yy = y; yy < y + h; yy += 1) {
      for (let xx = x; xx < x + w; xx += 1) {
        if (maskHas(clip, xx, yy)) {
          const [mappedX, mappedY] = this.mapPoint(xx, yy);
          this.pixels.delete(keyOf(mappedX, mappedY));
        }
      }
    }
  }

  replace(from: string, to: string, clip?: Mask) {
    for (const cell of this.pixels.values()) {
      if (cell.color === from && maskHas(clip, cell.x, cell.y)) {
        cell.color = to;
      }
    }
  }

  bbox(): Box | undefined {
    return bboxFromPoints([...this.pixels.values()].map((cell) => [cell.x, cell.y] as Point));
  }

  private mapPoint(x: number, y: number): Point {
    if (this.width === this.designWidth && this.height === this.designHeight) return [x, y];
    return [
      Math.min(this.width - 1, Math.max(0, Math.floor((x / this.designWidth) * this.width))),
      Math.min(this.height - 1, Math.max(0, Math.floor((y / this.designHeight) * this.height)))
    ];
  }
}

export class LayerStack {
  private layers = new Map<string, MutableLayer>();

  constructor(private width = CANVAS_SIZE, private height = CANVAS_SIZE, private designWidth = CANVAS_SIZE, private designHeight = CANVAS_SIZE) {}

  get(id: string, z = zForLayer(id)) {
    let layer = this.layers.get(id);
    if (!layer) {
      layer = new MutableLayer(id, z, this.width, this.height, this.designWidth, this.designHeight);
      this.layers.set(id, layer);
    }
    return layer;
  }

  all(): RenderLayer[] {
    return [...this.layers.values()].sort((a, b) => a.z - b.z || a.id.localeCompare(b.id));
  }
}

export function drawRect(layer: MutableLayer, x: number, y: number, w: number, h: number, color: string, meta?: Partial<PixelMeta>, clip?: Mask) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) {
      layer.set(xx, yy, color, meta, clip);
    }
  }
}

export function drawMask(layer: MutableLayer, mask: Mask, color: string, meta?: Partial<PixelMeta>) {
  for (const key of mask.points) {
    const [x, y] = pointFromKey(key);
    layer.set(x, y, color, meta);
  }
}

export function drawLine(layer: MutableLayer, x1: number, y1: number, x2: number, y2: number, color: string, meta?: Partial<PixelMeta>, clip?: Mask) {
  let x = Math.round(x1);
  let y = Math.round(y1);
  const tx = Math.round(x2);
  const ty = Math.round(y2);
  const dx = Math.abs(tx - x);
  const sx = x < tx ? 1 : -1;
  const dy = -Math.abs(ty - y);
  const sy = y < ty ? 1 : -1;
  let err = dx + dy;
  while (true) {
    layer.set(x, y, color, meta, clip);
    if (x === tx && y === ty) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

export function drawEllipse(layer: MutableLayer, cx: number, cy: number, rx: number, ry: number, color: string, meta?: Partial<PixelMeta>, clip?: Mask) {
  const minX = Math.floor(cx - rx);
  const maxX = Math.ceil(cx + rx);
  const minY = Math.floor(cy - ry);
  const maxY = Math.ceil(cy + ry);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) layer.set(x, y, color, meta, clip);
    }
  }
}

export function drawTriangle(layer: MutableLayer, points: [Point, Point, Point], color: string, meta?: Partial<PixelMeta>, clip?: Mask) {
  const [a, b, c] = points;
  const minX = Math.floor(Math.min(a[0], b[0], c[0]));
  const maxX = Math.ceil(Math.max(a[0], b[0], c[0]));
  const minY = Math.floor(Math.min(a[1], b[1], c[1]));
  const maxY = Math.ceil(Math.max(a[1], b[1], c[1]));
  const area = edge(a, b, c);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const p: Point = [x + 0.5, y + 0.5];
      const w0 = edge(b, c, p);
      const w1 = edge(c, a, p);
      const w2 = edge(a, b, p);
      if ((area >= 0 && w0 >= 0 && w1 >= 0 && w2 >= 0) || (area < 0 && w0 <= 0 && w1 <= 0 && w2 <= 0)) {
        layer.set(x, y, color, meta, clip);
      }
    }
  }
}

function edge(a: Point, b: Point, c: Point) {
  return (c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0]);
}

export function compositeLayers(layers: RenderLayer[], width = CANVAS_SIZE, height = CANVAS_SIZE): PixelImage {
  const sorted = [...layers].sort((a, b) => a.z - b.z || a.id.localeCompare(b.id));
  const stacks = new Map<string, PixelStackEntry[]>();
  const visible = new Map<string, PixelCell>();

  for (const layer of sorted) {
    for (const [key, cell] of layer.pixels) {
      const stack = stacks.get(key) ?? [];
      stack.push({
        layer: layer.id,
        trait: cell.meta.trait,
        color: cell.color,
        colorToken: cell.meta.colorToken,
        z: layer.z
      });
      stacks.set(key, stack);
      visible.set(key, cell);
    }
  }

  return { width, height, pixels: visible, stacks };
}
