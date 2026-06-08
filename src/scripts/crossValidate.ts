import { mkdir, writeFile } from "node:fs/promises";
import { ASSET_PACKS, listTraitValues } from "../assets/registry";
import { renderAvatar } from "../core/render";
import { createSpecWithTraits } from "../core/spec";
import { validateAssetPackMinimums } from "../core/validate";
import { writePng } from "../node/png";
import { AssetPackId, TraitKey } from "../types";

type Case = { name: string; traits: Record<string, string> };

const matrixKeys: TraitKey[] = [
  "face.shape",
  "hair.style",
  "eyes.shape",
  "mouth.shape",
  "ears.shape",
  "glasses.shape",
  "facial_hair.style",
  "headwear.type",
  "clothing.top",
  "background.style"
];

const outDir = "examples/outputs/cross_validation";
await mkdir(outDir, { recursive: true });

const report = {
  status: "ok",
  minimums: {} as Record<AssetPackId, ReturnType<typeof validateAssetPackMinimums>>,
  tested_combinations: {} as Record<AssetPackId, number>,
  warnings: [] as Array<{ case: string; warnings: string[] }>,
  errors: [] as Array<{ case: string; error: string }>,
  snapshots: [] as string[]
};

for (const assetPackId of Object.keys(ASSET_PACKS) as AssetPackId[]) {
  const cases = buildCases(assetPackId);
  const minimums = validateAssetPackMinimums(5, assetPackId);
  report.minimums[assetPackId] = minimums;
  report.tested_combinations[assetPackId] = cases.length;

  for (let i = 0; i < cases.length; i += 1) {
    const testCase = cases[i];
    const name = `${assetPackId}__${testCase.name}`;
    try {
      const spec = createSpecWithTraits(testCase.traits, assetPackId);
      const result = renderAvatar(spec);
      if (result.inspect.warnings.length) report.warnings.push({ case: name, warnings: result.inspect.warnings });
      if (i < 30 || (testCase.name.includes("face_") && testCase.name.includes("__hair_"))) {
        const path = `${outDir}/${String(report.snapshots.length + 1).padStart(3, "0")}_${name}.png`;
        await writePng(path, result.image, 3);
        report.snapshots.push(path);
      }
    } catch (error) {
      report.errors.push({ case: name, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

if (Object.values(report.minimums).some((minimums) => minimums.status === "error") || report.errors.length) report.status = "error";
else if (report.warnings.length) report.status = "warning";

await writeFile(`${outDir}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

if (report.status === "error") process.exitCode = 1;

function buildCases(assetPackId: AssetPackId) {
  const cases: Case[] = [];
  for (const key of matrixKeys) {
    for (const value of listTraitValues(assetPackId, key)) {
      cases.push({ name: `${key}-${value}`.replace(/[^\w.-]+/g, "_"), traits: { [key]: value } });
    }
  }

  for (const face of listTraitValues(assetPackId, "face.shape")) {
    for (const hair of listTraitValues(assetPackId, "hair.style")) {
      cases.push({ name: `face_${face}__hair_${hair}`, traits: { "face.shape": face, "hair.style": hair } });
    }
    for (const ears of listTraitValues(assetPackId, "ears.shape")) {
      cases.push({ name: `face_${face}__ears_${ears}`, traits: { "face.shape": face, "ears.shape": ears } });
    }
    for (const mouth of listTraitValues(assetPackId, "mouth.shape")) {
      cases.push({ name: `face_${face}__mouth_${mouth}`, traits: { "face.shape": face, "mouth.shape": mouth } });
    }
  }

  for (const hair of listTraitValues(assetPackId, "hair.style")) {
    for (const glasses of listTraitValues(assetPackId, "glasses.shape")) {
      cases.push({ name: `hair_${hair}__glasses_${glasses}`, traits: { "hair.style": hair, "glasses.shape": glasses } });
    }
  }
  return cases;
}
