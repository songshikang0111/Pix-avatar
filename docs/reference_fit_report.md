# Reference Fit Report

## Reference Read

The provided reference is a grid of compact pixel portrait avatars. Its strongest
visual rules are:

- Full-cell pastel backgrounds, mostly mint, cream, pink, and cyan.
- Heavy dark outside contour around each bust.
- Large readable head silhouettes with cropped shoulders.
- Small facial features, usually friendly or neutral-friendly.
- Hair and accessories add identity but rarely hide the face.
- Most cells use human skin tones and a restrained palette; novelty colors are
  occasional accents rather than the default state.

## Baseline Gap

The first 40x40 generator was functionally correct but visually noisy:

- Backgrounds were too variable, including dark, patterned, or diagonal styles.
- Random treated all trait values as equally likely, so frowns, angry brows,
  scars, fantasy skin, crowns, hoods, and large accessories appeared too often.
- The avatar lacked a unified black silhouette contour.
- Hair, glasses, hats, and facial hair could stack into too many high-salience
  traits in one face.
- Some small-mouth and lip-highlight details read as artifacts rather than
  intentional expression at 40px.

## SOP Changes Applied

- Added flat pastel background variants and made them the default random pool.
- Added a global one-pixel silhouette outline computed from character pixels.
- Changed default random from full uniform sampling to a curated weighted pool.
- Kept novelty traits available through explicit constraints or `preset=full`.
- Reduced expression risk by removing frown, surprised, angry, sad, neutral, and
  scar-like details from default random.
- Reduced noisy trait collisions: bright hair, headwear, glasses, and facial hair
  are no longer equally stacked.
- Made beanie and cap shapes sit higher and smaller so eyes remain readable.
- Removed the small-smile lip-highlight pixel that made some mouths look noisy.

## Current Remaining Difference

The output now follows the reference structure: pastel cells, dark contour,
readable busts, and friendlier faces. It is still a generated trait system rather
than a hand-curated stock illustration grid, so individual hair and hat shapes
need future polish as more trait variants are added.
