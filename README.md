# Pix Avatar

Spec-first pixel avatar generator for agents, CLIs, SDKs, and HTTP workflows.

The canonical source is an Avatar Spec. PNG, SVG, debug grids, anchors, layer
reports, and pixel inspection are all deterministic render outputs.

## Quick Start

```bash
npm install
npm run dev
```

CLI examples:

```bash
npm run cli -- random --seed 42 --out examples/specs/seed-42.json
npm run cli -- render examples/specs/seed-42.json --out examples/outputs/seed-42.png --debug-grid examples/outputs/seed-42-grid.png --debug-anchors examples/outputs/seed-42-anchors.png
npm run cli -- inspect examples/specs/seed-42.json --pixel 64,80 --json
npm run validate:assets
```

HTTP API:

```bash
npm run serve:api
```

Endpoints include `GET /traits`, `POST /avatar/random`, `POST /avatar/render`,
`POST /avatar/patch`, `POST /avatar/inspect`, and `POST /avatar/validate`.
