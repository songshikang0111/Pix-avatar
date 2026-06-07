import { FaceRig, Mask, PixelMeta, Placement, TraitMap } from "../types";
import { colorToken } from "./color";
import { CANVAS_SIZE, bboxUnion, countOverlap, inBounds, keyOf, maskEdge, maskFromEllipse, maskFromRoundedRect, pointFromKey } from "./geometry";
import { LayerStack, drawEllipse, drawLine, drawMask, drawRect, drawTriangle } from "./pixelLayer";

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
  drawSilhouetteOutline(ctx);
}

function token(ctx: DrawContext, value: string) {
  return colorToken(value, ctx.palette);
}

function meta(trait: string, colorTokenValue: string): Partial<PixelMeta> {
  return { trait, colorToken: colorTokenValue };
}

function rect(ctx: DrawContext, layer: string, x: number, y: number, w: number, h: number, color: string, trait: string, clip?: Mask) {
  drawRect(ctx.layers.get(layer), x, y, w, h, token(ctx, color), meta(trait, color), clip);
}

function px(ctx: DrawContext, layer: string, x: number, y: number, color: string, trait: string, clip?: Mask) {
  rect(ctx, layer, x, y, 1, 1, color, trait, clip);
}

function line(ctx: DrawContext, layer: string, x1: number, y1: number, x2: number, y2: number, color: string, trait: string, clip?: Mask) {
  drawLine(ctx.layers.get(layer), x1, y1, x2, y2, token(ctx, color), meta(trait, color), clip);
}

function ellipse(ctx: DrawContext, layer: string, cx: number, cy: number, rx: number, ry: number, color: string, trait: string, clip?: Mask) {
  drawEllipse(ctx.layers.get(layer), cx, cy, rx, ry, token(ctx, color), meta(trait, color), clip);
}

function triangle(ctx: DrawContext, layer: string, points: [[number, number], [number, number], [number, number]], color: string, trait: string, clip?: Mask) {
  drawTriangle(ctx.layers.get(layer), points, token(ctx, color), meta(trait, color), clip);
}

function ellipseOutline(ctx: DrawContext, layerId: string, cx: number, cy: number, rx: number, ry: number, color: string, trait: string, clip?: Mask) {
  const outer = maskFromEllipse(cx, cy, rx, ry);
  const inner = maskFromEllipse(cx, cy, Math.max(0.5, rx - 0.8), Math.max(0.5, ry - 0.8));
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

  if (style === "solid" || style.endsWith("_flat")) {
    rect(ctx, "background.base", 0, 0, 40, 40, "background.base", trait);
  } else if (style === "circle") {
    ellipse(ctx, "background.base", 20, 20, 18, 18, "background.base", trait);
    ellipse(ctx, "background.pattern", 20, 20, 15, 15, "background.shadow", trait);
    ellipse(ctx, "background.effects", 19, 18, 11, 11, "background.base", trait);
  } else if (style === "rounded_square") {
    drawMask(ctx.layers.get("background.base"), maskFromRoundedRect(2, 2, 36, 36, 5), token(ctx, "background.base"), meta(trait, "background.base"));
    drawMask(ctx.layers.get("background.pattern"), maskFromRoundedRect(5, 5, 30, 30, 4), token(ctx, "background.shadow"), meta(trait, "background.shadow"));
  } else if (style === "checker") {
    rect(ctx, "background.base", 0, 0, 40, 40, "background.base", trait);
    for (let y = 0; y < 40; y += 4) {
      for (let x = 0; x < 40; x += 4) {
        if ((x + y) / 4 % 2 === 0) rect(ctx, "background.pattern", x, y, 4, 4, "background.accent", trait);
      }
    }
  } else if (style === "stars") {
    rect(ctx, "background.base", 0, 0, 40, 40, "background.base", trait);
    for (const [x, y] of [
      [7, 7],
      [32, 9],
      [10, 28],
      [31, 30],
      [21, 5],
      [36, 22]
    ]) {
      line(ctx, "background.effects", x - 1, y, x + 1, y, "background.accent", trait);
      line(ctx, "background.effects", x, y - 1, x, y + 1, "background.accent", trait);
    }
  } else if (style === "diagonal_stripes") {
    rect(ctx, "background.base", 0, 0, 40, 40, "background.base", trait);
    for (let i = -40; i < 50; i += 5) line(ctx, "background.pattern", i, 39, i + 39, 0, "background.accent", trait);
  } else if (style === "aura") {
    ellipse(ctx, "background.base", 20, 20, 18, 18, "background.base", trait);
    ellipse(ctx, "background.pattern", 20, 20, 15, 15, "background.shadow", trait);
    for (const [x, y] of [
      [5, 16],
      [35, 16],
      [8, 28],
      [32, 28],
      [20, 4],
      [20, 36]
    ]) rect(ctx, "background.effects", x, y, 1, 1, "background.accent", trait);
  }

  ctx.placements[trait] = { trait, bbox: [0, 0, 40, 40] };
}

