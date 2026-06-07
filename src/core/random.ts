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
    const values = constrained?.length ? constrained : listTraitValues(key);
    traits[key] = pick(values, rng);
  }

  traits["base.species"] = "human";
  traits.presentation = options.preset === "friendly_agent" ? pick(["androgynous", "cute", "mature"], rng) : traits.presentation ?? "androgynous";

  if (options.preset === "friendly_agent") {
    traits["mouth.shape"] = pick(["small_smile", "big_smile", "teeth_smile"], rng);
    traits["eyes.shape"] = pick(["round", "almond", "happy_arc"], rng);
    traits["glasses.shape"] = pick(["round", "rectangle", "thin_frame", "none"], rng);
    traits["background.style"] = pick(["circle", "rounded_square", "aura", "solid"], rng);
  }

  const spec = createDefaultSpec(traits);
  spec.seed = seed;
  return spec;
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
