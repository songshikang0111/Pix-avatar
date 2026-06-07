import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { PNG } from "pngjs";
import { PixelImage, RenderLayer } from "../types";
import { hexToRgb } from "../core/color";

export function imageToPngBuffer(image: PixelImage, scale = 4) {
  const png = new PNG({ width: image.width * scale, height: image.height * scale });
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const srcX = Math.floor(x / scale);
      const srcY = Math.floor(y / scale);
      const cell = image.pixels.get(`${srcX},${srcY}`);
      const [r, g, b, a] = cell ? hexToRgb(cell.color) : [0, 0, 0, 0];
      const idx = (png.width * y + x) << 2;
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }
  return PNG.sync.write(png);
}

export async function writePng(path: string, image: PixelImage, scale = 4) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, imageToPngBuffer(image, scale));
}

export async function writeLayerPngs(dir: string, layers: RenderLayer[], scale = 4) {
  await mkdir(dir, { recursive: true });
  for (const layer of layers) {
    const image: PixelImage = {
      width: 128,
      height: 128,
      pixels: layer.pixels,
      stacks: new Map()
    };
    const safe = `${String(layer.z).padStart(3, "0")}_${layer.id.replace(/[^\w.-]+/g, "_")}.png`;
    await writePng(`${dir}/${safe}`, image, scale);
  }
}
