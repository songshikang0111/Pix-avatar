import { HumanV2IconTraitCard, HUMAN_V2_ICON_TRAIT_CARD_BASE } from "../traitSchema";

export const HUMAN_V2_ICON_MOUTH_TRAIT_CARDS: HumanV2IconTraitCard[] = [
  {
    ...HUMAN_V2_ICON_TRAIT_CARD_BASE,
    id: "mouth.open_smile",
    slot: "mouth.shape",
    role: "mounted",
    visual_intent: {
      summary: "Tiny open smile with a dark base and one light tooth block.",
      must_keep: ["4 to 6 pixel mouth footprint", "dark outline", "optional tooth highlight"],
      must_avoid: ["large realistic mouth", "too many lip pixels", "touching the nose"]
    },
    anchors: {
      primary: "mouth.center",
      secondary: ["nose.tip", "chin"]
    },
    bbox_logical: [17, 26, 23, 30],
    clip: "face",
    layers: [
      { layer: "mouth", z_intent: "face_mounted" },
      { layer: "lips", z_intent: "small_accent" }
    ],
    palette_slots: {
      dark: "mouth.dark",
      teeth: "mouth.teeth",
      highlight: "lip.highlight"
    },
    qa: {
      render_with: [
        { "face.shape": "oval", "nose.shape": "single_pixel" },
        { "face.shape": "round", "skin.tone": "deep_brown_09" }
      ],
      pass_conditions: ["mouth remains below nose.tip by at least 2px", "mouth does not touch chin"]
    }
  }
];
