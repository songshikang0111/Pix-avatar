import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createDefaultSpec } from "../assets/humanV1";
import { normalizeHex } from "../core/color";
import { keyOf } from "../core/geometry";
import { PixelMatrix, TRANSPARENT_PIXEL } from "../core/pixelMatrix";
import { renderAvatar } from "../core/render";
import { writePng } from "../node/png";
import { AvatarSpec, Box, PixelCell, PixelImage, PixelPatch, TraitMap } from "../types";

type CoarseSegment = "skin" | "hair" | "clothing" | "accessory" | "face_feature" | "ink" | "ignored";
type CandidateStatus = "accepted" | "review" | "rejected";
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

interface SegmentJson {
  id: string;
  background: string;
  ignoredPixels: number;
  segments: Partial<Record<CoarseSegment, Array<{ x: number; y: number; color: string }>>>;
}

interface PartCell {
  x: number;
  y: number;
  color: string;
  slot: PartSlot;
}

interface CandidateAsset {
  id: string;
  sourceId: string;
  slot: PartSlot;
  background: string;
  cells: PartCell[];
  status: CandidateStatus;
  reasons: string[];
  pixelCount: number;
  bbox?: Box;
  componentCount: number;
  largestComponentPixels: number;
  zoneCoverage: number;
}

interface SlotRule {
  minPixels: number;
  minZoneCoverage: number;
  zones: Box[];
  empty?: "accept" | "reject";
  maxSmallFeatureComponents?: number;
}

const SLOT_MODEL: PartSlot[] = [
  "background.style",
  "face.shape",
  "ears.shape",
  "hair.style",
  "eyes.shape",
  "eyebrows.shape",
  "nose.shape",
  "mouth.shape",
  "glasses.shape",
  "facial_hair.style",
  "headwear.type",
  "clothing.top"
];

const SLOT_RULES: Record<PartSlot, SlotRule> = {
  "background.style": { minPixels: 1024, minZoneCoverage: 1, zones: [[0, 0, 32, 32]], empty: "accept" },
  "face.shape": { minPixels: 60, minZoneCoverage: 0.62, zones: [[5, 4, 31, 31]], empty: "reject" },
  "ears.shape": {
    minPixels: 2,
    minZoneCoverage: 0.34,
    zones: [
      [0, 6, 12, 26],
      [25, 6, 32, 26]
    ],
    empty: "reject"
  },
  "hair.style": { minPixels: 18, minZoneCoverage: 0.45, zones: [[0, 0, 32, 32]], empty: "accept" },
  "eyes.shape": { minPixels: 1, minZoneCoverage: 0.45, zones: [[7, 10, 30, 22]], empty: "reject", maxSmallFeatureComponents: 12 },
  "eyebrows.shape": { minPixels: 2, minZoneCoverage: 0.42, zones: [[7, 8, 30, 18]], empty: "reject", maxSmallFeatureComponents: 12 },
  "nose.shape": { minPixels: 1, minZoneCoverage: 0.38, zones: [[12, 11, 30, 26]], empty: "reject", maxSmallFeatureComponents: 12 },
  "mouth.shape": { minPixels: 1, minZoneCoverage: 0.34, zones: [[7, 17, 30, 29]], empty: "reject", maxSmallFeatureComponents: 8 },
  "glasses.shape": { minPixels: 3, minZoneCoverage: 0.42, zones: [[4, 8, 32, 23]], empty: "reject", maxSmallFeatureComponents: 10 },
  "facial_hair.style": { minPixels: 3, minZoneCoverage: 0.4, zones: [[7, 17, 30, 30]], empty: "reject", maxSmallFeatureComponents: 10 },
  "headwear.type": { minPixels: 8, minZoneCoverage: 0.42, zones: [[3, 0, 32, 18]], empty: "reject" },
  "clothing.top": { minPixels: 20, minZoneCoverage: 0.42, zones: [[0, 19, 32, 32]], empty: "accept" }
};

const args = parseArgs(process.argv.slice(2));
const segmentDir = args.segments ?? "datasets/reference/istock-36/segments";
const outDir = args.out ?? "datasets/reference/istock-36/part-traits";
const scale = Number(args.scale ?? 6);

await deriveReferencePartTraits(segmentDir, outDir, scale);

