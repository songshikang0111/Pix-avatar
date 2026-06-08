import { HumanV2IconTraitCard, HUMAN_V2_ICON_TRAIT_CARD_BASE } from "../traitSchema";

export const HUMAN_V2_ICON_CLOTHING_TRAIT_CARDS: HumanV2IconTraitCard[] = [
  {
    ...HUMAN_V2_ICON_TRAIT_CARD_BASE,
    id: "clothing.tshirt",
    slot: "clothing.top",
    role: "mounted",
    visual_intent: {
      summary: "Simple pastel shoulder block that frames the head without becoming the focal point.",
      must_keep: ["broad shoulder shape", "quiet color", "stable neck connection"],
      must_avoid: ["complex folds", "high-contrast logo detail", "covering the chin"]
    },
    anchors: {
      primary: "neck",
      secondary: ["chin"]
    },
    bbox_logical: [6, 31, 34, 40],
    clip: "body",
    layers: [
      { layer: "body.shadow", z_intent: "body" },
      { layer: "body.base", z_intent: "body" }
    ],
    palette_slots: {
      base: "clothing.base",
      shadow: "clothing.shadow",
      highlight: "clothing.highlight"
    },
    qa: {
      render_with: [
        { "background.style": "pastel_mint" },
        { "background.style": "split_color" }
      ],
      pass_conditions: ["neck remains visible", "body stays inside the lower 9px band"]
    }
  }
];
