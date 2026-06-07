import { FaceRig, Mask, PixelMeta, Placement, TraitMap } from "../types";
import { colorToken } from "./color";
import { addMaskPoint, bboxFromPoints, countOverlap, createMask, keyOf, maskEdge, maskFromEllipse, maskFromRoundedRect, pointFromKey } from "./geometry";
import { LAYERS } from "./layers";
import { LayerStack, MutableLayer, drawEllipse, drawLine, drawMask, drawRect, drawTriangle } from "./pixelLayer";

export interface DrawContext {
  layers: LayerStack;
  rig: FaceRig;
  traits: TraitMap;
  palette: Record<string, string>;
  placements: Record<string, Placement>;
  warnings: string[];
}

export function drawAvatarTraits(ctx: DrawContext) {
  drawBackground(ctx);
  drawBody(ctx);
  drawHairBack(ctx);
  drawHeadwearBack(ctx);
  drawEars(ctx);
  drawHead(ctx);
  drawFaceDetails(ctx);
  drawEyes(ctx);
  drawEyebrows(ctx);
  drawNose(ctx);
  drawMouth(ctx);
  drawFacialHair(ctx);
  drawGlasses(ctx);
  drawHairFront(ctx);
  drawHeadwearFront(ctx);
}

function token(ctx: DrawContext, value: string) {
  return colorToken(value, ctx.palette);
}

function meta(trait: string, colorTokenValue: string): Partial<PixelMeta> {
  return { trait, colorToken: colorTokenValue };
}

function setRect(ctx: DrawContext, layerId: string, x: number, y: number, w: number, h: number, color: string, trait: string, clip?: Mask) {
  drawRect(ctx.layers.get(layerId), x, y, w, h, token(ctx, color), meta(trait, color), clip);
}

function setLine(ctx: DrawContext, layerId: string, x1: number, y1: number, x2: number, y2: number, color: string, trait: string, clip?: Mask) {
  drawLine(ctx.layers.get(layerId), x1, y1, x2, y2, token(ctx, color), meta(trait, color), clip);
}

function setEllipse(ctx: DrawContext, layerId: string, cx: number, cy: number, rx: number, ry: number, color: string, trait: string, clip?: Mask) {
  drawEllipse(ctx.layers.get(layerId), cx, cy, rx, ry, token(ctx, color), meta(trait, color), clip);
}

function setTriangle(ctx: DrawContext, layerId: string, points: [[number, number], [number, number], [number, number]], color: string, trait: string, clip?: Mask) {
  drawTriangle(ctx.layers.get(layerId), points, token(ctx, color), meta(trait, color), clip);
}

function drawEllipseOutline(ctx: DrawContext, layerId: string, cx: number, cy: number, rx: number, ry: number, color: string, trait: string, clip?: Mask) {
  const outer = maskFromEllipse(cx, cy, rx, ry);
  const inner = maskFromEllipse(cx, cy, Math.max(1, rx - 1.4), Math.max(1, ry - 1.4));
  const layer = ctx.layers.get(layerId);
  for (const key of outer.points) {
    if (!inner.points.has(key)) {
      const [x, y] = pointFromKey(key);
      layer.set(x, y, token(ctx, color), meta(trait, color), clip);
    }
  }
}

function drawBackground(ctx: DrawContext) {
  const style = ctx.traits["background.style"] ?? "circle";
  const trait = `background.style.${style}`;
  if (style === "transparent") return;

  if (style === "solid") {
    setRect(ctx, "background.base", 0, 0, 128, 128, "background.base", trait);
  } else if (style === "circle") {
    setEllipse(ctx, "background.base", 64, 64, 57, 57, "background.base", trait);
    setEllipse(ctx, "background.pattern", 64, 64, 49, 49, "background.shadow", trait);
    setEllipse(ctx, "background.effects", 60, 58, 38, 38, "background.base", trait);
  } else if (style === "rounded_square") {
    drawMask(ctx.layers.get("background.base"), maskFromRoundedRect(8, 8, 112, 112, 18), token(ctx, "background.base"), meta(trait, "background.base"));
    drawMask(ctx.layers.get("background.pattern"), maskFromRoundedRect(17, 17, 94, 94, 14), token(ctx, "background.shadow"), meta(trait, "background.shadow"));
  } else if (style === "checker") {
    setRect(ctx, "background.base", 0, 0, 128, 128, "background.base", trait);
    for (let y = 0; y < 128; y += 8) {
      for (let x = 0; x < 128; x += 8) {
        if ((x + y) / 8 % 2 === 0) setRect(ctx, "background.pattern", x, y, 8, 8, "background.accent", trait);
      }
    }
  } else if (style === "stars") {
    setRect(ctx, "background.base", 0, 0, 128, 128, "background.base", trait);
    for (const [x, y] of [
      [22, 24],
      [103, 31],
      [35, 88],
      [95, 93],
      [66, 17],
      [116, 68]
    ]) {
      setLine(ctx, "background.effects", x - 2, y, x + 2, y, "background.accent", trait);
      setLine(ctx, "background.effects", x, y - 2, x, y + 2, "background.accent", trait);
    }
  } else if (style === "diagonal_stripes") {
    setRect(ctx, "background.base", 0, 0, 128, 128, "background.base", trait);
    for (let i = -128; i < 160; i += 14) {
      setLine(ctx, "background.pattern", i, 127, i + 127, 0, "background.accent", trait);
      setLine(ctx, "background.pattern", i + 1, 127, i + 128, 0, "background.accent", trait);
    }
  } else if (style === "aura") {
    setEllipse(ctx, "background.base", 64, 64, 58, 58, "background.base", trait);
    setEllipse(ctx, "background.pattern", 64, 64, 48, 48, "background.shadow", trait);
    setEllipse(ctx, "background.effects", 64, 64, 36, 36, "background.base", trait);
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2;
      const x = 64 + Math.round(Math.cos(angle) * 51);
      const y = 64 + Math.round(Math.sin(angle) * 51);
      setRect(ctx, "background.effects", x - 1, y - 1, 3, 3, "background.accent", trait);
    }
  }

  ctx.placements[trait] = { trait, bbox: [0, 0, 128, 128] };
}

