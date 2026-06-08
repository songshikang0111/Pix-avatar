import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createDefaultSpec } from "../assets/humanV1";
import { keyOf } from "../core/geometry";
import { PixelMatrix, TRANSPARENT_PIXEL } from "../core/pixelMatrix";
import { renderAvatar } from "../core/render";
import { writePng } from "../node/png";
import { AvatarSpec, PixelCell, PixelImage, PixelPatch } from "../types";

interface SegmentReport {
  entries: Array<{ id: string; background: string }>;
}

type SegmentName = "skin" | "hair" | "clothing" | "accessory" | "face_feature" | "ink";
type SegmentJson = {
  id: string;
  background: string;
  segments: Partial<Record<SegmentName, Array<{ x: number; y: number; color: string }>>>;
};

const args = parseArgs(process.argv.slice(2));
const segmentDir = args.segments ?? "datasets/reference/istock-36/segments";
const outDir = args.out ?? "datasets/reference/istock-36/segment-recombinations";
const scale = Number(args.scale ?? 6);

await recombineReferenceSegments(segmentDir, outDir, scale);

async function recombineReferenceSegments(segmentDir: string, outDir: string, scale: number) {
  const report = JSON.parse(await readFile(join(segmentDir, "report.json"), "utf8")) as SegmentReport;
  const sourceIds = report.entries.map((entry) => entry.id);
  const segments = new Map<string, SegmentJson>();
  for (const id of sourceIds) {
    segments.set(id, JSON.parse(await readFile(join(segmentDir, `${id}.json`), "utf8")) as SegmentJson);
  }

  const recipes = Array.from({ length: 12 }, (_, index) => {
    const face = sourceIds[(index * 3) % sourceIds.length];
    const hair = sourceIds[(index * 5 + 2) % sourceIds.length];
    const clothing = sourceIds[(index * 7 + 6) % sourceIds.length];
    const accessory = sourceIds[(index * 11 + 10) % sourceIds.length];
    return { id: `mix-${String(index + 1).padStart(2, "0")}`, face, hair, clothing, accessory };
  });

  const matrices: PixelMatrix[] = [];
  await mkdir(join(outDir, "specs"), { recursive: true });
  await mkdir(join(outDir, "generated"), { recursive: true });

  for (const recipe of recipes) {
    const face = get(segments, recipe.face);
    const hair = get(segments, recipe.hair);
    const clothing = get(segments, recipe.clothing);
    const accessory = get(segments, recipe.accessory);
    const spec = recombinedSpec(recipe.id, face, hair, clothing, accessory);
    const render = renderAvatar(spec);
    matrices.push(imageToMatrix(render.image, 32, 32, face.background));
    await writeJson(join(outDir, "specs", `${recipe.id}.json`), { recipe, spec });
    await writePng(join(outDir, "generated", `${recipe.id}.png`), render.image, scale);
  }

  await writePng(join(outDir, "contact-sheet.png"), matrixContactSheet(matrices, 6, 32, 32), scale);
  await writeJson(join(outDir, "report.json"), {
    version: "pix-avatar/reference-segment-recombination/v1",
    source: segmentDir,
    note: "Sanity-check recombinations of independently extracted reference segment layers. This is visual QA, not the 15% reference-fit metric.",
    recipes
  });

  console.log(JSON.stringify({ entries: recipes.length, outDir, contactSheet: join(outDir, "contact-sheet.png") }, null, 2));
}

function recombinedSpec(id: string, face: SegmentJson, hair: SegmentJson, clothing: SegmentJson, accessory: SegmentJson): AvatarSpec {
  const spec = createDefaultSpec({
    "background.style": "transparent",
    "hair.style": "bald_clean",
    "ears.shape": "none",
    "glasses.shape": "none",
    "facial_hair.style": "none",
    "headwear.type": "none",
    "face.detail": "none"
  });
  spec.seed = `segment-recombine-${id}`;
  spec.patches = [
    { op: "rect", layer: "custom.mix.00_background", coordSpace: "output", x: 0, y: 0, w: 32, h: 32, color: face.background },
    ...runsToPatches("custom.mix.10_clothing", [...(clothing.segments.clothing ?? [])]),
    ...runsToPatches("custom.mix.20_skin", [...(face.segments.skin ?? [])]),
    ...runsToPatches("custom.mix.30_hair", [...(hair.segments.hair ?? [])]),
    ...runsToPatches("custom.mix.40_accessory", [...(accessory.segments.accessory ?? [])]),
    ...runsToPatches("custom.mix.50_face_feature", [...(face.segments.face_feature ?? [])]),
    ...runsToPatches("custom.mix.90_ink", [...(hair.segments.ink ?? []), ...(face.segments.ink ?? [])])
  ];
  return spec;
}

function runsToPatches(layer: string, cells: Array<{ x: number; y: number; color: string }>): PixelPatch[] {
  const patches: PixelPatch[] = [];
  const rows = new Map<number, Array<{ x: number; y: number; color: string }>>();
  for (const cell of cells) {
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
  return patches;
}

function get(segments: Map<string, SegmentJson>, id: string) {
  const value = segments.get(id);
  if (!value) throw new Error(`Missing segment source: ${id}`);
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
