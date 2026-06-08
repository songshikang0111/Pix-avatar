import { HumanV2IconTraitCard, HUMAN_V2_ICON_TRAIT_CARD_BASE } from "../traitSchema";

export const HUMAN_V2_ICON_BACKGROUND_TRAIT_CARDS: HumanV2IconTraitCard[] = [
  {
    ...HUMAN_V2_ICON_TRAIT_CARD_BASE,
    id: "background.diagonal",
    slot: "background.style",
    role: "background",
    visual_intent: {
      summary: "Pastel diagonal split that keeps the face as the dominant silhouette.",
      must_keep: ["large pastel fields", "low contrast behind facial features", "full canvas coverage"],
      must_avoid: ["busy stripes", "dark background values", "center line crossing the mouth"]
    },
    anchors: {
      primary: "head.center"
    },
    bbox_logical: [0, 0, 40, 40],
    clip: "none",
    layers: [
      { layer: "background.base", z_intent: "background" },
      { layer: "background.pattern", z_intent: "background" }
    ],
    palette_slots: {
      base: "background.base",
      accent: "background.accent",
      shadow: "background.shadow"
    },
    qa: {
      render_with: [
        { "hair.style": "side_sweep", "skin.tone": "fair_02" },
        { "hair.style": "curly_cap", "skin.tone": "deep_brown_09" }
      ],
      pass_conditions: ["background covers 40x40", "subject outline remains high contrast"]
    }
  }
];