function drawBody(ctx: DrawContext) {
  const top = ctx.traits["clothing.top"] ?? "hoodie";
  const trait = `clothing.top.${top}`;
  setRect(ctx, "neck", 58, 94, 12, 18, "skin.base", "neck", ctx.rig.masks.head);
  setEllipse(ctx, "body.shadow", 64, 123, 47, 22, "clothing.shadow", trait);
  if (top === "tshirt") {
    setTriangle(ctx, "body.base", [
      [25, 127],
      [64, 94],
      [103, 127]
    ], "clothing.base", trait);
    setRect(ctx, "body.base", 47, 104, 34, 24, "clothing.base", trait);
  } else if (top === "hoodie") {
    setEllipse(ctx, "body.base", 64, 120, 42, 24, "clothing.base", trait);
    setLine(ctx, "body.base", 53, 100, 62, 123, "clothing.highlight", trait);
    setLine(ctx, "body.base", 75, 100, 66, 123, "clothing.highlight", trait);
    setRect(ctx, "body.base", 56, 96, 16, 8, "clothing.shadow", trait);
  } else if (top === "jacket") {
    setRect(ctx, "body.base", 29, 101, 70, 27, "clothing.base", trait);
    setTriangle(ctx, "body.base", [
      [50, 101],
      [64, 126],
      [64, 101]
    ], "clothing.shadow", trait);
    setTriangle(ctx, "body.base", [
      [78, 101],
      [64, 126],
      [64, 101]
    ], "clothing.highlight", trait);
  } else if (top === "suit") {
    setTriangle(ctx, "body.base", [
      [27, 127],
      [55, 98],
      [66, 127]
    ], "clothing.base", trait);
    setTriangle(ctx, "body.base", [
      [101, 127],
      [73, 98],
      [62, 127]
    ], "clothing.base", trait);
    setTriangle(ctx, "body.base", [
      [58, 102],
      [70, 102],
      [64, 116]
    ], "accessory.white", trait);
    setLine(ctx, "body.base", 64, 106, 64, 127, "accessory.red", trait);
  } else if (top === "robe") {
    setEllipse(ctx, "body.base", 64, 123, 45, 25, "clothing.base", trait);
    setLine(ctx, "body.base", 42, 107, 86, 127, "clothing.highlight", trait);
    setLine(ctx, "body.base", 86, 107, 42, 127, "clothing.shadow", trait);
  } else if (top === "armor") {
    setRect(ctx, "body.base", 33, 102, 62, 26, "clothing.base", trait);
    setRect(ctx, "body.base", 39, 106, 50, 5, "clothing.highlight", trait);
    setLine(ctx, "body.base", 64, 103, 64, 127, "clothing.shadow", trait);
    setRect(ctx, "body.base", 27, 107, 12, 16, "clothing.shadow", trait);
    setRect(ctx, "body.base", 89, 107, 12, 16, "clothing.shadow", trait);
  }
  ctx.placements[trait] = { trait, bbox: [24, 94, 104, 128] };
}

function drawHead(ctx: DrawContext) {
  const trait = `face.shape.${ctx.rig.id}`;
  drawMask(ctx.layers.get("head.base"), ctx.rig.masks.head, token(ctx, "skin.base"), meta(trait, "skin.base"));
  const edge = maskEdge(ctx.rig.masks.head);
  const shadowLayer = ctx.layers.get("skin.shadow");
  const highlightLayer = ctx.layers.get("skin.highlight");
  for (const point of edge.points) {
    const [x, y] = pointFromKey(point);
    if (y > ctx.rig.anchors["face.center"][1] + 6 || x > 84 || x < 35) {
      shadowLayer.set(x, y, token(ctx, "skin.shadow"), meta(trait, "skin.shadow"));
    }
    if (x < 58 && y < 50) {
      highlightLayer.set(x, y, token(ctx, "skin.highlight"), meta(trait, "skin.highlight"));
    }
  }
  setEllipse(ctx, "skin.highlight", 50, ctx.rig.anchors["left_eye.center"][1] + 10, 7, 3, "skin.highlight", trait, ctx.rig.masks.head);
  setEllipse(ctx, "skin.shadow", 76, ctx.rig.anchors.chin[1] - 2, 11, 2, "skin.shadow", trait, ctx.rig.masks.head);
  ctx.placements[trait] = { trait, bbox: ctx.rig.bbox };
}

function drawEars(ctx: DrawContext) {
  const shape = ctx.traits["ears.shape"] ?? "round";
  if (shape === "none") return;
  drawEar(ctx, "left", shape);
  drawEar(ctx, "right", shape);
}

