import { mkdir, writeFile } from "node:fs/promises";
import { createDefaultSpec, listTraitValues } from "../assets/humanV1";
import { renderAvatar } from "../core/render";
import { validateAssetPackMinimums } from "../core/validate";
import { writePng } from "../node/png";
import { TraitKey } from "../types";

type Case = { name: string; traits: Record<string, string> };

const cases: Case[] = [];
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

for (const key of matrixKeys) {
  for (const value of listTraitValues(key)) {
    cases.push({ name: `${key}-${value}`.replace(/[^\w.-]+/g, "_"), traits: { [key]: value } });
  }
}

for (const face of listTraitValues("face.shape")) {
  for (const hair of listTraitValues("hair.style")) {
    cases.push({ name: `face_${face}__hair_${hair}`, traits: { "face.shape": face, "hair.style": hair } });
  }
  for (const ears of listTraitValues("ears.shape")) {
    cases.push({ name: `face_${face}__ears_${ears}`, traits: { "face.shape": face, "ears.shape": ears } });
  }
  for (const mouth of listTraitValues("mouth.shape")) {
    cases.push({ name: `face_${face}__mouth_${mouth}`, traits: { "face.shape": face, "mouth.shape": mouth } });
  }
}

for (const hair of listTraitValues("hair.style")) {
  for (const glasses of listTraitValues("glasses.shape")) {
    cases.push({ name: `hair_${hair}__glasses_${glasses}`, traits: { "hair.style": hair, "glasses.shape": glasses } });
  }
}

const outDir = "examples/outputs/cross_validation";
await mkdir(outDir, { recursive: true });

const minimums = validateAssetPackMinimums(5);
const report = {
  status: "ok",
  minimums,
  tested_combinations: cases.length,
  warnings: [] as Array<{ case: string; warnings: string[] }>,
  errors: [] as Array<{ case: string; error: string }>,
  snapshots: [] as string[]
};

for (let i = 0; i < cases.length; i += 1) {
  const testCase = cases[i];
  try {
    const spec = createDefaultSpec(testCase.traits);
    const result = renderAvatar(spec);
    if (result.inspect.warnings.length) report.warnings.push({ case: testCase.name, warnings: result.inspect.warnings });
    if (i < 30 || testCase.name.includes("face_") && testCase.name.includes("__hair_")) {
      const path = `${outDir}/${String(report.snapshots.length + 1).padStart(3, "0")}_${testCase.name}.png`;
      await writePng(path, result.image, 3);
      report.snapshots.push(path);
    }
  } catch (error) {
    report.errors.push({ case: testCase.name, error: error instanceof Error ? error.message : String(error) });
  }
}

if (minimums.status === "error" || report.errors.length) report.status = "error";
else if (report.warnings.length) report.status = "warning";

await writeFile(`${outDir}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

if (report.status === "error") process.exitCode = 1;
