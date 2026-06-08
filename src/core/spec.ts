import { AssetPackId, AvatarSpec, TraitMap } from "../types";
import { DEFAULT_ASSET_PACK_ID, getAssetPack, getTraitOption } from "../assets/registry";

export function normalizeSpec(input: Partial<AvatarSpec> = {}): AvatarSpec {
  const assetPackId = input.asset_pack?.id ?? DEFAULT_ASSET_PACK_ID;
  const assetPack = getAssetPack(assetPackId);
  const traits: TraitMap = { ...assetPack.defaultTraits, ...(input.traits ?? {}) };
  for (const key of assetPack.requiredTraitKeys) {
    if (!traits[key]) traits[key] = assetPack.defaultTraits[key];
  }
  return {
    version: "avatar/v1",
    canvas: {
      size: assetPack.canvas.size,
      scale: input.canvas?.scale ?? assetPack.canvas.scale,
      background: input.canvas?.background ?? "transparent"
    },
    asset_pack: {
      id: assetPack.id,
      version: input.asset_pack?.version ?? assetPack.version
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
  const assetPack = getAssetPack(spec.asset_pack.id);
  if (spec.version !== "avatar/v1") errors.push(`Unsupported spec version: ${spec.version}`);
  if (spec.canvas.size[0] !== assetPack.canvas.size[0] || spec.canvas.size[1] !== assetPack.canvas.size[1]) {
    errors.push(`Only ${assetPack.canvas.size[0]}x${assetPack.canvas.size[1]} logical canvas is supported in ${assetPack.id}.`);
  }

  for (const [key, value] of Object.entries(spec.traits)) {
    if (!value) continue;
    if (!getTraitOption(assetPack.id, key, value)) {
      warnings.push(`Unknown trait ${key}=${value}; default drawing fallback may be used.`);
    }
  }

  return { warnings, errors };
}

export function createSpecWithTraits(traits: TraitMap = {}, assetPackId: AssetPackId = DEFAULT_ASSET_PACK_ID): AvatarSpec {
  const assetPack = getAssetPack(assetPackId);
  return {
    version: "avatar/v1" as const,
    canvas: {
      size: assetPack.canvas.size,
      scale: assetPack.canvas.scale,
      background: "transparent"
    },
    asset_pack: {
      id: assetPack.id,
      version: assetPack.version
    },
    traits: { ...assetPack.defaultTraits, ...traits }
  };
}
