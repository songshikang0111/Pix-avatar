import { TraitMap } from "../types";
import { REQUIRED_TRAIT_KEYS, createDefaultSpec, listTraitValues } from "../assets/humanV1";

export interface RandomOptions {
  seed?: number | string;
  preset?: string;
  constraints?: Record<string, string[]>;
}

export function randomSpec(options: RandomOptions = {}) {
  const seed = options.seed ?? Date.now();
  const rng = mulberry32(hashSeed(seed));
  const traits: TraitMap = {};

  for (const key of REQUIRED_TRAIT_KEYS) {
    const constrained = options.constraints?.[key];
    const values = constrained?.length ? constrained : valuesForKey(key, options.preset);
    traits[key] = pick(values, rng);
  }

  traits["base.species"] = "human";
  traits.presentation = pick(["androgynous", "androgynous", "cute", "mature"], rng);

  if (options.preset === "friendly_agent") {
    traits["mouth.shape"] = pick(["small_smile", "big_smile", "teeth_smile"], rng);
    traits["eyes.shape"] = pick(["dot", "round", "happy_arc"], rng);
    traits["glasses.shape"] = pick(["small_round", "narrow_rectangle", "thin_frame", "none", "none"], rng);
    traits["background.style"] = pick(["mint_flat", "cream_flat", "pink_flat", "sky_flat", "yellow_flat"], rng);
  }

  reduceStatementTraitCollisions(traits, rng);

  const spec = createDefaultSpec(traits);
  spec.seed = seed;
  return spec;
}

function valuesForKey(key: string, preset?: string) {
  if (preset === "full" || preset === "chaos") return listTraitValues(key);
  const pools: Record<string, string[]> = {
    "base.species": ["human"],
    presentation: ["androgynous", "androgynous", "cute", "mature"],
    "face.shape": ["side_oval", "side_oval", "side_oval", "oval", "soft_round", "heart", "round"],
    "skin.tone": ["porcelain_01", "fair_02", "light_warm_03", "medium_warm_05", "tan_07", "deep_brown_09"],
    "face.detail": ["none", "none", "none", "none", "blush_soft", "freckles_light"],
    "hair.style": ["side_sweep", "side_sweep", "clean_crop", "bob", "curly_cap", "pink_bob", "pigtails", "blue_short", "blonde_wave", "long_side", "buzz_cut", "bald_clean"],
    "hair.color": ["black_02", "black_02", "dark_brown", "brown", "blonde", "ginger", "gray", "pink", "blue"],
    "eyes.shape": ["dot", "dot", "round", "happy_arc", "sleepy"],
    "eyes.color": ["black", "brown", "brown", "amber", "green", "blue"],
    "eyebrows.shape": ["soft_flat", "soft_flat", "soft_flat", "arched", "raised_left"],
    "nose.shape": ["single_pixel", "small_line", "small_line", "button", "soft_bridge"],
    "mouth.shape": ["small_smile", "small_smile", "small_smile", "big_smile", "teeth_smile", "neutral"],
    "ears.shape": ["small_round", "small_round", "round", "none"],
    "glasses.shape": ["none", "none", "none", "none", "small_round", "thin_frame", "narrow_rectangle", "sunglasses"],
    "facial_hair.style": ["none", "none", "none", "none", "none", "mustache_thin", "goatee", "short_beard", "full_beard"],
    "headwear.type": ["none", "none", "none", "none", "none", "beanie", "cap", "headphones", "beret"],
    "clothing.top": ["tshirt", "tshirt", "hoodie", "hoodie", "jacket", "suit"],
    "background.style": ["mint_flat", "cream_flat", "pink_flat", "sky_flat", "yellow_flat"]
  };
  return pools[key] ?? listTraitValues(key);
}

function reduceStatementTraitCollisions(traits: TraitMap, rng: () => number) {
  if (traits["headwear.type"] !== "none" && ["bob", "pink_bob", "pigtails", "long_side", "long_wavy", "bob_bangs"].includes(traits["hair.style"] ?? "")) {
    traits["hair.style"] = pick(["side_sweep", "clean_crop", "curly_cap", "buzz_cut", "bald_clean"], rng);
  }

  if ((traits["hair.color"] === "blue" || traits["hair.color"] === "pink") && traits["headwear.type"] !== "none" && rng() < 0.8) {
    traits["headwear.type"] = "none";
  }

  const statements = [
    traits["glasses.shape"] !== "none",
    traits["facial_hair.style"] !== "none",
    traits["headwear.type"] !== "none",
    traits["hair.color"] === "blue" || traits["hair.color"] === "pink"
  ].filter(Boolean).length;

  if (statements <= 2) return;
  if (traits["headwear.type"] !== "none" && rng() < 0.7) traits["headwear.type"] = "none";
  if (traits["facial_hair.style"] !== "none" && rng() < 0.6) traits["facial_hair.style"] = "none";
  if ((traits["hair.color"] === "blue" || traits["hair.color"] === "pink") && rng() < 0.6) {
    traits["hair.color"] = pick(["black_02", "dark_brown", "brown", "blonde", "ginger", "gray"], rng);
  }
}

function pick<T>(values: T[], rng: () => number): T {
  return values[Math.floor(rng() * values.length)] ?? values[0];
}

function hashSeed(seed: number | string) {
  const text = String(seed);
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
