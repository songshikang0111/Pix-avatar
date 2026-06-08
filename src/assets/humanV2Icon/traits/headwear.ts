import { HumanV2IconTraitCard, HUMAN_V2_ICON_TRAIT_CARD_BASE } from "../traitSchema";

export const HUMAN_V2_ICON_HEADWEAR_TRAIT_CARDS: HumanV2IconTraitCard[] = [
  {
    ...HUMAN_V2_ICON_TRAIT_CARD_BASE,
    id: "headwear.hairband",
    slot: "headwear.type",
    role: "occluder",
    visual_intent: {
      summary: "A simple bright hairband mounted across the top hairline.",
      must_keep: ["single clean band", "small center highlight", "clear overlap with hair"],
      must_avoid: ["floating above crown", "covering eyes", "too many stripe details"]
    },
    anchors: {
      primary: "hairline.center",
      secondary: ["hair.crown"]
    },
    bbox_logical: [10, 8, 30, 13],
    clip: "hair",
    layers: [{ layer: "headwear.front", z_intent: "over_forehead" }],
    palette_slots: {
      base: "clothing.base",
      shadow: "clothing.shadow",
      highlight: "clothing.highlight"
    },
    qa: {
      render_with: [
        { "hair.style": "bob", "hair.color": "pink" },
        { "hair.style": "blonde_wave", "hair.color": "blonde" }
      ],
      pass_conditions: ["band is attached to hairline", "hair silhouette remains readable"]
    }
  }
];
