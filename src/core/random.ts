import { AssetPackId, TraitMap } from "../types";
import { DEFAULT_ASSET_PACK_ID, getAssetPack, listTraitValues } from "../assets/registry";
import { createSpecWithTraits } from "./spec";

export interface RandomOptions {
  seed?: number | string;
  preset?: string;
  assetPackId?: AssetPackId;
  asset_pack?: AssetPackId | { id?: AssetPackId };
  constraints?: Record<string, string[]>;
}

export function randomSpec(options: RandomOptions = {}) {
  const seed = options.seed ?? Date.now();
  const rng = mulberry32(hashSeed(seed));
  const optionPack = typeof options.asset_pack === "object" ? options.asset_pack.id : options.asset_pack;
  const assetPackId = options.assetPackId ?? optionPack ?? (options.preset === "human_v2_icon" ? "human_v2_icon" : DEFAULT_ASSET_PACK_ID);
  const assetPack = getAssetPack(assetPackId);
  const traits: TraitMap = {};

  for (const key of assetPack.requiredTraitKeys) {
    const constrained = options.constraints?.[key];
    const values = constrained?.length ? constrained : listTraitValues(assetPack.id, key);
    traits[key] = pick(values, rng);
  }

  traits["base.species"] = "human";
  traits.presentation = options.preset === "friendly_agent" ? pick(["androgynous", "cute", "mature"], rng) : traits.presentation ?? assetPack.defaultTraits.presentation ?? "androgynous";

  if (assetPack.id === "human_v2_icon") {
    applyHumanV2IconRandomBias(traits, rng, options.constraints);
  }

  if (options.preset === "friendly_agent") {
    if (assetPack.id === "human_v2_icon") {
      traits["mouth.shape"] = pick(["tiny_smile", "open_smile", "teeth_smile"], rng);
      traits["eyes.shape"] = pick(["dot", "round", "happy_arc"], rng);
      traits["glasses.shape"] = pick(["small_round", "narrow_rectangle", "nerd_frame", "none"], rng);
      traits["background.style"] = pick(["pastel_mint", "pastel_cream", "pastel_pink", "pastel_cyan"], rng);
    } else {
      traits["mouth.shape"] = pick(["small_smile", "big_smile", "teeth_smile"], rng);
      traits["eyes.shape"] = pick(["round", "almond", "happy_arc"], rng);
      traits["glasses.shape"] = pick(["round", "rectangle", "thin_frame", "none"], rng);
      traits["background.style"] = pick(["circle", "rounded_square", "aura", "solid"], rng);
    }
  }

  const spec = createSpecWithTraits(traits, assetPack.id);
  spec.seed = seed;
  return spec;
}

function applyHumanV2IconRandomBias(traits: TraitMap, rng: () => number, constraints?: Record<string, string[]>) {
  const unconstrained = (key: string) => !constraints?.[key]?.length;
  if (unconstrained("presentation")) traits.presentation = pick(["cute", "androgynous", "feminine"], rng);
  if (unconstrained("face.detail")) traits["face.detail"] = pick(["none", "none", "blush_soft"], rng);
  if (unconstrained("facial_hair.style")) traits["facial_hair.style"] = "none";
  if (unconstrained("clothing.top")) traits["clothing.top"] = pick(["tshirt", "hoodie", "jacket"], rng);
  if (unconstrained("eyes.shape")) traits["eyes.shape"] = pick(["dot", "dot", "round", "happy_arc"], rng);
  if (unconstrained("ears.shape")) traits["ears.shape"] = pick(["small_round", "round", "none"], rng);

  if (unconstrained("hair.color")) {
    if (traits["hair.style"] === "pink_bob") traits["hair.color"] = "pink";
    else if (traits["hair.style"] === "blue_short") traits["hair.color"] = "blue";
    else if (traits["hair.style"] === "blonde_wave") traits["hair.color"] = "blonde";
    else traits["hair.color"] = pick(["black_02", "dark_brown", "brown", "blonde"], rng);
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