function drawBody(ctx: DrawContext) {
  const top = ctx.traits["clothing.top"] ?? "hoodie";
  const trait = `clothing.top.${top}`;
  rect(ctx, "neck", 18, 30, 4, 5, "skin.base", "neck", ctx.rig.masks.head);
  ellipse(ctx, "body.shadow", 20, 39, 14, 7, "clothing.shadow", trait);

  if (top === "tshirt") {
    triangle(ctx, "body.base", [[8, 40], [20, 30], [32, 40]], "clothing.base", trait);
    rect(ctx, "body.base", 15, 33, 10, 7, "clothing.base", trait);
  } else if (top === "hoodie") {
    ellipse(ctx, "body.base", 20, 38, 13, 7, "clothing.base", trait);
    line(ctx, "body.base", 17, 32, 19, 39, "clothing.highlight", trait);
    line(ctx, "body.base", 23, 32, 21, 39, "clothing.highlight", trait);
    rect(ctx, "body.base", 17, 31, 6, 2, "clothing.shadow", trait);
  } else if (top === "jacket") {
    rect(ctx, "body.base", 9, 32, 22, 8, "clothing.base", trait);
    triangle(ctx, "body.base", [[16, 32], [20, 40], [20, 32]], "clothing.shadow", trait);
    triangle(ctx, "body.base", [[24, 32], [20, 40], [20, 32]], "clothing.highlight", trait);
  } else if (top === "suit") {
    triangle(ctx, "body.base", [[8, 40], [17, 31], [20, 40]], "clothing.base", trait);
    triangle(ctx, "body.base", [[32, 40], [23, 31], [20, 40]], "clothing.base", trait);
    triangle(ctx, "body.base", [[18, 32], [22, 32], [20, 36]], "accessory.white", trait);
    line(ctx, "body.base", 20, 34, 20, 40, "accessory.red", trait);
  } else if (top === "robe") {
    ellipse(ctx, "body.base", 20, 38, 14, 8, "clothing.base", trait);
    line(ctx, "body.base", 13, 33, 27, 40, "clothing.highlight", trait);
    line(ctx, "body.base", 27, 33, 13, 40, "clothing.shadow", trait);
  } else if (top === "armor") {
    rect(ctx, "body.base", 10, 32, 20, 8, "clothing.base", trait);
    rect(ctx, "body.base", 12, 33, 16, 1, "clothing.highlight", trait);
    line(ctx, "body.base", 20, 32, 20, 40, "clothing.shadow", trait);
  }

  ctx.placements[trait] = { trait, bbox: [7, 30, 33, 40] };
}

function drawHead(ctx: DrawContext) {
  const trait = `face.shape.${ctx.rig.id}`;
  drawMask(ctx.layers.get("head.base"), ctx.rig.masks.head, token(ctx, "skin.base"), meta(trait, "skin.base"));
  const edge = maskEdge(ctx.rig.masks.head);
  const shadow = ctx.layers.get("skin.shadow");
  const highlight = ctx.layers.get("skin.highlight");
  for (const point of edge.points) {
    const [x, y] = pointFromKey(point);
    if (y > ctx.rig.anchors["face.center"][1] + 2 || x > 26 || x < 13) shadow.set(x, y, token(ctx, "skin.shadow"), meta(trait, "skin.shadow"));
    if (x < 18 && y < 17) highlight.set(x, y, token(ctx, "skin.highlight"), meta(trait, "skin.highlight"));
  }
  ellipse(ctx, "skin.highlight", 16, ctx.rig.anchors["left_eye.center"][1] + 4, 2, 1, "skin.highlight", trait, ctx.rig.masks.head);
  ellipse(ctx, "skin.shadow", 24, ctx.rig.anchors.chin[1] - 1, 2.5, 1, "skin.shadow", trait, ctx.rig.masks.head);
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
  if (shape === "pointed") {
    triangle(ctx, "ears.back", [[cx + dir, cy - 3], [cx + dir * 5, cy], [cx + dir, cy + 3]], "skin.base", trait);
    line(ctx, "ears.front", cx + dir, cy, cx + dir * 3, cy + 1, "skin.shadow", trait);
  } else {
    const rx = shape === "small_round" ? 1.5 : shape === "large_round" || shape === "stick_out" ? 2.6 : 2;
    const ry = shape === "large_round" ? 3.4 : 2.7;
    const offset = shape === "stick_out" ? dir * 2 : dir;
    ellipse(ctx, "ears.back", cx + offset, cy, rx + 0.5, ry, "skin.shadow", trait);
    ellipse(ctx, "ears.base", cx + offset, cy, rx, ry - 0.3, "skin.base", trait);
    px(ctx, "ears.front", cx + offset + dir, cy, "skin.highlight", trait);
  }
  const layerKeys = new Set([...ctx.layers.get("ears.back").pixels.keys(), ...ctx.layers.get("ears.base").pixels.keys(), ...ctx.layers.get("ears.front").pixels.keys()]);
  const overlap = countOverlap(socket.joinMask, layerKeys);
  if (overlap < socket.minOverlap) ctx.warnings.push(`${trait} has low socket overlap: ${overlap}px`);
  ctx.placements[trait] = { trait, socket: socketName, socket_xy: socket.anchor, final_xy: [cx, cy], overlap_pixels: overlap, bbox: side === "left" ? [5, cy - 4, 12, cy + 5] : [28, cy - 4, 35, cy + 5] };
}

