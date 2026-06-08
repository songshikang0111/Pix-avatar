import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { PNG } from "pngjs";
import { createEmptyManualTemplate, manualTemplateToSpec, ManualTraitPixel, ManualTraitTemplate } from "../core/manualTraitTemplate";
import { hexToRgb, normalizeHex } from "../core/color";
import { keyOf } from "../core/geometry";
import { pixelImageToMatrix, PixelMatrix, TRANSPARENT_PIXEL } from "../core/pixelMatrix";
import { renderAvatar } from "../core/render";
import { writePng } from "../node/png";
import { AvatarSpec, PixelImage } from "../types";

type SegmentName = "background" | "skin" | "hair" | "clothing" | "accessory" | "face_feature" | "ink" | "ignored";
type ThreeSlot = "face.shape" | "hair.style" | "clothing.top";

interface SegmentJson {
  id: string;
  background: string;
  segments: Partial<Record<SegmentName, ManualTraitPixel[]>>;
}

interface ManifestEntry {
  id: string;
  matrix: string;
  background: string;
}

interface Manifest {
  id: string;
  canvas: { size: [number, number] };
  entries: ManifestEntry[];
}

interface PartJson {
  parts?: Partial<Record<string, ManualTraitPixel[]>>;
}

interface ThreePartAssetSet {
  id: string;
  background: string;
  skinColor: string;
  outlineColor: string;
  template: ManualTraitTemplate;
  referenceMatrix: PixelMatrix;
  layers: Record<ThreeSlot, ManualTraitPixel[]>;
}

const args = parseArgs(process.argv.slice(2));
const datasetDir = args.dataset ?? "datasets/reference/istock-36";
const outDir = args.out ?? join(datasetDir, "manual-traits-3part");
const count = Number(args.count ?? 5);
const scale = Number(args.scale ?? 8);

await buildThreePartReferenceTraits(datasetDir, outDir, count, scale);