function drawEar(ctx: DrawContext, side: "left" | "right", shape: string) {
  const socketName = `${side}_ear`;
  const socket = ctx.rig.sockets[socketName];
  const trait = `ears.shape.${shape}.${side}`;
  const [cx, cy] = socket.anchor;
  const dir = side === "left" ? -1 : 1;
  const baseLayer = ctx.layers.get("ears.base");
  const backLayer = ctx.layers.get("ears.back");
  const frontLayer = ctx.layers.get("ears.front");

  if (shape === "pointed") {
    drawTriangle(backLayer, [
      [cx + dir * 1, cy - 8],
      [cx + dir * 16, cy - 2],
      [cx + dir * 1, cy + 9]
    ], token(ctx, "skin.base"), meta(trait, "skin.base"));
    drawLine(frontLayer, cx + dir * 2, cy - 2, cx + dir * 9, cy + 3, token(ctx, "skin.shadow"), meta(trait, "skin.shadow"));
  } else {
    const rx = shape === "small_round" ? 5 : shape === "large_round" || shape === "stick_out" ? 8 : 6;
    const ry = shape === "large_round" ? 11 : 9;
    const offset = shape === "stick_out" ? dir * 4 : dir * 2;
    drawEllipse(backLayer, cx + offset, cy, rx, ry, token(ctx, "skin.shadow"), meta(trait, "skin.shadow"));
    drawEllipse(baseLayer, cx + offset, cy, Math.max(3, rx - 1), Math.max(5, ry - 1), token(ctx, "skin.base"), meta(trait, "skin.base"));
    drawEllipse(frontLayer, cx + offset + dir, cy + 1, Math.max(1, rx - 3), Math.max(2, ry - 4), token(ctx, "skin.highlight"), meta(trait, "skin.highlight"));
  }

  const layerKeys = new Set([...backLayer.pixels.keys(), ...baseLayer.pixels.keys(), ...frontLayer.pixels.keys()]);
  const overlap = countOverlap(socket.joinMask, layerKeys);
  if (overlap < socket.minOverlap) ctx.warnings.push(`${trait} has low socket overlap: ${overlap}px`);
  ctx.placements[trait] = {
    trait,
    socket: socketName,
    socket_xy: socket.anchor,
    final_xy: [cx, cy],
    overlap_pixels: overlap,
    bbox: side === "left" ? [18, cy - 12, 36, cy + 13] : [92, cy - 12, 110, cy + 13]
  };
}

function drawHairBack(ctx: DrawContext) {
  const style = ctx.traits["hair.style"] ?? "short_messy";
  const trait = `hair.style.${style}`;
  if (style === "bald_clean" || style === "buzz_cut" || style === "undercut") return;
  const crown = ctx.rig.anchors["hair.crown"];

  if (style === "long_wavy") {
    setEllipse(ctx, "hair.back", crown[0] - 23, 69, 15, 48, "hair.shadow", trait, ctx.rig.masks.hair_allowed);
    setEllipse(ctx, "hair.back", crown[0] + 23, 69, 15, 48, "hair.shadow", trait, ctx.rig.masks.hair_allowed);
    setEllipse(ctx, "hair.back", crown[0], 48, 39, 35, "hair.base", trait, ctx.rig.masks.hair_allowed);
  } else if (style === "bob_bangs") {
    setEllipse(ctx, "hair.back", crown[0], 54, 42, 42, "hair.shadow", trait, ctx.rig.masks.hair_allowed);
    setRect(ctx, "hair.back", 25, 50, 15, 45, "hair.base", trait, ctx.rig.masks.hair_allowed);
    setRect(ctx, "hair.back", 88, 50, 15, 45, "hair.base", trait, ctx.rig.masks.hair_allowed);
  } else if (style === "curly_short") {
    for (const [x, y, r] of [
      [35, 31, 9],
      [47, 22, 11],
      [64, 18, 12],
      [81, 23, 10],
      [94, 34, 9]
    ]) {
      setEllipse(ctx, "hair.back", x, y, r, r, "hair.shadow", trait, ctx.rig.masks.hair_allowed);
    }
  } else if (style === "short_messy") {
    setEllipse(ctx, "hair.back", crown[0], 32, 37, 24, "hair.shadow", trait, ctx.rig.masks.hair_allowed);
  }
}

