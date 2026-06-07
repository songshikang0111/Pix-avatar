import { AvatarSpec, HumanPalette, TraitKey, TraitMap, TraitOption } from "../types";

export const REQUIRED_TRAIT_KEYS: TraitKey[] = [
  "face.shape",
  "skin.tone",
  "face.detail",
  "hair.style",
  "hair.color",
  "eyes.shape",
  "eyes.color",
  "eyebrows.shape",
  "nose.shape",
  "mouth.shape",
  "ears.shape",
  "glasses.shape",
  "facial_hair.style",
  "headwear.type",
  "clothing.top",
  "background.style"
];

const options = <T extends string>(
  key: TraitKey,
  role: TraitOption["role"],
  values: Array<[T, string, string?, string[]?]>
): TraitOption[] =>
  values.map(([value, label, description, tags]) => ({
    key,
    value,
    id: `${key}.${value}`,
    label,
    role,
    description,
    tags
  }));

export const TRAIT_OPTIONS: TraitOption[] = [
  ...options("base.species", "root", [["human", "Human"]]),
  ...options("presentation", "modifier", [
    ["androgynous", "Androgynous"],
    ["masculine", "Masculine"],
    ["feminine", "Feminine"],
    ["cute", "Cute"],
    ["mature", "Mature"],
    ["elderly", "Elderly"]
  ]),
  ...options("face.shape", "root", [
    ["soft_round", "Soft round", "Wide cheeks with a soft jaw.", ["wide", "soft"]],
    ["oval", "Oval", "Balanced neutral face rig.", ["medium"]],
    ["round", "Round", "Short and friendly rounded face.", ["short", "wide"]],
    ["square_soft", "Soft square", "Structured jaw with softened corners.", ["wide", "jaw"]],
    ["heart", "Heart", "Wider forehead and narrow chin.", ["forehead", "narrow_chin"]],
    ["long", "Long", "Tall face with lower nose and mouth anchors.", ["long"]]
  ]),
  ...options("skin.tone", "palette", [
    ["porcelain_01", "Porcelain"],
    ["fair_02", "Fair"],
    ["light_warm_03", "Light warm"],
    ["medium_warm_05", "Medium warm"],
    ["tan_07", "Tan"],
    ["deep_brown_09", "Deep brown"],
    ["fantasy_blue", "Fantasy blue"],
    ["robot_gray", "Robot gray"]
  ]),
  ...options("face.detail", "mounted", [
    ["none", "None"],
    ["blush_soft", "Soft blush"],
    ["freckles_light", "Light freckles"],
    ["cheek_mole_left", "Left mole"],
    ["under_eye_lines", "Under eye lines"],
    ["scar_left_cheek", "Left cheek scar"]
  ]),
  ...options("hair.style", "occluder", [
    ["buzz_cut", "Buzz cut"],
    ["short_messy", "Short messy"],
    ["bob_bangs", "Bob with bangs"],
    ["curly_short", "Short curls"],
    ["long_wavy", "Long wavy"],
    ["undercut", "Undercut"],
    ["bald_clean", "Bald clean"]
  ]),
  ...options("hair.color", "palette", [
    ["black_02", "Soft black"],
    ["dark_brown", "Dark brown"],
    ["brown", "Brown"],
    ["blonde", "Blonde"],
    ["ginger", "Ginger"],
    ["blue", "Blue"],
    ["pink", "Pink"],
    ["gray", "Gray"]
  ]),
  ...options("eyes.shape", "mounted", [
    ["dot", "Dot"],
    ["round", "Round"],
    ["almond", "Almond"],
    ["sleepy", "Sleepy"],
    ["happy_arc", "Happy arc"],
    ["starry", "Starry"]
  ]),
  ...options("eyes.color", "palette", [
    ["black", "Black"],
    ["brown", "Brown"],
    ["amber", "Amber"],
    ["green", "Green"],
    ["blue", "Blue"],
    ["purple", "Purple"],
    ["robot_cyan", "Robot cyan"]
  ]),
  ...options("eyebrows.shape", "mounted", [
    ["soft_flat", "Soft flat"],
    ["arched", "Arched"],
    ["thick_flat", "Thick flat"],
    ["angry", "Angry"],
    ["sad", "Sad"],
    ["raised_left", "Raised left"]
  ]),
  ...options("nose.shape", "mounted", [
    ["single_pixel", "Single pixel"],
    ["button", "Button"],
    ["small_line", "Small line"],
    ["soft_bridge", "Soft bridge"],
    ["triangle", "Triangle"],
    ["wide", "Wide"]
  ]),
  ...options("mouth.shape", "mounted", [
    ["neutral", "Neutral"],
    ["small_smile", "Small smile"],
    ["big_smile", "Big smile"],
    ["frown", "Frown"],
    ["surprised_o", "Surprised O"],
    ["smirk_left", "Left smirk"],
    ["teeth_smile", "Teeth smile"]
  ]),
  ...options("ears.shape", "mounted", [
    ["small_round", "Small round"],
    ["round", "Round"],
    ["large_round", "Large round"],
    ["pointed", "Pointed"],
    ["stick_out", "Stick out"],
    ["none", "None"]
  ]),
  ...options("glasses.shape", "mounted", [
    ["none", "None"],
    ["round", "Round"],
    ["square", "Square"],
    ["rectangle", "Rectangle"],
    ["thin_frame", "Thin frame"],
    ["sunglasses", "Sunglasses"]
  ]),
  ...options("facial_hair.style", "mounted", [
    ["none", "None"],
    ["stubble", "Stubble"],
    ["mustache_thin", "Thin mustache"],
    ["goatee", "Goatee"],
    ["short_beard", "Short beard"],
    ["sideburns", "Sideburns"]
  ]),
  ...options("headwear.type", "occluder", [
    ["none", "None"],
    ["beanie", "Beanie"],
    ["cap", "Cap"],
    ["crown", "Crown"],
    ["headphones", "Headphones"],
    ["hood", "Hood"],
    ["beret", "Beret"]
  ]),
  ...options("clothing.top", "mounted", [
    ["tshirt", "T-shirt"],
    ["hoodie", "Hoodie"],
    ["jacket", "Jacket"],
    ["suit", "Suit"],
    ["robe", "Robe"],
    ["armor", "Armor"]
  ]),
  ...options("background.style", "background", [
    ["transparent", "Transparent"],
    ["solid", "Solid"],
    ["mint_flat", "Mint flat"],
    ["cream_flat", "Cream flat"],
    ["pink_flat", "Pink flat"],
    ["sky_flat", "Sky flat"],
    ["lavender_flat", "Lavender flat"],
    ["peach_flat", "Peach flat"],
    ["circle", "Circle"],
    ["rounded_square", "Rounded square"],
    ["checker", "Checker"],
    ["stars", "Stars"],
    ["diagonal_stripes", "Diagonal stripes"],
    ["aura", "Aura"]
  ])
];

