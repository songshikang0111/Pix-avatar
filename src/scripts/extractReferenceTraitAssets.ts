import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { normalizeHex, hexToRgb } from "../core/color";
import { keyOf } from "../core/geometry";
import { PixelMatrix, TRANSPARENT_PIXEL, assertMatrixSize } from "../core/pixelMatrix";
import { renderAvatar } from "../core/render";
import { AvatarSpec, PixelCell, PixelImage, PixelPatch, TraitMap } from "../types";
import { createDefaultSpec } from "../assets/humanV1";
import { writePng } from "../node/png";

interface IgnoreRegion {
  id: string;
  matrixRegion: [number, number, number, number];
}

interface ManifestEntry {
  id: string;
  matrix: string;
  background: string;
  ignoreRegions?: IgnoreRegion[];
}

interface Manifest {
  id: string;
  canvas: { size: [number, number] };
  entries: ManifestEntry[];
}

type SegmentName = "background" | "skin" | "hair" | "clothing" | "accessory" | "face_feature" | "ink" | "ignored";

interface SegmentCell {
  x: number;
  y: number;
  color: string;
  segment: SegmentName;
}

const args = parseArgs(process.argv.slice(2));
const datasetDir = args.dataset ?? "datasets/reference/istock-36";
const outDir = args.out ?? join(datasetDir, "segments");
const assetOutDir = args.assetsOut ?? join(datasetDir, "segment-traits");
const scale = Number(args.scale ?? 6);

await extractReferenceTraitAssets(datasetDir, outDir, assetOutDir, scale);

async function extractReferenceTraitAssets(datasetDir: string, outDir: string, assetOutDir: string, scale: number) {
  const manifest: Manifest = JSON.parse(await readFile(join(datasetDir, "manifest.json"), "utf8"));
  const [width, height] = manifest.canvas.size;
  const semanticMatrices: PixelMatrix[] = [];
  const reconstructedMatrices: PixelMatrix[] = [];
  const summary = [];

  await mkdir(outDir, { recursive: true });
  await mkdir(join(assetOutDir, "specs"), { recursive: true });
  await mkdir(join(assetOutDir, "generated"), { recursive: true });

  for (const entry of manifest.entries) {
    const reference = JSON.parse(await readFile(join(datasetDir, entry.matrix), "utf8")) as { matrix: PixelMatrix };
    assertMatrixSize(reference.matrix, width, height);
    const background = normalizeHex(entry.background);
    const ignored = ignoredMask(entry.ignoreRegions ?? []);
    const cells = segmentMatrix(reference.matrix, background, ignored);
    const semantic = semanticPreviewMatrix(reference.matrix, cells, width, height);
    const spec = segmentCellsToSpec(entry.id, background, cells, width, height);
    const render = renderAvatar(spec);
    const reconstructed = imageToMatrix(render.image, width, height, background);
    const counts = countSegments(cells);

    semanticMatrices.push(semantic);
    reconstructedMatrices.push(reconstructed);

    await writeJson(join(outDir, `${entry.id}.json`), {
      id: entry.id,
      background,
      ignoredPixels: ignored.size,
      counts,
      segments: groupCells(cells)
    });
    await writePng(join(outDir, `${entry.id}.png`), matrixToPixelImage(semantic), scale);
    await writeJson(join(assetOutDir, "specs", `${entry.id}.json`), spec);
    await writePng(join(assetOutDir, "generated", `${entry.id}.png`), render.image, scale);

    summary.push({
      id: entry.id,
      background,
      ignoredPixels: ignored.size,
      counts,
      spec: `specs/${entry.id}.json`,
      semantic: `../segments/${entry.id}.png`,
      generated: `generated/${entry.id}.png`
    });
  }

  await writePng(join(outDir, "semantic-contact-sheet.png"), matrixContactSheet(semanticMatrices, 6, width, height), scale);
  await writePng(join(assetOutDir, "contact-sheet.png"), matrixContactSheet(reconstructedMatrices, 6, width, height), scale);
  await writeJson(join(outDir, "report.json"), {
    version: "pix-avatar/reference-segmentation/v1",
    dataset: manifest.id,
    canvas: manifest.canvas,
    method: {
      summary: "Color-family and connected-component segmentation tuned for the quantized 32px iStock reference matrices.",
      segments: {
        background: "Manifest background color plus ignored watermark/asset-id regions.",
        skin: "Large light or brown face/ear/neck color regions in the head zone.",
        hair: "Upper or side head color masses, including black, pink, blue, blonde, brown, and dark hair shadows.",
        clothing: "Lower bust color regions and lower outline fragments.",
        accessory: "Glasses, headphones, hats, highlights, blush, and high-saturation small props.",
        face_feature: "Small dark components inside the face box: eyes, brows, nose, mouth.",
        ink: "Remaining dark contour and linework pixels."
      }
    },
    artifacts: {
      semanticContactSheet: "semantic-contact-sheet.png",
      segmentAssetSpecs: "../segment-traits/specs",
      segmentAssetContactSheet: "../segment-traits/contact-sheet.png"
    },
    entries: summary
  });

  console.log(
    JSON.stringify(
      {
        entries: summary.length,
        outDir,
        assetOutDir,
        semanticContactSheet: join(outDir, "semantic-contact-sheet.png"),
        segmentAssetContactSheet: join(assetOutDir, "contact-sheet.png")
      },
      null,
      2
    )
  );
}

