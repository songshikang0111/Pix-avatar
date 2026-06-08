import { describe, expect, it } from "vitest";
import { createDefaultSpec } from "../src/assets/humanV1";
import { countMatrixPixels, pixelImageToMatrix } from "../src/core/pixelMatrix";
import { renderAvatar } from "../src/core/render";

describe("pixel matrix conversion", () => {
  it("converts a render output into a dense 32x32 matrix", () => {
    const result = renderAvatar(createDefaultSpec({ "background.style": "transparent" }));
    const matrix = pixelImageToMatrix(result.image);
    expect(matrix).toHaveLength(32);
    expect(matrix[0]).toHaveLength(32);
    expect(countMatrixPixels(matrix)).toBe(result.image.pixels.size);
  });

  it("rejects legacy 40x40 logical canvases", () => {
    expect(() =>
      renderAvatar({
        ...createDefaultSpec({ "background.style": "transparent" }),
        canvas: { size: [40, 40], scale: 12, background: "transparent" }
      })
    ).toThrow("Only 32x32 logical canvases");
  });
});
