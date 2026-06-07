export type TraitKey =
  | "base.species"
  | "presentation"
  | "face.shape"
  | "face.detail"
  | "skin.tone"
  | "hair.style"
  | "hair.color"
  | "eyes.shape"
  | "eyes.color"
  | "eyebrows.shape"
  | "nose.shape"
  | "mouth.shape"
  | "ears.shape"
  | "glasses.shape"
  | "facial_hair.style"
  | "headwear.type"
  | "clothing.top"
  | "background.style";

export type TraitMap = Partial<Record<TraitKey, string>> & Record<string, string | undefined>;

export type Point = [number, number];
export type Box = [number, number, number, number];

export interface CanvasSpec {
  size: Point;
  scale: number;
  background?: "transparent" | string;
}

export interface AvatarSpec {
  version: "avatar/v1";
  canvas: CanvasSpec;
  asset_pack: {
    id: "human_v1";
    version: string;
  };
  seed?: number | string;
  palette?: Record<string, string>;
  traits: TraitMap;
  patches?: PixelPatch[];
}

export type PatchClip = "none" | "face" | "head" | "hair" | "body";

export type PixelPatch =
  | {
      op: "px";
      layer: string;
      x?: number;
      y?: number;
      at?: AnchorRef;
      region?: string;
      dx?: number;
      dy?: number;
      color: string;
      clip?: PatchClip;
    }
  | {
      op: "rect";
      layer: string;
      x?: number;
      y?: number;
      at?: AnchorRef;
      region?: string;
      dx?: number;
      dy?: number;
      w: number;
      h: number;
      color: string;
      clip?: PatchClip;
    }
  | {
      op: "line";
      layer: string;
      x1?: number;
      y1?: number;
      x2?: number;
      y2?: number;
      from?: AnchorRef;
      to?: AnchorRef;
      color: string;
      clip?: PatchClip;
    }
  | {
      op: "erase";
      layer: string;
      x: number;
      y: number;
      w?: number;
      h?: number;
      clip?: PatchClip;
    }
  | {
      op: "replace";
      layer: string;
      from: string;
      to: string;
      clip?: PatchClip;
    }
  | {
      op: "mirror";
      layer?: string;
      axis: "vertical" | "horizontal";
      x?: number;
      y?: number;
      ops: PixelPatch[];
    };

export interface AnchorRef {
  anchor: string;
  dx?: number;
  dy?: number;
}

export interface TraitOption {
  key: TraitKey;
  value: string;
  id: string;
  label: string;
  role: "root" | "mounted" | "occluder" | "modifier" | "palette" | "background";
  tags?: string[];
  description?: string;
}

export interface PaletteGroup {
  [variant: string]: Record<string, string>;
}

export interface HumanPalette {
  skin: PaletteGroup;
  hair: PaletteGroup;
  eyes: PaletteGroup;
  clothing: PaletteGroup;
  accessory: PaletteGroup;
  background: PaletteGroup;
  semantic: Record<string, string>;
}

export interface FaceRig {
  id: string;
  anchors: Record<string, Point>;
  sockets: Record<string, { anchor: Point; joinMask: Mask; minOverlap: number; zBack: number; zFront: number }>;
  zones: Record<string, { bbox: Box; anchor?: Point }>;
  masks: Record<string, Mask>;
  profiles: Record<string, string>;
  bbox: Box;
}

export interface Mask {
  width: number;
  height: number;
  points: Set<string>;
}

export interface PixelMeta {
  layer: string;
  trait?: string;
  colorToken?: string;
}

export interface PixelCell {
  x: number;
  y: number;
  color: string;
  meta: PixelMeta;
}

export interface RenderLayer {
  id: string;
  z: number;
  pixels: Map<string, PixelCell>;
}

export interface Placement {
  trait: string;
  layer?: string;
  anchor?: string;
  anchor_xy?: Point;
  socket?: string;
  socket_xy?: Point;
  mount_point?: Point;
  final_xy?: Point;
  bbox?: Box;
  overlap_pixels?: number;
  nudged_by?: Point;
  warnings?: string[];
}

export interface PixelStackEntry {
  layer: string;
  trait?: string;
  color: string;
  colorToken?: string;
  z: number;
}

export interface InspectReport {
  traits: TraitMap;
  anchors: Record<string, Point>;
  sockets: Record<string, Point>;
  zones: Record<string, { bbox: Box }>;
  placements: Record<string, Placement>;
  warnings: string[];
  layers: Array<{ id: string; z: number; pixels: number; bbox?: Box }>;
  bbox?: Box;
  visible_pixels: number;
  palette: Record<string, string>;
  pixel?: {
    xy: Point;
    visible_color?: string;
    stack: PixelStackEntry[];
  };
}

export interface PixelImage {
  width: number;
  height: number;
  pixels: Map<string, PixelCell>;
  stacks: Map<string, PixelStackEntry[]>;
}

export interface RenderOptions {
  debugGrid?: boolean;
  debugAnchors?: boolean;
  pixel?: Point;
}

export interface RenderResult {
  spec: AvatarSpec;
  image: PixelImage;
  layers: RenderLayer[];
  inspect: InspectReport;
  svg: string;
}

export interface ValidationResult {
  status: "ok" | "warning" | "error";
  warnings: string[];
  errors: string[];
  placements: Record<string, Placement>;
}
