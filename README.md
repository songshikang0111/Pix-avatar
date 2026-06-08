# Pix Avatar

Spec-first 32x32 pixel avatar generator for agents, CLIs, SDKs, and HTTP workflows.

The canonical source is an Avatar Spec. PNG, SVG, debug grids, anchors, layer
reports, and pixel inspection are all deterministic render outputs.

## Quick Start

Production CLI install:

```bash
npm install -g @shiki0111/pix-avatar

pix-avatar random --seed 42 --out spec.json
pix-avatar render spec.json --out avatar.png
pix-avatar inspect spec.json --pixel 20,26 --json
```

Package-local install:

```bash
npm install @shiki0111/pix-avatar
npx pix-avatar random --seed 42 --out spec.json
```

Local development:

```bash
npm install
npm run dev
```

The local web app opens `Pix Avatar Trait Studio`, a 32x32 manual trait editor.
It supports reference-image underlays, slot-specific layers, color picking,
brush/eraser tools, undo/redo, saved layer variants, cross-slot preview, and
JSON export.

See the Chinese operation manual for the reference-to-trait workflow:
[`docs/trait-studio-manual.zh.md`](docs/trait-studio-manual.zh.md).

CLI examples:

```bash
npm run cli -- random --seed 42 --out examples/specs/seed-42.json
npm run cli -- render examples/specs/seed-42.json --out examples/outputs/seed-42.png --debug-grid examples/outputs/seed-42-grid.png --debug-anchors examples/outputs/seed-42-anchors.png
npm run cli -- inspect examples/specs/seed-42.json --pixel 20,26 --json
npm run validate:assets
```

Manual trait template export can be rendered by the repo:

```bash
npm run render:manual-template -- --input ./my-traits.manual-traits.json --out ./avatar.png --specOut ./avatar-spec.json
```

The default logical canvas is `32x32`; the default scale is `12`, so PNG
renders are `384x384` unless `--scale` is provided. Public Avatar Specs are
validated as `32x32` only; the reference-derived part assets are stored as
32px output-coordinate patches.

HTTP API:

```bash
npm run serve:api
```

Endpoints include `GET /traits`, `POST /avatar/random`, `POST /avatar/render`,
`POST /avatar/patch`, `POST /avatar/inspect`, and `POST /avatar/validate`.
