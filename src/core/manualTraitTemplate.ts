import { createDefaultSpec } from "../assets/humanV1";
import { AvatarSpec, PixelPatch, TraitKey, TraitMap } from "../types";

export const MANUAL_TRAIT_LAYER_DEFS = [
  { slot: "background.style", label: "Background", layer: "manual.00.background" },
  { slot: "clothing.top", label: "Clothing", layer: "manual.10.clothing" },
  { slot: "ears.shape", label: "Ears", layer: "manual.20.ears" },
  { slot: "face.shape", label: "Face", layer: "manual.30.face" },
  { slot: "hair.style", label: "Hair", layer: "manual.40.hair" },
  { slot: "headwear.type", label: "Headwear", layer: "manual.45.headwear" },
  { slot: "eyes.shape", label: "Eyes", layer: "manual.50.eyes" },
  { slot: "eyebrows.shape", label: "Eyebrows", layer: "manual.55.eyebrows" },
  { slot: "nose.shape", label: "Nose", layer: "manual.60.nose" },
  { slot: "mouth.shape", label: "Mouth", layer: "manual.65.mouth" },
  { slot: "facial_hair.style", label: "Facial hair", layer: "manual.70.facial_hair" },
  { slot: "glasses.shape", label: "Glasses", layer: "manual.80.glasses" }
] as const;

export type ManualTraitSlot = (typeof MANUAL_TRAIT_LAYER_DEFS)[number]["slot"];

export interface ManualTraitPixel {
  x: number;
  y: number;
  color: string;
}

export interface ManualTraitLayer {
  slot: ManualTraitSlot;
  label: string;
  visible: boolean;
  opacity: number;
  pixels: ManualTraitPixel[];
}

export interface ManualTraitTemplate {
  version: "pix-avatar/manual-trait-template/v1";
  name: string;
  canvas: { size: [32, 32] };
  layers: ManualTraitLayer[];
  traits?: TraitMap;
  reference?: {
    id?: string;
    opacity?: number;
  };
  createdAt?: string;
}

export function createEmptyManualTemplate(name = "manual-trait-template"): ManualTraitTemplate {
  return {
    version: "pix-avatar/manual-trait-template/v1",
    name,
    canvas: { size: [32, 32] },
    layers: MANUAL_TRAIT_LAYER_DEFS.map((layer) => ({
      slot: layer.slot,
      label: layer.label,
      visible: true,
      opacity: 1,
      pixels: []
    }))
  };
}

export function manualTemplateToSpec(template: ManualTraitTemplate, overrides: TraitMap = {}): AvatarSpec {
  validateManualTemplate(template);
  const traits: TraitMap = { ...(template.traits ?? {}), ...overrides };
  for (const layer of template.layers) {
    if (layer.pixels.length > 0) traits[layer.slot] = `${template.name}_${layer.slot.replace(/\W+/g, "_")}`;
  }
  const spec = createDefaultSpec(traits);
  spec.seed = `manual-template-${template.name}`;
  spec.patches = manualTemplateToPatches(template);
  return spec;
}

export function manualTemplateToPatches(template: ManualTraitTemplate): PixelPatch[] {
  validateManualTemplate(template);
  const patches: PixelPatch[] = [];
  for (const def of MANUAL_TRAIT_LAYER_DEFS) {
    const layer = template.layers.find((candidate) => candidate.slot === def.slot);
    if (!layer || !layer.visible || layer.opacity <= 0) continue;
    patches.push(...pixelsToPatches(def.layer, layer.pixels));
  }
  return patches;
}

export function validateManualTemplate(template: ManualTraitTemplate) {
  if (template.version !== "pix-avatar/manual-trait-template/v1") {
    throw new Error(`Unsupported manual trait template version: ${template.version}`);
  }
  if (template.canvas.size[0] !== 32 || template.canvas.size[1] !== 32) {
    throw new Error("Manual trait templates must use a 32x32 canvas.");
  }
  for (const layer of template.layers) {
    if (!MANUAL_TRAIT_LAYER_DEFS.some((def) => def.slot === layer.slot)) {
      throw new Error(`Unknown manual trait slot: ${layer.slot}`);
    }
    for (const pixel of layer.pixels) {
      if (!Number.isInteger(pixel.x) || !Number.isInteger(pixel.y) || pixel.x < 0 || pixel.x >= 32 || pixel.y < 0 || pixel.y >= 32) {
        throw new Error(`Pixel out of bounds in ${layer.slot}: ${pixel.x},${pixel.y}`);
      }
    }
  }
}

export function layerDefForSlot(slot: ManualTraitSlot) {
  const def = MANUAL_TRAIT_LAYER_DEFS.find((layer) => layer.slot === slot);
  if (!def) throw new Error(`Unknown manual trait slot: ${slot}`);
  return def;
}

function pixelsToPatches(layer: string, pixels: ManualTraitPixel[]): PixelPatch[] {
  const rows = new Map<number, ManualTraitPixel[]>();
  for (const pixel of pixels) {
    const row = rows.get(pixel.y) ?? [];
    row.push(pixel);
    rows.set(pixel.y, row);
  }
  const patches: PixelPatch[] = [];
  for (const [y, row] of rows) {
    row.sort((a, b) => a.x - b.x || a.color.localeCompare(b.color));
    let start: ManualTraitPixel | undefined;
    let previous: ManualTraitPixel | undefined;
    for (const pixel of row) {
      if (!start || !previous || pixel.x !== previous.x + 1 || pixel.color !== previous.color) {
        if (start && previous) patches.push({ op: "rect", layer, coordSpace: "output", x: start.x, y, w: previous.x - start.x + 1, h: 1, color: start.color });
        start = pixel;
      }
      previous = pixel;
    }
    if (start && previous) patches.push({ op: "rect", layer, coordSpace: "output", x: start.x, y, w: previous.x - start.x + 1, h: 1, color: start.color });
  }
  return patches;
}

export type ManualTraitExport = ManualTraitTemplate;
export type ManualTraitExportSlot = TraitKey;
