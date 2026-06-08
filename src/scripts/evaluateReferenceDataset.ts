import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import { PixelMatrix, assertMatrixSize } from "../core/pixelMatrix";

interface RgbaImage {
  width: number;
  height: number;
  data: Uint8Array;
}

interface CropBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface IgnoreRegion {
  id: string;
  matrixRegion: [number, number, number, number];
}

interface ManifestEntry {
  id: string;
  row: number;
  column: number;
  matrix: string;
  crop: [number, number, number, number];
  ignoreRegions?: IgnoreRegion[];
}

interface Manifest {
  id: string;
  canvas: { size: [number, number] };
  normalization: Record<string, unknown>;
  source: { width: number; height: number; grid: [number, number] };
  entries: ManifestEntry[];
}

const args = parseArgs(process.argv.slice(2));
const sourcePath = args.source;
const datasetDir = args.dataset ?? "datasets/reference/istock-36";
const outDir = args.out ?? join(datasetDir, "evaluation");
const diffThreshold = Number(args.diffThreshold ?? 30);

if (!sourcePath) {
  throw new Error("Missing --source <path>. Example: npm run evaluate:reference-dataset -- --source /path/to/reference.jpg");
}

await evaluateReferenceDataset(sourcePath, datasetDir, outDir, diffThreshold);