async function buildThreePartReferenceTraits(datasetDir: string, outDir: string, count: number, scale: number) {
  const manifest = JSON.parse(await readFile(join(datasetDir, "manifest.json"), "utf8")) as Manifest;
  const entries = manifest.entries.slice(0, count);
  const assets: ThreePartAssetSet[] = [];

  await mkdir(outDir, { recursive: true });
  await mkdir(join(outDir, "templates"), { recursive: true });
  await mkdir(join(outDir, "specs"), { recursive: true });
  await mkdir(join(outDir, "generated"), { recursive: true });
  await mkdir(join(outDir, "diffs"), { recursive: true });
  await mkdir(join(outDir, "asset-previews"), { recursive: true });
  await mkdir(join(outDir, "stack-previews"), { recursive: true });

  for (const entry of entries) {
    const reference = JSON.parse(await readFile(join(datasetDir, entry.matrix), "utf8")) as { matrix: PixelMatrix };
    const segment = JSON.parse(await readFile(join(datasetDir, "segments", `${entry.id}.json`), "utf8")) as SegmentJson;
    const part = JSON.parse(await readFile(join(datasetDir, "part-traits", "parts", `${entry.id}.json`), "utf8")) as PartJson;
    const asset = buildAssetSet(entry.id, normalizeHex(entry.background), reference.matrix, segment, part);
    const spec = manualTemplateToSpec(asset.template);
    const rendered = renderAvatar(spec);
    const generated = pixelImageToMatrix(rendered.image, asset.background);
    const diff = compareMatrices(generated, reference.matrix, asset.background);

    assets.push(asset);

    await writeJson(join(outDir, "templates", `${entry.id}.manual-traits.json`), asset.template);
    await writeJson(join(outDir, "specs", `${entry.id}.json`), spec);
    await writePng(join(outDir, "generated", `${entry.id}.png`), rendered.image, scale);
    await writePng(join(outDir, "diffs", `${entry.id}.png`), matrixToPixelImage(diff.matrix), scale);
    await writeJson(join(outDir, "diffs", `${entry.id}.json`), diff.report);

    const assetDir = join(outDir, "asset-previews", entry.id);
    await mkdir(assetDir, { recursive: true });
    await writePng(join(assetDir, "01-face.png"), checkerPreview(asset.layers["face.shape"]), scale);
    await writePng(join(assetDir, "02-clothing.png"), checkerPreview(asset.layers["clothing.top"]), scale);
    await writePng(join(assetDir, "03-hair.png"), checkerPreview(asset.layers["hair.style"]), scale);
    await writePng(join(assetDir, "contact-sheet.png"), matrixContactSheet([imageToMatrix(checkerPreview(asset.layers["face.shape"], 1), 32, 32), imageToMatrix(checkerPreview(asset.layers["clothing.top"], 1), 32, 32), imageToMatrix(checkerPreview(asset.layers["hair.style"], 1), 32, 32)], 3, 32, 32, "#F4F7FA"), scale);
    await writeJson(join(assetDir, "summary.json"), {
      id: entry.id,
      skinColor: asset.skinColor,
      outlineColor: asset.outlineColor,
      slots: {
        "face.shape": summarizePixels(asset.layers["face.shape"]),
        "clothing.top": summarizePixels(asset.layers["clothing.top"]),
        "hair.style": summarizePixels(asset.layers["hair.style"])
      }
    });

    await writePng(join(outDir, "stack-previews", `${entry.id}.png`), comparisonPanel(reference.matrix, generated, diff.matrix, asset.background), scale);
  }

  await writePng(join(outDir, "asset-contact-sheet.png"), assetContactSheet(assets), scale);
  await writePng(join(outDir, "stack-contact-sheet.png"), stackContactSheet(assets), scale);

  const cross = await buildCrossCombinations(assets, outDir, scale);
  const aggregate = {
    version: "pix-avatar/three-part-reference-traits/v1",
    source: datasetDir,
    canvas: { size: [32, 32] },
    entries: assets.map((asset) => ({
      id: asset.id,
      background: asset.background,
      skinColor: asset.skinColor,
      outlineColor: asset.outlineColor,
      template: `templates/${asset.id}.manual-traits.json`,
      generated: `generated/${asset.id}.png`,
      stackPreview: `stack-previews/${asset.id}.png`,
      assets: `asset-previews/${asset.id}`,
      counts: {
        face: asset.layers["face.shape"].length,
        clothing: asset.layers["clothing.top"].length,
        hair: asset.layers["hair.style"].length
      }
    })),
    reconstruction: {
      reports: "diffs/*.json",
      aggregateDiffRate: 0
    },
    cross,
    layerHygiene: assets.map((asset) => ({
      id: asset.id,
      hairCentralFaceLeakagePixels: countHairCentralFaceLeakage(asset.layers["hair.style"], asset.skinColor),
      clothingFaceShadowLeakagePixels: countClothingFaceShadowLeakage(asset.layers["clothing.top"])
    }))
  };

  const diffReports = await Promise.all(assets.map((asset) => readJson(join(outDir, "diffs", `${asset.id}.json`)) as Promise<{ diffRate: number; diffPixels: number; scoredPixels: number }>));
  aggregate.reconstruction.aggregateDiffRate = diffReports.reduce((sum, report) => sum + report.diffPixels, 0) / Math.max(1, diffReports.reduce((sum, report) => sum + report.scoredPixels, 0));
  await writeJson(join(outDir, "report.json"), aggregate);

  console.log(
    JSON.stringify(
      {
        outDir,
        entries: assets.length,
        aggregateDiffRate: aggregate.reconstruction.aggregateDiffRate,
        crossCombinations: cross.combinations,
        crossContactSheet: cross.contactSheet
      },
      null,
      2
    )
  );
}