function segmentMatrix(matrix: PixelMatrix, background: string, ignored: Set<string>): SegmentCell[] {
  const darkComponents = connectedComponents(matrix, (x, y, color) => !ignored.has(keyOf(x, y)) && isDarkInkCandidate(color));
  const darkComponentByKey = new Map<string, { segment: SegmentName }>();
  for (const component of darkComponents) {
    const segment = classifyDarkComponent(component);
    for (const key of component.keys) darkComponentByKey.set(key, { segment });
  }

  const cells: SegmentCell[] = [];
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      const key = keyOf(x, y);
      const color = normalizeHex(matrix[y][x]);
      if (ignored.has(key)) {
        cells.push({ x, y, color: background, segment: "ignored" });
        continue;
      }
      if (color === background || color === TRANSPARENT_PIXEL) {
        cells.push({ x, y, color: background, segment: "background" });
        continue;
      }
      const dark = darkComponentByKey.get(key);
      if (dark) {
        cells.push({ x, y, color, segment: dark.segment });
        continue;
      }
      cells.push({ x, y, color, segment: classifyColorPixel(color, x, y) });
    }
  }
  return cells;
}

function classifyDarkComponent(component: Component): SegmentName {
  const { area, bbox } = component;
  const [x0, y0, x1, y1] = bbox;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  if (area <= 18 && x0 >= 8 && x1 <= 29 && y0 >= 9 && y1 <= 27) return "face_feature";
  if (y1 >= 25 && area >= 12) return "clothing";
  if (y0 <= 18 && (area >= 18 || x0 <= 9 || x1 >= 28)) return "hair";
  if (cy >= 24) return "clothing";
  if (cx >= 7 && cx <= 28 && cy >= 11 && cy <= 27 && area <= 28) return "face_feature";
  return "ink";
}

function classifyColorPixel(color: string, x: number, y: number): SegmentName {
  const [r, g, b] = hexToRgb(color);
  if (isBluePurple(r, g, b)) return y >= 24 ? "clothing" : "hair";
  if (isPink(r, g, b)) {
    if (y >= 25) return "clothing";
    if (x >= 8 && x <= 26 && y >= 12 && y <= 24 && Math.abs(r - g) > 70) return "accessory";
    return "hair";
  }
  if (isBlonde(r, g, b)) return y >= 26 ? "clothing" : "hair";
  if (isBrown(r, g, b)) {
    if (y >= 25) return "clothing";
    if (y <= 11 || x <= 9 || x >= 27) return "hair";
    return "skin";
  }
  if (isLightSkin(r, g, b)) return y >= 26 ? "clothing" : "skin";
  if (isWhiteHighlight(r, g, b)) return "accessory";
  if (y >= 24) return "clothing";
  return "accessory";
}

function isDarkInkCandidate(color: string) {
  if (color === TRANSPARENT_PIXEL) return false;
  const [r, g, b] = hexToRgb(color);
  if (isBluePurple(r, g, b) && b - r > 40) return false;
  return luminance(r, g, b) < 72;
}

function isBluePurple(r: number, g: number, b: number) {
  return b > 80 && r < 80 && b > g + 20;
}

function isPink(r: number, g: number, b: number) {
  return r > 180 && b > 120 && g < 170;
}

function isBlonde(r: number, g: number, b: number) {
  return r > 210 && g > 185 && b < 180;
}

function isBrown(r: number, g: number, b: number) {
  return r >= 85 && r <= 155 && g >= 45 && g <= 110 && b >= 35 && b <= 95;
}

function isLightSkin(r: number, g: number, b: number) {
  return r >= 210 && g >= 205 && b >= 185;
}

function isWhiteHighlight(r: number, g: number, b: number) {
  return r > 235 && g > 235 && b > 225;
}

function luminance(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

interface Component {
  keys: string[];
  area: number;
  bbox: [number, number, number, number];
}

function connectedComponents(matrix: PixelMatrix, predicate: (x: number, y: number, color: string) => boolean): Component[] {
  const seen = new Set<string>();
  const components: Component[] = [];
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      const startKey = keyOf(x, y);
      if (seen.has(startKey) || !predicate(x, y, matrix[y][x])) continue;
      const queue: Array<[number, number]> = [[x, y]];
      const keys: string[] = [];
      seen.add(startKey);
      let minX = x;
      let minY = y;
      let maxX = x;
      let maxY = y;
      for (let i = 0; i < queue.length; i += 1) {
        const [cx, cy] = queue[i];
        keys.push(keyOf(cx, cy));
        minX = Math.min(minX, cx);
        minY = Math.min(minY, cy);
        maxX = Math.max(maxX, cx);
        maxY = Math.max(maxY, cy);
        for (const [nx, ny] of neighbors4(cx, cy)) {
          if (ny < 0 || ny >= matrix.length || nx < 0 || nx >= matrix[ny].length) continue;
          const key = keyOf(nx, ny);
          if (seen.has(key) || !predicate(nx, ny, matrix[ny][nx])) continue;
          seen.add(key);
          queue.push([nx, ny]);
        }
      }
      components.push({ keys, area: keys.length, bbox: [minX, minY, maxX + 1, maxY + 1] });
    }
  }
  return components;
}

