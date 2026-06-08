import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createDefaultSpec } from "../assets/humanV1";
import { keyOf } from "../core/geometry";
import { PixelMatrix, TRANSPARENT_PIXEL } from "../core/pixelMatrix";
import { renderAvatar } from "../core/render";
import { writePng } from "../node/png";
import { AvatarSpec, PixelCell, PixelImage, PixelPatch, TraitMap } from "../types";

type PartSlot =
  | "background.style"
  | "face.shape"
  | "ears.shape"
  | "hair.style"
  | "eyes.shape"
  | "eyebrows.shape"
  | "nose.shape"
  | "mouth.shape"
  | "glasses.shape"
  | "facial_hair.style"
  | "headwear.type"
  | "clothing.top";

interface PartJson {
  id: string;
  background: string;
  acceptedCounts: Record<string, number>;
  parts: Partial<Record<PartSlot, Array<{ x: number; y: number; color: string }>>>;
}

interface Recipe {
  id: string;
  background: string;
  face: string;
  hair: string;
  clothing: string;
  features: string;
  glasses?: string;
  headwear?: string;
}

const args = parseArgs(process.argv.slice(2));
const partDir = args.parts ?? "datasets/reference/istock-36/part-traits";
const outDir = args.out ?? "datasets/reference/istock-36/part-recombinations";
const scale = Number(args.scale ?? 6);

await recombineReferenceParts(partDir, outDir, scale);

async function recombineReferenceParts(partDir: string, outDir: string, scale: number) {
  const report = JSON.parse(await readFile(join(partDir, "report.json"), "utf8")) as { entries: Array<{ id: string }> };
  const sourceIds = report.entries.map((entry) => entry.id);
  const parts = new Map<string, PartJson>();
  for (const id of sourceIds) parts.set(id, JSON.parse(await readFile(join(partDir, "parts", `${id}.json`), "utf8")) as PartJson);
  const ignoredIds = await loadIgnoredIds(partDir);

  const recipes = Array.from({ length: 12 }, (_, index) => makeRecipe(index, sourceIds, parts, ignoredIds));
  const matrices: PixelMatrix[] = [];

  await mkdir(join(outDir, "specs"), { recursive: true });
  await mkdir(join(outDir, "generated"), { recursive: true });

  for (const recipe of recipes) {
    const spec = recombinedSpec(recipe, parts);
    const render = renderAvatar(spec);
    const background = get(parts, recipe.background).background;
    matrices.push(imageToMatrix(render.image, 32, 32, background));
    await writeJson(join(outDir, "specs", `${recipe.id}.json`), { recipe, spec, warnings: render.inspect.warnings });
    await writePng(join(outDir, "generated", `${recipe.id}.png`), render.image, scale);
  }

  await writePng(join(outDir, "contact-sheet.png"), matrixContactSheet(matrices, 6, 32, 32), scale);
  await writeJson(join(outDir, "report.json"), {
    version: "pix-avatar/reference-part-recombination/v1",
    source: partDir,
    note:
      "Visual QA for cross-generalization: mixes only accepted repo-native 32px part-slot assets. Face shape and facial feature slots stay together as a face kit because extracted features are absolute 32px assets.",
    ignoredSourcesExcluded: [...ignoredIds],
    recipes,
    artifacts: {
      contactSheet: "contact-sheet.png",
      generatedDir: "generated",
      specsDir: "specs"
    }
  });

  console.log(JSON.stringify({ entries: recipes.length, outDir, contactSheet: join(outDir, "contact-sheet.png") }, null, 2));
}

