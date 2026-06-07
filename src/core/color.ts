import { HumanPalette, TraitMap } from "../types";
import { HUMAN_PALETTE } from "../assets/humanV1";

const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

export function normalizeHex(input: string): string {
  if (input === "transparent") return "transparent";
  if (!HEX_RE.test(input)) {
    throw new Error(`Invalid color: ${input}`);
  }
  return input.startsWith("#") ? input.toUpperCase() : `#${input.toUpperCase()}`;
}

export function hexToRgb(hex: string): [number, number, number, number] {
  if (hex === "transparent") return [0, 0, 0, 0];
  const value = normalizeHex(hex).slice(1);
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    255
  ];
}

export function resolvePalette(traits: TraitMap, overrides?: Record<string, string>, palette: HumanPalette = HUMAN_PALETTE) {
  const skin = traits["skin.tone"] ?? "medium_warm_05";
  const hair = traits["hair.color"] ?? "dark_brown";
  const eyes = traits["eyes.color"] ?? "brown";
  const clothing = traits["clothing.top"] ?? "hoodie";
  const background = traits["background.style"] ?? "circle";
  const tokens: Record<string, string> = {};

  const mergeGroup = (prefix: string, group?: Record<string, string>) => {
    if (!group) return;
    for (const [slot, color] of Object.entries(group)) {
      tokens[`${prefix}.${slot}`] = normalizeHex(color);
    }
  };

  mergeGroup("skin", palette.skin[skin] ?? palette.skin.medium_warm_05);
  mergeGroup("hair", palette.hair[hair] ?? palette.hair.dark_brown);
  mergeGroup("eyes", palette.eyes[eyes] ?? palette.eyes.brown);
  mergeGroup("clothing", palette.clothing[clothing] ?? palette.clothing.hoodie);
  mergeGroup("background", palette.background[background] ?? palette.background.circle);
  mergeGroup("accessory", palette.accessory.default);

  for (const [slot, color] of Object.entries(palette.semantic)) {
    tokens[slot] = normalizeHex(color);
  }

  if (overrides) {
    for (const [slot, color] of Object.entries(overrides)) {
      tokens[slot] = normalizeHex(color);
    }
  }

  return tokens;
}

export function colorToken(token: string, palette: Record<string, string>): string {
  if (token === "transparent") return "transparent";
  if (HEX_RE.test(token)) return normalizeHex(token);
  const resolved = palette[token];
  if (!resolved) {
    throw new Error(`Unknown palette token: ${token}`);
  }
  return resolved;
}
