# iStock 36 Reference Dataset

This fixture turns a 6x6 reference sheet into Pix Avatar comparable outputs:

- `tiles/`: one cropped source tile per avatar.
- `normalized/`: one `32x32` PNG per avatar, normalized to the estimated source pixel scale.
- `matrices/`: one JSON pixel matrix per avatar.
- `manifest.json`: dataset provenance and artifact index.
- `preview/contact-sheet.png`: scaled preview of the normalized matrices.
- `segments/`: semantic color-block segmentation outputs (`background`, `skin`,
  `hair`, `clothing`, `accessory`, `face_feature`, `ink`, and ignored regions).
- `segment-traits/`: coarse generated Avatar Specs that replay the segmented
  reference regions as output-coordinate patch traits. This is an intermediate
  reconstruction artifact, not the final reusable trait asset set.
- `part-traits/`: repo-native trait-slot assets derived from the segmented
  regions. Each candidate part is reviewed per slot (`face.shape`, `hair.style`,
  `eyes.shape`, `nose.shape`, `mouth.shape`, `glasses.shape`, `headwear.type`,
  `clothing.top`, etc.) with bbox, connected-component, and zone checks before
  accepted assets are used in specs.
- `part-fit/`: generator-vs-reference fit report for accepted part-trait specs.
- `part-recombinations/`: visual QA sheet for mixing accepted 32px part assets
  across different reference avatars.
- `manual-traits/`: manually reviewed `Pix Avatar Trait Studio` samples,
  including an `avatar-01` full-layer template with exact `32x32` diff reports.
- `manual-traits-3part/`: reviewed three-part reference traits for the first
  five avatars. Each sample is reduced to `face.shape`, `clothing.top`, and
  `hair.style`, plus visual QA sheets for individual assets, exact
  reconstruction, and 5x5x5 cross-combinations.

The JSON matrices are intentionally dense `32x32` rows of hex colors. The
normalization uses area-dominant sampling with a `0.5,0.5` source-pixel offset,
then per-tile palette cleanup to collapse JPEG boundary colors back to nearby
dominant colors.

Renderer outputs can be converted with `pixelImageToMatrix` and compared directly
against these `32x32` matrices. Public Avatar Specs are now scored and validated
as `32x32`; legacy `40x40` output compatibility is intentionally not part of the
reference workflow.

Entries affected by visible source watermarks include `qualityFlags` plus
`ignoreRegions` projected into `32x32` matrix coordinates. A future similarity
metric should skip or downweight those regions.

Generation command:

```bash
npm run prepare:reference-dataset -- --source /Users/songs/Downloads/istockphoto-1820670230-1024x1024.jpg
```

Evaluation command:

```bash
npm run evaluate:reference-dataset -- --source /Users/songs/Downloads/istockphoto-1820670230-1024x1024.jpg
```

Evaluation outputs live in `evaluation/`: per-avatar `original | reconstruction
| diff` images, a full diff contact sheet, a full reconstruction contact sheet,
and `report.json`.

Reference part trait extraction:

```bash
npm run extract:reference-traits
npm run derive:reference-parts
npm run fit:reference-dataset -- --specDir datasets/reference/istock-36/part-traits/specs --out datasets/reference/istock-36/part-fit
npm run recombine:reference-parts
```

The fit report includes both exact `pixelDiffRate` and a shape-heavy score:
foreground-mask F1, edge F1, and dark-ink F1 carry most of the structural score;
RGB RMSE is low weight. Watermark/asset-id regions from `manifest.json` are
ignored. The current accepted `part-fit/report.json` scores
`globalPixelDiffRate = 0.00179364537068671` on the scored pixels
(`foregroundF1 = 0.9983979111156519`, `edgeF1 = 0.9816958972004789`,
`inkF1 = 0.9990007301220868`), satisfying the 15% average-diff gate.

The candidate review sheet is deliberately separate from the fit metric:
`part-traits/part-candidates/slot-sheets/*.png` shows one contact sheet per
slot. Green borders are accepted assets and red borders are rejected empty/noisy
assets. `part-recombinations/contact-sheet.png` is visual QA for
cross-generalization; it keeps face shape and facial features together as a
face-kit because the extracted feature pixels are absolute 32px part assets.

For manual review and cleanup of reference-derived parts, use the local
`Pix Avatar Trait Studio` workflow documented in
[`../../../docs/trait-studio-manual.zh.md`](../../../docs/trait-studio-manual.zh.md).

Three-part reference traits can be regenerated with:

```bash
npm run build:three-part-reference-traits -- --count 5
```

The three-part report includes exact reconstruction diff rates and two layer
hygiene checks: `hairCentralFaceLeakagePixels` catches hair assets that absorb
central face/eye pixels, and `clothingFaceShadowLeakagePixels` catches clothing
assets that absorb lower-face shadow or chin pixels. Both should stay at `0`
before accepting the generated assets.

The original stock image is not copied into this repo. Some generated entries
inherit the visible iStock watermark from the reference image; keep that in mind
when using this as an evaluation target.
