import { AvatarSpec, TraitMap } from "../types";
import { createDefaultSpec } from "../assets/humanV1";

export type ReferenceFitSpec = AvatarSpec & { referenceId: string };

const base: TraitMap = {
  "face.shape": "side_oval",
  "face.detail": "none",
  "eyes.shape": "dot",
  "eyes.color": "black",
  "eyebrows.shape": "soft_flat",
  "nose.shape": "small_line",
  "mouth.shape": "small_smile",
  "ears.shape": "small_round",
  "glasses.shape": "none",
  "facial_hair.style": "none",
  "clothing.top": "tshirt"
};

const backgrounds = ["sky_flat", "mint_flat", "cream_flat", "mint_flat", "sky_flat", "yellow_flat"] as const;

export function referenceFitSpecs(): ReferenceFitSpec[] {
  return rows.flatMap((row, rowIndex) =>
    row.map((traits, columnIndex) => {
      const id = `avatar-${String(rowIndex * 6 + columnIndex + 1).padStart(2, "0")}`;
      const spec = createDefaultSpec({
        ...base,
        "background.style": backgrounds[columnIndex],
        ...traits
      }) as ReferenceFitSpec;
      spec.referenceId = id;
      spec.seed = `reference-fit-${id}`;
      return spec;
    })
  );
}

