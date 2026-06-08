import { HumanV2IconTraitCard, HUMAN_V2_ICON_TRAIT_CARD_BASE } from "../traitSchema";

export const HUMAN_V2_ICON_GLASSES_TRAIT_CARDS: HumanV2IconTraitCard[] = [
  {
    ...HUMAN_V2_ICON_TRAIT_CARD_BASE,
    id: "glasses.thick_square",
    slot: "glasses.shape",
    role: "mounted",
    visual_intent: {
      summary: "Thick square frame that reads clearly at 40x40 without hiding the eyes.",
      must_keep: ["dark frame", "short bridge", "symmetric lenses"],
      must_avoid: ["lens blocks wider than the face", "floating temple arms", "covering eyebrows"]
    },
    anchors: {
      primary: "nose.bridge",
      secondary: ["left_eye.center", "right_eye.center"]
    },
    bbox_logical: [12, 17, 28, 23],
    clip: "face",
    layers: [
      { layer: "glasses.lens", z_intent: "face_mounted" },
      { layer: "glasses.frame", z_intent: "face_mounted" },
      { layer: "glasses.highlight", z_intent: "small_accent" }
    ],
    palette_slots: {
      frame: "accessory.frame",
      lens: "accessory.lens",
      dark: "accessory.dark"
    },
    qa: {
      render_with: [
        { "face.shape": "round", "hair.style": "side_sweep" },
        { "face.shape": "oval", "headwear.type": "beanie" }
      ],
      pass_conditions: ["bridge touches nose bridge anchor", "both lenses remain inside face clip"]
    }
  }
];