export const HUMAN_PALETTE: HumanPalette = {
  skin: {
    porcelain_01: { base: "#F4C7B7", shadow: "#D99380", highlight: "#FFE0D2", outline: "#8A4A3A" },
    fair_02: { base: "#E7B493", shadow: "#BE7F5C", highlight: "#F7D0B4", outline: "#7B4533" },
    light_warm_03: { base: "#DCA178", shadow: "#A86647", highlight: "#F0BE98", outline: "#6E3B2B" },
    medium_warm_05: { base: "#B87955", shadow: "#8F563B", highlight: "#D89A72", outline: "#5B3126" },
    tan_07: { base: "#9C6345", shadow: "#71422F", highlight: "#BC815F", outline: "#43271E" },
    deep_brown_09: { base: "#5D382C", shadow: "#3C211A", highlight: "#855642", outline: "#21120E" },
    fantasy_blue: { base: "#74A9C8", shadow: "#4F7897", highlight: "#9BD3EA", outline: "#2C485D" },
    robot_gray: { base: "#9EA7B0", shadow: "#66717C", highlight: "#CCD3D8", outline: "#3A424A" }
  },
  hair: {
    black_02: { base: "#171719", shadow: "#070708", highlight: "#3A3A40" },
    dark_brown: { base: "#3A2418", shadow: "#21140E", highlight: "#5A3A28" },
    brown: { base: "#6E4226", shadow: "#402414", highlight: "#9C6A3F" },
    blonde: { base: "#CFA84E", shadow: "#8E6A25", highlight: "#F1D06C" },
    ginger: { base: "#A84E25", shadow: "#6C2C15", highlight: "#D9783A" },
    blue: { base: "#244D91", shadow: "#132854", highlight: "#5F8EDB" },
    pink: { base: "#C35D8D", shadow: "#7A2D52", highlight: "#EF93BB" },
    gray: { base: "#7B818A", shadow: "#4B5057", highlight: "#B4BAC2" }
  },
  eyes: {
    black: { iris: "#1A1512", pupil: "#090706", highlight: "#FFFFFF" },
    brown: { iris: "#5A351F", pupil: "#1B1009", highlight: "#FFDFA3" },
    amber: { iris: "#B56B22", pupil: "#1A0F08", highlight: "#FFE3A6" },
    green: { iris: "#3D7E48", pupil: "#132617", highlight: "#DDF7B2" },
    blue: { iris: "#2D6AA0", pupil: "#0D1C2C", highlight: "#BFE8FF" },
    purple: { iris: "#6B4AA0", pupil: "#1B0E2B", highlight: "#E1D4FF" },
    robot_cyan: { iris: "#38D6E8", pupil: "#07373D", highlight: "#D8FCFF" }
  },
  clothing: {
    tshirt: { base: "#2E7D6E", shadow: "#17443D", highlight: "#54B5A0" },
    hoodie: { base: "#294E8A", shadow: "#172B4C", highlight: "#557FC2" },
    jacket: { base: "#5F6670", shadow: "#343940", highlight: "#939BA6" },
    suit: { base: "#202A34", shadow: "#111820", highlight: "#4B5966" },
    robe: { base: "#6A4A92", shadow: "#3D2958", highlight: "#9A76C5" },
    armor: { base: "#7B8792", shadow: "#46505A", highlight: "#C0CBD4" }
  },
  accessory: {
    default: {
      dark: "#1F2430",
      frame: "#263241",
      frame_light: "#65798C",
      lens: "#BDEAFF",
      lens_dark: "#202B36",
      gold: "#D6A73B",
      red: "#B9413E",
      white: "#F5F4EF"
    }
  },
  background: {
    transparent: { base: "transparent", accent: "#E8EEF5", shadow: "#CBD5E1" },
    solid: { base: "#BFE8D3", accent: "#8EBCA0", shadow: "#9CC9AD" },
    mint_flat: { base: "#BFE8D3", accent: "#8EBCA0", shadow: "#9CC9AD" },
    cream_flat: { base: "#F3E7B7", accent: "#D8BE75", shadow: "#E3D39B" },
    pink_flat: { base: "#F2AFC6", accent: "#D7799C", shadow: "#E395B2" },
    sky_flat: { base: "#AEE3E8", accent: "#67AFBC", shadow: "#8BCBD3" },
    lavender_flat: { base: "#DAC9F0", accent: "#9277BD", shadow: "#BBA8D8" },
    peach_flat: { base: "#F1C29D", accent: "#CF8656", shadow: "#DFA77E" },
    circle: { base: "#E8EEF5", accent: "#7C9EC8", shadow: "#C6D3E3" },
    rounded_square: { base: "#F0E4C9", accent: "#C7925B", shadow: "#DDC79E" },
    checker: { base: "#EEF0F2", accent: "#C8CDD4", shadow: "#AEB6C2" },
    stars: { base: "#172033", accent: "#F5D76E", shadow: "#304463" },
    diagonal_stripes: { base: "#E6DDF0", accent: "#7E6BA7", shadow: "#C8B9DA" },
    aura: { base: "#DBF2EC", accent: "#D9617A", shadow: "#81CBBE" }
  },
  semantic: {
    "mouth.dark": "#1B1412",
    "mouth.shadow": "#341412",
    "mouth.teeth": "#FFF4E6",
    "lip.highlight": "#E78A94",
    "blush.soft": "#D66B76",
    "scar.light": "#F2A1A1",
    "line.dark": "#151313",
    "debug.grid": "#8EA0B7",
    "debug.anchor": "#FF306E"
  }
};