function buildAssetSet(id: string, background: string, referenceMatrix: PixelMatrix, segment: SegmentJson, part: PartJson): ThreePartAssetSet {
  const segmentByKey = segmentMap(segment);
  const partsBySlot = part.parts ?? {};
  const hairKeys = keySet([...(partsBySlot["hair.style"] ?? []), ...(partsBySlot["headwear.type"] ?? [])]);
  const clothingKeys = keySet(partsBySlot["clothing.top"] ?? []);
  const faceKeys = keySet([
    ...(partsBySlot["face.shape"] ?? []),
    ...(partsBySlot["ears.shape"] ?? []),
    ...(partsBySlot["eyes.shape"] ?? []),
    ...(partsBySlot["eyebrows.shape"] ?? []),
    ...(partsBySlot["nose.shape"] ?? []),
    ...(partsBySlot["mouth.shape"] ?? []),
    ...(partsBySlot["glasses.shape"] ?? []),
    ...(partsBySlot["facial_hair.style"] ?? [])
  ]);
  const skinColor = dominantColor(segment.segments.skin ?? [], "#F0F0E0");
  const outlineColor = dominantDarkColor(referenceMatrix, background);
  const characterKeys = new Set<string>();
  const assigned = new Map<string, ThreeSlot>();

  for (let y = 0; y < 32; y += 1) {
    for (let x = 0; x < 32; x += 1) {
      const color = normalizeHex(referenceMatrix[y][x]);
      if (color === background || color === TRANSPARENT_PIXEL) continue;
      const key = keyOf(x, y);
      characterKeys.add(key);
      const segmentName = segmentByKey.get(key);
      if (isFaceProtectedPixel(color, x, y, skinColor, segmentName, faceKeys.has(key))) {
        assigned.set(key, "face.shape");
      } else if (isHairPixel(color, x, y, skinColor, segmentName, hairKeys.has(key))) {
        assigned.set(key, "hair.style");
      } else if (isClothingPixel(color, x, y, skinColor, segmentName, clothingKeys.has(key))) {
        assigned.set(key, "clothing.top");
      } else if (segmentName === "ink" || segmentName === "accessory") {
        assigned.set(key, "face.shape");
      } else {
        assigned.set(key, y >= 28 && !isSkinLike(color, skinColor) ? "clothing.top" : "face.shape");
      }
    }
  }

  promoteAdjacentHairOutlines(referenceMatrix, assigned, skinColor);

  const layers: Record<ThreeSlot, ManualTraitPixel[]> = {
    "face.shape": [],
    "hair.style": [],
    "clothing.top": []
  };

  for (let y = 0; y < 32; y += 1) {
    for (let x = 0; x < 32; x += 1) {
      const key = keyOf(x, y);
      const slot = assigned.get(key);
      if (!slot) continue;
      const color = normalizeHex(referenceMatrix[y][x]);
      if (slot === "hair.style") {
        layers["hair.style"].push({ x, y, color });
        layers["face.shape"].push({ x, y, color: baseBodyColor(x, y, characterKeys, skinColor, outlineColor) });
      } else if (slot === "clothing.top") {
        layers["clothing.top"].push({ x, y, color });
        layers["face.shape"].push({ x, y, color: baseBodyColor(x, y, characterKeys, skinColor, outlineColor) });
      } else {
        layers["face.shape"].push({ x, y, color });
      }
    }
  }

  const template = createEmptyManualTemplate(`three-part-${id}`);
  template.reference = { id, opacity: 0.45 };
  template.createdAt = new Date().toISOString();
  for (const layer of template.layers) {
    if (layer.slot === "background.style") {
      layer.pixels = fillBackground(background);
    } else if (layer.slot === "face.shape" || layer.slot === "hair.style" || layer.slot === "clothing.top") {
      layer.pixels = mergePixels(layers[layer.slot]);
    } else {
      layer.pixels = [];
    }
  }

  return {
    id,
    background,
    skinColor,
    outlineColor,
    template,
    referenceMatrix,
    layers: {
      "face.shape": mergePixels(layers["face.shape"]),
      "hair.style": mergePixels(layers["hair.style"]),
      "clothing.top": mergePixels(layers["clothing.top"])
    }
  };
}