function drawHairFront(ctx: DrawContext) {
  const style = ctx.traits["hair.style"] ?? "short_messy";
  const trait = `hair.style.${style}`;
  if (style === "bald_clean") {
    ctx.placements[trait] = { trait, bbox: [0, 0, 0, 0] };
    return;
  }
  const crown = ctx.rig.anchors["hair.crown"];
  const hairline = ctx.rig.anchors["hairline.center"];
  const y = hairline[1];

  if (style === "buzz_cut") {
    setEllipse(ctx, "hair.front", crown[0], y - 1, 35, 17, "hair.base", trait, ctx.rig.masks.hair_allowed);
    setLine(ctx, "hair.highlight", 42, y - 3, 84, y - 7, "hair.highlight", trait, ctx.rig.masks.hair_allowed);
  } else if (style === "short_messy") {
    setEllipse(ctx, "hair.front", crown[0], y - 4, 38, 19, "hair.base", trait, ctx.rig.masks.hair_allowed);
    const points = [
      [34, y, 43, y + 14, 49, y],
      [47, y - 4, 54, y + 16, 63, y - 2],
      [60, y - 3, 68, y + 15, 76, y - 3],
      [76, y - 1, 84, y + 15, 94, y + 2]
    ] as Array<[number, number, number, number, number, number]>;
    for (const [x1, y1, x2, y2, x3, y3] of points) setTriangle(ctx, "hair.front", [[x1, y1], [x2, y2], [x3, y3]], "hair.base", trait, ctx.rig.masks.hair_allowed);
    setLine(ctx, "hair.highlight", 47, y + 1, 72, y - 1, "hair.highlight", trait, ctx.rig.masks.hair_allowed);
  } else if (style === "bob_bangs") {
    setEllipse(ctx, "hair.front", crown[0], y + 2, 39, 21, "hair.base", trait, ctx.rig.masks.hair_allowed);
    for (let i = 0; i < 7; i += 1) {
      const bx = 36 + i * 8;
      setTriangle(ctx, "hair.front", [[bx, y - 2], [bx + 7, y - 2], [bx + 3, y + 17 + (i % 2)]], "hair.base", trait, ctx.rig.masks.hair_allowed);
    }
    setRect(ctx, "hair.side", 27, 50, 10, 39, "hair.shadow", trait, ctx.rig.masks.hair_allowed);
    setRect(ctx, "hair.side", 91, 50, 10, 39, "hair.shadow", trait, ctx.rig.masks.hair_allowed);
  } else if (style === "curly_short") {
    for (const [x, yy, r] of [
      [33, y + 8, 9],
      [44, y - 2, 10],
      [58, y - 6, 11],
      [73, y - 4, 10],
      [88, y + 4, 10],
      [52, y + 15, 8],
      [78, y + 14, 8]
    ]) {
      setEllipse(ctx, "hair.front", x, yy, r, r, "hair.base", trait, ctx.rig.masks.hair_allowed);
      setEllipse(ctx, "hair.highlight", x - 2, yy - 2, Math.max(2, r - 5), Math.max(2, r - 6), "hair.highlight", trait, ctx.rig.masks.hair_allowed);
    }
  } else if (style === "long_wavy") {
    setEllipse(ctx, "hair.front", crown[0], y + 1, 37, 21, "hair.base", trait, ctx.rig.masks.hair_allowed);
    setRect(ctx, "hair.side", 29, 47, 12, 57, "hair.base", trait, ctx.rig.masks.hair_allowed);
    setRect(ctx, "hair.side", 87, 47, 12, 57, "hair.base", trait, ctx.rig.masks.hair_allowed);
    setLine(ctx, "hair.highlight", 43, 30, 35, 89, "hair.highlight", trait, ctx.rig.masks.hair_allowed);
    setLine(ctx, "hair.highlight", 83, 29, 94, 91, "hair.highlight", trait, ctx.rig.masks.hair_allowed);
  } else if (style === "undercut") {
    setEllipse(ctx, "hair.front", 61, y - 3, 25, 15, "hair.base", trait, ctx.rig.masks.hair_allowed);
    setRect(ctx, "hair.side", 30, 37, 12, 35, "hair.shadow", trait, ctx.rig.masks.hair_allowed);
    setTriangle(ctx, "hair.front", [[43, y - 8], [83, y - 5], [55, y + 13]], "hair.base", trait, ctx.rig.masks.hair_allowed);
    setLine(ctx, "hair.highlight", 49, y - 4, 78, y - 2, "hair.highlight", trait, ctx.rig.masks.hair_allowed);
  }

  const boxes = ["hair.back", "hair.side", "hair.front", "hair.highlight"].map((id) => ctx.layers.get(id).bbox());
  const bbox = bboxFromBoxes(boxes);
  ctx.placements[trait] = {
    trait,
    anchor: "hair.crown",
    anchor_xy: crown,
    mount_point: [0, 0],
    final_xy: crown,
    bbox
  };
}

function drawFaceDetails(ctx: DrawContext) {
  const detail = ctx.traits["face.detail"] ?? "none";
  if (detail === "none") return;
  const trait = `face.detail.${detail}`;
  const leftEye = ctx.rig.anchors["left_eye.center"];
  const rightEye = ctx.rig.anchors["right_eye.center"];

  if (detail === "blush_soft") {
    setEllipse(ctx, "face.details", leftEye[0] - 9, leftEye[1] + 12, 5, 2, "blush.soft", trait, ctx.rig.masks.face_core);
    setEllipse(ctx, "face.details", rightEye[0] + 9, rightEye[1] + 12, 5, 2, "blush.soft", trait, ctx.rig.masks.face_core);
  } else if (detail === "freckles_light") {
    for (const [x, y] of [
      [leftEye[0] - 7, leftEye[1] + 9],
      [leftEye[0] - 2, leftEye[1] + 11],
      [leftEye[0] + 4, leftEye[1] + 10],
      [rightEye[0] - 4, rightEye[1] + 10],
      [rightEye[0] + 2, rightEye[1] + 11],
      [rightEye[0] + 7, rightEye[1] + 9]
    ]) setRect(ctx, "face.details", x, y, 1, 1, "skin.shadow", trait, ctx.rig.masks.face_core);
  } else if (detail === "cheek_mole_left") {
    setRect(ctx, "face.details", leftEye[0] - 10, leftEye[1] + 17, 2, 2, "line.dark", trait, ctx.rig.masks.face_core);
  } else if (detail === "under_eye_lines") {
    setLine(ctx, "face.details", leftEye[0] - 5, leftEye[1] + 5, leftEye[0] + 3, leftEye[1] + 5, "skin.shadow", trait, ctx.rig.masks.face_core);
    setLine(ctx, "face.details", rightEye[0] - 3, rightEye[1] + 5, rightEye[0] + 5, rightEye[1] + 5, "skin.shadow", trait, ctx.rig.masks.face_core);
  } else if (detail === "scar_left_cheek") {
    setLine(ctx, "face.details", leftEye[0] - 13, leftEye[1] + 15, leftEye[0] - 4, leftEye[1] + 8, "scar.light", trait, ctx.rig.masks.face_core);
    setLine(ctx, "face.details", leftEye[0] - 11, leftEye[1] + 12, leftEye[0] - 8, leftEye[1] + 15, "skin.shadow", trait, ctx.rig.masks.face_core);
  }
  ctx.placements[trait] = { trait, bbox: ctx.layers.get("face.details").bbox() };
}