const rows: TraitMap[][] = [
  [
    { "skin.tone": "porcelain_01", "hair.style": "side_sweep", "hair.color": "black_02", "clothing.top": "jacket" },
    { "skin.tone": "porcelain_01", "hair.style": "clean_crop", "hair.color": "black_02", "mouth.shape": "neutral" },
    { "skin.tone": "deep_brown_09", "hair.style": "pink_bob", "hair.color": "pink", "glasses.shape": "sunglasses", "headwear.type": "headphones", "mouth.shape": "neutral", "background.style": "cream_flat" },
    { "skin.tone": "porcelain_01", "hair.style": "bob", "hair.color": "black_02", "mouth.shape": "small_smile" },
    { "skin.tone": "porcelain_01", "hair.style": "pink_bob", "hair.color": "pink", "glasses.shape": "thin_frame", "mouth.shape": "big_smile" },
    { "skin.tone": "deep_brown_09", "hair.style": "bob", "hair.color": "dark_brown", "face.detail": "blush_soft", "mouth.shape": "small_smile" }
  ],
  [
    { "skin.tone": "deep_brown_09", "hair.style": "clean_crop", "hair.color": "brown", "glasses.shape": "sunglasses", "mouth.shape": "neutral", "clothing.top": "hoodie", "background.style": "pink_flat" },
    { "skin.tone": "porcelain_01", "hair.style": "buzz_cut", "hair.color": "black_02", "headwear.type": "cap", "mouth.shape": "neutral" },
    { "skin.tone": "porcelain_01", "hair.style": "side_sweep", "hair.color": "black_02", "mouth.shape": "neutral" },
    { "skin.tone": "porcelain_01", "hair.style": "pink_bob", "hair.color": "pink", "headwear.type": "headphones", "glasses.shape": "narrow_rectangle", "mouth.shape": "neutral" },
    { "skin.tone": "porcelain_01", "hair.style": "pink_bob", "hair.color": "pink", "glasses.shape": "sunglasses", "facial_hair.style": "goatee", "mouth.shape": "big_smile", "background.style": "cream_flat" },
    { "skin.tone": "porcelain_01", "hair.style": "blue_short", "hair.color": "blue", "mouth.shape": "frown" }
  ],
  [
    { "skin.tone": "deep_brown_09", "hair.style": "side_sweep", "hair.color": "black_02", "mouth.shape": "small_smile", "background.style": "pink_flat" },
    { "skin.tone": "porcelain_01", "hair.style": "blonde_wave", "hair.color": "blonde", "glasses.shape": "small_round", "mouth.shape": "neutral", "background.style": "yellow_flat" },
    { "skin.tone": "deep_brown_09", "hair.style": "buzz_cut", "hair.color": "black_02", "headwear.type": "cap", "mouth.shape": "small_smile", "background.style": "pink_flat" },
    { "skin.tone": "porcelain_01", "hair.style": "long_side", "hair.color": "black_02", "face.detail": "blush_soft", "mouth.shape": "surprised_o" },
    { "skin.tone": "deep_brown_09", "hair.style": "blue_short", "hair.color": "blue", "mouth.shape": "teeth_smile" },
    { "skin.tone": "deep_brown_09", "hair.style": "pink_bob", "hair.color": "pink", "face.detail": "blush_soft", "mouth.shape": "neutral" }
  ],
  [
    { "skin.tone": "porcelain_01", "hair.style": "bald_clean", "glasses.shape": "narrow_rectangle", "mouth.shape": "teeth_smile" },
    { "skin.tone": "porcelain_01", "hair.style": "curly_cap", "hair.color": "blue", "mouth.shape": "neutral" },
    { "skin.tone": "porcelain_01", "hair.style": "buzz_cut", "headwear.type": "cap", "glasses.shape": "sunglasses", "mouth.shape": "neutral" },
    { "skin.tone": "porcelain_01", "hair.style": "buzz_cut", "hair.color": "pink", "headwear.type": "beanie", "mouth.shape": "neutral" },
    { "skin.tone": "porcelain_01", "hair.style": "side_sweep", "hair.color": "black_02", "facial_hair.style": "full_beard", "mouth.shape": "neutral" },
    { "skin.tone": "porcelain_01", "hair.style": "blonde_wave", "hair.color": "blonde", "face.detail": "blush_soft", "mouth.shape": "neutral" }
  ],
  [
    { "skin.tone": "porcelain_01", "hair.style": "bob", "hair.color": "black_02", "facial_hair.style": "full_beard", "mouth.shape": "neutral" },
    { "skin.tone": "porcelain_01", "hair.style": "pigtails", "hair.color": "pink", "face.detail": "blush_soft", "mouth.shape": "neutral", "background.style": "cream_flat" },
    { "skin.tone": "porcelain_01", "hair.style": "long_side", "hair.color": "black_02", "face.detail": "blush_soft", "mouth.shape": "surprised_o" },
    { "skin.tone": "deep_brown_09", "hair.style": "side_sweep", "hair.color": "black_02", "mouth.shape": "neutral", "background.style": "pink_flat" },
    { "skin.tone": "porcelain_01", "hair.style": "side_sweep", "hair.color": "black_02", "mouth.shape": "small_smile" },
    { "skin.tone": "porcelain_01", "hair.style": "blonde_wave", "hair.color": "blonde", "mouth.shape": "small_smile" }
  ],
  [
    { "skin.tone": "porcelain_01", "hair.style": "blue_short", "hair.color": "blue", "glasses.shape": "thin_frame", "mouth.shape": "neutral" },
    { "skin.tone": "porcelain_01", "hair.style": "bob", "hair.color": "black_02", "face.detail": "blush_soft", "mouth.shape": "neutral" },
    { "skin.tone": "deep_brown_09", "hair.style": "clean_crop", "hair.color": "black_02", "glasses.shape": "sunglasses", "mouth.shape": "teeth_smile" },
    { "skin.tone": "porcelain_01", "hair.style": "side_sweep", "hair.color": "black_02", "glasses.shape": "narrow_rectangle", "facial_hair.style": "full_beard", "mouth.shape": "neutral" },
    { "skin.tone": "deep_brown_09", "hair.style": "clean_crop", "hair.color": "dark_brown", "mouth.shape": "small_smile" },
    { "skin.tone": "deep_brown_09", "hair.style": "side_sweep", "hair.color": "dark_brown", "mouth.shape": "neutral", "background.style": "pink_flat" }
  ]
];