async function buildCrossCombinations(assets: ThreePartAssetSet[], outDir: string, scale: number) {
  const crossDir = join(outDir, "cross-combinations");
  await mkdir(join(crossDir, "generated"), { recursive: true });
  await mkdir(join(crossDir, "specs"), { recursive: true });
  const matrices: PixelMatrix[] = [];
  const entries = [];

  for (const face of assets) {
    for (const hair of assets) {
      for (const clothing of assets) {
        const id = `face-${face.id}__hair-${hair.id}__clothing-${clothing.id}`;
        const template = createEmptyManualTemplate(`three-part-cross-${id}`);
        template.reference = { id: face.id, opacity: 0.45 };
        for (const layer of template.layers) {
          if (layer.slot === "background.style") layer.pixels = fillBackground(face.background);
          else if (layer.slot === "face.shape") layer.pixels = face.layers["face.shape"];
          else if (layer.slot === "hair.style") layer.pixels = hair.layers["hair.style"];
          else if (layer.slot === "clothing.top") layer.pixels = clothing.layers["clothing.top"];
          else layer.pixels = [];
        }
        const spec = manualTemplateToSpec(template);
        const rendered = renderAvatar(spec);
        const matrix = pixelImageToMatrix(rendered.image, face.background);
        const character = countNonBackground(matrix, face.background);
        const bbox = matrixBbox(matrix, face.background);
        matrices.push(matrix);
        await writeJson(join(crossDir, "specs", `${id}.json`), spec);
        await writePng(join(crossDir, "generated", `${id}.png`), rendered.image, scale);
        entries.push({ id, face: face.id, hair: hair.id, clothing: clothing.id, generated: `generated/${id}.png`, spec: `specs/${id}.json`, characterPixels: character, bbox });
      }
    }
  }

  await writePng(join(crossDir, "contact-sheet.png"), matrixContactSheet(matrices, 25, 32, 32, "#F4F7FA"), scale);
  await writeJson(join(crossDir, "report.json"), {
    version: "pix-avatar/three-part-cross-combinations/v1",
    combinations: entries.length,
    layout: "Rows are face assets. Within each row, columns are grouped as hair 01-05 x clothing 01-05.",
    entries
  });
  return {
    combinations: entries.length,
    contactSheet: "cross-combinations/contact-sheet.png",
    report: "cross-combinations/report.json",
    characterPixels: {
      min: Math.min(...entries.map((entry) => entry.characterPixels)),
      max: Math.max(...entries.map((entry) => entry.characterPixels)),
      average: average(entries.map((entry) => entry.characterPixels))
    }
  };
}

function isFaceProtectedPixel(color: string, x: number, y: number, skinColor: string, segmentName: SegmentName | undefined, isFaceKey: boolean) {
  if (segmentName === "skin" || segmentName === "face_feature") return true;
  if (isSkinLike(color, skinColor) && isHeadAndNeckZone(x, y)) return true;
  if (isLowSaturationFaceFill(color) && isCentralFaceFillZone(x, y)) return true;
  if (isDarkColor(color) && isFacialInkZone(x, y)) return true;
  if ((segmentName === "accessory" || isFaceKey) && !isLikelyColoredHairPixel(color, x, y, skinColor)) return true;
  if (segmentName === "ink" && !isTorsoInkZone(x, y)) return true;
  return false;
}

function isHairPixel(color: string, x: number, y: number, skinColor: string, segmentName: SegmentName | undefined, isHairKey: boolean) {
  if (isTopHeadAccessory(segmentName, x, y)) return true;
  if (isSideHairAccessory(color, x, y, skinColor)) return true;
  if (!(isHairKey || segmentName === "hair")) return false;
  if (isSkinLike(color, skinColor)) return false;
  return isHairOverlayZone(x, y) || isLikelyHairColor(color, skinColor);
}

function isClothingPixel(color: string, x: number, y: number, skinColor: string, segmentName: SegmentName | undefined, isClothingKey: boolean) {
  if (isSkinLike(color, skinColor)) return false;
  if (segmentName === "clothing" || isClothingKey) return isTorsoZone(x, y) || !isHeadAndNeckZone(x, y);
  if (segmentName === "ink") return isTorsoInkZone(x, y);
  return y >= 28 && !isHeadAndNeckZone(x, y);
}

function isTopHeadAccessory(segmentName: SegmentName | undefined, x: number, y: number) {
  return (segmentName === "accessory" || segmentName === "ink") && (y <= 11 || (y <= 17 && (x <= 9 || x >= 23)));
}

function isSideHairAccessory(color: string, x: number, y: number, skinColor: string) {
  if (isSkinLike(color, skinColor)) return false;
  const [r, g, b] = hexToRgb(normalizeHex(color));
  const pinkHair = r > 180 && b > 110 && g < 180;
  const saturatedProp = Math.max(r, g, b) - Math.min(r, g, b) > 95 && y <= 29;
  return (pinkHair || saturatedProp) && (x <= 11 || x >= 22 || y <= 16);
}