function drawEyes(ctx: DrawContext) {
  const shape = ctx.traits["eyes.shape"] ?? "almond";
  drawOneEye(ctx, "left", shape);
  drawOneEye(ctx, "right", shape);
}

function drawOneEye(ctx: DrawContext, side: "left" | "right", shape: string) {
  const anchorKey = `${side}_eye.center`;
  const [cx, cy] = ctx.rig.anchors[anchorKey];
  const trait = `eyes.shape.${shape}.${side}`;
  const pupil = "eyes.pupil";
  const iris = "eyes.iris";
  const white = "accessory.white";
  const clip = ctx.rig.masks.face_core;

  if (shape === "dot") {
    setRect(ctx, "eyes.pupil", cx - 1, cy - 1, 2, 2, pupil, trait, clip);
  } else if (shape === "round") {
    setEllipse(ctx, "eyes.white", cx, cy, 4, 3, white, trait, clip);
    setEllipse(ctx, "eyes.iris", cx, cy, 2, 2, iris, trait, clip);
    setRect(ctx, "eyes.pupil", cx, cy, 2, 2, pupil, trait, clip);
    setRect(ctx, "eyes.pupil", cx - 1, cy - 1, 1, 1, "eyes.highlight", trait, clip);
  } else if (shape === "almond") {
    setLine(ctx, "eyes.white", cx - 5, cy, cx + 5, cy, white, trait, clip);
    setRect(ctx, "eyes.white", cx - 3, cy - 1, 7, 3, white, trait, clip);
    setRect(ctx, "eyes.iris", cx - 1, cy - 1, 3, 3, iris, trait, clip);
    setRect(ctx, "eyes.pupil", cx, cy, 1, 2, pupil, trait, clip);
    setLine(ctx, "eyelids", cx - 6, cy - 2, cx + 5, cy - 1, "line.dark", trait, clip);
  } else if (shape === "sleepy") {
    setRect(ctx, "eyes.white", cx - 4, cy, 9, 2, white, trait, clip);
    setRect(ctx, "eyes.iris", cx - 1, cy, 3, 2, iris, trait, clip);
    setLine(ctx, "eyelids", cx - 5, cy - 1, cx + 5, cy - 1, "line.dark", trait, clip);
  } else if (shape === "happy_arc") {
    setLine(ctx, "eyes.pupil", cx - 4, cy + 1, cx - 1, cy - 1, pupil, trait, clip);
    setLine(ctx, "eyes.pupil", cx - 1, cy - 1, cx + 4, cy + 1, pupil, trait, clip);
  } else if (shape === "starry") {
    setRect(ctx, "eyes.iris", cx - 1, cy - 4, 3, 9, iris, trait, clip);
    setRect(ctx, "eyes.iris", cx - 4, cy - 1, 9, 3, iris, trait, clip);
    setRect(ctx, "eyes.pupil", cx, cy, 1, 1, pupil, trait, clip);
    setRect(ctx, "eyes.pupil", cx - 1, cy - 1, 1, 1, "eyes.highlight", trait, clip);
  }

  ctx.placements[trait] = {
    trait,
    anchor: anchorKey,
    anchor_xy: [cx, cy],
    mount_point: [0, 0],
    final_xy: [cx, cy],
    bbox: [cx - 6, cy - 5, cx + 7, cy + 6]
  };
}