function neighbors4(x: number, y: number): Array<[number, number]> {
  return [
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1]
  ];
}

function segmentCellsToSpec(id: string, background: string, cells: SegmentCell[], width: number, height: number): AvatarSpec {
  const traits: TraitMap = {
    "background.style": "transparent",
    "hair.style": "bald_clean",
    "ears.shape": "none",
    "glasses.shape": "none",
    "facial_hair.style": "none",
    "headwear.type": "none",
    "face.detail": "none"
  };
  const spec = createDefaultSpec(traits);
  spec.seed = `segment-trait-${id}`;
  spec.patches = [
    { op: "rect", layer: "custom.reference.00_background", coordSpace: "output", x: 0, y: 0, w: width, h: height, color: background },
    ...runsToPatches(cells.filter((cell) => cell.segment !== "background" && cell.segment !== "ignored"))
  ];
  return spec;
}

function runsToPatches(cells: SegmentCell[]): PixelPatch[] {
  const byLayer = new Map<string, SegmentCell[]>();
  for (const cell of cells) {
    const layer = layerForSegment(cell.segment);
    const bucket = byLayer.get(layer) ?? [];
    bucket.push(cell);
    byLayer.set(layer, bucket);
  }
  const patches: PixelPatch[] = [];
  for (const [layer, layerCells] of byLayer) {
    const rows = new Map<number, SegmentCell[]>();
    for (const cell of layerCells) {
      const row = rows.get(cell.y) ?? [];
      row.push(cell);
      rows.set(cell.y, row);
    }
    for (const [y, row] of rows) {
      row.sort((a, b) => a.x - b.x || a.color.localeCompare(b.color));
      let start: SegmentCell | undefined;
      let previous: SegmentCell | undefined;
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

function layerForSegment(segment: SegmentName) {
  const order: Record<SegmentName, string> = {
    background: "custom.reference.00_background",
    clothing: "custom.reference.10_clothing",
    skin: "custom.reference.20_skin",
    hair: "custom.reference.30_hair",
    accessory: "custom.reference.40_accessory",
    face_feature: "custom.reference.50_face_feature",
    ink: "custom.reference.90_ink",
    ignored: "custom.reference.99_ignored"
  };
  return order[segment];
}

function semanticPreviewMatrix(reference: PixelMatrix, cells: SegmentCell[], width: number, height: number): PixelMatrix {
  const out = blankMatrix(width, height, "#FFFFFF");
  for (const cell of cells) {
    out[cell.y][cell.x] = semanticColor(cell.segment, reference[cell.y][cell.x]);
  }
  return out;
}

function semanticColor(segment: SegmentName, original: string) {
  const colors: Record<SegmentName, string> = {
    background: "#F5F5F5",
    skin: "#FFD1B8",
    hair: "#7D4AEA",
    clothing: "#2F80ED",
    accessory: "#F2C94C",
    face_feature: "#111111",
    ink: "#666666",
    ignored: "#999999"
  };
  if (segment === "background") return normalizeHex(original);
  return colors[segment];
}

function countSegments(cells: SegmentCell[]) {
  const counts: Record<string, number> = {};
  for (const cell of cells) counts[cell.segment] = (counts[cell.segment] ?? 0) + 1;
  return counts;
}

function groupCells(cells: SegmentCell[]) {
  const grouped: Record<string, Array<{ x: number; y: number; color: string }>> = {};
  for (const cell of cells) {
    if (cell.segment === "background") continue;
    const group = grouped[cell.segment] ?? [];
    group.push({ x: cell.x, y: cell.y, color: cell.color });
    grouped[cell.segment] = group;
  }
  return grouped;
}

function ignoredMask(regions: IgnoreRegion[]) {
  const ignored = new Set<string>();
  for (const region of regions) {
    const [x0, y0, x1, y1] = region.matrixRegion;
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) ignored.add(keyOf(x, y));
    }
  }
  return ignored;
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
  const output = blankMatrix(width, height, "#FFFFFF");

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
      pixels.set(keyOf(x, y), { x, y, color: normalizeHex(color), meta: { layer: "matrix" } });
    }
  }
  return { width: matrix[0]?.length ?? 0, height: matrix.length, pixels, stacks: new Map() };
}

function blankMatrix(width: number, height: number, fill: string): PixelMatrix {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
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