async function evaluateReferenceDataset(sourcePath: string, datasetDir: string, outDir: string, diffThreshold: number) {
  const source = decodeImage(await readFile(sourcePath), sourcePath);
  const manifest: Manifest = JSON.parse(await readFile(join(datasetDir, "manifest.json"), "utf8"));
  const [columns, rows] = manifest.source.grid;
  const [matrixWidth, matrixHeight] = manifest.canvas.size;
  const heatContact = createBlankImage(source.width, source.height, [0, 0, 0, 255]);
  const reconstructionContact = createBlankImage(source.width, source.height, [0, 0, 0, 255]);
  const diffDir = join(outDir, "diffs");
  await mkdir(diffDir, { recursive: true });

  const entries = [];
  let scoredSse = 0;
  let scoredPixels = 0;
  let scoredDiffPixels = 0;
  let allSse = 0;
  let allPixels = 0;
  let allDiffPixels = 0;
  let ignoredPixels = 0;

  for (const entry of manifest.entries) {
    const fixture = JSON.parse(await readFile(join(datasetDir, entry.matrix), "utf8")) as { matrix: PixelMatrix };
    assertMatrixSize(fixture.matrix, matrixWidth, matrixHeight);
    const crop = boxFromArray(entry.crop);
    const integerCrop = integerCropFromBox(crop);
    const originalTile = cropImage(source, integerCrop);
    const reconstructionTile = createBlankImage(originalTile.width, originalTile.height, [0, 0, 0, 255]);
    const heatTile = createBlankImage(originalTile.width, originalTile.height, [0, 0, 0, 255]);

    let entryScoredSse = 0;
    let entryScoredPixels = 0;
    let entryScoredDiffPixels = 0;
    let entryAllSse = 0;
    let entryAllPixels = 0;
    let entryAllDiffPixels = 0;
    let entryIgnoredPixels = 0;

    for (let y = 0; y < originalTile.height; y += 1) {
      for (let x = 0; x < originalTile.width; x += 1) {
        const sourceX = integerCrop.x0 + x;
        const sourceY = integerCrop.y0 + y;
        const [mx, my] = matrixPointForSourcePoint(sourceX, sourceY, crop, matrixWidth, matrixHeight);
        const original = getPixel(source, sourceX, sourceY);
        const reconstructed = hexToRgba(fixture.matrix[my][mx]);
        const delta = pixelDelta(original, reconstructed);
        const ignored = isIgnored(mx, my, entry.ignoreRegions ?? []);

        setPixel(reconstructionTile, x, y, reconstructed);
        setPixel(reconstructionContact, sourceX, sourceY, reconstructed);
        setPixel(heatTile, x, y, ignored ? [70, 70, 70, 255] : heatColor(delta, diffThreshold));
        setPixel(heatContact, sourceX, sourceY, ignored ? [70, 70, 70, 255] : heatColor(delta, diffThreshold));

        entryAllSse += delta ** 2;
        entryAllPixels += 1;
        if (delta > diffThreshold) entryAllDiffPixels += 1;

        if (ignored) {
          entryIgnoredPixels += 1;
          continue;
        }
        entryScoredSse += delta ** 2;
        entryScoredPixels += 1;
        if (delta > diffThreshold) entryScoredDiffPixels += 1;
      }
    }

    await writePng(join(diffDir, `${entry.id}.png`), joinPanels([originalTile, reconstructionTile, heatTile]));

    const colorStats = matrixColorStats(fixture.matrix);
    const summary = {
      id: entry.id,
      row: entry.row,
      column: entry.column,
      crop: entry.crop,
      diff: `diffs/${entry.id}.png`,
      colors: colorStats.colors,
      rareColors: colorStats.rareColors,
      all: summarize(entryAllSse, entryAllPixels, entryAllDiffPixels),
      scored: summarize(entryScoredSse, entryScoredPixels, entryScoredDiffPixels),
      ignoredPixels: entryIgnoredPixels,
      ignoreRegions: entry.ignoreRegions ?? []
    };
    entries.push(summary);

    allSse += entryAllSse;
    allPixels += entryAllPixels;
    allDiffPixels += entryAllDiffPixels;
    scoredSse += entryScoredSse;
    scoredPixels += entryScoredPixels;
    scoredDiffPixels += entryScoredDiffPixels;
    ignoredPixels += entryIgnoredPixels;
  }

  await writePng(join(outDir, "diff-contact-sheet.png"), heatContact);
  await writePng(join(outDir, "reconstruction-contact-sheet.png"), reconstructionContact);
  await writeJson(join(outDir, "report.json"), {
    version: "pix-avatar/reference-evaluation/v1",
    dataset: manifest.id,
    source: sourcePath,
    canvas: manifest.canvas,
    normalization: manifest.normalization,
    diffThreshold,
    artifacts: {
      diffContactSheet: "diff-contact-sheet.png",
      reconstructionContactSheet: "reconstruction-contact-sheet.png",
      diffsDir: "diffs"
    },
    aggregate: {
      all: summarize(allSse, allPixels, allDiffPixels),
      scored: summarize(scoredSse, scoredPixels, scoredDiffPixels),
      ignoredPixels,
      averageColors: average(entries.map((entry) => entry.colors)),
      averageRareColors: average(entries.map((entry) => entry.rareColors))
    },
    entries
  });

  console.log(
    JSON.stringify(
      {
        entries: entries.length,
        all: summarize(allSse, allPixels, allDiffPixels),
        scored: summarize(scoredSse, scoredPixels, scoredDiffPixels),
        ignoredPixels,
        outDir
      },
      null,
      2
    )
  );

  if (entries.length !== columns * rows) {
    throw new Error(`Expected ${columns * rows} entries, got ${entries.length}.`);
  }
}

function decodeImage(buffer: Buffer, path: string): RgbaImage {
  const extension = extname(path).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") {
    const decoded = jpeg.decode(buffer, { useTArray: true });
    return { width: decoded.width, height: decoded.height, data: decoded.data };
  }
  if (extension === ".png") {
    const decoded = PNG.sync.read(buffer);
    return { width: decoded.width, height: decoded.height, data: decoded.data };
  }
  throw new Error(`Unsupported image extension: ${extension}`);
}

function boxFromArray([x0, y0, x1, y1]: [number, number, number, number]): CropBox {
  return { x0, y0, x1, y1 };
}

function integerCropFromBox(crop: CropBox): CropBox {
  return {
    x0: Math.floor(crop.x0),
    y0: Math.floor(crop.y0),
    x1: Math.ceil(crop.x1),
    y1: Math.ceil(crop.y1)
  };
}

function cropImage(source: RgbaImage, crop: CropBox): RgbaImage {
  const width = crop.x1 - crop.x0;
  const height = crop.y1 - crop.y0;
  const output = createBlankImage(width, height, [0, 0, 0, 255]);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      setPixel(output, x, y, getPixel(source, crop.x0 + x, crop.y0 + y));
    }
  }
  return output;
}

