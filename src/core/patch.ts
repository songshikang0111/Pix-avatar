import { FaceRig, Mask, PatchClip, PixelPatch, Point } from "../types";
import { colorToken } from "./color";
import { maskHas } from "./geometry";
import { LayerStack, drawLine, drawRect } from "./pixelLayer";

export function parseCompactPatch(input: string): PixelPatch {
  const parts = input.trim().split(/\s+/);
  const op = parts[0];
  const kv = Object.fromEntries(
    parts
      .slice(1)
      .filter((part) => part.includes("="))
      .map((part) => {
        const [key, ...rest] = part.split("=");
        return [key, rest.join("=")];
      })
  );
  const args = parts.slice(1).filter((part) => !part.includes("="));

  if (op === "px") {
    return {
      op,
      layer: args[0],
      x: Number(args[1]),
      y: Number(args[2]),
      color: args[3],
      clip: parseClip(kv.clip)
    };
  }
  if (op === "rect") {
    return {
      op,
      layer: args[0],
      x: Number(args[1]),
      y: Number(args[2]),
      w: Number(args[3]),
      h: Number(args[4]),
      color: args[5],
      clip: parseClip(kv.clip)
    };
  }
  if (op === "line") {
    return {
      op,
      layer: args[0],
      x1: Number(args[1]),
      y1: Number(args[2]),
      x2: Number(args[3]),
      y2: Number(args[4]),
      color: args[5],
      clip: parseClip(kv.clip)
    };
  }
  if (op === "erase") {
    return {
      op,
      layer: args[0],
      x: Number(args[1]),
      y: Number(args[2]),
      w: Number(args[3] ?? 1),
      h: Number(args[4] ?? 1),
      clip: parseClip(kv.clip)
    };
  }
  if (op === "replace") {
    return {
      op,
      layer: args[0],
      from: args[1],
      to: args[2],
      clip: parseClip(kv.clip)
    };
  }
  throw new Error(`Unsupported compact patch op: ${op}`);
}

function parseClip(value: string | undefined) {
  if (!value) return undefined;
  if (value === "face" || value === "head" || value === "hair" || value === "body" || value === "none") return value;
  throw new Error(`Unknown clip mask: ${value}`);
}

export function applyPatches(layers: LayerStack, patches: PixelPatch[], rig: FaceRig, palette: Record<string, string>, warnings: string[]) {
  for (const patch of patches) {
    applyPatch(layers, patch, rig, palette, warnings);
  }
}

function applyPatch(layers: LayerStack, patch: PixelPatch, rig: FaceRig, palette: Record<string, string>, warnings: string[]) {
  if (patch.op === "mirror") {
    const axisValue = patch.axis === "vertical" ? patch.x ?? 63.5 : patch.y ?? 63.5;
    for (const child of patch.ops) {
      applyPatch(layers, child, rig, palette, warnings);
      applyPatch(layers, mirrorPatch(child, patch.axis, axisValue), rig, palette, warnings);
    }
    return;
  }

  const clip = clipMask(patch.clip, rig);
  const layer = layers.get(patch.layer);
  if (patch.op === "replace") {
    layer.replace(colorToken(patch.from, palette), colorToken(patch.to, palette), clip);
    return;
  }
  if (patch.op === "erase") {
    if (patch.coordSpace === "output") eraseOutput(layer, patch.x, patch.y, patch.w ?? 1, patch.h ?? 1);
    else layer.erase(patch.x, patch.y, patch.w ?? 1, patch.h ?? 1, clip);
    return;
  }

  if (patch.op === "px") {
    const [x, y] = resolvePatchPoint(patch, rig, warnings);
    const color = colorToken(patch.color, palette);
    if (patch.coordSpace === "output") layer.setOutput(x, y, color, { trait: "patch.px", colorToken: patch.color });
    else layer.set(x, y, color, { trait: "patch.px", colorToken: patch.color }, clip);
    return;
  }

  if (patch.op === "rect") {
    const [x, y] = resolvePatchPoint(patch, rig, warnings);
    const color = colorToken(patch.color, palette);
    if (patch.coordSpace === "output") drawRectOutput(layer, x, y, patch.w, patch.h, color, { trait: "patch.rect", colorToken: patch.color });
    else drawRect(layer, x, y, patch.w, patch.h, color, { trait: "patch.rect", colorToken: patch.color }, clip);
    return;
  }

  if (patch.op === "line") {
    const from = patch.from ? resolveAnchorRef(patch.from, rig) : [patch.x1 ?? 0, patch.y1 ?? 0];
    const to = patch.to ? resolveAnchorRef(patch.to, rig) : [patch.x2 ?? 0, patch.y2 ?? 0];
    const color = colorToken(patch.color, palette);
    if (patch.coordSpace === "output") drawLineOutput(layer, from[0], from[1], to[0], to[1], color, { trait: "patch.line", colorToken: patch.color });
    else drawLine(layer, from[0], from[1], to[0], to[1], color, { trait: "patch.line", colorToken: patch.color }, clip);
  }
}

