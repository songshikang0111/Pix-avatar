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
  centerX?: number;
  profile: (t: number) => number;
  anchors: Record<string, Point>;
  profiles: Record<string, string>;
}

const baseAnchors = {
  "head.top": [20, 5] as Point,
  "head.center": [20, 18] as Point,
  "face.center": [20, 19] as Point,
  "face.centerline.top": [20, 10] as Point,
  "face.centerline.bottom": [20, 31] as Point,
  "left_eye.center": [16, 18] as Point,
  "right_eye.center": [24, 18] as Point,
  "left_eyebrow.center": [16, 15] as Point,
  "right_eyebrow.center": [24, 15] as Point,
  "nose.bridge": [20, 19] as Point,
  "nose.tip": [20, 22] as Point,
  "mouth.center": [20, 26] as Point,
  "mouth.baseline": [20, 26] as Point,
  chin: [20, 32] as Point,
  "left_ear.socket": [9, 19] as Point,
  "right_ear.socket": [31, 19] as Point,
  "hair.crown": [20, 5] as Point,
  "hairline.center": [20, 10] as Point,
  left_temple: [11, 12] as Point,
  right_temple: [29, 12] as Point,
  neck: [20, 32] as Point
};

const configs: Record<string, FaceConfig> = {
  side_oval: {
    top: 4,
    bottom: 33,
    centerX: 20,
    profile: (t) => 4.5 + Math.sin(Math.PI * t) * 6.2 - Math.max(0, t - 0.82) * 2.6,
    anchors: {
      ...baseAnchors,
      "head.top": [20, 4],
      "head.center": [20, 18],
      "face.center": [21, 19],
      "face.centerline.top": [22, 10],
      "face.centerline.bottom": [22, 31],
      "left_eye.center": [17, 17],
      "right_eye.center": [23, 17],
      "left_eyebrow.center": [17, 14],
      "right_eyebrow.center": [23, 14],
      "nose.bridge": [23, 18],
      "nose.tip": [24, 22],
      "mouth.center": [22, 26],
      "mouth.baseline": [22, 26],
      chin: [21, 33],
      "left_ear.socket": [9, 18],
      "right_ear.socket": [30, 18],
      "hair.crown": [20, 4],
      "hairline.center": [20, 9],
      left_temple: [10, 11],
      right_temple: [29, 11],
      neck: [20, 33]
    },
    profiles: { face_width: "medium", face_height: "medium", jaw: "soft_right", forehead: "medium", cheek_width: "medium", ear_height: "medium", chin_space: "medium" }
  },
  soft_round: {
    top: 5,
    bottom: 32,
    profile: (t) => 5 + Math.sin(Math.PI * t) * 7 - Math.max(0, t - 0.76) * 5,
    anchors: baseAnchors,
    profiles: { face_width: "wide", face_height: "medium", jaw: "soft", forehead: "medium", cheek_width: "wide", ear_height: "medium", chin_space: "medium" }
  },
  oval: {
    top: 4,
    bottom: 33,
    profile: (t) => 4 + Math.sin(Math.PI * t) * 7 - Math.max(0, t - 0.72) * 3,
    anchors: {
      ...baseAnchors,
      "mouth.center": [20, 27],
      chin: [20, 33],
      "left_ear.socket": [10, 19],
      "right_ear.socket": [30, 19]
    },
    profiles: { face_width: "medium", face_height: "medium", jaw: "soft", forehead: "medium", cheek_width: "medium", ear_height: "medium", chin_space: "medium" }
  },
  round: {
    top: 6,
    bottom: 31,
    profile: (t) => 4 + Math.sin(Math.PI * t) * 8 - Math.max(0, t - 0.72) * 4,
    anchors: {
      ...baseAnchors,
      "head.top": [20, 6],
      "left_eye.center": [16, 17],
      "right_eye.center": [24, 17],
      "left_eyebrow.center": [16, 14],
      "right_eyebrow.center": [24, 14],
      "nose.tip": [20, 21],
      "mouth.center": [20, 25],
      chin: [20, 31],
      "left_ear.socket": [8, 18],
      "right_ear.socket": [32, 18],
      "hair.crown": [20, 6],
      "hairline.center": [20, 11]
    },
    profiles: { face_width: "wide", face_height: "short", jaw: "round", forehead: "medium", cheek_width: "wide", ear_height: "medium", chin_space: "small" }
  },
  square_soft: {
    top: 5,
    bottom: 33,
    profile: (t) => 8 + Math.min(3, Math.min(t, 1 - t) * 12) - Math.max(0, t - 0.72) * 4,
    anchors: {
      ...baseAnchors,
      "left_eye.center": [15, 18],
      "right_eye.center": [25, 18],
      "mouth.center": [20, 27],
      chin: [20, 33],
      "left_ear.socket": [8, 19],
      "right_ear.socket": [32, 19],
      left_temple: [10, 12],
      right_temple: [30, 12]
    },
    profiles: { face_width: "wide", face_height: "medium", jaw: "square", forehead: "wide", cheek_width: "wide", ear_height: "medium", chin_space: "medium" }
  },
  heart: {
    top: 4,
    bottom: 32,
    profile: (t) => 4 + Math.sin(Math.PI * t) * 8 + (t < 0.34 ? 2 : 0) - Math.max(0, t - 0.55) * 9,
    anchors: {
      ...baseAnchors,
      "left_eye.center": [16, 17],
      "right_eye.center": [24, 17],
      "nose.tip": [20, 21],
      "mouth.center": [20, 25],
      chin: [20, 32],
      "left_ear.socket": [9, 18],
      "right_ear.socket": [31, 18],
      "hairline.center": [20, 9],
      left_temple: [10, 11],
      right_temple: [30, 11]
    },
    profiles: { face_width: "medium", face_height: "medium", jaw: "narrow", forehead: "wide", cheek_width: "wide", ear_height: "medium", chin_space: "small" }
  },
  long: {
    top: 3,
    bottom: 35,
    profile: (t) => 4 + Math.sin(Math.PI * t) * 6 - Math.max(0, t - 0.72) * 3,
    anchors: {
      ...baseAnchors,
      "head.top": [20, 3],
      "head.center": [20, 19],
      "face.center": [20, 20],
      "left_eye.center": [16, 18],
      "right_eye.center": [24, 18],
      "left_eyebrow.center": [16, 15],
      "right_eyebrow.center": [24, 15],
      "nose.bridge": [20, 20],
      "nose.tip": [20, 23],
      "mouth.center": [20, 28],
      "mouth.baseline": [20, 28],
      chin: [20, 35],
      "left_ear.socket": [10, 20],
      "right_ear.socket": [30, 20],
      "hair.crown": [20, 4],
      "hairline.center": [20, 9]
    },
    profiles: { face_width: "narrow", face_height: "long", jaw: "soft", forehead: "medium", cheek_width: "medium", ear_height: "tall", chin_space: "large" }
  }
};

