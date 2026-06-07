import { FaceRig, Mask, Point, TraitMap } from "../types";
import {
  CANVAS_SIZE,
  addMaskPoint,
  createMask,
  maskDilate,
  maskErode,
  maskFromEllipse,
  maskFromRoundedRect,
  maskFromRowProfile,
  maskIntersect,
  maskUnion
} from "./geometry";

interface FaceConfig {
  top: number;
  bottom: number;
  profile: (t: number) => number;
  anchors: Record<string, Point>;
  profiles: Record<string, string>;
}

const baseAnchors = {
  "head.top": [64, 14] as Point,
  "head.center": [64, 58] as Point,
  "face.center": [64, 61] as Point,
  "face.centerline.top": [64, 28] as Point,
  "face.centerline.bottom": [64, 98] as Point,
  "left_eye.center": [49, 56] as Point,
  "right_eye.center": [79, 56] as Point,
  "left_eyebrow.center": [49, 49] as Point,
  "right_eyebrow.center": [79, 49] as Point,
  "nose.bridge": [64, 60] as Point,
  "nose.tip": [64, 69] as Point,
  "mouth.center": [64, 81] as Point,
  "mouth.baseline": [64, 82] as Point,
  chin: [64, 101] as Point,
  "left_ear.socket": [30, 59] as Point,
  "right_ear.socket": [98, 59] as Point,
  "hair.crown": [64, 19] as Point,
  "hairline.center": [64, 31] as Point,
  left_temple: [35, 39] as Point,
  right_temple: [93, 39] as Point,
  neck: [64, 102] as Point
};

const configs: Record<string, FaceConfig> = {
  soft_round: {
    top: 14,
    bottom: 103,
    profile: (t) => 21 + Math.sin(Math.PI * t) * 18 - Math.max(0, t - 0.75) * 14,
    anchors: baseAnchors,
    profiles: { face_width: "wide", face_height: "medium", jaw: "soft", forehead: "medium", cheek_width: "wide", ear_height: "medium", chin_space: "medium" }
  },
  oval: {
    top: 13,
    bottom: 106,
    profile: (t) => 16 + Math.sin(Math.PI * t) * 17 - Math.max(0, t - 0.72) * 8,
    anchors: {
      ...baseAnchors,
      "left_eye.center": [49, 56],
      "right_eye.center": [79, 56],
      "mouth.center": [64, 82],
      chin: [64, 104],
      "left_ear.socket": [31, 60],
      "right_ear.socket": [97, 60]
    },
    profiles: { face_width: "medium", face_height: "medium", jaw: "soft", forehead: "medium", cheek_width: "medium", ear_height: "medium", chin_space: "medium" }
  },
  round: {
    top: 18,
    bottom: 101,
    profile: (t) => 14 + Math.sin(Math.PI * t) * 24 - Math.max(0, t - 0.72) * 9,
    anchors: {
      ...baseAnchors,
      "head.top": [64, 18],
      "left_eye.center": [49, 55],
      "right_eye.center": [79, 55],
      "left_eyebrow.center": [49, 48],
      "right_eyebrow.center": [79, 48],
      "nose.tip": [64, 68],
      "mouth.center": [64, 79],
      chin: [64, 99],
      "left_ear.socket": [28, 58],
      "right_ear.socket": [100, 58],
      "hair.crown": [64, 21],
      "hairline.center": [64, 34]
    },
    profiles: { face_width: "wide", face_height: "short", jaw: "round", forehead: "medium", cheek_width: "wide", ear_height: "medium", chin_space: "small" }
  },
  square_soft: {
    top: 14,
    bottom: 106,
    profile: (t) => {
      const corner = Math.min(t, 1 - t) * 3.5;
      return 31 + Math.min(8, corner * 8) - Math.max(0, t - 0.72) * 9;
    },
    anchors: {
      ...baseAnchors,
      "left_eye.center": [48, 57],
      "right_eye.center": [80, 57],
      "mouth.center": [64, 83],
      chin: [64, 104],
      "left_ear.socket": [27, 60],
      "right_ear.socket": [101, 60],
      left_temple: [32, 39],
      right_temple: [96, 39]
    },
    profiles: { face_width: "wide", face_height: "medium", jaw: "square", forehead: "wide", cheek_width: "wide", ear_height: "medium", chin_space: "medium" }
  },
  heart: {
    top: 13,
    bottom: 104,
    profile: (t) => 14 + Math.sin(Math.PI * t) * 22 + (t < 0.35 ? 7 : 0) - Math.max(0, t - 0.55) * 23,
    anchors: {
      ...baseAnchors,
      "left_eye.center": [49, 55],
      "right_eye.center": [79, 55],
      "nose.tip": [64, 68],
      "mouth.center": [64, 80],
      chin: [64, 102],
      "left_ear.socket": [29, 58],
      "right_ear.socket": [99, 58],
      "hair.crown": [64, 18],
      "hairline.center": [64, 30],
      left_temple: [32, 37],
      right_temple: [96, 37]
    },
    profiles: { face_width: "medium", face_height: "medium", jaw: "narrow", forehead: "wide", cheek_width: "wide", ear_height: "medium", chin_space: "small" }
  },
  long: {
    top: 10,
    bottom: 112,
    profile: (t) => 13 + Math.sin(Math.PI * t) * 18 - Math.max(0, t - 0.72) * 7,
    anchors: {
      ...baseAnchors,
      "head.top": [64, 10],
      "head.center": [64, 61],
      "face.center": [64, 65],
      "left_eye.center": [49, 58],
      "right_eye.center": [79, 58],
      "left_eyebrow.center": [49, 51],
      "right_eyebrow.center": [79, 51],
      "nose.bridge": [64, 63],
      "nose.tip": [64, 73],
      "mouth.center": [64, 87],
      "mouth.baseline": [64, 88],
      chin: [64, 110],
      "left_ear.socket": [32, 62],
      "right_ear.socket": [96, 62],
      "hair.crown": [64, 16],
      "hairline.center": [64, 29]
    },
    profiles: { face_width: "narrow", face_height: "long", jaw: "soft", forehead: "medium", cheek_width: "medium", ear_height: "tall", chin_space: "large" }
  }
};