async function deriveReferencePartTraits(segmentDir: string, outDir: string, scale: number) {
  const report = JSON.parse(await readFile(join(segmentDir, "report.json"), "utf8")) as { entries: Array<{ id: string }> };
  const semanticMatrices: PixelMatrix[] = [];
  const generatedMatrices: PixelMatrix[] = [];
  const entries = [];
  const allCandidates: CandidateAsset[] = [];
  const candidatesBySlot = new Map<PartSlot, CandidateAsset[]>();
  for (const slot of SLOT_MODEL) candidatesBySlot.set(slot, []);

  await mkdir(join(outDir, "parts"), { recursive: true });
  await mkdir(join(outDir, "specs"), { recursive: true });
  await mkdir(join(outDir, "generated"), { recursive: true });
  await mkdir(join(outDir, "semantic"), { recursive: true });
  await mkdir(join(outDir, "part-candidates", "assets"), { recursive: true });
  await mkdir(join(outDir, "part-candidates", "slot-sheets"), { recursive: true });

  for (const entry of report.entries) {
    const source = JSON.parse(await readFile(join(segmentDir, `${entry.id}.json`), "utf8")) as SegmentJson;
    const cells = derivePartCells(source);
    const candidates = buildCandidates(source, cells);
    const acceptedSlots = new Set(candidates.filter((candidate) => candidate.status === "accepted").map((candidate) => candidate.slot));
    const acceptedCells = cells.filter((cell) => acceptedSlots.has(cell.slot));
    const spec = partCellsToSpec(source.id, source.background, acceptedCells, acceptedSlots);
    const render = renderAvatar(spec);
    const generated = imageToMatrix(render.image, 32, 32, source.background);
    const semantic = semanticPreview(acceptedCells, source.background);
    const allCounts = countSlots(cells);
    const acceptedCounts = countSlots(acceptedCells);

    generatedMatrices.push(generated);
    semanticMatrices.push(semantic);
    allCandidates.push(...candidates);
    for (const candidate of candidates) candidatesBySlot.get(candidate.slot)?.push(candidate);

    await writeCandidateAssets(outDir, candidates, scale);
    await writeJson(join(outDir, "parts", `${source.id}.json`), {
      id: source.id,
      background: source.background,
      allCounts,
      acceptedCounts,
      candidates: candidates.map(candidateReportEntry),
      parts: groupCells(acceptedCells)
    });
    await writeJson(join(outDir, "specs", `${source.id}.json`), spec);
    await writePng(join(outDir, "generated", `${source.id}.png`), render.image, scale);
    await writePng(join(outDir, "semantic", `${source.id}.png`), matrixToPixelImage(semantic), scale);

    entries.push({
      id: source.id,
      background: source.background,
      allCounts,
      acceptedCounts,
      rejectedCounts: countCandidateStatuses(candidates, "rejected"),
      reviewCounts: countCandidateStatuses(candidates, "review"),
      spec: `specs/${source.id}.json`,
      parts: `parts/${source.id}.json`,
      generated: `generated/${source.id}.png`,
      semantic: `semantic/${source.id}.png`
    });
  }

  for (const slot of SLOT_MODEL) {
    const candidates = candidatesBySlot.get(slot) ?? [];
    const safeSlot = safeSlotName(slot);
    await writePng(
      join(outDir, "part-candidates", "slot-sheets", `${safeSlot}.png`),
      candidateContactSheet(candidates, 6, 32, 32),
      scale
    );
  }

  await writePng(join(outDir, "contact-sheet.png"), matrixContactSheet(generatedMatrices, 6, 32, 32), scale);
  await writePng(join(outDir, "semantic-contact-sheet.png"), matrixContactSheet(semanticMatrices, 6, 32, 32), scale);
  await writeJson(join(outDir, "part-candidates", "report.json"), {
    version: "pix-avatar/reference-part-candidates/v1",
    source: segmentDir,
    canvas: { size: [32, 32] },
    slotModel: SLOT_MODEL,
    rules: SLOT_RULES,
    statusSummary: summarizeCandidates(allCandidates),
    artifacts: {
      assetsDir: "assets",
      slotSheetsDir: "slot-sheets"
    },
    candidates: allCandidates.map(candidateReportEntry)
  });
  await writeJson(join(outDir, "report.json"), {
    version: "pix-avatar/reference-part-traits/v2",
    source: segmentDir,
    canvas: { size: [32, 32] },
    slotModel: SLOT_MODEL,
    method:
      "Derives repo-native trait-slot candidates from coarse reference color segments, reviews each candidate with slot-specific bbox/component/zone checks, and builds final specs only from accepted 32px part assets.",
    artifacts: {
      candidateReport: "part-candidates/report.json",
      candidateSlotSheets: "part-candidates/slot-sheets",
      partSpecs: "specs",
      generatedContactSheet: "contact-sheet.png",
      semanticContactSheet: "semantic-contact-sheet.png"
    },
    statusSummary: summarizeCandidates(allCandidates),
    entries
  });

  console.log(
    JSON.stringify(
      {
        entries: entries.length,
        outDir,
        accepted: allCandidates.filter((candidate) => candidate.status === "accepted").length,
        review: allCandidates.filter((candidate) => candidate.status === "review").length,
        rejected: allCandidates.filter((candidate) => candidate.status === "rejected").length,
        contactSheet: join(outDir, "contact-sheet.png"),
        candidateReport: join(outDir, "part-candidates", "report.json")
      },
      null,
      2
    )
  );
}

