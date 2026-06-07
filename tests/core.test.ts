import { describe, expect, it } from "vitest";
import { REQUIRED_TRAIT_KEYS, createDefaultSpec, listTraitValues } from "../src/assets/humanV1";
import { randomSpec } from "../src/core/random";
import { renderAvatar } from "../src/core/render";
import { parseCompactPatch } from "../src/core/patch";
import { validateAssetPackMinimums, validateAvatar } from "../src/core/validate";

describe("asset registry", () => {
  it("has at least five options per implemented part", () => {
    const result = validateAssetPackMinimums(5);
    expect(result.status).toBe("ok");
    for (const key of REQUIRED_TRAIT_KEYS) {
      expect(listTraitValues(key).length).toBeGreaterThanOrEqual(5);
    }
  });
});

describe("rendering", () => {
  it("renders a deterministic random spec", () => {
    const first = randomSpec({ seed: 42, preset: "friendly_agent" });
    const second = randomSpec({ seed: 42, preset: "friendly_agent" });
    expect(first.traits).toEqual(second.traits);
    const render = renderAvatar(first);
    expect(render.image.pixels.size).toBeGreaterThan(1200);
    expect(render.inspect.anchors["mouth.center"]).toBeDefined();
  });

  it("validates default avatar layout", () => {
    const result = validateAvatar(createDefaultSpec());
    expect(result.status).not.toBe("error");
    expect(result.errors).toEqual([]);
  });

  it("applies compact patch operations", () => {
    const spec = createDefaultSpec({
      "background.style": "transparent"
    });
    spec.patches = [parseCompactPatch("rect custom.face 60 80 8 1 mouth.dark clip=face")];
    const result = renderAvatar(spec, { pixel: [64, 80] });
    expect(result.inspect.pixel?.stack.some((entry) => entry.layer === "custom.face")).toBe(true);
  });

  it("smoke-renders face-by-feature cross sections", () => {
    let count = 0;
    for (const face of listTraitValues("face.shape")) {
      for (const hair of listTraitValues("hair.style")) {
        const result = renderAvatar(createDefaultSpec({ "face.shape": face, "hair.style": hair }));
        expect(result.image.pixels.size).toBeGreaterThan(1000);
        count += 1;
      }
      for (const glasses of listTraitValues("glasses.shape")) {
        const result = renderAvatar(createDefaultSpec({ "face.shape": face, "glasses.shape": glasses }));
        expect(result.inspect.placements[`face.shape.${face}`]).toBeDefined();
        count += 1;
      }
    }
    expect(count).toBeGreaterThanOrEqual(60);
  });
});
