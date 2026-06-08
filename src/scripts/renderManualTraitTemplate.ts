import { readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import { manualTemplateToSpec, ManualTraitTemplate } from "../core/manualTraitTemplate";
import { renderAvatar } from "../core/render";
import { writePng } from "../node/png";

const args = parseArgs(process.argv.slice(2));
const input = args.input;
const out = args.out;
const specOut = args.specOut;
const scale = Number(args.scale ?? 12);

if (!input) throw new Error("Missing --input <manual-template.json>");
if (!out && !specOut) throw new Error("Provide --out <avatar.png> or --specOut <avatar-spec.json>");

const template = JSON.parse(await readFile(input, "utf8")) as ManualTraitTemplate;
const spec = manualTemplateToSpec(template);

if (specOut) await writeJson(specOut, spec);
if (out) {
  const result = renderAvatar(spec);
  await writePng(out, result.image, scale);
}

console.log(JSON.stringify({ input, out, specOut, patches: spec.patches?.length ?? 0 }, null, 2));

async function writeJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function parseArgs(argv: string[]) {
  const parsed: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    parsed[arg.slice(2)] = argv[i + 1];
    i += 1;
  }
  return parsed;
}
