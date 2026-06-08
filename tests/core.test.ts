import { describe, expect, it } from "vitest";
import { REQUIRED_TRAIT_KEYS, createDefaultSpec, listTraitValues } from "../src/assets/humanV1";
import { getAssetPack, listTraitValues as listTraitValuesForPack } from "../src/assets/registry";
import { randomSpec } from "../src/core/random";
import { renderAvatar } from "../src/core/render";
import { parseCompactPatch } from "../src/core/patch";
import { validateAssetPackMinimums, validateAvatar } from "../src/core/validate";
import { createSpecWithTraits } from "../src/core/spec";

describe("asset registry", () => {
  it("has at least five options per implemented part", () => {
    const result = validateAssetPackMinimums(5);
    expect(result.status).toBe("ok");
    for (const key of REQUIRED_TRAIT_KEYS) {
      expect(listTraitValues(key).length).toBeGreaterThanOrEqual(5);
    }
  });

  it("registers human_v2_icon as a separate 40x40 asset pack", () => {
    const pack = getAssetPack("human_v2_icon");
    const result = validateAssetPackMinimums(5, "human_v2_icon");
    expect(pack.canvas.size).toEqual([40, 40]);
    expect(result.status).toBe("ok");
    expect(listTraitValuesForPack("human_v2_icon", "hair.style")).toContain("side_sweep");
    expect(listTraitValuesForPack("human_v2_icon", "background.style")).toContain("pastel_mint");
  });
});

describe("rendering", () => {
  it("renders a deterministic random spec", () => {
    const first = randomSpec({ seed: 42, preset: "friendly_agent" });
    const second = randomSpec({ seed: 42, preset: "friendly_agent" });
    expect(first.traits).toEqual(second.traits);
    const render = renderAvatar(first);
    expect(render.image.pixels.size).toBeGreaterThan(450);
    expect(render.inspect.anchors["mouth.center"]).toBeDefined();
  });

  it("renders human_v2_icon with v2 trait vocabulary", () => {
    const spec = randomSpec({ seed: 101, assetPackId: "human_v2_icon" });
    const render = renderAvatar(spec);
    expect(spec.asset_pack.id).toBe("human_v2_icon");
    expect(render.image.width).toBe(40);
    expect(render.inspect.visible_pixels).toBeGreaterThan(700);
    expect(validateAvatar(spec).status).not.toBe("error");
  });

  it("keeps v2 specs on the 40x40 coordinate system", () => {
    const spec = createSpecWithTraits(
      {
        "hair.style": "side_sweep",
        "glasses.shape": "narrow_rectangle",
        "mouth.shape": "tiny_smile",
        "background.style": "pastel_mint"
      },
      "human_v2_icon"
    );
    spec.patches = [
      {
        op: "mirror",
        axis: "vertical",
        ops: [{ op: "px", layer: "custom.overlay", x: 12, y: 20, color: "line.dark" }]
      }
    ];
    const result = renderAvatar(spec, { pixel: [27, 20] });
    expect(result.inspect.pixel?.stack.some((entry) => entry.layer === "custom.overlay")).toBe(true);
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
    spec.patches = [parseCompactPatch("rect custom.face 18 26 4 1 mouth.dark clip=face")];
    const result = renderAvatar(spec, { pixel: [20, 26] });
    expect(result.inspect.pixel?.stack.some((entry) => entry.layer === "custom.face")).toBe(true);
  });

  it("smoke-renders face-by-feature cross sections", () => {
    let count = 0;
    for (const face of listTraitValues("face.shape")) {
      for (const hair of listTraitValues("hair.style")) {
        const result = renderAvatar(createDefaultSpec({ "face.shape": face, "hair.style": hair }));
        expect(result.image.pixels.size).toBeGreaterThan(350);
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
