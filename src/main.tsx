import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Brush,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FileJson,
  Grid2X2,
  Image as ImageIcon,
  Layers,
  Pipette,
  Redo2,
  Save,
  Trash2,
  Undo2,
  Upload,
  ZoomIn
} from "lucide-react";
import {
  createEmptyManualTemplate,
  manualTemplateToSpec,
  MANUAL_TRAIT_LAYER_DEFS,
  ManualTraitSlot,
  ManualTraitTemplate
} from "./core/manualTraitTemplate";
import { hexToRgb } from "./core/color";
import "./styles.css";

type Tool = "brush" | "eraser" | "picker";
type PixelMap = Record<string, string>;

interface EditorLayer {
  slot: ManualTraitSlot;
  label: string;
  visible: boolean;
  opacity: number;
  pixels: PixelMap;
}

interface ReferenceSource {
  id: string;
  label: string;
  matrix: string[][];
}

interface SavedTraitAsset {
  id: string;
  slot: ManualTraitSlot;
  name: string;
  pixels: PixelMap;
  createdAt: string;
}

const CANVAS_SIZE = 32;
const ASSET_STORAGE_KEY = "pix-avatar.manualTraitAssets.v1";
const DEFAULT_SWATCHES = ["#171719", "#F4C7B7", "#8A4A3A", "#FFFFFF", "#56CCF2", "#2F80ED", "#F875AD", "#F2C94C", "#6B4F1D", "#E25555"];

const referenceLoaders = import.meta.glob("../datasets/reference/istock-36/matrices/*.json") as Record<
  string,
  () => Promise<{ default?: { matrix: string[][] }; matrix?: string[][] }>
>;

const BUILT_IN_REFERENCE_INDEX = Object.entries(referenceLoaders)
  .map(([path]) => {
    const id = path.match(/avatar-\d+/)?.[0] ?? path;
    return { id, label: id.replace("avatar-", "#"), path };
  })
  .sort((a, b) => a.id.localeCompare(b.id));