function drawEyebrows(ctx: DrawContext) {
  const shape = ctx.traits["eyebrows.shape"] ?? "soft_flat";
  const trait = `eyebrows.shape.${shape}`;
  const left = ctx.rig.anchors["left_eyebrow.center"];
  const right = ctx.rig.anchors["right_eyebrow.center"];
  const clip = ctx.rig.masks.face_core;
  const draw = (cx: number, cy: number, side: "left" | "right") => {
    if (shape === "soft_flat") setLine(ctx, "eyebrows", cx - 5, cy, cx + 5, cy, "hair.shadow", trait, clip);
    else if (shape === "arched") {
      setLine(ctx, "eyebrows", cx - 5, cy + 1, cx, cy - 2, "hair.shadow", trait, clip);
      setLine(ctx, "eyebrows", cx, cy - 2, cx + 5, cy, "hair.shadow", trait, clip);
    } else if (shape === "thick_flat") {
      setRect(ctx, "eyebrows", cx - 6, cy - 1, 12, 2, "hair.shadow", trait, clip);
    } else if (shape === "angry") {
      const d = side === "left" ? 1 : -1;
      setLine(ctx, "eyebrows", cx - 6, cy - d * 2, cx + 6, cy + d * 2, "hair.shadow", trait, clip);
    } else if (shape === "sad") {
      const d = side === "left" ? -1 : 1;
      setLine(ctx, "eyebrows", cx - 6, cy - d * 2, cx + 6, cy + d * 2, "hair.shadow", trait, clip);
    } else if (shape === "raised_left") {
      setLine(ctx, "eyebrows", cx - 5, cy + (side === "left" ? -2 : 1), cx + 5, cy + (side === "left" ? -2 : 1), "hair.shadow", trait, clip);
    }
  };
  draw(left[0], left[1], "left");
  draw(right[0], right[1], "right");
  ctx.placements[trait] = { trait, bbox: [left[0] - 6, left[1] - 4, right[0] + 7, right[1] + 4] };
}

function drawNose(ctx: DrawContext) {
  const shape = ctx.traits["nose.shape"] ?? "button";
  const trait = `nose.shape.${shape}`;
  const [cx, cy] = ctx.rig.anchors["nose.tip"];
  const clip = ctx.rig.masks.face_core;
  if (shape === "single_pixel") setRect(ctx, "nose", cx, cy, 1, 1, "skin.shadow", trait, clip);
  else if (shape === "button") {
    setRect(ctx, "nose", cx - 1, cy, 3, 2, "skin.shadow", trait, clip);
    setRect(ctx, "nose", cx, cy - 1, 1, 1, "skin.highlight", trait, clip);
  } else if (shape === "small_line") setLine(ctx, "nose", cx, cy - 4, cx, cy + 2, "skin.shadow", trait, clip);
  else if (shape === "soft_bridge") {
    setLine(ctx, "nose", cx, cy - 7, cx - 1, cy - 1, "skin.shadow", trait, clip);
    setRect(ctx, "nose", cx, cy + 1, 3, 1, "skin.shadow", trait, clip);
  } else if (shape === "triangle") setTriangle(ctx, "nose", [[cx, cy - 4], [cx - 3, cy + 3], [cx + 3, cy + 3]], "skin.shadow", trait, clip);
  else if (shape === "wide") {
    setRect(ctx, "nose", cx - 3, cy + 1, 7, 1, "skin.shadow", trait, clip);
    setRect(ctx, "nose", cx - 2, cy, 1, 1, "skin.shadow", trait, clip);
    setRect(ctx, "nose", cx + 2, cy, 1, 1, "skin.shadow", trait, clip);
  }
  ctx.placements[trait] = { trait, anchor: "nose.tip", anchor_xy: [cx, cy], final_xy: [cx, cy], bbox: [cx - 5, cy - 8, cx + 6, cy + 6] };
}

function drawMouth(ctx: DrawContext) {
  const shape = ctx.traits["mouth.shape"] ?? "small_smile";
  const trait = `mouth.shape.${shape}`;
  const [cx, cy] = ctx.rig.anchors["mouth.center"];
  const clip = ctx.rig.masks.face_core;
  if (shape === "neutral") setLine(ctx, "mouth", cx - 5, cy, cx + 5, cy, "mouth.dark", trait, clip);
  else if (shape === "small_smile") {
    setLine(ctx, "mouth", cx - 5, cy - 1, cx - 1, cy + 2, "mouth.dark", trait, clip);
    setLine(ctx, "mouth", cx - 1, cy + 2, cx + 5, cy - 1, "mouth.dark", trait, clip);
    setRect(ctx, "lips", cx + 1, cy, 2, 1, "lip.highlight", trait, clip);
  } else if (shape === "big_smile") {
    setLine(ctx, "mouth", cx - 8, cy - 2, cx - 3, cy + 3, "mouth.dark", trait, clip);
    setLine(ctx, "mouth", cx - 3, cy + 3, cx + 8, cy - 2, "mouth.dark", trait, clip);
    setRect(ctx, "mouth", cx - 4, cy + 1, 8, 2, "mouth.teeth", trait, clip);
  } else if (shape === "teeth_smile") {
    setRect(ctx, "mouth", cx - 7, cy - 1, 14, 4, "mouth.dark", trait, clip);
    setRect(ctx, "mouth", cx - 5, cy, 10, 2, "mouth.teeth", trait, clip);
    setLine(ctx, "mouth", cx, cy, cx, cy + 2, "skin.shadow", trait, clip);
  } else if (shape === "frown") {
    setLine(ctx, "mouth", cx - 6, cy + 3, cx - 1, cy, "mouth.dark", trait, clip);
    setLine(ctx, "mouth", cx - 1, cy, cx + 6, cy + 3, "mouth.dark", trait, clip);
  } else if (shape === "surprised_o") {
    setEllipse(ctx, "mouth", cx, cy, 4, 5, "mouth.dark", trait, clip);
    setEllipse(ctx, "mouth", cx, cy, 2, 3, "mouth.shadow", trait, clip);
  } else if (shape === "smirk_left") {
    setLine(ctx, "mouth", cx - 7, cy + 1, cx - 1, cy - 1, "mouth.dark", trait, clip);
    setLine(ctx, "mouth", cx - 1, cy - 1, cx + 5, cy, "mouth.dark", trait, clip);
  }
  const belowNose = cy - ctx.rig.anchors["nose.tip"][1];
  if (belowNose < 5) ctx.warnings.push(`${trait} is close to nose.tip (${belowNose}px)`);
  ctx.placements[trait] = { trait, anchor: "mouth.center", anchor_xy: [cx, cy], mount_point: [0, 0], final_xy: [cx, cy], bbox: [cx - 9, cy - 4, cx + 10, cy + 7] };
}