function drawHairBack(ctx: DrawContext) {
  const style = ctx.traits["hair.style"] ?? "short_messy";
  const trait = `hair.style.${style}`;
  if (style === "bald_clean" || style === "buzz_cut" || style === "undercut") return;
  const crown = ctx.rig.anchors["hair.crown"];

  if (style === "long_wavy") {
    ellipse(ctx, "hair.back", crown[0] - 8, 22, 4, 16, "hair.shadow", trait, ctx.rig.masks.hair_allowed);
    ellipse(ctx, "hair.back", crown[0] + 8, 22, 4, 16, "hair.shadow", trait, ctx.rig.masks.hair_allowed);
    ellipse(ctx, "hair.back", crown[0], 13, 12, 10, "hair.base", trait, ctx.rig.masks.hair_allowed);
  } else if (style === "bob_bangs") {
    ellipse(ctx, "hair.back", crown[0], 16, 13, 12, "hair.shadow", trait, ctx.rig.masks.hair_allowed);
    rect(ctx, "hair.back", 8, 16, 4, 12, "hair.base", trait, ctx.rig.masks.hair_allowed);
    rect(ctx, "hair.back", 28, 16, 4, 12, "hair.base", trait, ctx.rig.masks.hair_allowed);
  } else if (style === "curly_short") {
    for (const [x, y, r] of [
      [11, 10, 3],
      [15, 7, 4],
      [20, 6, 4],
      [25, 7, 4],
      [29, 11, 3]
    ]) ellipse(ctx, "hair.back", x, y, r, r, "hair.shadow", trait, ctx.rig.masks.hair_allowed);
  } else if (style === "short_messy") {
    ellipse(ctx, "hair.back", crown[0], 10, 12, 7, "hair.shadow", trait, ctx.rig.masks.hair_allowed);
  }
}