export function createFaceRig(shape = "soft_round", traits?: TraitMap): FaceRig {
  const config = configs[shape] ?? configs.soft_round;
  const head = maskFromRowProfile(config.top, config.bottom, 64, config.profile);
  const faceCore = maskIntersect(maskErode(head, 6), maskFromEllipse(64, config.anchors["face.center"][1] + 4, 31, 36));
  const hairAllowed = maskUnion(maskDilate(head, 5), maskFromRoundedRect(18, 5, 92, 58, 12));
  const body = maskFromRoundedRect(24, 96, 80, 34, 18);
  const leftJoin = smallJoinMask(config.anchors["left_ear.socket"], -1);
  const rightJoin = smallJoinMask(config.anchors["right_ear.socket"], 1);

  const anchors = applyLayoutModifiers(config.anchors, traits);
  const rig: FaceRig = {
    id: shape,
    anchors,
    sockets: {
      left_ear: { anchor: anchors["left_ear.socket"], joinMask: leftJoin, minOverlap: 3, zBack: 210, zFront: 450 },
      right_ear: { anchor: anchors["right_ear.socket"], joinMask: rightJoin, minOverlap: 3, zBack: 210, zFront: 450 }
    },
    zones: {
      eyes: { bbox: [39, anchors["left_eye.center"][1] - 7, 89, anchors["left_eye.center"][1] + 8] },
      nose: { bbox: [56, anchors["nose.tip"][1] - 10, 72, anchors["nose.tip"][1] + 8] },
      mouth: { bbox: [49, anchors["mouth.center"][1] - 6, 79, anchors["mouth.center"][1] + 9] },
      left_ear: { bbox: [18, anchors["left_ear.socket"][1] - 14, 36, anchors["left_ear.socket"][1] + 16] },
      right_ear: { bbox: [92, anchors["right_ear.socket"][1] - 14, 110, anchors["right_ear.socket"][1] + 16] },
      hair: { bbox: [18, 5, 110, 66] },
      body: { bbox: [24, 96, 104, 127] }
    },
    masks: {
      head,
      skin_visible: head,
      face_core: faceCore,
      hair_allowed: hairAllowed,
      left_ear_join: leftJoin,
      right_ear_join: rightJoin,
      body
    },
    profiles: config.profiles,
    bbox: [24, config.top, 104, config.bottom]
  };
  return rig;
}

function smallJoinMask([cx, cy]: Point, side: -1 | 1): Mask {
  const mask = createMask(CANVAS_SIZE, CANVAS_SIZE);
  for (let y = cy - 6; y <= cy + 6; y += 1) {
    for (let x = cx - 4; x <= cx + 4; x += 1) {
      const dx = (x - cx) * side;
      if (dx >= -1 && dx <= 4 && Math.abs(y - cy) <= 6 - Math.max(0, dx - 1)) {
        addMaskPoint(mask, x, y);
      }
    }
  }
  return mask;
}

function applyLayoutModifiers(anchors: Record<string, Point>, traits?: TraitMap): Record<string, Point> {
  const next = Object.fromEntries(Object.entries(anchors).map(([key, value]) => [key, [...value] as Point]));
  const presentation = traits?.presentation;

  if (presentation === "cute") {
    offset(next, "left_eye.center", [0, -2]);
    offset(next, "right_eye.center", [0, -2]);
    offset(next, "left_eyebrow.center", [0, -2]);
    offset(next, "right_eyebrow.center", [0, -2]);
    offset(next, "mouth.center", [0, -2]);
  }

  if (presentation === "mature" || presentation === "elderly") {
    offset(next, "nose.tip", [0, 1]);
    offset(next, "mouth.center", [0, 1]);
  }

  return next;
}

function offset(anchors: Record<string, Point>, key: string, [dx, dy]: Point) {
  const anchor = anchors[key];
  if (anchor) anchors[key] = [anchor[0] + dx, anchor[1] + dy];
}
