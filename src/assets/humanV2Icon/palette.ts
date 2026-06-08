import { HumanPalette } from "../../types";
import { HUMAN_PALETTE } from "../humanV1";

export const HUMAN_V2_ICON_PALETTE: HumanPalette = {
  skin: {
    ...HUMAN_PALETTE.skin,
    porcelain_01: { base: "#F8D4C5", shadow: "#DB9A83", highlight: "#FFE6DA", outline: "#1B1412" },
    fair_02: { base: "#EFC09E", shadow: "#C98762", highlight: "#FFD9BC", outline: "#1B1412" },
    medium_warm_05: { base: "#BD7D59", shadow: "#8E563C", highlight: "#DFA27B", outline: "#171719" },
    deep_brown_09: { base: "#6A4232", shadow: "#3F241C", highlight: "#94624A", outline: "#171719" }
  },
  hair: {
    ...HUMAN_PALETTE.hair,
    black_02: { base: "#171719", shadow: "#070708", highlight: "#42424A" },
    dark_brown: { base: "#2F211A", shadow: "#15100D", highlight: "#5D4637" },
    blonde: { base: "#F1D06C", shadow: "#8E6A25", highlight: "#FFF0A8" },
    blue: { base: "#2C65BE", shadow: "#163C7A", highlight: "#83ACEB" },
    pink: { base: "#F16EA9", shadow: "#A92D6E", highlight: "#FFB6D4" }
  },
  eyes: HUMAN_PALETTE.eyes,
  clothing: {
    ...HUMAN_PALETTE.clothing,
    tshirt: { base: "#F4F1D3", shadow: "#B7B07A", highlight: "#FFFBE2" },
    hoodie: { base: "#F05A9B", shadow: "#8F2D5A", highlight: "#FFB1D0" },
    jacket: { base: "#6FC6B4", shadow: "#347C70", highlight: "#BEEFE3" },
    suit: { base: "#2B2F3B", shadow: "#171719", highlight: "#626A7B" },
    robe: { base: "#C8B8F4", shadow: "#7A67BA", highlight: "#ECE4FF" },
    armor: { base: "#AAB6C2", shadow: "#5D6874", highlight: "#E1E8EF" }
  },
  accessory: {
    default: {
      ...HUMAN_PALETTE.accessory.default,
      dark: "#171719",
      frame: "#1F2430",
      frame_light: "#6C7482",
      lens: "#BDEAFF",
      lens_dark: "#171719",
      gold: "#F0C75E",
      red: "#E05369",
      white: "#FFF8EA"
    }
  },
  background: {
    ...HUMAN_PALETTE.background,
    pastel_mint: { base: "#C8F2DD", accent: "#F6F0B5", shadow: "#A6DDC6" },
    pastel_cream: { base: "#F6EFB8", accent: "#C8F2DD", shadow: "#DAD8A8" },
    pastel_pink: { base: "#F8A7C8", accent: "#BEEFE3", shadow: "#E77FB0" },
    pastel_cyan: { base: "#BDEAFF", accent: "#FFE2A8", shadow: "#8FCBDF" },
    pastel_yellow: { base: "#F8E98E", accent: "#BDEDD8", shadow: "#D7C865" },
    pastel_lavender: { base: "#D9C8FF", accent: "#BDEAFF", shadow: "#B69CEB" },
    diagonal: { base: "#F6EFB8", accent: "#C8F2DD", shadow: "#EBC7D8" },
    split_color: { base: "#BDEDD8", accent: "#F8A7C8", shadow: "#F6EFB8" }
  },
  semantic: {
    ...HUMAN_PALETTE.semantic,
    "mouth.dark": "#1B1412",
    "mouth.shadow": "#5E2524",
    "mouth.teeth": "#FFF8EA",
    "lip.highlight": "#F2A0A8",
    "line.dark": "#171719",
    "debug.grid": "#8EA0B7",
    "debug.anchor": "#FF306E"
  }
};