function drawHairFront(ctx: DrawContext) {
  const style = ctx.traits["hair.style"] ?? "short_messy";
  const trait = `hair.style.${style}`;
  const crown = ctx.rig.anchors["hair.crown"];
  const y = ctx.rig.anchors["hairline.center"][1];

  if (style === "bald_clean") {
    ctx.placements[trait] = { trait, bbox: [0, 0, 0, 0] };
    return;
  }

  if (style === "buzz_cut") {
    ellipse(ctx, "hair.front", crown[0], y, 11, 5, "hair.base", trait, ctx.rig.masks.hair_allowed);
    line(ctx, "hair.highlight", 14, y - 2, 26, y - 3, "hair.highlight", trait, ctx.rig.masks.hair_allowed);
  } else if (style === "short_messy") {
    ellipse(ctx, "hair.front", crown[0], y - 1, 12, 6, "hair.base", trait, ctx.rig.masks.hair_allowed);
    triangle(ctx, "hair.front", [[10, y], [14, y + 5], [16, y]], "hair.base", trait, ctx.rig.masks.hair_allowed);
    triangle(ctx, "hair.front", [[15, y - 2], [18, y + 5], [21, y - 1]], "hair.base", trait, ctx.rig.masks.hair_allowed);
    triangle(ctx, "hair.front", [[21, y - 1], [24, y + 5], [28, y]], "hair.base", trait, ctx.rig.masks.hair_allowed);
    line(ctx, "hair.highlight", 15, y, 22, y - 1, "hair.highlight", trait, ctx.rig.masks.hair_allowed);
  } else if (style === "bob_bangs") {
    ellipse(ctx, "hair.front", crown[0], y + 1, 12, 6, "hair.base", trait, ctx.rig.masks.hair_allowed);
    for (let i = 0; i < 5; i += 1) {
      const bx = 12 + i * 3;
      triangle(ctx, "hair.front", [[bx, y - 1], [bx + 3, y - 1], [bx + 1, y + 5 + (i % 2)]], "hair.base", trait, ctx.rig.masks.hair_allowed);
    }
    rect(ctx, "hair.side", 8, 16, 3, 12, "hair.shadow", trait, ctx.rig.masks.hair_allowed);
    rect(ctx, "hair.side", 29, 16, 3, 12, "hair.shadow", trait, ctx.rig.masks.hair_allowed);
  } else if (style === "curly_short") {
    for (const [x, yy, r] of [
      [11, y + 2, 3],
      [15, y - 1, 4],
      [20, y - 3, 4],
      [25, y - 1, 4],
      [29, y + 2, 3],
      [17, y + 4, 3],
      [23, y + 4, 3]
    ]) {
      ellipse(ctx, "hair.front", x, yy, r, r, "hair.base", trait, ctx.rig.masks.hair_allowed);
      if (r >= 4) px(ctx, "hair.highlight", x - 1, yy - 1, "hair.highlight", trait, ctx.rig.masks.hair_allowed);
    }
  } else if (style === "long_wavy") {
    ellipse(ctx, "hair.front", crown[0], y + 1, 12, 6, "hair.base", trait, ctx.rig.masks.hair_allowed);
    rect(ctx, "hair.side", 9, 15, 4, 18, "hair.base", trait, ctx.rig.masks.hair_allowed);
    rect(ctx, "hair.side", 27, 15, 4, 18, "hair.base", trait, ctx.rig.masks.hair_allowed);
    line(ctx, "hair.highlight", 13, 10, 11, 29, "hair.highlight", trait, ctx.rig.masks.hair_allowed);
    line(ctx, "hair.highlight", 26, 10, 29, 29, "hair.highlight", trait, ctx.rig.masks.hair_allowed);
  } else if (style === "undercut") {
    ellipse(ctx, "hair.front", 19, y - 1, 8, 5, "hair.base", trait, ctx.rig.masks.hair_allowed);
    rect(ctx, "hair.side", 10, 11, 3, 12, "hair.shadow", trait, ctx.rig.masks.hair_allowed);
    triangle(ctx, "hair.front", [[13, y - 3], [27, y - 2], [17, y + 5]], "hair.base", trait, ctx.rig.masks.hair_allowed);
    line(ctx, "hair.highlight", 15, y - 2, 25, y - 1, "hair.highlight", trait, ctx.rig.masks.hair_allowed);
  }

  ctx.placements[trait] = {
    trait,
    anchor: "hair.crown",
    anchor_xy: crown,
    mount_point: [0, 0],
    final_xy: crown,
    bbox: bboxUnion(["hair.back", "hair.side", "hair.front", "hair.highlight"].map((id) => ctx.layers.get(id).bbox()))
  };
}

function drawFaceDetails(ctx: DrawContext) {
  const detail = ctx.traits["face.detail"] ?? "none";
  if (detail === "none") return;
  const trait = `face.detail.${detail}`;
  const left = ctx.rig.anchors["left_eye.center"];
  const right = ctx.rig.anchors["right_eye.center"];
  const clip = ctx.rig.masks.face_core;

  if (detail === "blush_soft") {
    rect(ctx, "face.details", left[0] - 4, left[1] + 4, 3, 1, "blush.soft", trait, clip);
    rect(ctx, "face.details", right[0] + 2, right[1] + 4, 3, 1, "blush.soft", trait, clip);
  } else if (detail === "freckles_light") {
    for (const [x, y] of [
      [left[0] - 3, left[1] + 3],
      [left[0] + 1, left[1] + 4],
      [right[0] - 1, right[1] + 4],
      [right[0] + 3, right[1] + 3]
    ]) px(ctx, "face.details", x, y, "skin.shadow", trait, clip);
  } else if (detail === "cheek_mole_left") {
    px(ctx, "face.details", left[0] - 4, left[1] + 6, "line.dark", trait, clip);
  } else if (detail === "under_eye_lines") {
    line(ctx, "face.details", left[0] - 2, left[1] + 2, left[0] + 1, left[1] + 2, "skin.shadow", trait, clip);
    line(ctx, "face.details", right[0] - 1, right[1] + 2, right[0] + 2, right[1] + 2, "skin.shadow", trait, clip);
  } else if (detail === "scar_left_cheek") {
    line(ctx, "face.details", left[0] - 4, left[1] + 6, left[0] - 1, left[1] + 3, "scar.light", trait, clip);
  }
  ctx.placements[trait] = { trait, bbox: ctx.layers.get("face.details").bbox() };
}

