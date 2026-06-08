import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Boxes, Crosshair, Download, Grid2X2, RefreshCcw, Shuffle, Sparkles } from "lucide-react";
import { AssetPackId, AvatarSpec, PixelPatch, TraitKey } from "./types";
import { createSpecWithTraits } from "./core/spec";
import { randomSpec } from "./core/random";
import { renderAvatar } from "./core/render";
import { parseCompactPatch } from "./core/patch";
import { DEFAULT_ASSET_PACK_ID, getAssetPack, listAssetPacks, traitOptionsByKey } from "./assets/registry";
import { hexToRgb } from "./core/color";
import "./styles.css";

const paletteKeys = ["skin.tone", "hair.color", "eyes.color"] as TraitKey[];
const assetPacks = listAssetPacks();

function App() {
  const [spec, setSpec] = useState<AvatarSpec>(() => createSpecWithTraits());
  const [seed, setSeed] = useState("42");
  const [debugGrid, setDebugGrid] = useState(false);
  const [debugAnchors, setDebugAnchors] = useState(false);
  const [patchText, setPatchText] = useState("rect custom.face 18 26 4 1 mouth.dark clip=face");
  const [pixel, setPixel] = useState<[number, number] | undefined>(undefined);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const render = useMemo(
    () => renderAvatar(spec, { debugGrid, debugAnchors, pixel }),
    [spec, debugGrid, debugAnchors, pixel]
  );
  const activePack = getAssetPack(spec.asset_pack.id);
  const traitGroups = useMemo(() => traitOptionsByKey(spec.asset_pack.id), [spec.asset_pack.id]);
  const controlKeys = activePack.requiredTraitKeys.filter((key) => !paletteKeys.includes(key));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scale = 12;
    const logicalWidth = render.image.width;
    const logicalHeight = render.image.height;
    canvas.width = logicalWidth * scale;
    canvas.height = logicalHeight * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const cell of render.image.pixels.values()) {
      const [r, g, b, a] = hexToRgb(cell.color);
      if (a === 0) continue;
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
      ctx.fillRect(cell.x * scale, cell.y * scale, scale, scale);
    }
  }, [render]);

  const setTrait = (key: string, value: string) => {
    setSpec((current) => ({
      ...current,
      traits: { ...current.traits, [key]: value }
    }));
  };

  const randomize = () => {
    setSpec(randomSpec({ seed, preset: "friendly_agent", assetPackId: spec.asset_pack.id }));
  };

  const switchAssetPack = (assetPackId: AssetPackId) => {
    setSpec(createSpecWithTraits({}, assetPackId));
    setPixel(undefined);
  };

  const applyPatch = () => {
    const patch = parseCompactPatch(patchText);
    setSpec((current) => ({
      ...current,
      patches: [...(current.patches ?? []), patch as PixelPatch]
    }));
  };

  const resetPatches = () => {
    setSpec((current) => ({ ...current, patches: [] }));
  };

  const downloadSvg = () => {
    const blob = new Blob([render.svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pix-avatar.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * render.image.width);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * render.image.height);
    setPixel([x, y]);
  };

  return (
    <main className="appShell">
      <header className="topbar">
        <div className="brand">
          <div className="brandMark" aria-hidden="true">
            <Sparkles size={18} />
          </div>
          <div>
            <h1>Pix Avatar</h1>
            <p>Spec-first pixel avatar generator for agent workflows</p>
          </div>
        </div>
        <div className="topActions">
          <select className="seedInput" value={spec.asset_pack.id} onChange={(event) => switchAssetPack(parseAssetPack(event.target.value))} aria-label="Asset pack">
            {assetPacks.map((pack) => (
              <option key={pack.id} value={pack.id}>
                {pack.label}
              </option>
            ))}
          </select>
          <input className="seedInput" value={seed} onChange={(event) => setSeed(event.target.value)} aria-label="Seed" />
          <button type="button" className="button primary" onClick={randomize}>
            <Shuffle size={16} /> Random
          </button>
          <button type="button" className="iconButton" onClick={downloadSvg} aria-label="Download SVG" title="Download SVG">
            <Download size={17} />
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className="sidebar">
          <div className="panelTitle">
            <Boxes size={16} />
            Traits
          </div>
          <div className="paletteRow">
            {paletteKeys.map((key) => (
              <label key={key} className="field">
                <span>{shortLabel(key)}</span>
                <select value={spec.traits[key]} onChange={(event) => setTrait(key, event.target.value)}>
                  {(traitGroups[key] ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="controlGrid">
            {controlKeys.map((key) => (
              <label key={key} className="field">
                <span>{shortLabel(key)}</span>
                <select value={spec.traits[key]} onChange={(event) => setTrait(key, event.target.value)}>
                  {(traitGroups[key] ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </aside>

        <section className="stage">
          <div className="canvasToolbar">
            <button type="button" className={debugGrid ? "button selected" : "button"} onClick={() => setDebugGrid((value) => !value)}>
              <Grid2X2 size={16} /> Grid
            </button>
            <button type="button" className={debugAnchors ? "button selected" : "button"} onClick={() => setDebugAnchors((value) => !value)}>
              <Crosshair size={16} /> Anchors
            </button>
            <span>{render.inspect.visible_pixels.toLocaleString()} px visible</span>
          </div>
          <div className="canvasWrap">
            <canvas ref={canvasRef} onClick={onCanvasClick} />
          </div>
        </section>

        <aside className="inspector">
          <div className="panelTitle">
            <Crosshair size={16} />
            Inspector
          </div>
          <div className="patchBox">
            <textarea value={patchText} onChange={(event) => setPatchText(event.target.value)} />
            <div className="buttonRow">
              <button type="button" className="button primary" onClick={applyPatch}>
                <Sparkles size={16} /> Apply
              </button>
              <button type="button" className="button" onClick={resetPatches}>
                <RefreshCcw size={16} /> Reset
              </button>
            </div>
          </div>
          <dl className="stats">
            <div>
              <dt>Face</dt>
              <dd>{spec.traits["face.shape"]}</dd>
            </div>
            <div>
              <dt>Pack</dt>
              <dd>{activePack.id}</dd>
            </div>
            <div>
              <dt>Seed</dt>
              <dd>{String(spec.seed ?? "manual")}</dd>
            </div>
            <div>
              <dt>Patches</dt>
              <dd>{spec.patches?.length ?? 0}</dd>
            </div>
            <div>
              <dt>Warnings</dt>
              <dd>{render.inspect.warnings.length}</dd>
            </div>
          </dl>
          {pixel ? (
            <div className="pixelStack">
              <h2>
                Pixel {pixel[0]},{pixel[1]}
              </h2>
              {(render.inspect.pixel?.stack ?? []).map((entry, index) => (
                <div className="stackRow" key={`${entry.layer}-${index}`}>
                  <span className="swatch" style={{ background: entry.color }} />
                  <span>{entry.layer}</span>
                  <code>{entry.colorToken ?? entry.color}</code>
                </div>
              ))}
            </div>
          ) : (
            <div className="emptyState">Click the avatar to inspect a pixel stack.</div>
          )}
          <pre className="jsonPane">{JSON.stringify({ anchors: render.inspect.anchors, placements: Object.keys(render.inspect.placements).length }, null, 2)}</pre>
        </aside>
      </section>
    </main>
  );
}

function parseAssetPack(input: string): AssetPackId {
  if (input === "human_v2_icon") return "human_v2_icon";
  return DEFAULT_ASSET_PACK_ID;
}

function shortLabel(key: string) {
  return key.replace("background.style", "background").replace("facial_hair.style", "facial hair").replace(".shape", "").replace(".style", "").replace(".top", "").replace(".tone", "");
}

createRoot(document.getElementById("root")!).render(<App />);