function drawRectOutput(layer: ReturnType<LayerStack["get"]>, x: number, y: number, w: number, h: number, color: string, meta: { trait: string; colorToken: string }) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) layer.setOutput(xx, yy, color, meta);
  }
}

function drawLineOutput(layer: ReturnType<LayerStack["get"]>, x1: number, y1: number, x2: number, y2: number, color: string, meta: { trait: string; colorToken: string }) {
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
    layer.setOutput(x, y, color, meta);
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

function eraseOutput(layer: ReturnType<LayerStack["get"]>, x: number, y: number, w: number, h: number) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) layer.pixels.delete(`${xx},${yy}`);
  }
}

function resolvePatchPoint(patch: Extract<PixelPatch, { op: "px" | "rect" }>, rig: FaceRig, warnings: string[]): Point {
  if (patch.at) return resolveAnchorRef(patch.at, rig);
  if (patch.region) {
    const zone = rig.zones[patch.region];
    if (!zone) {
      warnings.push(`Unknown patch region: ${patch.region}`);
      return [patch.dx ?? 0, patch.dy ?? 0];
    }
    const [x1, y1, x2, y2] = zone.bbox;
    return [Math.floor((x1 + x2) / 2) + (patch.dx ?? 0), Math.floor((y1 + y2) / 2) + (patch.dy ?? 0)];
  }
  return [patch.x ?? 0, patch.y ?? 0];
}

function resolveAnchorRef(ref: { anchor: string; dx?: number; dy?: number }, rig: FaceRig): Point {
  const anchor = rig.anchors[ref.anchor] ?? [0, 0];
  return [anchor[0] + (ref.dx ?? 0), anchor[1] + (ref.dy ?? 0)];
}

function clipMask(clip: PatchClip | undefined, rig: FaceRig): Mask | undefined {
  if (!clip || clip === "none") return undefined;
  if (clip === "face") return rig.masks.face_core;
  if (clip === "head") return rig.masks.head;
  if (clip === "hair") return rig.masks.hair_allowed;
  if (clip === "body") return rig.masks.body;
  return undefined;
}

function mirrorPatch(patch: PixelPatch, axis: "vertical" | "horizontal", pivot: number): PixelPatch {
  if (patch.op === "mirror") return patch;
  if (patch.op === "px" || patch.op === "rect") {
    const mirrored = { ...patch };
    if (typeof mirrored.x === "number" && axis === "vertical") mirrored.x = Math.round(pivot * 2 - mirrored.x - (patch.op === "rect" ? patch.w - 1 : 0));
    if (typeof mirrored.y === "number" && axis === "horizontal") mirrored.y = Math.round(pivot * 2 - mirrored.y - (patch.op === "rect" ? patch.h - 1 : 0));
    if (mirrored.at) {
      mirrored.at = { ...mirrored.at };
      if (axis === "vertical") mirrored.at.dx = -(mirrored.at.dx ?? 0);
      if (axis === "horizontal") mirrored.at.dy = -(mirrored.at.dy ?? 0);
    }
    return mirrored;
  }
  if (patch.op === "line") {
    const mirrored = { ...patch };
    if (axis === "vertical") {
      if (typeof mirrored.x1 === "number") mirrored.x1 = Math.round(pivot * 2 - mirrored.x1);
      if (typeof mirrored.x2 === "number") mirrored.x2 = Math.round(pivot * 2 - mirrored.x2);
    } else {
      if (typeof mirrored.y1 === "number") mirrored.y1 = Math.round(pivot * 2 - mirrored.y1);
      if (typeof mirrored.y2 === "number") mirrored.y2 = Math.round(pivot * 2 - mirrored.y2);
    }
    return mirrored;
  }
  return patch;
}