function promoteAdjacentHairOutlines(matrix: PixelMatrix, assigned: Map<string, ThreeSlot>, skinColor: string) {
  for (let pass = 0; pass < 3; pass += 1) {
    const promote: string[] = [];
    for (const [key, slot] of assigned) {
      if (slot !== "clothing.top") continue;
      const [x, y] = key.split(",").map(Number);
      const color = normalizeHex(matrix[y][x]);
      if (isSkinLike(color, skinColor)) continue;
      if (isFacialInkZone(x, y)) continue;
      const [r, g, b] = hexToRgb(color);
      const dark = luminance(r, g, b) < 95;
      const sideLowerHairZone = x <= 10 || x >= 21 || y <= 18;
      if (!dark || !sideLowerHairZone) continue;
      if (neighbors(x, y).some(([xx, yy]) => assigned.get(keyOf(xx, yy)) === "hair.style")) promote.push(key);
    }
    if (!promote.length) return;
    for (const key of promote) assigned.set(key, "hair.style");
  }
}

function neighbors(x: number, y: number) {
  return [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1]
  ].filter(([xx, yy]) => xx >= 0 && xx < 32 && yy >= 0 && yy < 32);
}

function isHeadAndNeckZone(x: number, y: number) {
  return (x >= 4 && x <= 27 && y >= 7 && y <= 27) || (x >= 9 && x <= 22 && y <= 29);
}

function isCentralFaceFillZone(x: number, y: number) {
  return x >= 8 && x <= 23 && y >= 14 && y <= 25;
}

function isFacialInkZone(x: number, y: number) {
  return (x >= 10 && x <= 22 && y >= 14 && y <= 27) || (x >= 8 && x <= 24 && y >= 20 && y <= 27);
}

function isHairOverlayZone(x: number, y: number) {
  return y <= 17 || x <= 10 || x >= 22 || (y <= 25 && (x <= 12 || x >= 20));
}

function isTorsoZone(x: number, y: number) {
  return y >= 28 || (y >= 25 && (x <= 7 || x >= 24)) || (y >= 26 && (x <= 9 || x >= 22));
}

function isTorsoInkZone(x: number, y: number) {
  return y >= 28 || (y >= 26 && (x <= 8 || x >= 23));
}

function isLowSaturationFaceFill(color: string) {
  const [r, g, b] = hexToRgb(normalizeHex(color));
  return luminance(r, g, b) > 145 && Math.max(r, g, b) - Math.min(r, g, b) < 55;
}

function isDarkColor(color: string) {
  const [r, g, b] = hexToRgb(normalizeHex(color));
  return luminance(r, g, b) < 105;
}

function isLikelyColoredHairPixel(color: string, x: number, y: number, skinColor: string) {
  if (isSkinLike(color, skinColor)) return false;
  const [r, g, b] = hexToRgb(normalizeHex(color));
  const saturation = Math.max(r, g, b) - Math.min(r, g, b);
  return saturation > 80 && (x <= 11 || x >= 21 || y <= 16);
}

function isLikelyHairColor(color: string, skinColor: string) {
  if (isSkinLike(color, skinColor)) return false;
  const [r, g, b] = hexToRgb(normalizeHex(color));
  return luminance(r, g, b) < 95 || Math.max(r, g, b) - Math.min(r, g, b) > 75;
}

function baseBodyColor(x: number, y: number, characterKeys: Set<string>, skinColor: string, outlineColor: string) {
  return isOuterBoundary(x, y, characterKeys) ? outlineColor : skinColor;
}

function isOuterBoundary(x: number, y: number, characterKeys: Set<string>) {
  const neighbors = [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1]
  ];
  return neighbors.some(([xx, yy]) => xx < 0 || xx >= 32 || yy < 0 || yy >= 32 || !characterKeys.has(keyOf(xx, yy)));
}

function compareMatrices(generated: PixelMatrix, reference: PixelMatrix, background: string) {
  let diffPixels = 0;
  const diff = blankMatrix(background);
  const mismatches = [];
  for (let y = 0; y < 32; y += 1) {
    for (let x = 0; x < 32; x += 1) {
      const a = normalizeHex(generated[y][x]);
      const b = normalizeHex(reference[y][x]);
      if (a === b) {
        diff[y][x] = background;
      } else {
        diffPixels += 1;
        diff[y][x] = "#FF3366";
        if (mismatches.length < 50) mismatches.push({ x, y, generated: a, reference: b });
      }
    }
  }
  return {
    matrix: diff,
    report: {
      scoredPixels: 1024,
      diffPixels,
      diffRate: diffPixels / 1024,
      mismatches
    }
  };
}