function App() {
  const [templateName, setTemplateName] = useState("manual-reference-traits");
  const [layers, setLayers] = useState<EditorLayer[]>(() => createEditorLayers());
  const [activeSlot, setActiveSlot] = useState<ManualTraitSlot>("face.shape");
  const [tool, setTool] = useState<Tool>("brush");
  const [brushSize, setBrushSize] = useState(1);
  const [color, setColor] = useState("#171719");
  const [zoom, setZoom] = useState(18);
  const [showGrid, setShowGrid] = useState(true);
  const [showReference, setShowReference] = useState(true);
  const [referenceOpacity, setReferenceOpacity] = useState(0.28);
  const [customReferences, setCustomReferences] = useState<ReferenceSource[]>([]);
  const [loadedReferences, setLoadedReferences] = useState<Record<string, ReferenceSource>>({});
  const [referenceId, setReferenceId] = useState(BUILT_IN_REFERENCE_INDEX[0]?.id ?? "none");
  const [hoveredPixel, setHoveredPixel] = useState<[number, number] | undefined>();
  const [lastPick, setLastPick] = useState<string | undefined>();
  const [assetName, setAssetName] = useState("");
  const [savedAssets, setSavedAssets] = useState<SavedTraitAsset[]>(() => readSavedAssets());
  const [previewAssets, setPreviewAssets] = useState<Partial<Record<ManualTraitSlot, string>>>({});
  const [history, setHistory] = useState<EditorLayer[][]>([]);
  const [future, setFuture] = useState<EditorLayer[][]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const pointerDownRef = useRef(false);
  const activeLayer = layers.find((layer) => layer.slot === activeSlot) ?? layers[0];
  const referenceOptions = useMemo(
    () => [...customReferences.map((reference) => ({ id: reference.id, label: reference.label })), ...BUILT_IN_REFERENCE_INDEX.map(({ id, label }) => ({ id, label }))],
    [customReferences]
  );
  const activeReference = customReferences.find((reference) => reference.id === referenceId) ?? loadedReferences[referenceId];
  const activeAssets = savedAssets.filter((asset) => asset.slot === activeSlot);
  const activePixelCount = Object.keys(activeLayer?.pixels ?? {}).length;
  const template = useMemo(
    () => editorLayersToTemplate(templateName, layers, { id: activeReference?.id, opacity: referenceOpacity }),
    [activeReference?.id, layers, referenceOpacity, templateName]
  );
  const spec = useMemo(() => manualTemplateToSpec(template), [template]);

  useEffect(() => {
    window.localStorage.setItem(ASSET_STORAGE_KEY, JSON.stringify(savedAssets));
  }, [savedAssets]);

  useEffect(() => {
    if (!referenceId || customReferences.some((reference) => reference.id === referenceId) || loadedReferences[referenceId]) return;
    const indexEntry = BUILT_IN_REFERENCE_INDEX.find((reference) => reference.id === referenceId);
    if (!indexEntry) return;
    let cancelled = false;
    referenceLoaders[indexEntry.path]().then((module) => {
      if (cancelled) return;
      const source = module.default ?? module;
      setLoadedReferences((current) => ({
        ...current,
        [indexEntry.id]: {
          id: indexEntry.id,
          label: indexEntry.label,
          matrix: source.matrix ?? blankMatrix("#FFFFFF")
        }
      }));
    });
    return () => {
      cancelled = true;
    };
  }, [customReferences, loadedReferences, referenceId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawEditorCanvas(canvas, {
      layers,
      zoom,
      reference: showReference ? activeReference : undefined,
      referenceOpacity,
      showGrid,
      hoveredPixel
    });
  }, [activeReference, hoveredPixel, layers, referenceOpacity, showGrid, showReference, zoom]);

  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    const previewLayers = layers.map((layer) => {
      const assetId = previewAssets[layer.slot];
      const asset = assetId && layer.slot !== activeSlot ? savedAssets.find((candidate) => candidate.id === assetId) : undefined;
      return asset ? { ...layer, pixels: asset.pixels, visible: true, opacity: 1 } : layer;
    });
    drawEditorCanvas(canvas, {
      layers: previewLayers,
      zoom: 5,
      reference: undefined,
      referenceOpacity: 0,
      showGrid: false
    });
  }, [activeSlot, layers, previewAssets, savedAssets]);

  const pushHistory = useCallback(() => {
    setHistory((current) => [...current.slice(-49), cloneLayers(layers)]);
    setFuture([]);
  }, [layers]);

  const paintAt = useCallback(
    (x: number, y: number) => {
      if (tool === "picker") {
        const picked = pickColorAt(x, y, layers, activeReference, showReference);
        if (picked) {
          setColor(picked);
          setLastPick(`${picked} @ ${x},${y}`);
        }
        return;
      }
      setLayers((current) =>
        current.map((layer) => {
          if (layer.slot !== activeSlot) return layer;
          const pixels = { ...layer.pixels };
          const radius = Math.floor(brushSize / 2);
          for (let yy = y - radius; yy <= y + radius; yy += 1) {
            for (let xx = x - radius; xx <= x + radius; xx += 1) {
              if (!inCanvas(xx, yy)) continue;
              const key = pixelKey(xx, yy);
              if (tool === "eraser") delete pixels[key];
              else pixels[key] = color.toUpperCase();
            }
          }
          return { ...layer, pixels };
        })
      );
    },
    [activeReference, activeSlot, brushSize, color, layers, showReference, tool]
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = canvasPoint(event, zoom);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerDownRef.current = true;
    if (tool !== "picker") pushHistory();
    paintAt(point[0], point[1]);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = canvasPoint(event, zoom);
    setHoveredPixel(point);
    if (!point || !pointerDownRef.current || tool === "picker") return;
    paintAt(point[0], point[1]);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    pointerDownRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const undo = () => {
    setHistory((current) => {
      const previous = current.at(-1);
      if (!previous) return current;
      setFuture((next) => [cloneLayers(layers), ...next]);
      setLayers(previous);
      return current.slice(0, -1);
    });
  };

  const redo = () => {
    setFuture((current) => {
      const next = current[0];
      if (!next) return current;
      setHistory((past) => [...past, cloneLayers(layers)]);
      setLayers(next);
      return current.slice(1);
    });
  };

  const clearActiveLayer = () => {
    pushHistory();
    setLayers((current) => current.map((layer) => (layer.slot === activeSlot ? { ...layer, pixels: {} } : layer)));
  };

  const saveActiveAsset = () => {
    if (!activeLayer || activePixelCount === 0) return;
    const name = assetName.trim() || `${activeLayer.label} ${savedAssets.filter((asset) => asset.slot === activeSlot).length + 1}`;
    setSavedAssets((current) => [
      ...current,
      {
        id: `${activeSlot}-${Date.now()}`,
        slot: activeSlot,
        name,
        pixels: { ...activeLayer.pixels },
        createdAt: new Date().toISOString()
      }
    ]);
    setAssetName("");
  };

  const loadAssetToLayer = (asset: SavedTraitAsset) => {
    pushHistory();
    setLayers((current) => current.map((layer) => (layer.slot === asset.slot ? { ...layer, pixels: { ...asset.pixels }, visible: true } : layer)));
    setActiveSlot(asset.slot);
  };

  const deleteAsset = (assetId: string) => {
    setSavedAssets((current) => current.filter((asset) => asset.id !== assetId));
    setPreviewAssets((current) => Object.fromEntries(Object.entries(current).filter(([, value]) => value !== assetId)));
  };

  const importTemplate = async (file: File | undefined) => {
    if (!file) return;
    const parsed = JSON.parse(await file.text()) as ManualTraitTemplate;
    setTemplateName(parsed.name);
    setLayers(templateToEditorLayers(parsed));
    if (parsed.reference?.id) setReferenceId(parsed.reference.id);
    if (parsed.reference?.opacity) setReferenceOpacity(parsed.reference.opacity);
    setHistory([]);
    setFuture([]);
  };

  const uploadReference = async (file: File | undefined) => {
    if (!file) return;
    const matrix = await imageFileToMatrix(file);
    const next = { id: `upload-${Date.now()}`, label: file.name.replace(/\.[^.]+$/, ""), matrix };
    setCustomReferences((current) => [next, ...current]);
    setReferenceId(next.id);
    setShowReference(true);
  };

  const slotOptions = (slot: ManualTraitSlot) => savedAssets.filter((asset) => asset.slot === slot);

  return (
    <main className="editorShell">
      <header className="topbar">
        <div className="brand">
          <div className="brandMark" aria-hidden="true">
            <Layers size={18} />
          </div>
          <div>
            <h1>Pix Avatar Trait Studio</h1>
            <p>32x32 manual layer editor for reusable avatar traits</p>
          </div>
        </div>
        <div className="topActions">
          <input className="nameInput" value={templateName} onChange={(event) => setTemplateName(event.target.value)} aria-label="Template name" />
          <button type="button" className="button" onClick={() => downloadJson(`${templateName}.manual-traits.json`, template)}>
            <Download size={16} /> Template
          </button>
          <button type="button" className="button primary" onClick={() => downloadJson(`${templateName}.avatar-spec.json`, spec)}>
            <FileJson size={16} /> Spec
          </button>
        </div>
      </header>

      <section className="editorWorkspace">
        <aside className="leftRail">
          <section className="toolPanel">
            <div className="panelTitle">
              <ImageIcon size={16} />
              Reference
            </div>
            <div className="fieldGroup">
              <label className="field">
                <span>Image</span>
                <select value={referenceId} onChange={(event) => setReferenceId(event.target.value)}>
                  {referenceOptions.map((reference) => (
                    <option key={reference.id} value={reference.id}>
                      {reference.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="inlineToggle">
                <input type="checkbox" checked={showReference} onChange={(event) => setShowReference(event.target.checked)} />
                <span>Visible</span>
              </label>
              <label className="field">
                <span>Opacity</span>
                <input type="range" min="0" max="0.8" step="0.05" value={referenceOpacity} onChange={(event) => setReferenceOpacity(Number(event.target.value))} />
              </label>
              <label className="fileButton">
                <Upload size={15} />
                Upload
                <input type="file" accept="image/*" onChange={(event) => uploadReference(event.target.files?.[0])} />
              </label>
            </div>
          </section>

          <section className="toolPanel">
            <div className="panelTitle">
              <Layers size={16} />
              Layers
            </div>
            <div className="layerList">
              {layers.map((layer) => (
                <div key={layer.slot} className={layer.slot === activeSlot ? "layerRow active" : "layerRow"}>
                  <button type="button" className="visibilityButton" onClick={() => toggleLayerVisibility(layer.slot, setLayers)} title={layer.visible ? "Hide layer" : "Show layer"}>
                    {layer.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                  <button type="button" className="layerSelect" onClick={() => setActiveSlot(layer.slot)}>
                    <span>{layer.label}</span>
                    <code>{Object.keys(layer.pixels).length}</code>
                  </button>
                  <input
                    aria-label={`${layer.label} opacity`}
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={layer.opacity}
                    onChange={(event) => setLayerOpacity(layer.slot, Number(event.target.value), setLayers)}
                  />
                </div>
              ))}
            </div>
          </section>
        </aside>

        <section className="drawStage">
          <div className="drawToolbar">
            <div className="segmented">
              <button type="button" className={tool === "brush" ? "toolButton selected" : "toolButton"} onClick={() => setTool("brush")} title="Brush">
                <Brush size={16} />
              </button>
              <button type="button" className={tool === "eraser" ? "toolButton selected" : "toolButton"} onClick={() => setTool("eraser")} title="Erase">
                <Eraser size={16} />
              </button>
              <button type="button" className={tool === "picker" ? "toolButton selected" : "toolButton"} onClick={() => setTool("picker")} title="Pick color">
                <Pipette size={16} />
              </button>
            </div>
            <input className="colorInput" type="color" value={color} onChange={(event) => setColor(event.target.value.toUpperCase())} aria-label="Paint color" />
            <div className="swatchStrip">
              {DEFAULT_SWATCHES.map((swatch) => (
                <button key={swatch} type="button" className="paintSwatch" style={{ background: swatch }} onClick={() => setColor(swatch)} title={swatch} />
              ))}
            </div>
            <label className="compactRange">
              <Brush size={15} />
              <input type="range" min="1" max="3" step="1" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} />
              <span>{brushSize}px</span>
            </label>
            <label className="compactRange">
              <ZoomIn size={15} />
              <input type="range" min="10" max="24" step="1" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
              <span>{zoom}x</span>
            </label>
            <button type="button" className={showGrid ? "toolButton selected" : "toolButton"} onClick={() => setShowGrid((value) => !value)} title="Grid">
              <Grid2X2 size={16} />
            </button>
            <button type="button" className="toolButton" onClick={undo} disabled={history.length === 0} title="Undo">
              <Undo2 size={16} />
            </button>
            <button type="button" className="toolButton" onClick={redo} disabled={future.length === 0} title="Redo">
              <Redo2 size={16} />
            </button>
          </div>

          <div className="canvasViewport">
            <canvas
              ref={canvasRef}
              className="pixelCanvas"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerLeave={() => setHoveredPixel(undefined)}
            />
          </div>

          <div className="statusBar">
            <span>{activeLayer?.label}</span>
            <span>{activePixelCount} px</span>
            <span>{hoveredPixel ? `${hoveredPixel[0]},${hoveredPixel[1]}` : "--,--"}</span>
            <span>{lastPick ?? color}</span>
          </div>
        </section>

        <aside className="rightRail">
          <section className="toolPanel">
            <div className="panelTitle">
              <Save size={16} />
              Asset
            </div>
            <div className="fieldGroup">
              <input className="textInput" value={assetName} onChange={(event) => setAssetName(event.target.value)} placeholder={`${activeLayer?.label ?? "Layer"} option`} />
              <div className="buttonRow">
                <button type="button" className="button primary" onClick={saveActiveAsset} disabled={activePixelCount === 0}>
                  <Save size={15} /> Save
                </button>
                <button type="button" className="button" onClick={clearActiveLayer} disabled={activePixelCount === 0}>
                  <Trash2 size={15} /> Clear
                </button>
              </div>
            </div>
            <div className="assetList">
              {activeAssets.map((asset) => (
                <div key={asset.id} className="assetRow">
                  <button type="button" onClick={() => loadAssetToLayer(asset)}>
                    <span>{asset.name}</span>
                    <code>{Object.keys(asset.pixels).length}px</code>
                  </button>
                  <button type="button" className="visibilityButton" onClick={() => deleteAsset(asset.id)} title="Delete asset">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="toolPanel">
            <div className="panelTitle">
              <Eye size={16} />
              Preview
            </div>
            <canvas ref={previewRef} className="previewCanvas" />
            {(["face.shape", "hair.style", "clothing.top", "glasses.shape", "headwear.type"] as ManualTraitSlot[]).map((slot) => (
              <label key={slot} className="field compactField">
                <span>{slotLabel(slot)}</span>
                <select value={previewAssets[slot] ?? ""} onChange={(event) => setPreviewAssets((current) => ({ ...current, [slot]: event.target.value || undefined }))}>
                  <option value="">Current</option>
                  {slotOptions(slot).map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </section>

          <section className="toolPanel">
            <div className="panelTitle">
              <FileJson size={16} />
              Export
            </div>
            <div className="buttonStack">
              <button type="button" className="button" onClick={() => downloadJson(`${templateName}.manual-traits.json`, template)}>
                <Download size={15} /> Manual JSON
              </button>
              <button type="button" className="button primary" onClick={() => downloadJson(`${templateName}.avatar-spec.json`, spec)}>
                <FileJson size={15} /> Avatar Spec
              </button>
              <label className="fileButton">
                <Upload size={15} />
                Import
                <input type="file" accept="application/json,.json" onChange={(event) => importTemplate(event.target.files?.[0])} />
              </label>
            </div>
            <pre className="jsonPane">{JSON.stringify({ name: template.name, patches: spec.patches?.length ?? 0, activeSlot, layers: template.layers.map((layer) => ({ slot: layer.slot, pixels: layer.pixels.length })) }, null, 2)}</pre>
          </section>
        </aside>
      </section>
    </main>
  );
}

function createEditorLayers(): EditorLayer[] {
  return createEmptyManualTemplate().layers.map((layer) => ({
    slot: layer.slot,
    label: layer.label,
    visible: layer.visible,
    opacity: layer.opacity,
    pixels: {}
  }));
}

function editorLayersToTemplate(name: string, layers: EditorLayer[], reference?: ManualTraitTemplate["reference"]): ManualTraitTemplate {
  return {
    version: "pix-avatar/manual-trait-template/v1",
    name,
    canvas: { size: [32, 32] },
    reference,
    createdAt: new Date().toISOString(),
    layers: layers.map((layer) => ({
      slot: layer.slot,
      label: layer.label,
      visible: layer.visible,
      opacity: layer.opacity,
      pixels: Object.entries(layer.pixels)
        .map(([key, colorValue]) => {
          const [x, y] = key.split(",").map(Number);
          return { x, y, color: colorValue };
        })
        .sort((a, b) => a.y - b.y || a.x - b.x)
    }))
  };
}

function templateToEditorLayers(template: ManualTraitTemplate): EditorLayer[] {
  return MANUAL_TRAIT_LAYER_DEFS.map((def) => {
    const layer = template.layers.find((candidate) => candidate.slot === def.slot);
    return {
      slot: def.slot,
      label: def.label,
      visible: layer?.visible ?? true,
      opacity: layer?.opacity ?? 1,
      pixels: Object.fromEntries((layer?.pixels ?? []).map((pixel) => [pixelKey(pixel.x, pixel.y), pixel.color.toUpperCase()]))
    };
  });
}

function drawEditorCanvas(canvas: HTMLCanvasElement, options: { layers: EditorLayer[]; zoom: number; reference?: ReferenceSource; referenceOpacity: number; showGrid: boolean; hoveredPixel?: [number, number] }) {
  const { layers, zoom, reference, referenceOpacity, showGrid, hoveredPixel } = options;
  canvas.width = CANVAS_SIZE * zoom;
  canvas.height = CANVAS_SIZE * zoom;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawChecker(ctx, zoom);
  if (reference) drawMatrix(ctx, reference.matrix, zoom, referenceOpacity);
  for (const def of MANUAL_TRAIT_LAYER_DEFS) {
    const layer = layers.find((candidate) => candidate.slot === def.slot);
    if (!layer || !layer.visible) continue;
    for (const [key, pixelColor] of Object.entries(layer.pixels)) {
      const [x, y] = key.split(",").map(Number);
      drawCell(ctx, x, y, pixelColor, zoom, layer.opacity);
    }
  }
  if (showGrid) drawGrid(ctx, zoom);
  if (hoveredPixel) drawHover(ctx, hoveredPixel, zoom);
}

function drawChecker(ctx: CanvasRenderingContext2D, zoom: number) {
  for (let y = 0; y < CANVAS_SIZE; y += 1) {
    for (let x = 0; x < CANVAS_SIZE; x += 1) {
      ctx.fillStyle = (Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 0 ? "#F8FAFC" : "#E8EDF3";
      ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
    }
  }
}

function drawMatrix(ctx: CanvasRenderingContext2D, matrix: string[][], zoom: number, alpha: number) {
  for (let y = 0; y < CANVAS_SIZE; y += 1) {
    for (let x = 0; x < CANVAS_SIZE; x += 1) drawCell(ctx, x, y, matrix[y]?.[x] ?? "#FFFFFF", zoom, alpha);
  }
}

function drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, colorValue: string, zoom: number, alpha = 1) {
  if (colorValue === "transparent") return;
  const [r, g, b, a] = hexToRgb(colorValue);
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${(a / 255) * alpha})`;
  ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
}

function drawGrid(ctx: CanvasRenderingContext2D, zoom: number) {
  ctx.strokeStyle = "rgba(23, 32, 43, 0.22)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= CANVAS_SIZE; i += 1) {
    const p = i * zoom + 0.5;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, CANVAS_SIZE * zoom);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(CANVAS_SIZE * zoom, p);
    ctx.stroke();
  }
}

function drawHover(ctx: CanvasRenderingContext2D, [x, y]: [number, number], zoom: number) {
  ctx.strokeStyle = "#D95F76";
  ctx.lineWidth = 2;
  ctx.strokeRect(x * zoom + 1, y * zoom + 1, zoom - 2, zoom - 2);
}

function pickColorAt(x: number, y: number, layers: EditorLayer[], reference: ReferenceSource | undefined, showReference: boolean) {
  for (const def of [...MANUAL_TRAIT_LAYER_DEFS].reverse()) {
    const layer = layers.find((candidate) => candidate.slot === def.slot);
    const colorValue = layer?.visible ? layer.pixels[pixelKey(x, y)] : undefined;
    if (colorValue) return colorValue;
  }
  if (showReference) return reference?.matrix[y]?.[x]?.toUpperCase();
  return undefined;
}

function canvasPoint(event: React.PointerEvent<HTMLCanvasElement>, zoom: number): [number, number] | undefined {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * CANVAS_SIZE);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * CANVAS_SIZE);
  if (!inCanvas(x, y)) return undefined;
  return [x, y];
}

function toggleLayerVisibility(slot: ManualTraitSlot, setLayers: React.Dispatch<React.SetStateAction<EditorLayer[]>>) {
  setLayers((current) => current.map((layer) => (layer.slot === slot ? { ...layer, visible: !layer.visible } : layer)));
}

function setLayerOpacity(slot: ManualTraitSlot, opacity: number, setLayers: React.Dispatch<React.SetStateAction<EditorLayer[]>>) {
  setLayers((current) => current.map((layer) => (layer.slot === slot ? { ...layer, opacity } : layer)));
}

function cloneLayers(layers: EditorLayer[]): EditorLayer[] {
  return layers.map((layer) => ({ ...layer, pixels: { ...layer.pixels } }));
}

function pixelKey(x: number, y: number) {
  return `${x},${y}`;
}

function inCanvas(x: number, y: number) {
  return x >= 0 && x < CANVAS_SIZE && y >= 0 && y < CANVAS_SIZE;
}

function blankMatrix(colorValue: string) {
  return Array.from({ length: CANVAS_SIZE }, () => Array.from({ length: CANVAS_SIZE }, () => colorValue));
}

function readSavedAssets(): SavedTraitAsset[] {
  try {
    const raw = window.localStorage.getItem(ASSET_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedTraitAsset[]) : [];
  } catch {
    return [];
  }
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function imageFileToMatrix(file: File): Promise<string[][]> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load uploaded reference image."));
    img.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return blankMatrix("#FFFFFF");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
  const data = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE).data;
  return Array.from({ length: CANVAS_SIZE }, (_, y) =>
    Array.from({ length: CANVAS_SIZE }, (_, x) => {
      const index = (y * CANVAS_SIZE + x) * 4;
      if (data[index + 3] === 0) return "transparent";
      return rgbToHex(data[index], data[index + 1], data[index + 2]);
    })
  );
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function slotLabel(slot: ManualTraitSlot) {
  return MANUAL_TRAIT_LAYER_DEFS.find((layer) => layer.slot === slot)?.label ?? slot;
}

createRoot(document.getElementById("root")!).render(<App />);