function makeRecipe(index: number, sourceIds: string[], parts: Map<string, PartJson>, ignoredIds: Set<string>): Recipe {
  const cleanIds = sourceIds.filter((id) => !ignoredIds.has(id));
  const faceIds = cleanIds.filter((id) => {
    const source = get(parts, id);
    const featurePixels = (source.parts["eyes.shape"]?.length ?? 0) + (source.parts["nose.shape"]?.length ?? 0) + (source.parts["mouth.shape"]?.length ?? 0);
    return (source.parts["face.shape"]?.length ?? 0) >= 120 && featurePixels >= 5;
  });
  const pick = (pool: string[], offset: number) => pool[offset % pool.length] ?? sourceIds[offset % sourceIds.length];
  const pickSlot = (slot: PartSlot, offset: number, minimumPixels = 1) => {
    const candidates = cleanIds.filter((id) => (get(parts, id).parts[slot]?.length ?? 0) >= minimumPixels);
    return candidates[offset % Math.max(1, candidates.length)];
  };
  const face = pick(faceIds, index * 3 + 1);
  return {
    id: `mix-${String(index + 1).padStart(2, "0")}`,
    background: pick(cleanIds, index * 2),
    face,
    hair: pickSlot("hair.style", index * 5 + 2, 40) ?? pick(cleanIds, index * 5 + 2),
    clothing: pickSlot("clothing.top", index * 7 + 4, 20) ?? pick(cleanIds, index * 7 + 4),
    features: face,
    glasses: index % 2 === 0 ? pickSlot("glasses.shape", index * 13 + 8) : undefined,
    headwear: index % 3 === 0 ? pickSlot("headwear.type", index * 17 + 10) : undefined
  };
}

function recombinedSpec(recipe: Recipe, parts: Map<string, PartJson>): AvatarSpec {
  const background = get(parts, recipe.background).background;
  const cells = [
    ...cellsFor(parts, recipe.clothing, "clothing.top"),
    ...cellsFor(parts, recipe.face, "ears.shape"),
    ...cellsFor(parts, recipe.face, "face.shape"),
    ...cellsFor(parts, recipe.hair, "hair.style"),
    ...(recipe.headwear ? cellsFor(parts, recipe.headwear, "headwear.type") : []),
    ...cellsFor(parts, recipe.features, "eyes.shape"),
    ...cellsFor(parts, recipe.features, "eyebrows.shape"),
    ...cellsFor(parts, recipe.features, "nose.shape"),
    ...cellsFor(parts, recipe.features, "mouth.shape"),
    ...cellsFor(parts, recipe.features, "facial_hair.style"),
    ...(recipe.glasses ? cellsFor(parts, recipe.glasses, "glasses.shape") : [])
  ];
  const traits: TraitMap = {
    "background.style": `reference_mix_${recipe.background}`,
    "face.shape": `reference_mix_${recipe.face}`,
    "ears.shape": `reference_mix_${recipe.face}`,
    "hair.style": `reference_mix_${recipe.hair}`,
    "eyes.shape": `reference_mix_${recipe.features}`,
    "eyebrows.shape": `reference_mix_${recipe.features}`,
    "nose.shape": `reference_mix_${recipe.features}`,
    "mouth.shape": `reference_mix_${recipe.features}`,
    "glasses.shape": recipe.glasses ? `reference_mix_${recipe.glasses}` : "none",
    "facial_hair.style": "none",
    "headwear.type": recipe.headwear ? `reference_mix_${recipe.headwear}` : "none",
    "clothing.top": `reference_mix_${recipe.clothing}`,
    "face.detail": "none"
  };
  const spec = createDefaultSpec(traits);
  spec.seed = `reference-part-recombine-${recipe.id}`;
  spec.patches = [
    { op: "rect", layer: layerForSlot("background.style"), coordSpace: "output", x: 0, y: 0, w: 32, h: 32, color: background },
    ...runsToPatches(cells)
  ];
  return spec;
}

function cellsFor(parts: Map<string, PartJson>, id: string, slot: PartSlot) {
  return (get(parts, id).parts[slot] ?? []).map((cell) => ({ ...cell, slot }));
}