function derivePartCells(source: SegmentJson): PartCell[] {
  const cells: PartCell[] = [];
  for (const [segment, segmentCells] of Object.entries(source.segments) as Array<[CoarseSegment, Array<{ x: number; y: number; color: string }>]>) {
    if (segment === "ignored") continue;
    for (const cell of segmentCells) {
      cells.push({ ...cell, color: normalizeHex(cell.color), slot: classifyPartSlot(segment, cell) });
    }
  }
  return cells;
}

function classifyPartSlot(segment: CoarseSegment, cell: { x: number; y: number; color: string }): PartSlot {
  const { x, y } = cell;
  if (segment === "skin") {
    if ((x <= 8 || x >= 28) && y >= 8 && y <= 23) return "ears.shape";
    return "face.shape";
  }
  if (segment === "hair") {
    if (y <= 10 && x >= 11 && x <= 28 && isCapLikeColor(cell.color)) return "headwear.type";
    return "hair.style";
  }
  if (segment === "clothing") return "clothing.top";
  if (segment === "accessory") {
    if (y <= 11) return "headwear.type";
    if (y >= 12 && y <= 19 && x >= 7 && x <= 29) return "glasses.shape";
    if (y >= 20 && y <= 26 && x >= 10 && x <= 26) return "mouth.shape";
    return x <= 8 || x >= 28 ? "ears.shape" : "hair.style";
  }
  if (segment === "face_feature") {
    if (y <= 14) return "eyebrows.shape";
    if (y <= 18) return "eyes.shape";
    if (y <= 23) return "nose.shape";
    return "mouth.shape";
  }
  if (segment === "ink") {
    if (y >= 26) return "clothing.top";
    if (y <= 9) return "hair.style";
    if (y >= 12 && y <= 19 && x >= 7 && x <= 29) return "glasses.shape";
    if (y <= 14 && x >= 9 && x <= 27) return "eyebrows.shape";
    if (y <= 18 && x >= 9 && x <= 27) return "eyes.shape";
    if (y <= 23 && x >= 17 && x <= 27) return "nose.shape";
    if (y >= 20 && y <= 26 && x >= 10 && x <= 27) return "mouth.shape";
    if ((x <= 8 || x >= 28) && y <= 24) return "ears.shape";
    if (y <= 18 || x <= 10 || x >= 27) return "hair.style";
    return "face.shape";
  }
  return "face.shape";
}

function isCapLikeColor(color: string) {
  return color === "#E0F0C0" || color === "#F0E0A0" || color === "#FF80B0" || color === "#302080";
}

function buildCandidates(source: SegmentJson, cells: PartCell[]): CandidateAsset[] {
  return SLOT_MODEL.map((slot) => {
    const slotCells = slot === "background.style" ? backgroundCells(source.background) : cells.filter((cell) => cell.slot === slot);
    const analysis = analyzeCells(slotCells, slot);
    const review = reviewCandidate(slot, analysis);
    return {
      id: `${source.id}__${safeSlotName(slot)}`,
      sourceId: source.id,
      slot,
      background: source.background,
      cells: slotCells,
      status: review.status,
      reasons: review.reasons,
      pixelCount: slotCells.length,
      bbox: analysis.bbox,
      componentCount: analysis.componentCount,
      largestComponentPixels: analysis.largestComponentPixels,
      zoneCoverage: analysis.zoneCoverage
    };
  });
}

