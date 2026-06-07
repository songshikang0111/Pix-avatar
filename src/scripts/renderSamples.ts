import { mkdir, writeFile } from "node:fs/promises";
import { randomSpec } from "../core/random";
import { renderAvatar } from "../core/render";
import { writePng } from "../node/png";
import { createSpecWithTraits } from "../core/spec";

const samples = [
  createSpecWithTraits({
    "face.shape": "soft_round",
    "hair.style": "short_messy",
    "eyes.shape": "almond",
    "mouth.shape": "small_smile",
    "glasses.shape": "round",
    "background.style": "circle"
  }),
  createSpecWithTraits({
    "face.shape": "long",
    "hair.style": "long_wavy",
    "hair.color": "blue",
    "eyes.shape": "sleepy",
    "mouth.shape": "neutral",
    "glasses.shape": "rectangle",
    "clothing.top": "suit",
    "background.style": "stars"
  }),
  createSpecWithTraits({
    "face.shape": "heart",
    "hair.style": "bob_bangs",
    "hair.color": "pink",
    "eyes.shape": "starry",
    "mouth.shape": "teeth_smile",
    "headwear.type": "crown",
    "background.style": "aura"
  }),
  createSpecWithTraits({
    "face.shape": "square_soft",
    "hair.style": "undercut",
    "skin.tone": "robot_gray",
    "eyes.color": "robot_cyan",
    "eyes.shape": "dot",
    "facial_hair.style": "short_beard",
    "clothing.top": "armor",
    "background.style": "checker"
  }),
  randomSpec({ seed: 42, preset: "friendly_agent" })
];

await mkdir("examples/specs", { recursive: true });
await mkdir("examples/outputs", { recursive: true });

for (let i = 0; i < samples.length; i += 1) {
  const spec = samples[i];
  const result = renderAvatar(spec);
  const scale = spec.canvas.scale;
  await writeFile(`examples/specs/sample-${i + 1}.json`, `${JSON.stringify(spec, null, 2)}\n`);
  await writePng(`examples/outputs/sample-${i + 1}.png`, result.image, scale);
  await writePng(`examples/outputs/sample-${i + 1}-grid.png`, renderAvatar(spec, { debugGrid: true }).image, scale);
  await writePng(`examples/outputs/sample-${i + 1}-anchors.png`, renderAvatar(spec, { debugAnchors: true }).image, scale);
  await writeFile(`examples/outputs/sample-${i + 1}.inspect.json`, `${JSON.stringify(result.inspect, null, 2)}\n`);
}

console.log(`rendered ${samples.length} sample avatars to examples/outputs`);