function drawEyes(ctx: DrawContext) {
  const shape = ctx.traits["eyes.shape"] ?? "almond";
  drawEye(ctx, "left", shape);
  drawEye(ctx, "right", shape);
}

function drawEye(ctx: DrawContext, side: "left" | "right", shape: string) {
  const anchor = `${side}_eye.center`;
  const [cx, cy] = ctx.rig.anchors[anchor];
  const trait = `eyes.shape.${shape}.${side}`;
  const clip = ctx.rig.masks.face_core;

  if (shape === "dot") {
    px(ctx, "eyes.pupil", cx, cy, "eyes.pupil", trait, clip);
  } else if (shape === "round") {
    rect(ctx, "eyes.white", cx - 1, cy - 1, 3, 2, "accessory.white", trait, clip);
    px(ctx, "eyes.iris", cx, cy, "eyes.iris", trait, clip);
    px(ctx, "eyes.pupil", cx, cy, "eyes.pupil", trait, clip);
  } else if (shape === "almond") {
    line(ctx, "eyes.white", cx - 2, cy, cx + 2, cy, "accessory.white", trait, clip);
    px(ctx, "eyes.iris", cx, cy, "eyes.iris", trait, clip);
    line(ctx, "eyelids", cx - 2, cy - 1, cx + 2, cy - 1, "line.dark", trait, clip);
  } else if (shape === "sleepy") {
    line(ctx, "eyes.white", cx - 2, cy, cx + 2, cy, "accessory.white", trait, clip);
    line(ctx, "eyelids", cx - 2, cy - 1, cx + 2, cy - 1, "line.dark", trait, clip);
  } else if (shape === "happy_arc") {
    line(ctx, "eyes.pupil", cx - 2, cy, cx, cy - 1, "eyes.pupil", trait, clip);
    line(ctx, "eyes.pupil", cx, cy - 1, cx + 2, cy, "eyes.pupil", trait, clip);
  } else if (shape === "starry") {
    line(ctx, "eyes.iris", cx - 1, cy, cx + 1, cy, "eyes.iris", trait, clip);
    line(ctx, "eyes.iris", cx, cy - 1, cx, cy + 1, "eyes.iris", trait, clip);
    px(ctx, "eyes.pupil", cx, cy, "eyes.pupil", trait, clip);
  }

  ctx.placements[trait] = { trait, anchor, anchor_xy: [cx, cy], mount_point: [0, 0], final_xy: [cx, cy], bbox: [cx - 3, cy - 2, cx + 4, cy + 3] };
}

function drawEyebrows(ctx: DrawContext) {
  const shape = ctx.traits["eyebrows.shape"] ?? "soft_flat";
  const trait = `eyebrows.shape.${shape}`;
  const left = ctx.rig.anchors["left_eyebrow.center"];
  const right = ctx.rig.anchors["right_eyebrow.center"];
  const clip = ctx.rig.masks.face_core;
  const draw = (cx: number, cy: number, side: "left" | "right") => {
    if (shape === "soft_flat") line(ctx, "eyebrows", cx - 2, cy, cx + 2, cy, "hair.shadow", trait, clip);
    else if (shape === "arched") {
      line(ctx, "eyebrows", cx - 2, cy, cx, cy - 1, "hair.shadow", trait, clip);
      line(ctx, "eyebrows", cx, cy - 1, cx + 2, cy, "hair.shadow", trait, clip);
    } else if (shape === "thick_flat") rect(ctx, "eyebrows", cx - 2, cy - 1, 5, 2, "hair.shadow", trait, clip);
    else if (shape === "angry") line(ctx, "eyebrows", cx - 2, cy + (side === "left" ? -1 : 1), cx + 2, cy + (side === "left" ? 1 : -1), "hair.shadow", trait, clip);
    else if (shape === "sad") line(ctx, "eyebrows", cx - 2, cy + (side === "left" ? 1 : -1), cx + 2, cy + (side === "left" ? -1 : 1), "hair.shadow", trait, clip);
    else if (shape === "raised_left") line(ctx, "eyebrows", cx - 2, cy + (side === "left" ? -1 : 1), cx + 2, cy + (side === "left" ? -1 : 1), "hair.shadow", trait, clip);
  };
  draw(left[0], left[1], "left");
  draw(right[0], right[1], "right");
  ctx.placements[trait] = { trait, bbox: [left[0] - 3, left[1] - 2, right[0] + 4, right[1] + 3] };
}