export const DEFAULT_TRAITS: TraitMap = {
  "base.species": "human",
  presentation: "androgynous",
  "face.shape": "soft_round",
  "skin.tone": "medium_warm_05",
  "face.detail": "blush_soft",
  "hair.style": "short_messy",
  "hair.color": "dark_brown",
  "eyes.shape": "almond",
  "eyes.color": "brown",
  "eyebrows.shape": "soft_flat",
  "nose.shape": "button",
  "mouth.shape": "small_smile",
  "ears.shape": "round",
  "glasses.shape": "none",
  "facial_hair.style": "none",
  "headwear.type": "none",
  "clothing.top": "hoodie",
  "background.style": "circle"
};

export function traitOptionsByKey() {
  return TRAIT_OPTIONS.reduce<Record<string, TraitOption[]>>((acc, option) => {
    acc[option.key] = acc[option.key] ?? [];
    acc[option.key].push(option);
    return acc;
  }, {});
}

export function getTraitOption(key: string, value: string) {
  return TRAIT_OPTIONS.find((option) => option.key === key && option.value === value);
}

export function listTraitValues(key: TraitKey | string) {
  return TRAIT_OPTIONS.filter((option) => option.key === key).map((option) => option.value);
}

export function createDefaultSpec(overrides: TraitMap = {}): AvatarSpec {
  return {
    version: "avatar/v1" as const,
    canvas: { size: [40, 40] as [number, number], scale: 12, background: "transparent" },
    asset_pack: { id: "human_v1" as const, version: "1.0.0" },
    traits: { ...DEFAULT_TRAITS, ...overrides }
  };
}