function checkerPreview(pixels: ManualTraitPixel[], previewScale = 1): PixelImage {
  const image: PixelImage = { width: 32 * previewScale, height: 32 * previewScale, pixels: new Map(), stacks: new Map() };
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const cellX = Math.floor(x / previewScale);
      const cellY = Math.floor(y / previewScale);
      const color = (Math.floor(cellX / 2) + Math.floor(cellY / 2)) % 2 === 0 ? "#EEEEEE" : "#D8D8D8";
      image.pixels.set(keyOf(x, y), { x, y, color, meta: { layer: "checker" } });
    }
  }
  for (const pixel of pixels) {
    for (let yy = pixel.y * previewScale; yy < (pixel.y + 1) * previewScale; yy += 1) {
      for (let xx = pixel.x * previewScale; xx < (pixel.x + 1) * previewScale; xx += 1) image.pixels.set(keyOf(xx, yy), { x: xx, y: yy, color: pixel.color, meta: { layer: "asset" } });
    }
  }
  return image;
}

function comparisonPanel(reference: PixelMatrix, generated: PixelMatrix, diff: PixelMatrix, background: string): PixelImage {
  const gap = 2;
  const output = blankMatrix("#F4F7FA", 32 * 3 + gap * 2, 32);
  paste(output, reference, 0, 0);
  paste(output, generated, 32 + gap, 0);
  paste(output, diff, 64 + gap * 2, 0);
  return matrixToPixelImage(output, background);
}

function assetContactSheet(assets: ThreePartAssetSet[]) {
  const matrices: PixelMatrix[] = [];
  for (const asset of assets) {
    matrices.push(imageToMatrix(checkerPreview(asset.layers["face.shape"], 1), 32, 32));
    matrices.push(imageToMatrix(checkerPreview(asset.layers["clothing.top"], 1), 32, 32));
    matrices.push(imageToMatrix(checkerPreview(asset.layers["hair.style"], 1), 32, 32));
  }
  return matrixContactSheet(matrices, 3, 32, 32, "#F4F7FA");
}

function stackContactSheet(assets: ThreePartAssetSet[]) {
  const matrices: PixelMatrix[] = [];
  for (const asset of assets) {
    const generated = pixelImageToMatrix(renderAvatar(manualTemplateToSpec(asset.template)).image, asset.background);
    matrices.push(asset.referenceMatrix, generated);
  }
  return matrixContactSheet(matrices, 2, 32, 32, "#F4F7FA");
}

function matrixContactSheet(matrices: PixelMatrix[], columns: number, tileWidth: number, tileHeight: number, background: string): PixelImage {
  const gap = 2;
  const rows = Math.ceil(matrices.length / columns);
  const output = blankMatrix(background, columns * tileWidth + (columns - 1) * gap, rows * tileHeight + (rows - 1) * gap);
  for (let i = 0; i < matrices.length; i += 1) {
    const x = (i % columns) * (tileWidth + gap);
    const y = Math.floor(i / columns) * (tileHeight + gap);
    paste(output, matrices[i], x, y);
  }
  return matrixToPixelImage(output, background);
}

function matrixToPixelImage(matrix: PixelMatrix, fill = TRANSPARENT_PIXEL): PixelImage {
  const pixels = new Map<string, { x: number; y: number; color: string; meta: { layer: string } }>();
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      const color = matrix[y][x] ?? fill;
      if (color !== TRANSPARENT_PIXEL) pixels.set(keyOf(x, y), { x, y, color, meta: { layer: "matrix" } });
    }
  }
  return { width: matrix[0]?.length ?? 0, height: matrix.length, pixels, stacks: new Map() };
}

function imageToMatrix(image: PixelImage, width: number, height: number, fill = TRANSPARENT_PIXEL): PixelMatrix {
  const matrix = blankMatrix(fill, width, height);
  for (const cell of image.pixels.values()) matrix[cell.y][cell.x] = cell.color;
  return matrix;
}

function paste(target: PixelMatrix, source: PixelMatrix, x0: number, y0: number) {
  for (let y = 0; y < source.length; y += 1) {
    for (let x = 0; x < source[y].length; x += 1) {
      if (source[y][x] !== TRANSPARENT_PIXEL) target[y0 + y][x0 + x] = source[y][x];
    }
  }
}

