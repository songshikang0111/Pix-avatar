import { PixelImage, RenderLayer } from "../types";

export function exportSvg(image: PixelImage, layers?: RenderLayer[], scale = 1) {
  const width = image.width * scale;
  const height = image.height * scale;
  const body: string[] = [];
  if (layers?.length) {
    for (const layer of layers) {
      const rects = [...layer.pixels.values()]
        .sort((a, b) => a.y - b.y || a.x - b.x)
        .map((cell) => `<rect x="${cell.x}" y="${cell.y}" width="1" height="1" fill="${cell.color}" data-trait="${escapeAttr(cell.meta.trait ?? "")}" data-token="${escapeAttr(cell.meta.colorToken ?? "")}" />`)
        .join("");
      if (rects) body.push(`<g id="${escapeAttr(layer.id)}" data-layer="${escapeAttr(layer.id)}" data-z="${layer.z}">${rects}</g>`);
    }
  } else {
    body.push(
      [...image.pixels.values()]
        .sort((a, b) => a.y - b.y || a.x - b.x)
        .map((cell) => `<rect x="${cell.x}" y="${cell.y}" width="1" height="1" fill="${cell.color}" />`)
        .join("")
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${image.width} ${image.height}" shape-rendering="crispEdges">${body.join("")}</svg>`;
}

function escapeAttr(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === "\"") return "&quot;";
    return "&#39;";
  });
}
