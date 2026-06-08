import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import { PixelMatrix, assertMatrixSize } from "../core/pixelMatrix";

const DEFAULT_REFERENCE_SIZE = 32;
const DEFAULT_SAMPLE_OFFSET: [number, number] = [0.5, 0.5];
const DEFAULT_PALETTE_CLEANUP_THRESHOLD = 24;
const DEFAULT_PALETTE_MIN_REPRESENTATIVE_COUNT = 3;

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

interface PrepareOptions {
  source: string;
  outDir: string;
  columns: number;
  rows: number;
  size: number;
  previewScale: number;
  quantizeStep: number;
  sampleOffset: [number, number];
  paletteCleanupThreshold: number;
  paletteMinRepresentativeCount: number;
}

interface SourceIssueRegion {
  id: string;
  reason: string;
  box: CropBox;
}

const args = parseArgs(process.argv.slice(2));

if (!args.source) {
  throw new Error("Missing --source <path>. Example: npm run prepare:reference-dataset -- --source /path/to/reference.jpg");
}

const options: PrepareOptions = {
  source: args.source,
  outDir: args.out ?? "datasets/reference/istock-36",
  columns: Number(args.columns ?? 6),
  rows: Number(args.rows ?? 6),
  size: Number(args.size ?? DEFAULT_REFERENCE_SIZE),
  previewScale: Number(args.previewScale ?? 6),
  quantizeStep: Number(args.quantizeStep ?? 16),
  sampleOffset: parsePair(args.sampleOffset, DEFAULT_SAMPLE_OFFSET),
  paletteCleanupThreshold: Number(args.paletteCleanupThreshold ?? DEFAULT_PALETTE_CLEANUP_THRESHOLD),
  paletteMinRepresentativeCount: Number(args.paletteMinRepresentativeCount ?? DEFAULT_PALETTE_MIN_REPRESENTATIVE_COUNT)
};

await prepareReferenceDataset(options);

async function prepareReferenceDataset(options: PrepareOptions) {
  const sourceBuffer = await readFile(options.source);
  const source = decodeImage(sourceBuffer, options.source);
  const sourceHash = createHash("sha256").update(sourceBuffer).digest("hex");
  const tileDir = join(options.outDir, "tiles");
  const normalizedDir = join(options.outDir, "normalized");
  const matrixDir = join(options.outDir, "matrices");
  const previewDir = join(options.outDir, "preview");
  await Promise.all([mkdir(tileDir, { recursive: true }), mkdir(normalizedDir, { recursive: true }), mkdir(matrixDir, { recursive: true }), mkdir(previewDir, { recursive: true })]);

  const entries = [];
  const sourceIssueRegions = issueRegionsForSource(options.source, source.width, source.height);
  const contactSheet = createBlankImage(options.columns * options.size * options.previewScale, options.rows * options.size * options.previewScale);

  for (let row = 0; row < options.rows; row += 1) {
    for (let column = 0; column < options.columns; column += 1) {
      const index = row * options.columns + column + 1;
      const id = `avatar-${String(index).padStart(2, "0")}`;
      const crop = cropForCell(source.width, source.height, options.columns, options.rows, column, row);
      const integerCrop = integerCropForCell(source.width, source.height, options.columns, options.rows, column, row);
      const tile = cropImage(source, integerCrop);
      const matrix = cleanMatrixPalette(
        downsampleToMatrix(source, crop, options.size, options.quantizeStep, options.sampleOffset),
        options.paletteCleanupThreshold,
        options.paletteMinRepresentativeCount
      );
      assertMatrixSize(matrix, options.size, options.size);
      const ignoreRegions = sourceIssueRegions
        .map((region) => projectIssueRegion(region, crop, options.size))
        .filter((region) => region.matrixRegion[0] < region.matrixRegion[2] && region.matrixRegion[1] < region.matrixRegion[3]);
      const qualityFlags = ignoreRegions.map((region) => region.id);

      const tileFile = `tiles/${id}.png`;
      const normalizedFile = `normalized/${id}.png`;
      const matrixFile = `matrices/${id}.json`;

      await writePng(join(options.outDir, tileFile), tile);
      await writePng(join(options.outDir, normalizedFile), matrixToImage(matrix));
      await writeJson(join(options.outDir, matrixFile), {
        version: "pix-avatar/reference-pixel-matrix/v1",
        id,
        dataset: "istock-36",
        canvas: {
          size: [options.size, options.size],
          background: "opaque"
        },
        source: {
          fileName: basename(options.source),
          sha256: sourceHash,
          grid: [options.columns, options.rows],
          cell: [column, row],
          crop: preciseBox(crop)
        },
        normalization: {
          method: "offset-area-dominant-quantized-rgb-with-palette-cleanup",
          quantizeStep: options.quantizeStep,
          sampleOffset: options.sampleOffset,
          paletteCleanupThreshold: options.paletteCleanupThreshold,
          paletteMinRepresentativeCount: options.paletteMinRepresentativeCount
        },
        quality: {
          flags: qualityFlags,
          ignoreRegions
        },
        background: {
          sampledHex: sampleBackground(matrix)
        },
        matrix
      });

      drawMatrixOnImage(contactSheet, matrix, column * options.size * options.previewScale, row * options.size * options.previewScale, options.previewScale);

      entries.push({
        id,
        index,
        row,
        column,
        tile: tileFile,
        normalized: normalizedFile,
        matrix: matrixFile,
        background: sampleBackground(matrix),
        qualityFlags,
        ignoreRegions,
        crop: preciseBox(crop)
      });
    }
  }

  await writePng(join(previewDir, "contact-sheet.png"), contactSheet);
  await writeJson(join(options.outDir, "manifest.json"), {
    version: "pix-avatar/reference-dataset/v1",
    id: "istock-36",
    description: `36 reference avatars normalized to a ${options.size}x${options.size} logical canvas for pixel-level evaluation.`,
    source: {
      fileName: basename(options.source),
      sha256: sourceHash,
      width: source.width,
      height: source.height,
      grid: [options.columns, options.rows],
      note: "The original source file is not copied into this repository. Generated files are derived local evaluation fixtures."
    },
    sourceIssueRegions: sourceIssueRegions.map((region) => ({
      id: region.id,
      reason: region.reason,
      box: [round(region.box.x0), round(region.box.y0), round(region.box.x1), round(region.box.y1)]
    })),
    canvas: {
      size: [options.size, options.size],
      comparableTo: "renderAvatar(...).image via pixelImageToMatrix on the same 32x32 logical canvas"
    },
    normalization: {
      method: "offset-area-dominant-quantized-rgb-with-palette-cleanup",
      quantizeStep: options.quantizeStep,
      sampleOffset: options.sampleOffset,
      paletteCleanupThreshold: options.paletteCleanupThreshold,
      paletteMinRepresentativeCount: options.paletteMinRepresentativeCount,
      previewScale: options.previewScale
    },
    artifacts: {
      tilesDir: "tiles",
      normalizedDir: "normalized",
      matricesDir: "matrices",
      contactSheet: "preview/contact-sheet.png"
    },
    entries
  });

  console.log(`prepared ${entries.length} reference avatars in ${options.outDir}`);
}