function analyzeCells(cells: PartCell[], slot: PartSlot) {
  const bbox = bboxForCells(cells);
  const components = connectedComponents(cells);
  const rule = SLOT_RULES[slot];
  const zoneHits = cells.filter((cell) => rule.zones.some((zone) => pointInBox(cell.x, cell.y, zone))).length;
  return {
    bbox,
    pixelCount: cells.length,
    componentCount: components.length,
    largestComponentPixels: components[0]?.length ?? 0,
    zoneCoverage: cells.length === 0 ? 1 : zoneHits / cells.length
  };
}

function reviewCandidate(slot: PartSlot, analysis: ReturnType<typeof analyzeCells>): { status: CandidateStatus; reasons: string[] } {
  const rule = SLOT_RULES[slot];
  const reasons: string[] = [];
  if (!analysis.bbox) {
    if (rule.empty === "accept") return { status: "accepted", reasons: ["empty slot allowed for this reference"] };
    return { status: "rejected", reasons: ["empty optional slot"] };
  }
  const pixels = analysis.pixelCount;
  if (pixels < rule.minPixels) reasons.push(`too few pixels for ${slot}: ${pixels} < ${rule.minPixels}`);
  if (analysis.zoneCoverage < rule.minZoneCoverage) reasons.push(`low zone coverage for ${slot}: ${round(analysis.zoneCoverage)} < ${rule.minZoneCoverage}`);
  if (rule.maxSmallFeatureComponents && analysis.componentCount > rule.maxSmallFeatureComponents) {
    reasons.push(`too many disconnected components for ${slot}: ${analysis.componentCount} > ${rule.maxSmallFeatureComponents}`);
  }

  if (slot === "headwear.type" && pixels < rule.minPixels) return { status: "rejected", reasons };
  if (slot === "glasses.shape" && pixels < rule.minPixels) return { status: "rejected", reasons };
  if (slot === "facial_hair.style" && pixels < rule.minPixels) return { status: "rejected", reasons };
  if (slot === "ears.shape" && pixels < rule.minPixels) return { status: "rejected", reasons };
  if (slot === "hair.style" && pixels < rule.minPixels) return { status: "rejected", reasons };
  if (slot === "nose.shape" && analysis.zoneCoverage < rule.minZoneCoverage) return { status: "rejected", reasons };
  if (slot === "clothing.top" && pixels >= 8 && analysis.zoneCoverage >= rule.minZoneCoverage) {
    return { status: "accepted", reasons: ["small but coherent lower-body crop"] };
  }
  if (reasons.length === 0) return { status: "accepted", reasons: ["passes slot review"] };
  return { status: "review", reasons };
}

function partCellsToSpec(id: string, background: string, cells: PartCell[], acceptedSlots: Set<PartSlot>): AvatarSpec {
  const traits: TraitMap = {
    "background.style": `reference_${id}`,
    "face.shape": acceptedSlots.has("face.shape") ? `reference_${id}` : "side_oval",
    "ears.shape": acceptedSlots.has("ears.shape") ? `reference_${id}` : "none",
    "hair.style": acceptedSlots.has("hair.style") ? `reference_${id}` : "bald_clean",
    "eyes.shape": acceptedSlots.has("eyes.shape") ? `reference_${id}` : "dot",
    "eyebrows.shape": acceptedSlots.has("eyebrows.shape") ? `reference_${id}` : "soft_flat",
    "nose.shape": acceptedSlots.has("nose.shape") ? `reference_${id}` : "single_pixel",
    "mouth.shape": acceptedSlots.has("mouth.shape") ? `reference_${id}` : "neutral",
    "glasses.shape": acceptedSlots.has("glasses.shape") ? `reference_${id}` : "none",
    "facial_hair.style": acceptedSlots.has("facial_hair.style") ? `reference_${id}` : "none",
    "headwear.type": acceptedSlots.has("headwear.type") ? `reference_${id}` : "none",
    "clothing.top": acceptedSlots.has("clothing.top") ? `reference_${id}` : "tshirt",
    "face.detail": "none"
  };
  const spec = createDefaultSpec(traits);
  spec.seed = `reference-part-trait-${id}`;
  spec.patches = [
    { op: "rect", layer: layerForSlot("background.style"), coordSpace: "output", x: 0, y: 0, w: 32, h: 32, color: background },
    ...runsToPatches(cells)
  ];
  return spec;
}

