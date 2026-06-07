import express from "express";
import { renderAvatar } from "./core/render";
import { randomSpec } from "./core/random";
import { validateAvatar } from "./core/validate";
import { parseCompactPatch } from "./core/patch";
import { createSpecWithTraits } from "./core/spec";
import { TRAIT_OPTIONS } from "./assets/humanV1";
import { imageToPngBuffer } from "./node/png";

const app = express();
const port = Number(process.env.PORT ?? 8787);

app.use(express.json({ limit: "5mb" }));

app.get("/health", (_req, res) => res.json({ ok: true, service: "pix-avatar", version: "0.1.0" }));
app.get("/traits", (req, res) => {
  const type = req.query.type as string | undefined;
  res.json(type ? TRAIT_OPTIONS.filter((trait) => trait.key === type) : TRAIT_OPTIONS);
});
app.get("/traits/:id", (req, res) => {
  const trait = TRAIT_OPTIONS.find((option) => option.id === req.params.id || `${option.key}.${option.value}` === req.params.id);
  if (!trait) res.status(404).json({ error: { code: "TRAIT_NOT_FOUND", message: req.params.id } });
  else res.json(trait);
});
app.post("/avatar/new", (req, res) => res.json({ spec: createSpecWithTraits(req.body?.traits ?? {}) }));
app.post("/avatar/random", (req, res) => res.json({ spec: randomSpec(req.body ?? {}) }));
app.post("/avatar/render", (req, res) => {
  const result = renderAvatar(req.body.spec ?? req.body, req.body.options ?? {});
  const scale = Number(req.body?.spec?.canvas?.scale ?? req.body?.canvas?.scale ?? 4);
  const png = imageToPngBuffer(result.image, scale).toString("base64");
  res.json({
    image: { png_base64: png, width: result.image.width * scale, height: result.image.height * scale },
    spec: result.spec,
    inspect: result.inspect,
    svg: req.body?.outputs?.svg ? result.svg : undefined
  });
});
app.post("/avatar/patch", (req, res) => {
  const spec = req.body.spec;
  const compactOps = req.body.opsCompact ?? [];
  const jsonOps = req.body.ops ?? [];
  spec.patches = [...(spec.patches ?? []), ...compactOps.map(parseCompactPatch), ...jsonOps];
  res.json({ spec });
});
app.post("/avatar/inspect", (req, res) => {
  const result = renderAvatar(req.body.spec ?? req.body, { pixel: req.body.pixel });
  res.json(result.inspect);
});
app.post("/avatar/validate", (req, res) => res.json(validateAvatar(req.body.spec ?? req.body)));

app.listen(port, () => {
  console.log(`pix-avatar api listening on http://127.0.0.1:${port}`);
});
