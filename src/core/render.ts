import { AvatarSpec, InspectReport, PixelImage, Point, RenderLayer, RenderOptions, RenderResult } from "../types";
import { createFaceRig } from "./layout";
import { compositeLayers, drawLine, drawRect } from "./pixelLayer";
import { LayerStack } from "./pixelLayer";
import { drawAvatarTraits } from "./drawTraits";
import { normalizeSpec, validateSpecShape } from "./spec";
import { resolvePalette } from "./color";
import { bboxUnion, keyOf } from "./geometry";
import { applyPatches } from "./patch";
import { exportSvg } from "./svg";
import { zForLayer } from "./layers";
import { getAssetPack } from "../assets/registry";

export function renderAvatar(input: Partial<AvatarSpec>, options: RenderOptions = {}): RenderResult {
  const spec = normalizeSpec(input);
  const schema = validateSpecShape(spec);
  const warnings = [...schema.warnings];
  if (schema.errors.length) throw new Error(schema.errors.join("; "));

  const assetPack = getAssetPack(spec.asset_pack.id);
  const palette = resolvePalette(spec.traits, spec.palette, assetPack.palette);
  const rigTraits = { ...spec.traits, "__asset_pack": spec.asset_pack.id };
  const rig = createFaceRig(spec.traits["face.shape"], rigTraits);
  const layers = new LayerStack();
  const placements = {};

  drawAvatarTraits({
    layers,
    rig,
    traits: spec.traits,
    assetPackId: spec.asset_pack.id,
    palette,
    placements,
    warnings
  });

  if (spec.patches?.length) {
    applyPatches(layers, spec.patches, rig, palette, warnings);
  }

  if (options.debugGrid) drawDebugGrid(layers, palette);
  if (options.debugAnchors) drawDebugAnchors(layers, rig.anchors, palette);

  const renderLayers = layers.all();
  const image = compositeLayers(renderLayers, spec.canvas.size[0], spec.canvas.size[1]);
  const inspect = createInspectReport(spec, rig, renderLayers, image, palette, warnings, placements, options.pixel);

  return {
    spec,
    image,
    layers: renderLayers,
    inspect,
    svg: exportSvg(image, renderLayers, spec.canvas.scale)
  };
}

function drawDebugGrid(layers: LayerStack, palette: Record<string, string>) {
  const layer = layers.get("debug.grid", zForLayer("foreground.effects") + 10);
  const color = palette["debug.grid"] ?? "#8EA0B7";
  for (let i = 0; i <= 40; i += 5) {
    drawLine(layer, i, 0, i, 39, color, { trait: "debug.grid", colorToken: "debug.grid" });
    drawLine(layer, 0, i, 39, i, color, { trait: "debug.grid", colorToken: "debug.grid" });
  }
  for (let i = 0; i <= 40; i += 10) {
    drawLine(layer, i, 0, i, 39, color, { trait: "debug.grid.major", colorToken: "debug.grid" });
    drawLine(layer, 0, i, 39, i, color, { trait: "debug.grid.major", colorToken: "debug.grid" });
  }
}

function drawDebugAnchors(layers: LayerStack, anchors: Record<string, Point>, palette: Record<string, string>) {
  const layer = layers.get("debug.anchors", zForLayer("foreground.effects") + 20);
  const color = palette["debug.anchor"] ?? "#FF306E";
  for (const [name, [x, y]] of Object.entries(anchors)) {
    if (!criticalAnchor(name)) continue;
    drawLine(layer, x - 3, y, x + 3, y, color, { trait: `debug.anchor.${name}`, colorToken: "debug.anchor" });
    drawLine(layer, x, y - 3, x, y + 3, color, { trait: `debug.anchor.${name}`, colorToken: "debug.anchor" });
  }
}

function criticalAnchor(name: string) {
  return (
    name.endsWith("eye.center") ||
    name === "nose.tip" ||
    name === "mouth.center" ||
    name === "chin" ||
    name === "hair.crown" ||
    name.endsWith("ear.socket")
  );
}

function createInspectReport(
  spec: AvatarSpec,
  rig: ReturnType<typeof createFaceRig>,
  layers: RenderLayer[],
  image: PixelImage,
  palette: Record<string, string>,
  warnings: string[],
  placements: InspectReport["placements"],
  pixel?: Point
): InspectReport {
  const layerReports = layers.map((layer) => ({
    id: layer.id,
    z: layer.z,
    pixels: layer.pixels.size,
    bbox: layerBBox(layer)
  }));
  const bbox = bboxUnion(layerReports.map((layer) => layer.bbox));
  const report: InspectReport = {
    traits: spec.traits,
    anchors: rig.anchors,
    sockets: Object.fromEntries(Object.entries(rig.sockets).map(([key, value]) => [key, value.anchor])),
    zones: Object.fromEntries(Object.entries(rig.zones).map(([key, value]) => [key, { bbox: value.bbox }])),
    placements,
    warnings,
    layers: layerReports,
    bbox,
    visible_pixels: image.pixels.size,
    palette
  };

  if (pixel) {
    const key = keyOf(pixel[0], pixel[1]);
    const stack = image.stacks.get(key) ?? [];
    report.pixel = {
      xy: pixel,
      visible_color: stack.at(-1)?.color,
      stack
    };
  }

  return report;
}

function layerBBox(layer: RenderLayer) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const cell of layer.pixels.values()) {
    minX = Math.min(minX, cell.x);
    minY = Math.min(minY, cell.y);
    maxX = Math.max(maxX, cell.x);
    maxY = Math.max(maxY, cell.y);
  }
  if (!Number.isFinite(minX)) return undefined;
  return [minX, minY, maxX + 1, maxY + 1] as [number, number, number, number];
}
