import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { hexToRgb, normalizeHex } from "../core/color";
import { keyOf } from "../core/geometry";
import { assertMatrixSize, pixelImageToMatrix, PixelMatrix, TRANSPARENT_PIXEL } from "../core/pixelMatrix";
import { renderAvatar } from "../core/render";
import { AvatarSpec, PixelImage, PixelCell } from "../types";
import { writePng } from "../node/png";
import { referenceFitSpecs } from "./referenceFitSpecs";

interface ManifestEntry {
  id: string;
  matrix: string;
  background: string;
  ignoreRegions?: Array<{ id: string; matrixRegion: [number, number, number, number] }>;
}

interface Manifest {
  id: string;
  canvas: { size: [number, number] };
  entries: ManifestEntry[];
}

interface BinaryMetrics {
  precision: number;
  recall: number;
  f1: number;
  intersection: number;
  generated: number;
  reference: number;
}

const args = parseArgs(process.argv.slice(2));
const datasetDir = args.dataset ?? "datasets/reference/istock-36";
const outDir = args.out ?? join(datasetDir, "generator-fit");
const specDir = args.specDir;
const scale = Number(args.scale ?? 6);

const WEIGHTS = {
  foreground: 0.38,
  edge: 0.32,
  ink: 0.22,
  rgb: 0.08
};

await fitReferenceDataset(datasetDir, outDir, scale, specDir);

