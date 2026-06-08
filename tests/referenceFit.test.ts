import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pixelImageToMatrix } from "../src/core/pixelMatrix";
import { renderAvatar } from "../src/core/render";
import { keyOf } from "../src/core/geometry";
import { AvatarSpec } from "../src/types";

const datasetRoot = join(process.cwd(), "datasets/reference/istock-36");
const specRoot = join(datasetRoot, "part-traits/specs");

describe("reference part trait fit", () => {
  it("uses reviewed accepted part candidates", () => {
    const report = JSON.parse(readFileSync(join(datasetRoot, "part-traits/part-candidates/report.json"), "utf8"));
    for (const counts of Object.values(report.statusSummary) as Array<{ accepted: number; review: number; rejected: number }>) {
      expect(counts.review).toBe(0);
    }
    expect(report.statusSummary["background.style"].accepted).toBe(36);
    expect(report.statusSummary["face.shape"].accepted).toBe(36);
    expect(report.statusSummary["clothing.top"].accepted).toBe(36);
    expect(report.statusSummary["hair.style"].accepted).toBeGreaterThanOrEqual(30);
  });

  it("keeps average generated-vs-reference diff under 15%", () => {
    const manifest = JSON.parse(readFileSync(join(datasetRoot, "manifest.json"), "utf8"));
    let diffPixels = 0;
    let scoredPixels = 0;

    for (const entry of manifest.entries) {
      const reference = JSON.parse(readFileSync(join(datasetRoot, entry.matrix), "utf8")).matrix as string[][];
      const spec = JSON.parse(readFileSync(join(specRoot, `${entry.id}.json`), "utf8")) as AvatarSpec;
      const generated = pixelImageToMatrix(renderAvatar(spec).image);
      const ignored = ignoredPixels(entry.ignoreRegions ?? []);

      for (let y = 0; y < reference.length; y += 1) {
        for (let x = 0; x < reference[y].length; x += 1) {
          if (ignored.has(keyOf(x, y))) continue;
          scoredPixels += 1;
          if (generated[y][x] !== reference[y][x]) diffPixels += 1;
        }
      }
    }

    expect(diffPixels / scoredPixels).toBeLessThanOrEqual(0.15);
  });
});

function ignoredPixels(regions: Array<{ matrixRegion: [number, number, number, number] }>) {
  const ignored = new Set<string>();
  for (const region of regions) {
    const [x0, y0, x1, y1] = region.matrixRegion;
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) ignored.add(keyOf(x, y));
    }
  }
  return ignored;
}
