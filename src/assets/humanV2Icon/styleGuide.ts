import { Box, Point } from "../../types";

export const HUMAN_V2_ICON_STYLE_GUIDE = {
  id: "human_v2_icon",
  name: "Human V2 Icon",
  canvas: {
    size: [40, 40] as Point,
    scale: 12,
    sourceDesignGrid: [64, 64] as Point,
    coordinateScaleFromSource: 0.625,
    rule: "Specs and patches use the repo-native 40x40 logical canvas. Source 64x64 design notes are scaled by 0.625 and snapped to integer pixels."
  },
  mood: "cute, clean, editorial, collectible avatar",
  composition: {
    background: [0, 0, 40, 40] as Box,
    head: [11, 6, 29, 31] as Box,
    eyes: {
      left: [16, 19] as Point,
      right: [24, 19] as Point
    },
    eyebrowsY: [16, 18] as Point,
    nose: [20, 21, 20, 24] as Box,
    mouth: [18, 27, 22, 29] as Box,
    ears: {
      left: [8, 17, 11, 24] as Box,
      right: [29, 17, 32, 24] as Box
    },
    hair: [8, 3, 33, 21] as Box,
    shoulders: [6, 31, 34, 40] as Box
  },
  visualRules: [
    "Use at most five main colors: skin, hair, clothing, background, accessory.",
    "Keep outlines dark and stable: #171719, #1B1412, or #1F2430.",
    "Use broad shadows only; avoid noisy single-pixel detail clusters.",
    "Keep facial features sparse. Recognition should come from hair, glasses, and headwear silhouettes.",
    "Attach every trait to a rig anchor, socket, or named region before using manual offsets.",
    "Prioritize hair, headwear, and glasses as the highest-impact aesthetic traits.",
    "Use pastel background blocks that do not compete with the face silhouette."
  ],
  notAllowed: [
    "semi-realistic shading",
    "tiny noisy details",
    "random gradients",
    "excessive facial wrinkles",
    "oversized accessories",
    "unanchored floating pieces"
  ],
  layerOrder: [
    "background",
    "body",
    "hair.back",
    "headwear.back",
    "ears",
    "head",
    "face details",
    "eyes",
    "eyebrows",
    "nose",
    "mouth",
    "glasses",
    "hair.front",
    "headwear.front"
  ],
  acceptanceRules: [
    "Render output stays on a 40x40 logical grid.",
    "Every few-shot renders without validation errors.",
    "Debug anchors remain visible and aligned with eyes, nose, mouth, ears, and hair crown.",
    "A random gallery of at least 20 v2 specs has no obvious eye occlusion or detached accessories."
  ]
} as const;
