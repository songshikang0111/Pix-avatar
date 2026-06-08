import { HumanV2IconTraitCard, HUMAN_V2_ICON_TRAIT_CARD_BASE } from "../traitSchema";

export const HUMAN_V2_ICON_HAIR_TRAIT_CARDS: HumanV2IconTraitCard[] = [
  {
    ...HUMAN_V2_ICON_TRAIT_CARD_BASE,
    id: "hair.side_sweep",
    slot: "hair.style",
    role: "occluder",
    visual_intent: {
      summary: "Clean dark side-part short hair with a large top silhouette and one bang crossing the forehead.",
      reference_cells: ["fig2_r1_c1", "fig2_r2_c3"],
      must_keep: ["large dark silhouette", "clean irregular hairline", "base/shadow/highlight only"],
      must_avoid: ["noisy loose strands", "covering the eyes", "helmet-like full oval"]
    },
    anchors: {
      primary: "hairline.center",
      secondary: ["hair.crown", "left_temple", "right_temple"]
    },
    bbox_logical: [9, 4, 31, 21],
    clip: "hair",
    layers: [
      { layer: "hair.back", z_intent: "behind_head" },
      { layer: "hair.front", z_intent: "over_forehead" },
      { layer: "hair.highlight", z_intent: "small_accent" }
    ],
    palette_slots: {
      base: "hair.base",
      shadow: "hair.shadow",
      highlight: "hair.highlight",
      outline: "line.dark"
    },
    compatibility: {
      works_with_face_shapes: ["oval", "round", "soft_round", "heart"],
      avoid_with_headwear: ["cap", "beret", "hood"],
      notes: "Can coexist with glasses; the bang should not cover the frame."
    },
    qa: {
      render_with: [
        { "face.shape": "oval", "skin.tone": "fair_02", "glasses.shape": "none" },
        { "face.shape": "round", "skin.tone": "deep_brown_09", "glasses.shape": "narrow_rectangle" }
      ],
      pass_conditions: ["eyes are unobstructed", "forehead boundary is clean", "20 random combinations have no detached hair chunks"]
    }
  },
  {
    ...HUMAN_V2_ICON_TRAIT_CARD_BASE,
    id: "hair.bob",
    slot: "hair.style",
    role: "occluder",
    visual_intent: {
      summary: "Chunky bob with a simple bang row and two side blocks.",
      reference_cells: ["fig2_r3_c2"],
      must_keep: ["wide rounded top", "two readable side blocks", "small highlights"],
      must_avoid: ["thin strand noise", "overly long side locks", "flat rectangular cap"]
    },
    anchors: {
      primary: "hairline.center",
      secondary: ["hair.crown", "left_temple", "right_temple"]
    },
    bbox_logical: [8, 5, 32, 27],
    clip: "hair",
    layers: [
      { layer: "hair.back", z_intent: "behind_head" },
      { layer: "hair.front", z_intent: "over_forehead" },
      { layer: "hair.highlight", z_intent: "small_accent" }
    ],
    palette_slots: {
      base: "hair.base",
      shadow: "hair.shadow",
      highlight: "hair.highlight",
      outline: "line.dark"
    },
    qa: {
      render_with: [
        { "hair.color": "blonde", "background.style": "pastel_cream" },
        { "hair.color": "pink", "background.style": "pastel_pink" }
      ],
      pass_conditions: ["side blocks stay behind glasses", "bangs remain above eye centers"]
    }
  }
];
