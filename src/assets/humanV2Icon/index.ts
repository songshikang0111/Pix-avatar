import { AvatarSpec, TraitKey, TraitMap, TraitOption } from "../../types";
import { HUMAN_V2_ICON_PALETTE } from "./palette";
import { HUMAN_V2_ICON_STYLE_GUIDE } from "./styleGuide";
import { HUMAN_V2_ICON_BACKGROUND_TRAIT_CARDS } from "./traits/background";
import { HUMAN_V2_ICON_CLOTHING_TRAIT_CARDS } from "./traits/clothing";
import { HUMAN_V2_ICON_FACE_TRAIT_CARDS } from "./traits/face";
import { HUMAN_V2_ICON_GLASSES_TRAIT_CARDS } from "./traits/glasses";
import { HUMAN_V2_ICON_HAIR_TRAIT_CARDS } from "./traits/hair";
import { HUMAN_V2_ICON_HEADWEAR_TRAIT_CARDS } from "./traits/headwear";
import { HUMAN_V2_ICON_MOUTH_TRAIT_CARDS } from "./traits/mouth";

export const HUMAN_V2_ICON_VERSION = "2.0.0";

export const HUMAN_V2_ICON_REQUIRED_TRAIT_KEYS: TraitKey[] = [
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

export const HUMAN_V2_ICON_TRAIT_OPTIONS: TraitOption[] = [
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
    ["oval", "Icon oval", "Balanced v2 face rig."],
    ["round", "Icon round", "Short friendly face."],
    ["soft_round", "Soft round", "Wide cheeks with soft jaw."],
    ["heart", "Heart", "Wider forehead and narrow chin."],
    ["square_soft", "Soft square", "Structured jaw with softened corners."],
    ["long", "Long", "Tall face with more chin space."]
  ]),
  ...options("skin.tone", "palette", [
    ["porcelain_01", "Porcelain"],
    ["fair_02", "Fair"],
    ["light_warm_03", "Light warm"],
    ["medium_warm_05", "Medium warm"],
    ["tan_07", "Tan"],
    ["deep_brown_09", "Deep brown"]
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
    ["side_sweep", "Side sweep", "Large clean side-part silhouette."],
    ["clean_crop", "Clean crop", "Compact rounded crop with a dark outline."],
    ["bob", "Bob", "Simple bob with chunky bangs."],
    ["curly_cap", "Curly cap", "Rounded curls as a single strong mass."],
    ["pink_bob", "Pink bob", "Bob tuned for bright pink palettes."],
    ["blue_short", "Blue short", "Short sweep tuned for blue palettes."],
    ["blonde_wave", "Blonde wave", "Soft side wave with two highlights."],
    ["buzz", "Buzz", "Low clean hair cap."],
    ["bald", "Bald", "No hair silhouette."],
    ["long_side", "Long side", "Long side blocks with clean ends."]
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
    ["happy_arc", "Happy arc"],
    ["almond", "Almond"],
    ["sleepy", "Sleepy"],
    ["starry", "Starry"]
  ]),
  ...options("eyes.color", "palette", [
    ["black", "Black"],
    ["brown", "Brown"],
    ["amber", "Amber"],
    ["green", "Green"],
    ["blue", "Blue"],
    ["purple", "Purple"]
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
    ["tiny_smile", "Tiny smile"],
    ["open_smile", "Open smile"],
    ["teeth_smile", "Teeth smile"],
    ["smirk", "Smirk"],
    ["surprised", "Surprised"]
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
    ["small_round", "Small round"],
    ["thick_square", "Thick square"],
    ["sunglasses", "Sunglasses"],
    ["narrow_rectangle", "Narrow rectangle"],
    ["nerd_frame", "Nerd frame"]
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
    ["cap", "Cap"],
    ["beanie", "Beanie"],
    ["headphones", "Headphones"],
    ["beret", "Beret"],
    ["hairband", "Hairband"],
    ["hood", "Hood"]
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
    ["pastel_mint", "Pastel mint"],
    ["pastel_cream", "Pastel cream"],
    ["pastel_pink", "Pastel pink"],
    ["pastel_cyan", "Pastel cyan"],
    ["pastel_yellow", "Pastel yellow"],
    ["pastel_lavender", "Pastel lavender"],
    ["diagonal", "Diagonal"],
    ["split_color", "Split color"]
  ])
];

export const HUMAN_V2_ICON_DEFAULT_TRAITS: TraitMap = {
  "base.species": "human",
  presentation: "cute",
  "face.shape": "oval",
  "skin.tone": "fair_02",
  "face.detail": "none",
  "hair.style": "side_sweep",
  "hair.color": "black_02",
  "eyes.shape": "dot",
  "eyes.color": "black",
  "eyebrows.shape": "soft_flat",
  "nose.shape": "single_pixel",
  "mouth.shape": "tiny_smile",
  "ears.shape": "small_round",
  "glasses.shape": "none",
  "facial_hair.style": "none",
  "headwear.type": "none",
  "clothing.top": "tshirt",
  "background.style": "pastel_mint"
};

export function createHumanV2IconDefaultSpec(overrides: TraitMap = {}): AvatarSpec {
  return {
    version: "avatar/v1" as const,
    canvas: { size: [40, 40] as [number, number], scale: 12, background: "transparent" },
    asset_pack: { id: "human_v2_icon" as const, version: HUMAN_V2_ICON_VERSION },
    traits: { ...HUMAN_V2_ICON_DEFAULT_TRAITS, ...overrides }
  };
}

export const HUMAN_V2_ICON_TRAIT_CARDS = [
  ...HUMAN_V2_ICON_HAIR_TRAIT_CARDS,
  ...HUMAN_V2_ICON_HEADWEAR_TRAIT_CARDS,
  ...HUMAN_V2_ICON_GLASSES_TRAIT_CARDS,
  ...HUMAN_V2_ICON_FACE_TRAIT_CARDS,
  ...HUMAN_V2_ICON_MOUTH_TRAIT_CARDS,
  ...HUMAN_V2_ICON_CLOTHING_TRAIT_CARDS,
  ...HUMAN_V2_ICON_BACKGROUND_TRAIT_CARDS
];

export { HUMAN_V2_ICON_PALETTE, HUMAN_V2_ICON_STYLE_GUIDE };
