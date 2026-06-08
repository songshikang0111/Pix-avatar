import { describe, expect, it } from "vitest";
import { createDefaultSpec } from "../src/assets/humanV1";
import { countMatrixPixels, pixelImageToMatrix, resizeMatrixDominant } from "../src/core/pixelMatrix";
import { renderAvatar } from "../src/core/render";

describe("pixel matrix conversion", () => {
  it("converts a render output into a dense 40x40 matrix", () => {
    const result = renderAvatar(createDefaultSpec({ "background.style": "transparent" }));
    const matrix = pixelImageToMatrix(result.image);
    expect(matrix).toHaveLength(40);
    expect(matrix[0]).toHaveLength(40);
    expect(countMatrixPixels(matrix)).toBe(result.image.pixels.size);
  });

  it("downsamples render matrices to the 32x32 reference canvas", () => {
    const result = renderAvatar(createDefaultSpec({ "background.style": "transparent" }));
    const matrix = resizeMatrixDominant(pixelImageToMatrix(result.image), 32, 32);
    expect(matrix).toHaveLength(32);
    expect(matrix[0]).toHaveLength(32);
  });
});
