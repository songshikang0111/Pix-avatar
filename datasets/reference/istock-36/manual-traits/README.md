# Manual Trait Studio Samples

This directory stores hand-built `Pix Avatar Trait Studio` samples created from
the iStock 36 reference matrices.

`avatar-01.manual-traits.json` is a full 32x32 manual trait template for
`avatar-01`. It was reproduced in the local web editor by selecting each slot,
painting the 32x32 canvas with brush paths grouped by layer and color, and
saving each non-empty layer as a local trait asset.

Artifacts:

- `avatar-01.manual-traits.json`: editable manual trait template.
- `avatar-01.avatar-spec.json`: rendered Avatar Spec exported from the template.
- `avatar-01.rendered.png`: rendered PNG from the manual template.
- `avatar-01.diff-report.json`: exact 32x32 matrix diff against
  `../matrices/avatar-01.json`.
- `avatar-01.platform-run-report.json`: browser-operation evidence for the
  in-app editor pass.

The current `avatar-01` sample has `diffRate = 0`.