function drawFacialHair(ctx: DrawContext) {
  const style = ctx.traits["facial_hair.style"] ?? "none";
  if (style === "none") return;
  const trait = `facial_hair.style.${style}`;
  const [cx, cy] = ctx.rig.anchors["mouth.center"];
  const clip = ctx.rig.masks.face_core;
  if (style === "stubble") {
    for (let y = cy + 2; y < cy + 13; y += 3) {
      for (let x = cx - 12; x <= cx + 12; x += 5) setRect(ctx, "facial_hair", x, y, 1, 1, "hair.shadow", trait, clip);
    }
  } else if (style === "mustache_thin") {
    setLine(ctx, "facial_hair", cx - 9, cy - 4, cx - 1, cy - 2, "hair.shadow", trait, clip);
    setLine(ctx, "facial_hair", cx + 1, cy - 2, cx + 9, cy - 4, "hair.shadow", trait, clip);
  } else if (style === "goatee") {
    setRect(ctx, "facial_hair", cx - 3, cy + 4, 7, 5, "hair.shadow", trait, clip);
    setRect(ctx, "facial_hair", cx - 1, cy + 9, 3, 5, "hair.shadow", trait, clip);
  } else if (style === "short_beard") {
    setRect(ctx, "facial_hair", cx - 13, cy + 5, 4, 10, "hair.shadow", trait, clip);
    setRect(ctx, "facial_hair", cx + 10, cy + 5, 4, 10, "hair.shadow", trait, clip);
    setRect(ctx, "facial_hair", cx - 9, cy + 13, 19, 5, "hair.shadow", trait, clip);
    setLine(ctx, "facial_hair", cx - 11, cy + 8, cx - 5, cy + 15, "hair.base", trait, clip);
    setLine(ctx, "facial_hair", cx + 11, cy + 8, cx + 5, cy + 15, "hair.base", trait, clip);
  } else if (style === "sideburns") {
    setRect(ctx, "facial_hair", 36, cy - 20, 5, 25, "hair.shadow", trait, clip);
    setRect(ctx, "facial_hair", 87, cy - 20, 5, 25, "hair.shadow", trait, clip);
  }
  ctx.placements[trait] = { trait, bbox: ctx.layers.get("facial_hair").bbox() };
}

function drawGlasses(ctx: DrawContext) {
  const shape = ctx.traits["glasses.shape"] ?? "none";
  if (shape === "none") return;
  const trait = `glasses.shape.${shape}`;
  const left = ctx.rig.anchors["left_eye.center"];
  const right = ctx.rig.anchors["right_eye.center"];
  const bridge = ctx.rig.anchors["nose.bridge"];
  const lensColor = shape === "sunglasses" ? "accessory.lens_dark" : "accessory.lens";
  const frame = shape === "thin_frame" ? "accessory.frame_light" : "accessory.frame";
  const clip = ctx.rig.masks.face_core;

  if (shape === "round" || shape === "thin_frame") {
    drawEllipseOutline(ctx, "glasses.frame", left[0], left[1], 8, 7, frame, trait, clip);
    drawEllipseOutline(ctx, "glasses.frame", right[0], right[1], 8, 7, frame, trait, clip);
    if (shape !== "thin_frame") {
      drawEllipseOutline(ctx, "glasses.frame", left[0], left[1], 9, 8, frame, trait, clip);
      drawEllipseOutline(ctx, "glasses.frame", right[0], right[1], 9, 8, frame, trait, clip);
    }
  } else {
    const w = shape === "rectangle" || shape === "sunglasses" ? 16 : 13;
    const h = shape === "rectangle" || shape === "sunglasses" ? 8 : 11;
    drawGlassesBox(ctx, left[0] - Math.floor(w / 2), left[1] - Math.floor(h / 2), w, h, lensColor, frame, trait, clip);
    drawGlassesBox(ctx, right[0] - Math.floor(w / 2), right[1] - Math.floor(h / 2), w, h, lensColor, frame, trait, clip);
  }
  setLine(ctx, "glasses.frame", left[0] + 7, left[1], bridge[0], bridge[1], frame, trait, clip);
  setLine(ctx, "glasses.frame", bridge[0], bridge[1], right[0] - 7, right[1], frame, trait, clip);
  setLine(ctx, "glasses.frame", left[0] - 8, left[1] - 1, left[0] - 18, left[1] - 4, frame, trait);
  setLine(ctx, "glasses.frame", right[0] + 8, right[1] - 1, right[0] + 18, right[1] - 4, frame, trait);
  setRect(ctx, "glasses.highlight", left[0] - 4, left[1] - 4, 4, 1, "accessory.white", trait, clip);
  setRect(ctx, "glasses.highlight", right[0] - 4, right[1] - 4, 4, 1, "accessory.white", trait, clip);
  ctx.placements[trait] = { trait, anchor: "nose.bridge", anchor_xy: bridge, final_xy: bridge, bbox: [left[0] - 18, left[1] - 8, right[0] + 19, right[1] + 8] };
}

