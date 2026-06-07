export const LAYERS = {
  "background.base": 0,
  "background.pattern": 10,
  "background.effects": 20,
  "character.outline": 90,
  "body.shadow": 100,
  "body.base": 110,
  neck: 120,
  "hair.back": 150,
  "headwear.back": 160,
  "head.base": 200,
  "ears.back": 210,
  "ears.base": 220,
  "skin.shadow": 230,
  "skin.highlight": 240,
  "face.details": 250,
  "custom.face": 255,
  "eyes.white": 300,
  "eyes.iris": 310,
  "eyes.pupil": 320,
  eyelids: 330,
  eyelashes: 340,
  eyebrows: 350,
  nose: 360,
  mouth: 370,
  lips: 380,
  "facial_hair": 390,
  "glasses.lens": 400,
  "glasses.frame": 410,
  "glasses.highlight": 420,
  "ears.front": 450,
  earrings: 460,
  "hair.side": 500,
  "hair.front": 510,
  "hair.highlight": 520,
  "custom.hair": 525,
  "headwear.front": 550,
  "headphones.front": 560,
  "foreground.effects": 600,
  "custom.overlay": 900
} as const;

export type LayerId = keyof typeof LAYERS;

export function zForLayer(id: string): number {
  return LAYERS[id as LayerId] ?? (id.startsWith("custom.") ? 900 : 700);
}