function runsToPatches(cells: Array<{ x: number; y: number; color: string; slot: PartSlot }>): PixelPatch[] {
  const patches: PixelPatch[] = [];
  const byLayer = new Map<string, Array<{ x: number; y: number; color: string }>>();
  for (const cell of cells) {
    const layer = layerForSlot(cell.slot);
    const bucket = byLayer.get(layer) ?? [];
    bucket.push(cell);
    byLayer.set(layer, bucket);
  }
  for (const [layer, layerCells] of byLayer) {
    const rows = new Map<number, Array<{ x: number; y: number; color: string }>>();
    for (const cell of layerCells) {
      const row = rows.get(cell.y) ?? [];
      row.push(cell);
      rows.set(cell.y, row);
    }
    for (const [y, row] of rows) {
      row.sort((a, b) => a.x - b.x || a.color.localeCompare(b.color));
      let start: (typeof row)[number] | undefined;
      let previous: (typeof row)[number] | undefined;
      for (const cell of row) {
        if (!start || !previous || cell.x !== previous.x + 1 || cell.color !== previous.color) {
          if (start && previous) patches.push({ op: "rect", layer, coordSpace: "output", x: start.x, y, w: previous.x - start.x + 1, h: 1, color: start.color });
          start = cell;
        }
        previous = cell;
      }
      if (start && previous) patches.push({ op: "rect", layer, coordSpace: "output", x: start.x, y, w: previous.x - start.x + 1, h: 1, color: start.color });
    }
  }
  return patches;
}

function layerForSlot(slot: PartSlot) {
  const layers: Record<PartSlot, string> = {
    "background.style": "reference.00.background",
    "clothing.top": "reference.10.clothing",
    "ears.shape": "reference.20.ears",
    "face.shape": "reference.30.face",
    "hair.style": "reference.40.hair",
    "headwear.type": "reference.45.headwear",
    "eyes.shape": "reference.50.eyes",
    "eyebrows.shape": "reference.55.eyebrows",
    "nose.shape": "reference.60.nose",
    "mouth.shape": "reference.65.mouth",
    "facial_hair.style": "reference.70.facial_hair",
    "glasses.shape": "reference.75.glasses"
  };
  return layers[slot];
}

function get(parts: Map<string, PartJson>, id: string) {
  const value = parts.get(id);
  if (!value) throw new Error(`Missing part source: ${id}`);
  return value;
}

function imageToMatrix(image: PixelImage, width: number, height: number, fill: string): PixelMatrix {
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => image.pixels.get(keyOf(x, y))?.color ?? fill)
  );
}

function matrixContactSheet(matrices: PixelMatrix[], columns: number, tileWidth: number, tileHeight: number): PixelImage {
  const rows = Math.ceil(matrices.length / columns);
  const gutter = 1;
  const width = columns * tileWidth + (columns - 1) * gutter;
  const height = rows * tileHeight + (rows - 1) * gutter;
  const output = Array.from({ length: height }, () => Array.from({ length: width }, () => "#FFFFFF"));
  for (const [index, matrix] of matrices.entries()) {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const ox = col * (tileWidth + gutter);
    const oy = row * (tileHeight + gutter);
    for (let y = 0; y < tileHeight; y += 1) {
      for (let x = 0; x < tileWidth; x += 1) output[oy + y][ox + x] = matrix[y][x];
    }
  }
  return matrixToPixelImage(output);
}

function matrixToPixelImage(matrix: PixelMatrix): PixelImage {
  const pixels = new Map<string, PixelCell>();
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      const color = matrix[y][x];
      if (color === TRANSPARENT_PIXEL) continue;
      pixels.set(keyOf(x, y), { x, y, color, meta: { layer: "matrix" } });
    }
  }
  return { width: matrix[0]?.length ?? 0, height: matrix.length, pixels, stacks: new Map() };
}

async function writeJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function loadIgnoredIds(partDir: string) {
  try {
    const report = JSON.parse(await readFile(join(partDir, "..", "segments", "report.json"), "utf8")) as { entries: Array<{ id: string; ignoredPixels?: number }> };
    return new Set(report.entries.filter((entry) => (entry.ignoredPixels ?? 0) > 0).map((entry) => entry.id));
  } catch {
    return new Set<string>();
  }
}

function parseArgs(argv: string[]) {
  const parsed: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    parsed[arg.slice(2)] = argv[i + 1];
    i += 1;
  }
  return parsed;
}
