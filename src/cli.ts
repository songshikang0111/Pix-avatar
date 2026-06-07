#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Command } from "commander";
import YAML from "yaml";
import { AvatarSpec, TraitMap } from "./types";
import { createSpecWithTraits } from "./core/spec";
import { randomSpec } from "./core/random";
import { renderAvatar } from "./core/render";
import { parseCompactPatch } from "./core/patch";
import { validateAssetPackMinimums, validateAvatar } from "./core/validate";
import { TRAIT_OPTIONS } from "./assets/humanV1";
import { writeLayerPngs, writePng } from "./node/png";

const program = new Command();
program.name("avatar").description("Spec-first pixel avatar generator for agents.").version("0.1.0");

program
  .command("traits")
  .argument("<action>", "list or show")
  .argument("[id]")
  .option("--type <type>")
  .option("--json")
  .action((action, id, options) => {
    if (action === "list") {
      const rows = TRAIT_OPTIONS.filter((trait) => !options.type || trait.key === options.type);
      output(rows, options.json);
      return;
    }
    if (action === "show") {
      const trait = TRAIT_OPTIONS.find((option) => option.id === id || `${option.key}.${option.value}` === id);
      if (!trait) throw new Error(`Trait not found: ${id}`);
      output(trait, options.json);
      return;
    }
    throw new Error(`Unknown traits action: ${action}`);
  });

program
  .command("new")
  .option("--preset <preset>", "currently supports human", "human")
  .option("--out <path>")
  .action(async (options) => {
    const spec = createSpecWithTraits();
    await writeSpecOrStdout(spec, options.out);
  });

program
  .command("random")
  .option("--seed <seed>")
  .option("--preset <preset>", "optional preset, e.g. friendly_agent")
  .option("--constraint <constraint...>", "key=value1,value2")
  .option("--out <path>")
  .action(async (options) => {
    const constraints: Record<string, string[]> = {};
    for (const raw of options.constraint ?? []) {
      const [key, values] = raw.split("=");
      constraints[key] = values.split(",");
    }
    const spec = randomSpec({ seed: options.seed, preset: options.preset, constraints });
    await writeSpecOrStdout(spec, options.out);
  });

program
  .command("set")
  .argument("<input>")
  .argument("[traits...]")
  .option("--out <path>")
  .action(async (input, traits, options) => {
    const spec = await readSpec(input);
    for (const assignment of traits ?? []) {
      const [key, value] = assignment.split("=");
      spec.traits[key] = value;
    }
    await writeSpecOrStdout(spec, options.out ?? input);
  });

program
  .command("patch")
  .argument("<input>")
  .option("--op <op...>", "compact patch op")
  .option("--ops <path>", "JSON patch file")
  .option("--out <path>")
  .action(async (input, options) => {
    const spec = await readSpec(input);
    const patches = [...(spec.patches ?? [])];
    for (const op of options.op ?? []) patches.push(parseCompactPatch(op));
    if (options.ops) {
      const text = await readFile(options.ops, "utf8");
      patches.push(...JSON.parse(text));
    }
    spec.patches = patches;
    await writeSpecOrStdout(spec, options.out ?? input);
  });

program
  .command("render")
  .argument("<input>")
  .requiredOption("--out <path>")
  .option("--scale <scale>", "output scale", "4")
  .option("--debug-grid <path>")
  .option("--debug-anchors <path>")
  .option("--layers <dir>")
  .option("--report <path>")
  .option("--svg <path>")
  .action(async (input, options) => {
    const spec = await readSpec(input);
    const scale = Number(options.scale ?? spec.canvas.scale ?? 4);
    const result = renderAvatar(spec);
    await writePng(options.out, result.image, scale);
    if (options.debugGrid) await writePng(options.debugGrid, renderAvatar(spec, { debugGrid: true }).image, scale);
    if (options.debugAnchors) await writePng(options.debugAnchors, renderAvatar(spec, { debugAnchors: true }).image, scale);
    if (options.layers) await writeLayerPngs(options.layers, result.layers, scale);
    if (options.report) await writeJson(options.report, result.inspect);
    if (options.svg) await writeText(options.svg, result.svg);
    output({ out: options.out, warnings: result.inspect.warnings, visible_pixels: result.inspect.visible_pixels }, true);
  });

program
  .command("inspect")
  .argument("<input>")
  .option("--pixel <xy>", "x,y")
  .option("--json")
  .action(async (input, options) => {
    const spec = await readSpec(input);
    const pixel = options.pixel ? parsePixel(options.pixel) : undefined;
    const result = renderAvatar(spec, { pixel });
    output(result.inspect, options.json);
  });

program
  .command("validate")
  .argument("[input]")
  .option("--json")
  .action(async (input, options) => {
    if (!input) {
      output(validateAssetPackMinimums(5), options.json);
      return;
    }
    output(validateAvatar(await readSpec(input)), options.json);
  });

program
  .command("export-svg")
  .argument("<input>")
  .requiredOption("--out <path>")
  .action(async (input, options) => {
    const result = renderAvatar(await readSpec(input));
    await writeText(options.out, result.svg);
  });

program
  .command("assets")
  .argument("<action>", "validate")
  .option("--json")
  .action((action, options) => {
    if (action !== "validate") throw new Error(`Unknown assets action: ${action}`);
    output(validateAssetPackMinimums(5), options.json);
  });

program.parseAsync();

async function readSpec(path: string): Promise<AvatarSpec> {
  const text = await readFile(path, "utf8");
  if (path.endsWith(".yaml") || path.endsWith(".yml")) return YAML.parse(text);
  return JSON.parse(text);
}

async function writeSpecOrStdout(spec: AvatarSpec, path?: string) {
  if (!path) {
    output(spec, true);
    return;
  }
  await writeJson(path, spec);
}

async function writeJson(path: string, value: unknown) {
  await writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeText(path: string, text: string) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
}

function parsePixel(input: string): [number, number] {
  const [x, y] = input.split(",").map(Number);
  return [x, y];
}

function output(value: unknown, json = false) {
  if (json) console.log(JSON.stringify(value, null, 2));
  else console.log(formatHuman(value));
}

function formatHuman(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => JSON.stringify(item)).join("\n");
  if (typeof value === "object") return YAML.stringify(value);
  return String(value);
}
