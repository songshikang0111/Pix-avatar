import { AvatarSpec, ValidationResult } from "../types";
import { REQUIRED_TRAIT_KEYS, listTraitValues } from "../assets/humanV1";
import { renderAvatar } from "./render";

export function validateAvatar(input: Partial<AvatarSpec>): ValidationResult {
  const result = renderAvatar(input);
  const errors: string[] = [];
  const traits = result.spec.traits;
  const anchors = result.inspect.anchors;

  if ((anchors["mouth.center"]?.[1] ?? 0) <= (anchors["nose.tip"]?.[1] ?? 0) + 4) errors.push("mouth.center must be below nose.tip by at least 5px.");
  if ((anchors["chin"]?.[1] ?? 128) - (anchors["mouth.center"]?.[1] ?? 0) < 8) errors.push("mouth.center is too close to chin.");
  const eyeDistance = Math.abs((anchors["right_eye.center"]?.[0] ?? 0) - (anchors["left_eye.center"]?.[0] ?? 0));
  if (eyeDistance < 20) errors.push("eyes are too close.");

  for (const key of REQUIRED_TRAIT_KEYS) {
    const value = traits[key];
    if (!value) errors.push(`Missing trait: ${key}`);
    else if (!listTraitValues(key).includes(value)) errors.push(`Unknown trait value: ${key}=${value}`);
  }

  return {
    status: errors.length ? "error" : result.inspect.warnings.length ? "warning" : "ok",
    warnings: result.inspect.warnings,
    errors,
    placements: result.inspect.placements
  };
}

export function validateAssetPackMinimums(minimum = 5) {
  const errors: string[] = [];
  const counts: Record<string, number> = {};
  for (const key of REQUIRED_TRAIT_KEYS) {
    const values = listTraitValues(key);
    counts[key] = values.length;
    if (values.length < minimum) errors.push(`${key} has ${values.length} options, expected at least ${minimum}.`);
  }
  return { status: errors.length ? "error" : "ok", counts, errors };
}