async function fitReferenceDataset(datasetDir: string, outDir: string, scale: number, specDir?: string) {
  const manifest: Manifest = JSON.parse(await readFile(join(datasetDir, "manifest.json"), "utf8"));
  const [width, height] = manifest.canvas.size;
  const specsById = await loadSpecs(manifest, specDir);
  const generatedMatrices: PixelMatrix[] = [];
  const referenceMatrices: PixelMatrix[] = [];
  const diffMatrices: PixelMatrix[] = [];
  const entries = [];

  await mkdir(join(outDir, "generated"), { recursive: true });
  await mkdir(join(outDir, "diffs"), { recursive: true });
  await mkdir(join(outDir, "specs"), { recursive: true });

  for (const entry of manifest.entries) {
    const reference = JSON.parse(await readFile(join(datasetDir, entry.matrix), "utf8")) as { matrix: PixelMatrix };
    assertMatrixSize(reference.matrix, width, height);
    const spec = specsById.get(entry.id);
    if (!spec) throw new Error(`Missing reference fit spec for ${entry.id}`);

    const result = renderAvatar(spec);
    const generated = pixelImageToMatrix(result.image);
    assertMatrixSize(generated, width, height);

    const ignored = ignoredMask(entry.ignoreRegions ?? []);
    const comparable = bestAlignedComparison(generated, reference.matrix, normalizeHex(entry.background), ignored);
    const diff = diffMatrix(comparable.generated, comparable.reference, normalizeHex(entry.background), ignored);
    const score = scoreComparison(comparable);
    const specForDisk = { ...spec };
    delete (specForDisk as Partial<typeof spec>).referenceId;

    generatedMatrices.push(generated);
    referenceMatrices.push(reference.matrix);
    diffMatrices.push(diff);

    await writePng(join(outDir, "generated", `${entry.id}.png`), result.image, scale);
    await writePng(join(outDir, "diffs", `${entry.id}.png`), matrixToPixelImage(diff), scale);
    await writeJson(join(outDir, "specs", `${entry.id}.json`), specForDisk);

    entries.push({
      id: entry.id,
      spec: `specs/${entry.id}.json`,
      generated: `generated/${entry.id}.png`,
      diff: `diffs/${entry.id}.png`,
      score,
      alignment: comparable.alignment,
      metrics: {
        pixel: comparable.pixel,
        foreground: comparable.foreground,
        edge: comparable.edge,
        ink: comparable.ink,
        rgbRmse: comparable.rgbRmse,
        rgbRmseNorm: comparable.rgbRmseNorm,
        foregroundPixelDelta: comparable.foregroundPixelDelta,
        ignoredPixels: ignored.size
      },
      traits: spec.traits
    });
  }

  const sorted = [...entries].sort((a, b) => b.score - a.score);
  const report = {
    version: "pix-avatar/generator-reference-fit/v1",
    dataset: manifest.id,
    canvas: manifest.canvas,
    source: {
      type: specDir ? "spec-dir" : "referenceFitSpecs",
      specDir
    },
    metric: {
      direction: "lower_is_better",
      weights: {
        foregroundF1Loss: WEIGHTS.foreground,
        edgeF1Loss: WEIGHTS.edge,
        inkF1Loss: WEIGHTS.ink,
        rgbRmseNorm: WEIGHTS.rgb
      },
      rationale:
        "Foreground, edge, and ink masks de-emphasize exact color and directly reward matching silhouette, hair/accessory mass, facial feature linework, and readable outlines."
    },
    aggregate: {
      entries: entries.length,
      score: average(entries.map((entry) => entry.score)),
      pixelDiffRate: average(entries.map((entry) => entry.metrics.pixel.diffRate)),
      globalPixelDiffRate:
        entries.reduce((sum, entry) => sum + entry.metrics.pixel.diffPixels, 0) /
        Math.max(1, entries.reduce((sum, entry) => sum + entry.metrics.pixel.scoredPixels, 0)),
      foregroundF1: average(entries.map((entry) => entry.metrics.foreground.f1)),
      edgeF1: average(entries.map((entry) => entry.metrics.edge.f1)),
      inkF1: average(entries.map((entry) => entry.metrics.ink.f1)),
      rgbRmse: average(entries.map((entry) => entry.metrics.rgbRmse)),
      rgbRmseNorm: average(entries.map((entry) => entry.metrics.rgbRmseNorm)),
      foregroundPixelDelta: average(entries.map((entry) => Math.abs(entry.metrics.foregroundPixelDelta))),
      ignoredPixels: entries.reduce((sum, entry) => sum + entry.metrics.ignoredPixels, 0)
    },
    artifacts: {
      generatedContactSheet: "generated-contact-sheet.png",
      referenceContactSheet: "reference-contact-sheet.png",
      diffContactSheet: "diff-contact-sheet.png",
      generatedDir: "generated",
      diffsDir: "diffs",
      specsDir: "specs"
    },
    worst: sorted.slice(0, 8).map(({ id, score, metrics, traits }) => ({
      id,
      score,
      pixelDiffRate: metrics.pixel.diffRate,
      foregroundF1: metrics.foreground.f1,
      edgeF1: metrics.edge.f1,
      inkF1: metrics.ink.f1,
      rgbRmseNorm: metrics.rgbRmseNorm,
      traits
    })),
    entries
  };

  await writePng(join(outDir, "generated-contact-sheet.png"), matrixContactSheet(generatedMatrices, 6, width, height), scale);
  await writePng(join(outDir, "reference-contact-sheet.png"), matrixContactSheet(referenceMatrices, 6, width, height), scale);
  await writePng(join(outDir, "diff-contact-sheet.png"), matrixContactSheet(diffMatrices, 6, width, height), scale);
  await writeJson(join(outDir, "report.json"), report);

  console.log(
    JSON.stringify(
      {
        entries: entries.length,
        score: report.aggregate.score,
        pixelDiffRate: report.aggregate.pixelDiffRate,
        globalPixelDiffRate: report.aggregate.globalPixelDiffRate,
        foregroundF1: report.aggregate.foregroundF1,
        edgeF1: report.aggregate.edgeF1,
        inkF1: report.aggregate.inkF1,
        rgbRmseNorm: report.aggregate.rgbRmseNorm,
        outDir
      },
      null,
      2
    )
  );
}