function blankMatrix(color: string, width = 32, height = 32): PixelMatrix {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => color));
}

function fillBackground(background: string): ManualTraitPixel[] {
  const pixels: ManualTraitPixel[] = [];
  for (let y = 0; y < 32; y += 1) {
    for (let x = 0; x < 32; x += 1) pixels.push({ x, y, color: background });
  }
  return pixels;
}

function mergePixels(pixels: ManualTraitPixel[]) {
  const map = new Map<string, ManualTraitPixel>();
  for (const pixel of pixels) map.set(keyOf(pixel.x, pixel.y), { x: pixel.x, y: pixel.y, color: normalizeHex(pixel.color) });
  return [...map.values()].sort((a, b) => a.y - b.y || a.x - b.x || a.color.localeCompare(b.color));
}

function segmentMap(segment: SegmentJson) {
  const map = new Map<string, SegmentName>();
  for (const [name, pixels] of Object.entries(segment.segments) as Array<[SegmentName, ManualTraitPixel[]]>) {
    for (const pixel of pixels ?? []) map.set(keyOf(pixel.x, pixel.y), name);
  }
  return map;
}

function keySet(pixels: ManualTraitPixel[]) {
  return new Set(pixels.map((pixel) => keyOf(pixel.x, pixel.y)));
}

function dominantColor(pixels: ManualTraitPixel[], fallback: string) {
  const counts = new Map<string, number>();
  for (const pixel of pixels) counts.set(normalizeHex(pixel.color), (counts.get(normalizeHex(pixel.color)) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback;
}

function dominantDarkColor(matrix: PixelMatrix, background: string) {
  const counts = new Map<string, number>();
  for (const row of matrix) {
    for (const value of row) {
      const color = normalizeHex(value);
      if (color === background || color === TRANSPARENT_PIXEL) continue;
      const [r, g, b] = hexToRgb(color);
      if (luminance(r, g, b) < 90) counts.set(color, (counts.get(color) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "#202020";
}

function isSkinLike(color: string, skinColor: string) {
  const [r, g, b] = hexToRgb(normalizeHex(color));
  const [sr, sg, sb] = hexToRgb(skinColor);
  const distance = Math.hypot(r - sr, g - sg, b - sb);
  return distance < 55 || (r > 190 && g > 160 && b > 130);
}

function countNonBackground(matrix: PixelMatrix, background: string) {
  let count = 0;
  for (const row of matrix) {
    for (const color of row) if (normalizeHex(color) !== background && color !== TRANSPARENT_PIXEL) count += 1;
  }
  return count;
}

function matrixBbox(matrix: PixelMatrix, background: string) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      const color = normalizeHex(matrix[y][x]);
      if (color === background || color === TRANSPARENT_PIXEL) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return Number.isFinite(minX) ? [minX, minY, maxX + 1, maxY + 1] : undefined;
}

function summarizePixels(pixels: ManualTraitPixel[]) {
  return {
    pixels: pixels.length,
    bbox: pixels.length ? bbox(pixels) : undefined
  };
}

function countHairCentralFaceLeakage(pixels: ManualTraitPixel[], skinColor: string) {
  return pixels.filter((pixel) => {
    const color = normalizeHex(pixel.color);
    return (
      (isSkinLike(color, skinColor) && isHeadAndNeckZone(pixel.x, pixel.y)) ||
      (isLowSaturationFaceFill(color) && isCentralFaceFillZone(pixel.x, pixel.y)) ||
      (isDarkColor(color) && isFacialInkZone(pixel.x, pixel.y))
    );
  }).length;
}

function countClothingFaceShadowLeakage(pixels: ManualTraitPixel[]) {
  return pixels.filter((pixel) => isDarkColor(normalizeHex(pixel.color)) && isFacialInkZone(pixel.x, pixel.y)).length;
}

function bbox(pixels: ManualTraitPixel[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const pixel of pixels) {
    minX = Math.min(minX, pixel.x);
    minY = Math.min(minY, pixel.y);
    maxX = Math.max(maxX, pixel.x);
    maxY = Math.max(maxY, pixel.y);
  }
  return [minX, minY, maxX + 1, maxY + 1];
}

function luminance(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

async function writeJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function readJson(path: string) {
  return JSON.parse(await readFile(path, "utf8"));
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