function matrixPointForSourcePoint(sourceX: number, sourceY: number, crop: CropBox, width: number, height: number): [number, number] {
  return [
    clamp(Math.floor(((sourceX - crop.x0) / (crop.x1 - crop.x0)) * width), 0, width - 1),
    clamp(Math.floor(((sourceY - crop.y0) / (crop.y1 - crop.y0)) * height), 0, height - 1)
  ];
}

function isIgnored(x: number, y: number, regions: IgnoreRegion[]) {
  return regions.some((region) => {
    const [x0, y0, x1, y1] = region.matrixRegion;
    return x >= x0 && x < x1 && y >= y0 && y < y1;
  });
}

function joinPanels(panels: RgbaImage[]) {
  const gutter = 2;
  const width = panels.reduce((sum, panel) => sum + panel.width, 0) + gutter * (panels.length - 1);
  const height = Math.max(...panels.map((panel) => panel.height));
  const output = createBlankImage(width, height, [255, 255, 255, 255]);
  let xOffset = 0;
  for (const panel of panels) {
    for (let y = 0; y < panel.height; y += 1) {
      for (let x = 0; x < panel.width; x += 1) {
        setPixel(output, xOffset + x, y, getPixel(panel, x, y));
      }
    }
    xOffset += panel.width + gutter;
  }
  return output;
}

function matrixColorStats(matrix: PixelMatrix) {
  const counts = new Map<string, number>();
  for (const row of matrix) {
    for (const color of row) counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  return {
    colors: counts.size,
    rareColors: [...counts.values()].filter((count) => count <= 2).length
  };
}

function summarize(sse: number, pixels: number, diffPixels: number) {
  return {
    pixels,
    rmse: round(pixels ? Math.sqrt(sse / pixels) : 0),
    diffPixels,
    diffRate: round(pixels ? diffPixels / pixels : 0, 6)
  };
}

function average(values: number[]) {
  return round(values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length), 3);
}

function pixelDelta([ar, ag, ab]: [number, number, number, number], [br, bg, bb]: [number, number, number, number]) {
  return Math.sqrt(((ar - br) ** 2 + (ag - bg) ** 2 + (ab - bb) ** 2) / 3);
}

function heatColor(delta: number, threshold: number): [number, number, number, number] {
  const hot = clamp(delta / Math.max(1, threshold * 3), 0, 1);
  if (delta <= threshold) {
    const value = Math.round(32 + hot * 80);
    return [value, value, value, 255];
  }
  return [255, Math.round(210 * (1 - hot)), 0, 255];
}

function createBlankImage(width: number, height: number, color: [number, number, number, number]): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  const image = { width, height, data };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) setPixel(image, x, y, color);
  }
  return image;
}

function getPixel(image: RgbaImage, x: number, y: number): [number, number, number, number] {
  const safeX = clamp(Math.round(x), 0, image.width - 1);
  const safeY = clamp(Math.round(y), 0, image.height - 1);
  const index = (safeY * image.width + safeX) * 4;
  return [image.data[index], image.data[index + 1], image.data[index + 2], image.data[index + 3]];
}

function setPixel(image: RgbaImage, x: number, y: number, [r, g, b, a]: [number, number, number, number]) {
  if (x < 0 || x >= image.width || y < 0 || y >= image.height) return;
  const index = (y * image.width + x) * 4;
  image.data[index] = r;
  image.data[index + 1] = g;
  image.data[index + 2] = b;
  image.data[index + 3] = a;
}

async function writePng(path: string, image: RgbaImage) {
  await mkdir(dirname(path), { recursive: true });
  const png = new PNG({ width: image.width, height: image.height });
  png.data.set(image.data);
  await writeFile(path, PNG.sync.write(png));
}

async function writeJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function hexToRgba(color: string): [number, number, number, number] {
  if (color === "transparent") return [0, 0, 0, 0];
  const value = color.replace("#", "");
  return [Number.parseInt(value.slice(0, 2), 16), Number.parseInt(value.slice(2, 4), 16), Number.parseInt(value.slice(4, 6), 16), 255];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, places = 3) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function parseArgs(values: string[]) {
  const parsed: Record<string, string | undefined> = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}