function bestAlignedComparison(generated: PixelMatrix, reference: PixelMatrix, referenceBackground: string, ignored: Set<string>) {
  const candidates = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const shifted = shiftMatrix(generated, dx, dy);
      const comparison = compareMatrices(shifted, reference, referenceBackground, ignored);
      candidates.push({ ...comparison, generated: shifted, reference, alignment: { dx, dy } });
    }
  }
  return candidates.sort((a, b) => scoreComparison(a) - scoreComparison(b))[0];
}

function compareMatrices(generated: PixelMatrix, reference: PixelMatrix, referenceBackground: string, ignored: Set<string>) {
  const generatedForeground = foregroundMask(generated, generated[0]?.[0] ?? TRANSPARENT_PIXEL, ignored);
  const referenceForeground = foregroundMask(reference, referenceBackground, ignored);
  const generatedEdge = edgeMask(generatedForeground);
  const referenceEdge = edgeMask(referenceForeground);
  const generatedInk = inkMask(generated, generated[0]?.[0] ?? TRANSPARENT_PIXEL, ignored);
  const referenceInk = inkMask(reference, referenceBackground, ignored);

  return {
    foreground: binaryMetrics(generatedForeground, referenceForeground),
    edge: binaryMetrics(generatedEdge, referenceEdge),
    ink: binaryMetrics(generatedInk, referenceInk),
    pixel: exactPixelDiff(generated, reference, ignored),
    rgbRmse: rgbRmse(generated, reference, ignored),
    rgbRmseNorm: rgbRmse(generated, reference, ignored) / Math.sqrt(255 ** 2 * 3),
    foregroundPixelDelta: generatedForeground.size - referenceForeground.size
  };
}

function scoreComparison(comparison: ReturnType<typeof compareMatrices>) {
  return (
    WEIGHTS.foreground * (1 - comparison.foreground.f1) +
    WEIGHTS.edge * (1 - comparison.edge.f1) +
    WEIGHTS.ink * (1 - comparison.ink.f1) +
    WEIGHTS.rgb * comparison.rgbRmseNorm
  );
}

function foregroundMask(matrix: PixelMatrix, background: string, ignored: Set<string>) {
  const mask = new Set<string>();
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (ignored.has(keyOf(x, y))) continue;
      const color = matrix[y][x];
      if (color !== background && color !== TRANSPARENT_PIXEL) mask.add(keyOf(x, y));
    }
  }
  return mask;
}

function inkMask(matrix: PixelMatrix, background: string, ignored: Set<string>) {
  const mask = new Set<string>();
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (ignored.has(keyOf(x, y))) continue;
      const color = matrix[y][x];
      if (color !== background && color !== TRANSPARENT_PIXEL && luminance(color) < 58) mask.add(keyOf(x, y));
    }
  }
  return mask;
}

function edgeMask(mask: Set<string>) {
  const edge = new Set<string>();
  for (const key of mask) {
    const [x, y] = key.split(",").map(Number);
    if (!mask.has(keyOf(x + 1, y)) || !mask.has(keyOf(x - 1, y)) || !mask.has(keyOf(x, y + 1)) || !mask.has(keyOf(x, y - 1))) {
      edge.add(key);
    }
  }
  return edge;
}

function binaryMetrics(generated: Set<string>, reference: Set<string>): BinaryMetrics {
  let intersection = 0;
  for (const key of generated) {
    if (reference.has(key)) intersection += 1;
  }
  const precision = generated.size === 0 ? (reference.size === 0 ? 1 : 0) : intersection / generated.size;
  const recall = reference.size === 0 ? (generated.size === 0 ? 1 : 0) : intersection / reference.size;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1, intersection, generated: generated.size, reference: reference.size };
}

