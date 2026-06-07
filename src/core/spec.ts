import { AvatarSpec, TraitMap } from "../types";
import { DEFAULT_TRAITS, REQUIRED_TRAIT_KEYS, createDefaultSpec, getTraitOption } from "../assets/humanV1";

export function normalizeSpec(input: Partial<AvatarSpec> = {}): AvatarSpec {
  const traits: TraitMap = { ...DEFAULT_TRAITS, ...(input.traits ?? {}) };
  for (const key of REQUIRED_TRAIT_KEYS) {
    if (!traits[key]) traits[key] = DEFAULT_TRAITS[key];
  }
  return {
    version: "avatar/v1",
    canvas: {
      size: [128, 128],
      scale: input.canvas?.scale ?? 4,
      background: input.canvas?.background ?? "transparent"
    },
    asset_pack: {
      id: "human_v1",
      version: input.asset_pack?.version ?? "1.0.0"
    },
    seed: input.seed,
    palette: input.palette,
    traits,
    patches: input.patches ?? []
  };
}

export function validateSpecShape(spec: AvatarSpec) {
  const warnings: string[] = [];
  const errors: string[] = [];
  if (spec.version !== "avatar/v1") errors.push(`Unsupported spec version: ${spec.version}`);
  if (spec.canvas.size[0] !== 128 || spec.canvas.size[1] !== 128) errors.push("Only 128x128 logical canvas is supported in this asset pack.");
  if (spec.asset_pack.id !== "human_v1") errors.push(`Unknown asset pack: ${spec.asset_pack.id}`);

  for (const [key, value] of Object.entries(spec.traits)) {
    if (!value) continue;
    if (!getTraitOption(key, value)) {
      warnings.push(`Unknown trait ${key}=${value}; default drawing fallback may be used.`);
    }
  }

  return { warnings, errors };
}

export function createSpecWithTraits(traits: TraitMap = {}) {
  return createDefaultSpec(traits);
}
