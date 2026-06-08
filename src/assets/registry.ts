import { AssetPackId, HumanPalette, Point, TraitKey, TraitMap, TraitOption } from "../types";
import { DEFAULT_TRAITS, HUMAN_PALETTE, REQUIRED_TRAIT_KEYS, TRAIT_OPTIONS } from "./humanV1";
import {
  HUMAN_V2_ICON_DEFAULT_TRAITS,
  HUMAN_V2_ICON_PALETTE,
  HUMAN_V2_ICON_REQUIRED_TRAIT_KEYS,
  HUMAN_V2_ICON_STYLE_GUIDE,
  HUMAN_V2_ICON_TRAIT_CARDS,
  HUMAN_V2_ICON_TRAIT_OPTIONS,
  HUMAN_V2_ICON_VERSION
} from "./humanV2Icon";

export interface AssetPackDefinition {
  id: AssetPackId;
  version: string;
  label: string;
  description: string;
  canvas: {
    size: Point;
    scale: number;
  };
  requiredTraitKeys: TraitKey[];
  defaultTraits: TraitMap;
  traitOptions: TraitOption[];
  palette: HumanPalette;
  styleGuide?: unknown;
  traitCards?: unknown[];
}

export const DEFAULT_ASSET_PACK_ID: AssetPackId = "human_v1";

export const ASSET_PACKS: Record<AssetPackId, AssetPackDefinition> = {
  human_v1: {
    id: "human_v1",
    version: "1.0.0",
    label: "Human V1",
    description: "Original spec-first 40x40 human pixel avatar pack.",
    canvas: { size: [40, 40], scale: 12 },
    requiredTraitKeys: REQUIRED_TRAIT_KEYS,
    defaultTraits: DEFAULT_TRAITS,
    traitOptions: TRAIT_OPTIONS,
    palette: HUMAN_PALETTE
  },
  human_v2_icon: {
    id: "human_v2_icon",
    version: HUMAN_V2_ICON_VERSION,
    label: "Human V2 Icon",
    description: "Clean collectible icon style using the repo-native 40x40 logical grid.",
    canvas: { size: [40, 40], scale: 12 },
    requiredTraitKeys: HUMAN_V2_ICON_REQUIRED_TRAIT_KEYS,
    defaultTraits: HUMAN_V2_ICON_DEFAULT_TRAITS,
    traitOptions: HUMAN_V2_ICON_TRAIT_OPTIONS,
    palette: HUMAN_V2_ICON_PALETTE,
    styleGuide: HUMAN_V2_ICON_STYLE_GUIDE,
    traitCards: HUMAN_V2_ICON_TRAIT_CARDS
  }
};

export function getAssetPack(id: AssetPackId = DEFAULT_ASSET_PACK_ID): AssetPackDefinition {
  return ASSET_PACKS[id] ?? ASSET_PACKS[DEFAULT_ASSET_PACK_ID];
}

export function listAssetPacks() {
  return Object.values(ASSET_PACKS).map(({ id, version, label, description, canvas }) => ({
    id,
    version,
    label,
    description,
    canvas
  }));
}

export function traitOptionsByKey(assetPackId: AssetPackId = DEFAULT_ASSET_PACK_ID) {
  return getAssetPack(assetPackId).traitOptions.reduce<Record<string, TraitOption[]>>((acc, option) => {
    acc[option.key] = acc[option.key] ?? [];
    acc[option.key].push(option);
    return acc;
  }, {});
}

export function getTraitOption(assetPackId: AssetPackId, key: string, value: string) {
  return getAssetPack(assetPackId).traitOptions.find((option) => option.key === key && option.value === value);
}

export function listTraitValues(assetPackId: AssetPackId, key: TraitKey | string) {
  return getAssetPack(assetPackId)
    .traitOptions.filter((option) => option.key === key)
    .map((option) => option.value);
}
