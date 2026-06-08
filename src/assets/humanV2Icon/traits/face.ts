import { HumanV2IconTraitCard, HUMAN_V2_ICON_TRAIT_CARD_BASE } from "../traitSchema";

export const HUMAN_V2_ICON_FACE_TRAIT_CARDS: HumanV2IconTraitCard[] = [
  {
    ...HUMAN_V2_ICON_TRAIT_CARD_BASE,
    id: "face.oval",
    slot: "face.shape",
    role: "root",
    visual_intent: {
      summary: "Compact oval face with dark outline and enough lower-face space for small mouths.",
      must_keep: ["centered head mass", "clean jaw curve", "small facial feature area"],
      must_avoid: ["wide noisy cheeks", "mouth too close to chin", "unbalanced ears"]
    },
    anchors: {
      primary: "head.center",
      secondary: ["left_eye.center", "right_eye.center", "nose.tip", "mouth.center", "chin"]
    },
    bbox_logical: [11, 6, 29, 31],
    clip: "head",
    layers: [
      { layer: "head.base", z_intent: "face_mounted" },
      { layer: "skin.shadow", z_intent: "small_accent" },
      { layer: "skin.highlight", z_intent: "small_accent" }
    ],
    palette_slots: {
      base: "skin.base",
      shadow: "skin.shadow",
      highlight: "skin.highlight",
      outline: "line.dark"
    },
    qa: {
      render_with: [
        { "hair.style": "side_sweep", "glasses.shape": "none" },
        { "hair.style": "bob", "glasses.shape": "thick_square" }
      ],
      pass_conditions: ["eyes are horizontally balanced", "mouth center is below nose tip", "chin has at least 3px of clearance"]
    }
  }
];