export function createFaceRig(shape = "soft_round", traits?: TraitMap): FaceRig {
  const config = configs[shape] ?? configs.soft_round;
  const head = maskFromRowProfile(config.top, config.bottom, config.centerX ?? 20, config.profile);
  const faceCore = maskIntersect(maskErode(head, 2), maskFromEllipse(20, config.anchors["face.center"][1] + 1, 10, 11));
  const hairAllowed = maskUnion(maskDilate(head, 2), maskFromRoundedRect(5, 1, 30, 20, 4));
  const body = maskFromRoundedRect(7, 31, 26, 10, 5);
  const anchors = applyLayoutModifiers(config.anchors, traits);
  const leftJoin = smallJoinMask(anchors["left_ear.socket"], -1);
  const rightJoin = smallJoinMask(anchors["right_ear.socket"], 1);

  return {
    id: shape,
    anchors,
    sockets: {
      left_ear: { anchor: anchors["left_ear.socket"], joinMask: leftJoin, minOverlap: 1, zBack: 210, zFront: 450 },
      right_ear: { anchor: anchors["right_ear.socket"], joinMask: rightJoin, minOverlap: 1, zBack: 210, zFront: 450 }
    },
    zones: {
      eyes: { bbox: [12, anchors["left_eye.center"][1] - 2, 28, anchors["left_eye.center"][1] + 3] },
      nose: { bbox: [18, anchors["nose.tip"][1] - 3, 22, anchors["nose.tip"][1] + 3] },
      mouth: { bbox: [15, anchors["mouth.center"][1] - 2, 25, anchors["mouth.center"][1] + 3] },
      left_ear: { bbox: [5, anchors["left_ear.socket"][1] - 4, 11, anchors["left_ear.socket"][1] + 5] },
      right_ear: { bbox: [29, anchors["right_ear.socket"][1] - 4, 35, anchors["right_ear.socket"][1] + 5] },
      hair: { bbox: [5, 1, 35, 21] },
      body: { bbox: [7, 31, 33, 40] }
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
    bbox: [8, config.top, 32, config.bottom]
  };
}

function smallJoinMask([cx, cy]: Point, side: -1 | 1): Mask {
  const mask = createMask(CANVAS_SIZE, CANVAS_SIZE);
  for (let y = cy - 2; y <= cy + 2; y += 1) {
    for (let x = cx - 2; x <= cx + 2; x += 1) {
      const dx = (x - cx) * side;
      if (dx >= -1 && dx <= 2 && Math.abs(y - cy) <= 2) addMaskPoint(mask, x, y);
    }
  }
  return mask;
}

function applyLayoutModifiers(anchors: Record<string, Point>, traits?: TraitMap): Record<string, Point> {
  const next = Object.fromEntries(Object.entries(anchors).map(([key, value]) => [key, [...value] as Point]));
  const presentation = traits?.presentation;

  if (presentation === "cute") {
    offset(next, "left_eye.center", [0, -1]);
    offset(next, "right_eye.center", [0, -1]);
    offset(next, "left_eyebrow.center", [0, -1]);
    offset(next, "right_eyebrow.center", [0, -1]);
    offset(next, "mouth.center", [0, -1]);
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
