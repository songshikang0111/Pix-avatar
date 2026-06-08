# Human V2 Icon Trait Creation SOP

This repo renders on a native `40x40` logical canvas. Any older `64x64` design
notes must be scaled by `0.625` and snapped to integer logical pixels before
they become specs, patches, anchors, or QA coordinates.

## 1. Lock The Style Master Template

Read `src/assets/humanV2Icon/styleGuide.ts` before creating or changing a
trait.

- Style name: `human_v2_icon`
- Canvas: `40x40`
- Default render scale: `12`
- Source design grid: `64x64`
- Coordinate conversion: `current = round(source64 * 0.625)`
- Mood: cute, clean, editorial, collectible avatar
- Direction: pastel background, thick dark outline, simple facial features,
  strong hair/accessory silhouettes

Do not add semi-realistic shading, noisy details, random gradients, excessive
wrinkles, oversized accessories, or unanchored floating pieces.

## 2. Use The 40x40 Composition

The v2 source proportions map to these repo-native coordinates:

- `background`: `[0, 0, 40, 40]`
- `head`: `[11, 6, 29, 31]`
- `left_eye.center`: `[16, 19]`
- `right_eye.center`: `[24, 19]`
- `eyebrows.y`: `16-18`
- `nose`: `[20, 21, 20, 24]`
- `mouth`: `[18, 27, 22, 29]`
- `left_ear`: `[8, 17, 11, 24]`
- `right_ear`: `[29, 17, 32, 24]`
- `hair`: `[8, 3, 33, 21]`
- `shoulders`: `[6, 31, 34, 40]`

Use rig anchors first: `hairline.center`, `hair.crown`, `left_temple`,
`right_temple`, `left_eye.center`, `right_eye.center`, `nose.tip`,
`mouth.center`, `left_ear.socket`, `right_ear.socket`, and `neck`.

## 3. Write A Trait Card Before Code

Create or update a trait card in `src/assets/humanV2Icon/traits/` before
changing rendering code. The card must include:

- `id`
- `slot`
- `role`
- `bbox_logical`
- `anchors`
- `clip`
- `layers`
- `palette_slots`
- `compatibility`
- `qa.render_with`
- `qa.pass_conditions`

The card turns "looks good" into constraints that can be rendered and reviewed.

## 4. Implement Stable Traits As Registry Data

Use patches for few-shot examples, local repair, and one-off styling. Do not
build long-term visual vocabulary by stacking patches. Stable traits belong in
the asset registry and renderer.

P0 v2 vocabulary:

- Backgrounds: `pastel_mint`, `pastel_cream`, `pastel_pink`, `pastel_cyan`,
  `pastel_yellow`, `pastel_lavender`, `diagonal`, `split_color`
- Hair: `side_sweep`, `clean_crop`, `bob`, `curly_cap`, `pink_bob`,
  `blue_short`, `blonde_wave`, `buzz`, `bald`, `long_side`
- Glasses: `none`, `small_round`, `thick_square`, `sunglasses`,
  `narrow_rectangle`, `nerd_frame`
- Headwear: `none`, `cap`, `beanie`, `headphones`, `beret`, `hairband`, `hood`
- Mouths: `neutral`, `tiny_smile`, `open_smile`, `teeth_smile`, `smirk`,
  `surprised`

## 5. QA Every New Trait In A Gallery

Minimum local checks:

```bash
npm run cli -- random --asset-pack human_v2_icon --seed 101 --out examples/specs/v2-seed-101.json
npm run cli -- render examples/specs/v2-seed-101.json \
  --out examples/outputs/v2-seed-101.png \
  --debug-grid examples/outputs/v2-seed-101-grid.png \
  --debug-anchors examples/outputs/v2-seed-101-anchors.png
npm run cli -- inspect examples/specs/v2-seed-101.json --pixel 20,27 --json
npm run cli -- assets validate --asset-pack human_v2_icon --json
```

Acceptance rules:

- The output stays on a `40x40` logical grid.
- Validation has no errors.
- Eyes are not covered by hair, glasses, or headwear.
- Hair, headwear, and glasses remain attached to anchors or sockets.
- A 20-seed gallery has no detached accessories or obvious clipping failures.

## 6. Prompt Template For AI-Generated Traits

```text
You are a pixel avatar trait designer. Create one composable trait for
Pix-avatar's human_v2_icon style.

Rules:
1. Use the repo-native 40x40 logical grid. If a source uses 64x64 coordinates,
   scale by 0.625 and snap to integer pixels.
2. Bind the trait to anchors, sockets, or named regions before using offsets.
3. Use palette tokens instead of arbitrary colors.
4. Output a Trait Card, 40x40 logical ops, repo patch ops, three few-shot
   avatar specs, and a QA checklist.
5. Keep the style clean: large silhouettes, sparse facial features, dark
   outlines, and pastel high-contrast blocks.
6. Do not copy reference art; extract reusable design grammar.

Input:
- slot: {hair.style | glasses.shape | headwear.type | ...}
- desired visual: <description>
- reference cells: <example references>
- compatible traits: <optional>
```
