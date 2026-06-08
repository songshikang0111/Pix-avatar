import { AssetPackId, AvatarSpec, ValidationResult } from "../types";
import { DEFAULT_ASSET_PACK_ID, getAssetPack, listTraitValues } from "../assets/registry";
import { renderAvatar } from "./render";

export function validateAvatar(input: Partial<AvatarSpec>): ValidationResult {
  const result = renderAvatar(input);
  const errors: string[] = [];
  const assetPack = getAssetPack(result.spec.asset_pack.id);
  const traits = result.spec.traits;
  const anchors = result.inspect.anchors;

  if ((anchors["mouth.center"]?.[1] ?? 0) <= (anchors["nose.tip"]?.[1] ?? 0) + 1) errors.push("mouth.center must be below nose.tip by at least 2px.");
  if ((anchors["chin"]?.[1] ?? 40) - (anchors["mouth.center"]?.[1] ?? 0) < 3) errors.push("mouth.center is too close to chin.");
  const eyeDistance = Math.abs((anchors["right_eye.center"]?.[0] ?? 0) - (anchors["left_eye.center"]?.[0] ?? 0));
  if (eyeDistance < 6) errors.push("eyes are too close.");

  for (const key of assetPack.requiredTraitKeys) {
    const value = traits[key];
    if (!value) errors.push(`Missing trait: ${key}`);
    else if (!listTraitValues(assetPack.id, key).includes(value)) errors.push(`Unknown trait value: ${key}=${value}`);
  }

  return {
    status: errors.length ? "error" : result.inspect.warnings.length ? "warning" : "ok",
    warnings: result.inspect.warnings,
    errors,
    placements: result.inspect.placements
  };
}

export function validateAssetPackMinimums(minimum = 5, assetPackId: AssetPackId = DEFAULT_ASSET_PACK_ID) {
  const assetPack = getAssetPack(assetPackId);
  const errors: string[] = [];
  const counts: Record<string, number> = {};
  for (const key of assetPack.requiredTraitKeys) {
    const values = listTraitValues(assetPack.id, key);
    counts[key] = values.length;
    if (values.length < minimum) errors.push(`${key} has ${values.length} options, expected at least ${minimum}.`);
  }
  return { status: errors.length ? "error" : "ok", asset_pack: assetPack.id, counts, errors };
}