function drawNose(ctx: DrawContext) {
  const shape = ctx.traits["nose.shape"] ?? "button";
  const trait = `nose.shape.${shape}`;
  const [cx, cy] = ctx.rig.anchors["nose.tip"];
  const clip = ctx.rig.masks.face_core;
  if (shape === "single_pixel") px(ctx, "nose", cx, cy, "skin.shadow", trait, clip);
  else if (shape === "button") {
    px(ctx, "nose", cx, cy, "skin.shadow", trait, clip);
    px(ctx, "nose", cx + 1, cy, "skin.shadow", trait, clip);
  } else if (shape === "small_line") line(ctx, "nose", cx, cy - 1, cx, cy + 1, "skin.shadow", trait, clip);
  else if (shape === "soft_bridge") {
    line(ctx, "nose", cx, cy - 2, cx, cy, "skin.shadow", trait, clip);
    px(ctx, "nose", cx + 1, cy + 1, "skin.shadow", trait, clip);
  } else if (shape === "triangle") triangle(ctx, "nose", [[cx, cy - 2], [cx - 1, cy + 1], [cx + 2, cy + 1]], "skin.shadow", trait, clip);
  else if (shape === "wide") {
    line(ctx, "nose", cx - 2, cy + 1, cx + 2, cy + 1, "skin.shadow", trait, clip);
    px(ctx, "nose", cx - 1, cy, "skin.shadow", trait, clip);
    px(ctx, "nose", cx + 1, cy, "skin.shadow", trait, clip);
  }
  ctx.placements[trait] = { trait, anchor: "nose.tip", anchor_xy: [cx, cy], final_xy: [cx, cy], bbox: [cx - 2, cy - 2, cx + 3, cy + 3] };
}

function drawMouth(ctx: DrawContext) {
  const shape = ctx.traits["mouth.shape"] ?? "small_smile";
  const trait = `mouth.shape.${shape}`;
  const [cx, cy] = ctx.rig.anchors["mouth.center"];
  const clip = ctx.rig.masks.face_core;
  if (shape === "neutral") line(ctx, "mouth", cx - 2, cy, cx + 2, cy, "mouth.dark", trait, clip);
  else if (shape === "small_smile") {
    px(ctx, "mouth", cx - 2, cy, "mouth.dark", trait, clip);
    px(ctx, "mouth", cx - 1, cy + 1, "mouth.dark", trait, clip);
    px(ctx, "mouth", cx, cy + 1, "mouth.dark", trait, clip);
    px(ctx, "mouth", cx + 1, cy, "mouth.dark", trait, clip);
  } else if (shape === "big_smile") {
    line(ctx, "mouth", cx - 3, cy, cx - 1, cy + 1, "mouth.dark", trait, clip);
    line(ctx, "mouth", cx - 1, cy + 1, cx + 3, cy, "mouth.dark", trait, clip);
    rect(ctx, "mouth", cx - 2, cy + 1, 4, 1, "mouth.teeth", trait, clip);
  } else if (shape === "teeth_smile") {
    rect(ctx, "mouth", cx - 3, cy, 6, 2, "mouth.dark", trait, clip);
    rect(ctx, "mouth", cx - 2, cy, 4, 1, "mouth.teeth", trait, clip);
  } else if (shape === "frown") {
    line(ctx, "mouth", cx - 2, cy + 1, cx, cy, "mouth.dark", trait, clip);
    line(ctx, "mouth", cx, cy, cx + 2, cy + 1, "mouth.dark", trait, clip);
  } else if (shape === "surprised_o") {
    rect(ctx, "mouth", cx - 1, cy - 1, 3, 3, "mouth.dark", trait, clip);
    px(ctx, "mouth", cx, cy, "mouth.shadow", trait, clip);
  } else if (shape === "smirk_left") {
    line(ctx, "mouth", cx - 3, cy + 1, cx - 1, cy, "mouth.dark", trait, clip);
    line(ctx, "mouth", cx - 1, cy, cx + 2, cy, "mouth.dark", trait, clip);
  }
  const belowNose = cy - ctx.rig.anchors["nose.tip"][1];
  if (belowNose < 2) ctx.warnings.push(`${trait} is close to nose.tip (${belowNose}px)`);
  ctx.placements[trait] = { trait, anchor: "mouth.center", anchor_xy: [cx, cy], mount_point: [0, 0], final_xy: [cx, cy], bbox: [cx - 4, cy - 2, cx + 5, cy + 4] };
}