function issueRegionsForSource(path: string, width: number, height: number): SourceIssueRegion[] {
  if (!basename(path).startsWith("istockphoto-1820670230")) return [];
  return [
    {
      id: "large_istock_overlay",
      reason: "Visible iStock credit overlay in the downloaded reference image.",
      box: { x0: width * 0.59, y0: height * 0.62, x1: width, y1: height * 0.72 }
    },
    {
      id: "lower_left_asset_id",
      reason: "Visible stock asset id in the lower-left corner.",
      box: { x0: 0, y0: height * 0.96, x1: width * 0.1, y1: height }
    }
  ];
}

function projectIssueRegion(region: SourceIssueRegion, crop: CropBox, size: number) {
  const x0 = Math.max(crop.x0, region.box.x0);
  const y0 = Math.max(crop.y0, region.box.y0);
  const x1 = Math.min(crop.x1, region.box.x1);
  const y1 = Math.min(crop.y1, region.box.y1);
  const matrixRegion = [
    clamp(Math.floor(((x0 - crop.x0) / (crop.x1 - crop.x0)) * size), 0, size),
    clamp(Math.floor(((y0 - crop.y0) / (crop.y1 - crop.y0)) * size), 0, size),
    clamp(Math.ceil(((x1 - crop.x0) / (crop.x1 - crop.x0)) * size), 0, size),
    clamp(Math.ceil(((y1 - crop.y0) / (crop.y1 - crop.y0)) * size), 0, size)
  ];
  return {
    id: region.id,
    reason: region.reason,
    sourceRegion: [round(x0), round(y0), round(x1), round(y1)],
    matrixRegion
  };
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

function cropForCell(width: number, height: number, columns: number, rows: number, column: number, row: number): CropBox {
  return {
    x0: (column * width) / columns,
    y0: (row * height) / rows,
    x1: ((column + 1) * width) / columns,
    y1: ((row + 1) * height) / rows
  };
}

function integerCropForCell(width: number, height: number, columns: number, rows: number, column: number, row: number): CropBox {
  const crop = cropForCell(width, height, columns, rows, column, row);
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
  const output = createBlankImage(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = getPixel(source, crop.x0 + x, crop.y0 + y);
      setPixel(output, x, y, pixel);
    }
  }
  return output;
}

