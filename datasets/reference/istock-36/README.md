# iStock 36 Reference Dataset

This fixture turns a 6x6 reference sheet into Pix Avatar comparable outputs:

- `tiles/`: one cropped source tile per avatar.
- `normalized/`: one `32x32` PNG per avatar, normalized to the estimated source pixel scale.
- `matrices/`: one JSON pixel matrix per avatar.
- `manifest.json`: dataset provenance and artifact index.
- `preview/contact-sheet.png`: scaled preview of the normalized matrices.

The JSON matrices are intentionally dense `32x32` rows of hex colors. The
normalization uses area-dominant sampling with a `0.5,0.5` source-pixel offset,
then per-tile palette cleanup to collapse JPEG boundary colors back to nearby
dominant colors.

Renderer outputs can be converted with `pixelImageToMatrix`, then downsampled
from the repo's `40x40` render canvas with `resizeMatrixDominant(matrix, 32, 32)`
before similarity scoring.

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

The original stock image is not copied into this repo. Some generated entries
inherit the visible iStock watermark from the reference image; keep that in mind
when using this as an evaluation target.
