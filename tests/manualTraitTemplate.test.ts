import { describe, expect, it } from "vitest";
import { createEmptyManualTemplate, manualTemplateToSpec } from "../src/core/manualTraitTemplate";
import { pixelImageToMatrix } from "../src/core/pixelMatrix";
import { renderAvatar } from "../src/core/render";

describe("manual trait templates", () => {
  it("converts hand-drawn slot layers into renderable 32x32 patches", () => {
    const template = createEmptyManualTemplate("test-template");
    const background = template.layers.find((layer) => layer.slot === "background.style");
    const eyes = template.layers.find((layer) => layer.slot === "eyes.shape");
    const glasses = template.layers.find((layer) => layer.slot === "glasses.shape");
    if (!background || !eyes || !glasses) throw new Error("Missing test layers");

    background.pixels = [{ x: 0, y: 0, color: "#FFFFFF" }];
    eyes.pixels = [{ x: 16, y: 16, color: "#111111" }];
    glasses.pixels = [{ x: 16, y: 16, color: "#56CCF2" }];

    const spec = manualTemplateToSpec(template);
    const matrix = pixelImageToMatrix(renderAvatar(spec).image);

    expect(spec.canvas.size).toEqual([32, 32]);
    expect(spec.patches?.some((patch) => patch.op === "rect" && patch.layer === "manual.80.glasses")).toBe(true);
    expect(matrix[16][16]).toBe("#56CCF2");
  });

  it("renders clothing above the face base for three-part assets", () => {
    const template = createEmptyManualTemplate("three-part-order-test");
    const face = template.layers.find((layer) => layer.slot === "face.shape");
    const clothing = template.layers.find((layer) => layer.slot === "clothing.top");
    if (!face || !clothing) throw new Error("Missing test layers");

    face.pixels = [{ x: 14, y: 27, color: "#F0F0E0" }];
    clothing.pixels = [{ x: 14, y: 27, color: "#202020" }];

    const matrix = pixelImageToMatrix(renderAvatar(manualTemplateToSpec(template)).image);

    expect(matrix[27][14]).toBe("#202020");
  });
});
