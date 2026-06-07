# Avatar Visual SOP

Reference target: compact 40x40 portrait-grid pixel avatars with a clean sticker
silhouette, pastel square backgrounds, simple readable faces, and bold dark
outlines.

## Principles

1. Silhouette first. The head, hair, ears, and shoulders must read as one clear
   bust at thumbnail size before details are considered.
2. Use one-pixel dark outlines for the outside contour. Internal shadows should
   be softer than the contour so the avatar does not look muddy.
3. Keep backgrounds quiet. Default random output uses flat pastel blocks only;
   patterned or dark backgrounds are manual art-direction choices.
4. Keep the face friendly by default. Avoid angry brows, frowns, scars, large
   novelty accessories, and fantasy skin unless explicitly constrained.
5. Limit simultaneous statement traits. In default random, only one or two of
   glasses, facial hair, bright hair, and headwear should dominate.
6. Preserve a stable head scale. Eyes sit around the upper-middle of the face,
   mouth stays near the lower third, and shoulders remain cropped at the bottom.
7. Use a small palette per avatar: one skin ramp, one hair ramp, one clothing
   color, one background color, and black/brown linework.
8. Validate in sheets, not single images. A trait is accepted only if it holds up
   across varied face, hair, skin, accessory, and background combinations.

## Default Random Policy

- Background: pastel flat square.
- Face: soft round, oval, round, heart, or soft square.
- Skin: human tones only.
- Hair: natural colors by default, with occasional bright colors.
- Eyes and mouth: readable friendly shapes.
- Brows: neutral or gently expressive.
- Glasses/headwear/facial hair: weighted toward none or lightweight variants.
- Novelty traits remain available through explicit constraints or manual specs.

## Iteration Checklist

For every sheet, check:

- Does each cell read as a person at 1x and at 12x?
- Is the face visible before accessories?
- Does the background support rather than compete?
- Are the eyes and mouth aligned and emotionally intentional?
- Is there a clear black silhouette like the reference grid?
- Are no more than two high-salience traits active at once?