function runsToPatches(cells: PartCell[]): PixelPatch[] {
  const patches: PixelPatch[] = [];
  const byLayer = new Map<string, PartCell[]>();
  for (const cell of cells) {
    const layer = layerForSlot(cell.slot);
    const bucket = byLayer.get(layer) ?? [];
    bucket.push(cell);
    byLayer.set(layer, bucket);
  }
  for (const [layer, layerCells] of byLayer) {
    const rows = new Map<number, PartCell[]>();
    for (const cell of layerCells) {
      const row = rows.get(cell.y) ?? [];
      row.push(cell);
      rows.set(cell.y, row);
    }
    for (const [y, row] of rows) {
      row.sort((a, b) => a.x - b.x || a.color.localeCompare(b.color));
      let start: PartCell | undefined;
      let previous: PartCell | undefined;
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

async function writeCandidateAssets(outDir: string, candidates: CandidateAsset[], scale: number) {
  for (const candidate of candidates) {
    const safeSlot = safeSlotName(candidate.slot);
    await writePng(
      join(outDir, "part-candidates", "assets", safeSlot, `${candidate.sourceId}.png`),
      matrixToPixelImage(candidateAssetMatrix(candidate)),
      scale
    );
  }
}

function candidateAssetMatrix(candidate: CandidateAsset): PixelMatrix {
  if (candidate.slot === "background.style") return Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => candidate.background));
  const matrix = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => TRANSPARENT_PIXEL));
  for (const cell of candidate.cells) matrix[cell.y][cell.x] = candidate.status === "rejected" ? softenRejectedColor(cell.color) : cell.color;
  return matrix;
}

function candidatePreviewMatrix(candidate: CandidateAsset): PixelMatrix {
  const matrix = checkerMatrix(32, 32);
  if (candidate.slot === "background.style") {
    for (let y = 0; y < 32; y += 1) {
      for (let x = 0; x < 32; x += 1) matrix[y][x] = candidate.background;
    }
    return matrix;
  }
  for (const cell of candidate.cells) matrix[cell.y][cell.x] = candidate.status === "rejected" ? softenRejectedColor(cell.color) : cell.color;
  return matrix;
}

function candidateContactSheet(candidates: CandidateAsset[], columns: number, tileWidth: number, tileHeight: number): PixelImage {
  const rows = Math.ceil(candidates.length / columns);
  const gutter = 1;
  const border = 1;
  const framedWidth = tileWidth + border * 2;
  const framedHeight = tileHeight + border * 2;
  const width = columns * framedWidth + (columns - 1) * gutter;
  const height = rows * framedHeight + (rows - 1) * gutter;
  const output = Array.from({ length: height }, () => Array.from({ length: width }, () => "#FFFFFF"));
  for (const [index, candidate] of candidates.entries()) {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const ox = col * (framedWidth + gutter);
    const oy = row * (framedHeight + gutter);
    const borderColor = statusColor(candidate.status);
    for (let y = 0; y < framedHeight; y += 1) {
      for (let x = 0; x < framedWidth; x += 1) output[oy + y][ox + x] = borderColor;
    }
    const matrix = candidatePreviewMatrix(candidate);
    for (let y = 0; y < tileHeight; y += 1) {
      for (let x = 0; x < tileWidth; x += 1) output[oy + border + y][ox + border + x] = matrix[y][x];
    }
  }
  return matrixToPixelImage(output);
}

function semanticPreview(cells: PartCell[], background: string): PixelMatrix {
  const matrix = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => background));
  for (const cell of cells) matrix[cell.y][cell.x] = colorForSlot(cell.slot);
  return matrix;
}

function colorForSlot(slot: PartSlot) {
  const colors: Record<PartSlot, string> = {
    "background.style": "#FFFFFF",
    "face.shape": "#F2C6A8",
    "ears.shape": "#F49A7D",
    "hair.style": "#5B2C83",
    "eyes.shape": "#111111",
    "eyebrows.shape": "#6B4F1D",
    "nose.shape": "#B65C2E",
    "mouth.shape": "#E25555",
    "glasses.shape": "#56CCF2",
    "facial_hair.style": "#333333",
    "headwear.type": "#F2C94C",
    "clothing.top": "#2F80ED"
  };
  return colors[slot];
}