function drawFacialHair(ctx: DrawContext) {
  const style = ctx.traits["facial_hair.style"] ?? "none";
  if (style === "none") return;
  const trait = `facial_hair.style.${style}`;
  const [cx, cy] = ctx.rig.anchors["mouth.center"];
  const clip = ctx.rig.masks.face_core;
  if (style === "stubble") {
    for (let y = cy + 2; y < cy + 6; y += 2) {
      for (let x = cx - 5; x <= cx + 5; x += 3) px(ctx, "facial_hair", x, y, "hair.shadow", trait, clip);
    }
  } else if (style === "mustache_thin") {
    line(ctx, "facial_hair", cx - 4, cy - 1, cx - 1, cy - 1, "hair.shadow", trait, clip);
    line(ctx, "facial_hair", cx + 1, cy - 1, cx + 4, cy - 1, "hair.shadow", trait, clip);
  } else if (style === "goatee") {
    rect(ctx, "facial_hair", cx - 1, cy + 2, 3, 2, "hair.shadow", trait, clip);
    px(ctx, "facial_hair", cx, cy + 4, "hair.shadow", trait, clip);
  } else if (style === "short_beard") {
    rect(ctx, "facial_hair", cx - 5, cy + 2, 2, 4, "hair.shadow", trait, clip);
    rect(ctx, "facial_hair", cx + 4, cy + 2, 2, 4, "hair.shadow", trait, clip);
    rect(ctx, "facial_hair", cx - 3, cy + 5, 7, 2, "hair.shadow", trait, clip);
  } else if (style === "sideburns") {
    rect(ctx, "facial_hair", 12, cy - 7, 2, 8, "hair.shadow", trait, clip);
    rect(ctx, "facial_hair", 26, cy - 7, 2, 8, "hair.shadow", trait, clip);
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
  const frame = shape === "thin_frame" ? "accessory.frame_light" : "accessory.frame";
  const clip = ctx.rig.masks.face_core;

  if (shape === "round" || shape === "thin_frame") {
    ellipseOutline(ctx, "glasses.frame", left[0], left[1], 2.4, 2, frame, trait, clip);
    ellipseOutline(ctx, "glasses.frame", right[0], right[1], 2.4, 2, frame, trait, clip);
  } else {
    const w = shape === "rectangle" || shape === "sunglasses" ? 6 : 5;
    const h = shape === "rectangle" || shape === "sunglasses" ? 3 : 4;
    glassesBox(ctx, left[0] - Math.floor(w / 2), left[1] - 1, w, h, shape === "sunglasses", frame, trait, clip);
    glassesBox(ctx, right[0] - Math.floor(w / 2), right[1] - 1, w, h, shape === "sunglasses", frame, trait, clip);
  }
  line(ctx, "glasses.frame", left[0] + 2, left[1], bridge[0], bridge[1], frame, trait, clip);
  line(ctx, "glasses.frame", bridge[0], bridge[1], right[0] - 2, right[1], frame, trait, clip);
  line(ctx, "glasses.frame", left[0] - 3, left[1], left[0] - 6, left[1] - 1, frame, trait);
  line(ctx, "glasses.frame", right[0] + 3, right[1], right[0] + 6, right[1] - 1, frame, trait);
  px(ctx, "glasses.highlight", left[0] - 1, left[1] - 1, "accessory.white", trait, clip);
  px(ctx, "glasses.highlight", right[0] - 1, right[1] - 1, "accessory.white", trait, clip);
  ctx.placements[trait] = { trait, anchor: "nose.bridge", anchor_xy: bridge, final_xy: bridge, bbox: [left[0] - 6, left[1] - 3, right[0] + 7, right[1] + 4] };
}

function glassesBox(ctx: DrawContext, x: number, y: number, w: number, h: number, filled: boolean, frame: string, trait: string, clip?: Mask) {
  if (filled) rect(ctx, "glasses.lens", x + 1, y + 1, w - 2, h - 1, "accessory.lens_dark", trait, clip);
  rect(ctx, "glasses.frame", x, y, w, 1, frame, trait, clip);
  rect(ctx, "glasses.frame", x, y + h - 1, w, 1, frame, trait, clip);
  rect(ctx, "glasses.frame", x, y, 1, h, frame, trait, clip);
  rect(ctx, "glasses.frame", x + w - 1, y, 1, h, frame, trait, clip);
}

function drawHeadwearBack(ctx: DrawContext) {
  const type = ctx.traits["headwear.type"] ?? "none";
  const trait = `headwear.type.${type}`;
  if (type === "hood") ellipse(ctx, "headwear.back", 20, 20, 15, 18, "clothing.shadow", trait);
  else if (type === "headphones") {
    line(ctx, "headwear.back", 13, 10, 27, 10, "accessory.frame", trait);
    line(ctx, "headwear.back", 13, 10, 11, 17, "accessory.frame", trait);
    line(ctx, "headwear.back", 27, 10, 29, 17, "accessory.frame", trait);
  }
}

function drawHeadwearFront(ctx: DrawContext) {
  const type = ctx.traits["headwear.type"] ?? "none";
  if (type === "none") return;
  const trait = `headwear.type.${type}`;
  const top = ctx.rig.anchors["head.top"][1];
  if (type === "beanie") {
    ellipse(ctx, "headwear.front", 20, top + 3, 11, 4, "clothing.base", trait, ctx.rig.masks.hair_allowed);
    rect(ctx, "headwear.front", 11, top + 6, 18, 2, "clothing.shadow", trait, ctx.rig.masks.hair_allowed);
    rect(ctx, "headwear.front", 18, top, 4, 1, "clothing.highlight", trait, ctx.rig.masks.hair_allowed);
  } else if (type === "cap") {
    ellipse(ctx, "headwear.front", 20, top + 3, 11, 4, "clothing.base", trait, ctx.rig.masks.hair_allowed);
    rect(ctx, "headwear.front", 11, top + 6, 18, 2, "clothing.shadow", trait, ctx.rig.masks.hair_allowed);
    triangle(ctx, "headwear.front", [[22, top + 6], [33, top + 7], [23, top + 9]], "clothing.base", trait);
  } else if (type === "crown") {
    rect(ctx, "headwear.front", 14, top + 1, 13, 3, "accessory.gold", trait);
    for (const x of [14, 18, 23]) triangle(ctx, "headwear.front", [[x, top + 1], [x + 4, top + 1], [x + 2, top - 3]], "accessory.gold", trait);
    px(ctx, "headwear.front", 20, top, "accessory.red", trait);
  } else if (type === "headphones") {
    rect(ctx, "headphones.front", 9, 16, 4, 7, "accessory.frame", trait);
    rect(ctx, "headphones.front", 27, 16, 4, 7, "accessory.frame", trait);
    rect(ctx, "headphones.front", 10, 18, 2, 3, "accessory.frame_light", trait);
    rect(ctx, "headphones.front", 28, 18, 2, 3, "accessory.frame_light", trait);
  } else if (type === "hood") {
    ellipseOutline(ctx, "headwear.front", 20, 20, 14, 17, "clothing.base", trait);
    rect(ctx, "headwear.front", 9, 21, 3, 10, "clothing.base", trait);
    rect(ctx, "headwear.front", 28, 21, 3, 10, "clothing.base", trait);
    rect(ctx, "headwear.front", 14, 33, 12, 3, "clothing.shadow", trait);
  } else if (type === "beret") {
    ellipse(ctx, "headwear.front", 18, top + 3, 11, 4, "clothing.base", trait, ctx.rig.masks.hair_allowed);
    rect(ctx, "headwear.front", 16, top - 1, 2, 2, "clothing.shadow", trait);
  }
  ctx.placements[trait] = { trait, bbox: bboxUnion(["headwear.back", "headwear.front", "headphones.front"].map((id) => ctx.layers.get(id).bbox())) };
}

function drawSilhouetteOutline(ctx: DrawContext) {
  const occupied = new Set<string>();
  for (const layer of ctx.layers.all()) {
    if (layer.id.startsWith("background.") || layer.id.startsWith("debug.") || layer.id === "character.outline") continue;
    for (const key of layer.pixels.keys()) occupied.add(key);
  }

  const outline = ctx.layers.get("character.outline");
  for (const point of occupied) {
    const [x, y] = pointFromKey(point);
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const ox = x + dx;
        const oy = y + dy;
        const key = keyOf(ox, oy);
        if (inBounds(ox, oy, CANVAS_SIZE, CANVAS_SIZE) && !occupied.has(key)) {
          outline.set(ox, oy, token(ctx, "line.dark"), meta("style.silhouette_outline", "line.dark"));
        }
      }
    }
  }
}
