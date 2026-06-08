import { AvatarSpec, PixelPatch, TraitMap } from "./types";
import { createSpecWithTraits } from "./core/spec";
import { randomSpec, RandomOptions } from "./core/random";
import { renderAvatar } from "./core/render";
import { validateAvatar } from "./core/validate";
import { DEFAULT_ASSET_PACK_ID } from "./assets/registry";

export class Avatar {
  spec: AvatarSpec;

  constructor(spec?: Partial<AvatarSpec>) {
    const assetPackId = spec?.asset_pack?.id ?? DEFAULT_ASSET_PACK_ID;
    this.spec = createSpecWithTraits(spec?.traits ?? {}, assetPackId);
    this.spec = { ...this.spec, ...spec, traits: { ...this.spec.traits, ...(spec?.traits ?? {}) } };
  }

  static random(options: RandomOptions = {}) {
    return new Avatar(randomSpec(options));
  }

  static new(traits: TraitMap = {}) {
    return new Avatar(createSpecWithTraits(traits));
  }

  setTrait(key: string, value: string) {
    this.spec.traits[key] = value;
    return this;
  }

  setTraits(traits: TraitMap) {
    for (const [key, value] of Object.entries(traits)) {
      if (value) this.setTrait(key, value);
    }
    return this;
  }

  patch(patches: PixelPatch[]) {
    this.spec.patches = [...(this.spec.patches ?? []), ...patches];
    return this;
  }

  render(options = {}) {
    return renderAvatar(this.spec, options);
  }

  inspect(pixel?: [number, number]) {
    return renderAvatar(this.spec, { pixel }).inspect;
  }

  validate() {
    return validateAvatar(this.spec);
  }

  toJSON() {
    return this.spec;
  }
}

export { renderAvatar } from "./core/render";
export { randomSpec } from "./core/random";
export { validateAvatar, validateAssetPackMinimums } from "./core/validate";
export { parseCompactPatch } from "./core/patch";
export { TRAIT_OPTIONS, DEFAULT_TRAITS, REQUIRED_TRAIT_KEYS, traitOptionsByKey } from "./assets/humanV1";
export { ASSET_PACKS, DEFAULT_ASSET_PACK_ID, getAssetPack, listAssetPacks } from "./assets/registry";
export {
  HUMAN_V2_ICON_DEFAULT_TRAITS,
  HUMAN_V2_ICON_PALETTE,
  HUMAN_V2_ICON_REQUIRED_TRAIT_KEYS,
  HUMAN_V2_ICON_STYLE_GUIDE,
  HUMAN_V2_ICON_TRAIT_CARDS,
  HUMAN_V2_ICON_TRAIT_OPTIONS
} from "./assets/humanV2Icon";
export type { AvatarSpec, PixelPatch, InspectReport, RenderResult, ValidationResult } from "./types";