function countSlots(cells: PartCell[]) {
  const counts: Record<string, number> = {};
  for (const cell of cells) counts[cell.slot] = (counts[cell.slot] ?? 0) + 1;
  return counts;
}

function countCandidateStatuses(candidates: CandidateAsset[], status: CandidateStatus) {
  const counts: Record<string, number> = {};
  for (const candidate of candidates) {
    if (candidate.status !== status) continue;
    counts[candidate.slot] = (counts[candidate.slot] ?? 0) + 1;
  }
  return counts;
}

function groupCells(cells: PartCell[]) {
  const grouped: Record<string, Array<{ x: number; y: number; color: string }>> = {};
  for (const cell of cells) {
    const group = grouped[cell.slot] ?? [];
    group.push({ x: cell.x, y: cell.y, color: cell.color });
    grouped[cell.slot] = group;
  }
  return Object.fromEntries(Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)));
}

function summarizeCandidates(candidates: CandidateAsset[]) {
  const summary: Record<string, Record<CandidateStatus, number>> = {};
  for (const slot of SLOT_MODEL) summary[slot] = { accepted: 0, review: 0, rejected: 0 };
  for (const candidate of candidates) summary[candidate.slot][candidate.status] += 1;
  return summary;
}

function candidateReportEntry(candidate: CandidateAsset) {
  const safeSlot = safeSlotName(candidate.slot);
  return {
    id: candidate.id,
    sourceId: candidate.sourceId,
    slot: candidate.slot,
    status: candidate.status,
    reasons: candidate.reasons,
    pixelCount: candidate.pixelCount,
    bbox: candidate.bbox,
    componentCount: candidate.componentCount,
    largestComponentPixels: candidate.largestComponentPixels,
    zoneCoverage: round(candidate.zoneCoverage),
    asset: `part-candidates/assets/${safeSlot}/${candidate.sourceId}.png`,
    slotSheet: `part-candidates/slot-sheets/${safeSlot}.png`
  };
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

function backgroundCells(background: string): PartCell[] {
  const cells: PartCell[] = [];
  for (let y = 0; y < 32; y += 1) {
    for (let x = 0; x < 32; x += 1) cells.push({ x, y, color: background, slot: "background.style" });
  }
  return cells;
}

function bboxForCells(cells: PartCell[]): Box | undefined {
  if (cells.length === 0) return undefined;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const cell of cells) {
    minX = Math.min(minX, cell.x);
    minY = Math.min(minY, cell.y);
    maxX = Math.max(maxX, cell.x);
    maxY = Math.max(maxY, cell.y);
  }
  return [minX, minY, maxX + 1, maxY + 1];
}

function connectedComponents(cells: PartCell[]) {
  const byKey = new Map(cells.map((cell) => [keyOf(cell.x, cell.y), cell]));
  const seen = new Set<string>();
  const components: PartCell[][] = [];
  for (const cell of cells) {
    const start = keyOf(cell.x, cell.y);
    if (seen.has(start)) continue;
    const queue = [cell];
    const component: PartCell[] = [];
    seen.add(start);
    while (queue.length) {
      const current = queue.shift();
      if (!current) continue;
      component.push(current);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ]) {
        const nextKey = keyOf(current.x + dx, current.y + dy);
        const next = byKey.get(nextKey);
        if (!next || seen.has(nextKey)) continue;
        seen.add(nextKey);
        queue.push(next);
      }
    }
    components.push(component);
  }
  return components.sort((a, b) => b.length - a.length);
}

function pointInBox(x: number, y: number, box: Box) {
  return x >= box[0] && x < box[2] && y >= box[1] && y < box[3];
}

function checkerMatrix(width: number, height: number): PixelMatrix {
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => (((Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0 ? "#F7F7F7" : "#E7E7E7")))
  );
}

function statusColor(status: CandidateStatus) {
  if (status === "accepted") return "#27AE60";
  if (status === "review") return "#F2C94C";
  return "#EB5757";
}

function softenRejectedColor(color: string) {
  return color === TRANSPARENT_PIXEL ? color : "#BDBDBD";
}

function safeSlotName(slot: PartSlot) {
  return slot.replace(/\./g, "__");
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
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