function downsampleToMatrix(source: RgbaImage, crop: CropBox, size: number, quantizeStep: number, sampleOffset: [number, number]): PixelMatrix {
  const [offsetX, offsetY] = sampleOffset;
  return Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => {
      const sx0 = crop.x0 + offsetX + (x / size) * (crop.x1 - crop.x0);
      const sx1 = crop.x0 + offsetX + ((x + 1) / size) * (crop.x1 - crop.x0);
      const sy0 = crop.y0 + offsetY + (y / size) * (crop.y1 - crop.y0);
      const sy1 = crop.y0 + offsetY + ((y + 1) / size) * (crop.y1 - crop.y0);
      return dominantColor(source, sx0, sy0, sx1, sy1, quantizeStep);
    })
  );
}

function cleanMatrixPalette(matrix: PixelMatrix, threshold: number, minRepresentativeCount: number): PixelMatrix {
  const counts = new Map<string, number>();
  for (const row of matrix) {
    for (const color of row) counts.set(color, (counts.get(color) ?? 0) + 1);
  }

  const representatives: string[] = [];
  const replacement = new Map<string, string>();
  const colors = [...counts.keys()].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));

  for (const color of colors) {
    let best: string | undefined;
    let bestDistance = Infinity;
    for (const representative of representatives) {
      const distance = colorDistance(color, representative);
      if (distance < bestDistance) {
        best = representative;
        bestDistance = distance;
      }
    }

    if (best && bestDistance <= threshold && ((counts.get(best) ?? 0) >= minRepresentativeCount || (counts.get(color) ?? 0) <= 2)) {
      replacement.set(color, best);
    } else {
      representatives.push(color);
      replacement.set(color, color);
    }
  }

  return matrix.map((row) => row.map((color) => replacement.get(color) ?? color));
}

function colorDistance(a: string, b: string) {
  const [ar, ag, ab] = hexToRgba(a);
  const [br, bg, bb] = hexToRgba(b);
  return Math.sqrt((ar - br) ** 2 + (ag - bg) ** 2 + (ab - bb) ** 2);
}

function dominantColor(source: RgbaImage, sx0: number, sy0: number, sx1: number, sy1: number, quantizeStep: number) {
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  const minX = clamp(Math.floor(sx0), 0, source.width - 1);
  const maxX = clamp(Math.ceil(sx1) - 1, 0, source.width - 1);
  const minY = clamp(Math.floor(sy0), 0, source.height - 1);
  const maxY = clamp(Math.ceil(sy1) - 1, 0, source.height - 1);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const [r, g, b, a] = getPixel(source, x, y);
      if (a < 128) continue;
      const key = `${Math.floor(r / quantizeStep)},${Math.floor(g / quantizeStep)},${Math.floor(b / quantizeStep)}`;
      const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
      bucket.count += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      buckets.set(key, bucket);
    }
  }

  let best: { count: number; r: number; g: number; b: number } | undefined;
  for (const bucket of buckets.values()) {
    if (!best || bucket.count > best.count) best = bucket;
  }
  if (!best) return "transparent";
  return rgbToHex(snap(best.r / best.count, quantizeStep), snap(best.g / best.count, quantizeStep), snap(best.b / best.count, quantizeStep));
}

function matrixToImage(matrix: PixelMatrix): RgbaImage {
  const height = matrix.length;
  const width = matrix[0]?.length ?? 0;
  const image = createBlankImage(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      setPixel(image, x, y, hexToRgba(matrix[y][x]));
    }
  }
  return image;
}

function drawMatrixOnImage(image: RgbaImage, matrix: PixelMatrix, offsetX: number, offsetY: number, scale: number) {
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      const rgba = hexToRgba(matrix[y][x]);
      for (let yy = 0; yy < scale; yy += 1) {
        for (let xx = 0; xx < scale; xx += 1) {
          setPixel(image, offsetX + x * scale + xx, offsetY + y * scale + yy, rgba);
        }
      }
    }
  }
}

function sampleBackground(matrix: PixelMatrix) {
  const candidates = [
    matrix[0]?.[0],
    matrix[0]?.[matrix[0].length - 1],
    matrix[matrix.length - 1]?.[0],
    matrix[matrix.length - 1]?.[matrix[0].length - 1]
  ].filter(Boolean) as string[];
  const counts = new Map<string, number>();
  for (const color of candidates) counts.set(color, (counts.get(color) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "transparent";
}

function createBlankImage(width: number, height: number): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (let index = 3; index < data.length; index += 4) data[index] = 255;
  return { width, height, data };
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

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function snap(value: number, step: number) {
  return clamp(Math.round(value / step) * step, 0, 255);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function preciseBox(box: CropBox): [number, number, number, number] {
  return [box.x0, box.y0, box.x1, box.y1];
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

function parsePair(value: string | undefined, fallback: [number, number]): [number, number] {
  if (!value) return fallback;
  const [x, y] = value.split(",").map(Number);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`Expected numeric pair, got: ${value}`);
  return [x, y];
}
