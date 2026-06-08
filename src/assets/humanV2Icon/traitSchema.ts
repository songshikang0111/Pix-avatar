import { AssetPackId, Box, PatchClip, Point, TraitKey } from "../../types";

export type HumanV2IconTraitSlot = TraitKey;
export type HumanV2IconTraitRole = "root" | "mounted" | "occluder" | "palette" | "background";

export interface HumanV2IconTraitLayer {
  layer: string;
  z_intent: "behind_head" | "over_forehead" | "face_mounted" | "small_accent" | "background" | "body";
}

export interface HumanV2IconTraitCard {
  id: string;
  slot: HumanV2IconTraitSlot;
  role: HumanV2IconTraitRole;
  style_pack: AssetPackId;
  logical_grid: Point;
  physical_canvas: Point;
  visual_intent: {
    summary: string;
    reference_cells?: string[];
    must_keep: string[];
    must_avoid: string[];
  };
  anchors: {
    primary: string;
    secondary?: string[];
  };
  bbox_logical: Box;
  clip: PatchClip;
  layers: HumanV2IconTraitLayer[];
  palette_slots: Record<string, string>;
  compatibility?: {
    works_with_face_shapes?: string[];
    avoid_with_headwear?: string[];
    notes?: string;
  };
  qa: {
    render_with: Array<Record<string, string>>;
    pass_conditions: string[];
  };
}

export const HUMAN_V2_ICON_TRAIT_CARD_BASE = {
  style_pack: "human_v2_icon" as AssetPackId,
  logical_grid: [40, 40] as Point,
  physical_canvas: [40, 40] as Point
};
