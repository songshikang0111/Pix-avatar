import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const datasetRoot = join(process.cwd(), "datasets/reference/istock-36");

describe("reference dataset", () => {
  it("contains 36 comparable 32x32 matrix fixtures", () => {
    const manifest = JSON.parse(readFileSync(join(datasetRoot, "manifest.json"), "utf8"));
    expect(manifest.entries).toHaveLength(36);
    expect(manifest.canvas.size).toEqual([32, 32]);

    for (const entry of manifest.entries) {
      expect(existsSync(join(datasetRoot, entry.normalized))).toBe(true);
      const fixture = JSON.parse(readFileSync(join(datasetRoot, entry.matrix), "utf8"));
      expect(fixture.matrix).toHaveLength(32);
      expect(fixture.matrix.every((row: string[]) => row.length === 32)).toBe(true);
    }

    const report = JSON.parse(readFileSync(join(datasetRoot, "evaluation/report.json"), "utf8"));
    expect(report.entries).toHaveLength(36);
    expect(report.aggregate.scored.diffRate).toBeGreaterThan(0);
  });
});