function drawGlassesBox(ctx: DrawContext, x: number, y: number, w: number, h: number, lens: string, frame: string, trait: string, clip?: Mask) {
  if (lens === "accessory.lens_dark") setRect(ctx, "glasses.lens", x + 1, y + 1, w - 2, h - 2, lens, trait, clip);
  setRect(ctx, "glasses.frame", x, y, w, 1, frame, trait, clip);
  setRect(ctx, "glasses.frame", x, y + h - 1, w, 1, frame, trait, clip);
  setRect(ctx, "glasses.frame", x, y, 1, h, frame, trait, clip);
  setRect(ctx, "glasses.frame", x + w - 1, y, 1, h, frame, trait, clip);
  setRect(ctx, "glasses.highlight", x + 3, y + 2, 4, 1, "accessory.white", trait, clip);
}

function drawHeadwearBack(ctx: DrawContext) {
  const type = ctx.traits["headwear.type"] ?? "none";
  const trait = `headwear.type.${type}`;
  if (type === "hood") {
    setEllipse(ctx, "headwear.back", 64, 60, 46, 56, "clothing.shadow", trait);
  } else if (type === "headphones") {
    setLine(ctx, "headwear.back", 41, 28, 87, 28, "accessory.frame", trait);
    setLine(ctx, "headwear.back", 41, 28, 35, 51, "accessory.frame", trait);
    setLine(ctx, "headwear.back", 87, 28, 93, 51, "accessory.frame", trait);
  }
}

function drawHeadwearFront(ctx: DrawContext) {
  const type = ctx.traits["headwear.type"] ?? "none";
  if (type === "none") return;
  const trait = `headwear.type.${type}`;
  const top = ctx.rig.anchors["head.top"][1];
  if (type === "beanie") {
    setEllipse(ctx, "headwear.front", 64, top + 17, 38, 22, "clothing.base", trait, ctx.rig.masks.hair_allowed);
    setRect(ctx, "headwear.front", 31, top + 27, 66, 6, "clothing.shadow", trait, ctx.rig.masks.hair_allowed);
    setRect(ctx, "headwear.front", 56, top - 3, 16, 7, "clothing.highlight", trait, ctx.rig.masks.hair_allowed);
  } else if (type === "cap") {
    setEllipse(ctx, "headwear.front", 64, top + 18, 37, 18, "clothing.base", trait, ctx.rig.masks.hair_allowed);
    setRect(ctx, "headwear.front", 31, top + 26, 66, 5, "clothing.shadow", trait, ctx.rig.masks.hair_allowed);
    setTriangle(ctx, "headwear.front", [[73, top + 26], [108, top + 30], [75, top + 36]], "clothing.base", trait);
  } else if (type === "crown") {
    setRect(ctx, "headwear.front", 43, top + 2, 42, 9, "accessory.gold", trait);
    for (const x of [44, 56, 72, 84]) {
      setTriangle(ctx, "headwear.front", [[x, top + 2], [x + 8, top + 2], [x + 4, top - 9]], "accessory.gold", trait);
    }
    setRect(ctx, "headwear.front", 61, top - 2, 5, 5, "accessory.red", trait);
  } else if (type === "headphones") {
    setRect(ctx, "headphones.front", 28, 49, 11, 22, "accessory.frame", trait);
    setRect(ctx, "headphones.front", 89, 49, 11, 22, "accessory.frame", trait);
    setRect(ctx, "headphones.front", 31, 54, 5, 12, "accessory.frame_light", trait);
    setRect(ctx, "headphones.front", 92, 54, 5, 12, "accessory.frame_light", trait);
  } else if (type === "hood") {
    drawEllipseOutline(ctx, "headwear.front", 64, 60, 42, 53, "clothing.base", trait);
    drawEllipseOutline(ctx, "headwear.front", 64, 60, 41, 52, "clothing.base", trait);
    setRect(ctx, "headwear.front", 27, 62, 7, 33, "clothing.base", trait);
    setRect(ctx, "headwear.front", 94, 62, 7, 33, "clothing.base", trait);
    setRect(ctx, "headwear.front", 42, 101, 44, 9, "clothing.shadow", trait);
  } else if (type === "beret") {
    setEllipse(ctx, "headwear.front", 58, top + 10, 35, 14, "clothing.base", trait, ctx.rig.masks.hair_allowed);
    setRect(ctx, "headwear.front", 49, top - 4, 5, 7, "clothing.shadow", trait);
  }
  ctx.placements[trait] = { trait, bbox: bboxFromBoxes(["headwear.back", "headwear.front", "headphones.front"].map((id) => ctx.layers.get(id).bbox())) };
}

function bboxFromBoxes(boxes: Array<[number, number, number, number] | undefined>) {
  const present = boxes.filter(Boolean) as Array<[number, number, number, number]>;
  if (!present.length) return undefined;
  return [
    Math.min(...present.map((b) => b[0])),
    Math.min(...present.map((b) => b[1])),
    Math.max(...present.map((b) => b[2])),
    Math.max(...present.map((b) => b[3]))
  ] as [number, number, number, number];
}