function exactPixelDiff(generated: PixelMatrix, reference: PixelMatrix, ignored: Set<string>) {
  let diffPixels = 0;
  let scoredPixels = 0;
  for (let y = 0; y < reference.length; y += 1) {
    for (let x = 0; x < reference[y].length; x += 1) {
      if (ignored.has(keyOf(x, y))) continue;
      scoredPixels += 1;
      if (generated[y][x] !== reference[y][x]) diffPixels += 1;
    }
  }
  return { diffPixels, scoredPixels, diffRate: diffPixels / Math.max(1, scoredPixels) };
}

function rgbRmse(generated: PixelMatrix, reference: PixelMatrix, ignored: Set<string>) {
  let sse = 0;
  let count = 0;
  for (let y = 0; y < reference.length; y += 1) {
    for (let x = 0; x < reference[y].length; x += 1) {
      if (ignored.has(keyOf(x, y))) continue;
      const g = rgba(generated[y][x]);
      const r = rgba(reference[y][x]);
      sse += (g[0] - r[0]) ** 2 + (g[1] - r[1]) ** 2 + (g[2] - r[2]) ** 2;
      count += 1;
    }
  }
  return Math.sqrt(sse / Math.max(1, count));
}

function shiftMatrix(matrix: PixelMatrix, dx: number, dy: number): PixelMatrix {
  const height = matrix.length;
  const width = matrix[0]?.length ?? 0;
  const fill = matrix[0]?.[0] ?? TRANSPARENT_PIXEL;
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      const sx = x - dx;
      const sy = y - dy;
      return sx >= 0 && sx < width && sy >= 0 && sy < height ? matrix[sy][sx] : fill;
    })
  );
}

function diffMatrix(generated: PixelMatrix, reference: PixelMatrix, referenceBackground: string, ignored: Set<string>): PixelMatrix {
  const generatedForeground = foregroundMask(generated, generated[0]?.[0] ?? TRANSPARENT_PIXEL, ignored);
  const referenceForeground = foregroundMask(reference, referenceBackground, ignored);
  const generatedInk = inkMask(generated, generated[0]?.[0] ?? TRANSPARENT_PIXEL, ignored);
  const referenceInk = inkMask(reference, referenceBackground, ignored);
  return reference.map((row, y) =>
    row.map((_, x) => {
      const key = keyOf(x, y);
      if (ignored.has(key)) return "#777777";
      const fgG = generatedForeground.has(key);
      const fgR = referenceForeground.has(key);
      if (fgG && fgR) {
        if (generatedInk.has(key) && referenceInk.has(key)) return "#111111";
        if (generatedInk.has(key) !== referenceInk.has(key)) return "#F7C948";
        return "#A7B0BA";
      }
      if (fgR) return "#E84545";
      if (fgG) return "#2F80ED";
      return "#F5F5F5";
    })
  );
}

function ignoredMask(regions: Array<{ matrixRegion: [number, number, number, number] }>) {
  const ignored = new Set<string>();
  for (const region of regions) {
    const [x0, y0, x1, y1] = region.matrixRegion;
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) ignored.add(keyOf(x, y));
    }
  }
  return ignored;
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
      for (let x = 0; x < tileWidth; x += 1) {
        output[oy + y][ox + x] = matrix[y][x];
      }
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

function rgba(color: string) {
  return hexToRgb(color === TRANSPARENT_PIXEL ? "#FFFFFF" : color);
}

function luminance(color: string) {
  const [r, g, b] = rgba(color);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

async function loadSpecs(manifest: Manifest, specDir?: string): Promise<Map<string, AvatarSpec & { referenceId: string }>> {
  if (!specDir) return new Map(referenceFitSpecs().map((spec) => [spec.referenceId, spec]));
  const specs = new Map<string, AvatarSpec & { referenceId: string }>();
  for (const entry of manifest.entries) {
    const spec = JSON.parse(await readFile(join(specDir, `${entry.id}.json`), "utf8")) as AvatarSpec;
    specs.set(entry.id, { ...spec, referenceId: entry.id });
  }
  return specs;
}

async function writeJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
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
