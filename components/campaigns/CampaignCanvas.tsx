"use client";

import { useEffect, useRef } from "react";
import { mulberry32 } from "@/lib/prng";

export interface PatternLayer {
  type: "geometric" | "wave" | "burst" | "organic";
  blend: "normal" | "screen" | "multiply" | "overlay";
  density: number; // 0-1
  scale: number; // 0.5-2
  opacity: number; // 0-1
  rotation: number; // 0-360 degrees
  paletteOffset: number; // rotates which palette color a layer starts from
}

export interface ImageParams {
  seed: number;
  bg: string;
  palette: string[];
  accent: string;
  layers: PatternLayer[];
  grain: number; // 0-1
  glow: number; // 0-1
}

// Pre-existing rows created before the layer system was added store this
// flat shape instead of `layers`/`grain`/`glow`.
interface LegacyImageParams {
  seed: number;
  bg: string;
  palette: string[];
  accent: string;
  pattern: "geometric" | "wave" | "burst" | "organic";
  shapes: string[];
  density: number;
}

function normalizeImageParams(params: ImageParams | LegacyImageParams): ImageParams {
  if ("layers" in params && Array.isArray(params.layers)) {
    return {
      seed: params.seed,
      bg: params.bg,
      palette: params.palette,
      accent: params.accent,
      layers: params.layers,
      grain: params.grain ?? 0,
      glow: params.glow ?? 0,
    };
  }
  const legacy = params as LegacyImageParams;
  return {
    seed: legacy.seed,
    bg: legacy.bg,
    palette: legacy.palette,
    accent: legacy.accent,
    layers: [
      {
        type: legacy.pattern,
        blend: "normal",
        density: legacy.density,
        scale: 1,
        opacity: 1,
        rotation: 0,
        paletteOffset: 0,
      },
    ],
    grain: 0,
    glow: 0,
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function paletteColor(palette: string[], index: number, offset: number): string {
  return palette[(index + offset + palette.length * 4) % palette.length];
}

function drawGeometric(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  layer: PatternLayer,
  palette: string[],
  rand: () => number
) {
  const count = Math.floor(layer.density * 30) + 10;
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const size = (rand() * Math.min(w, h) * 0.22 + 20) * layer.scale;
    const idx = Math.floor(rand() * palette.length);
    const color = paletteColor(palette, idx, layer.paletteOffset);
    const [r, g, b] = hexToRgb(color);
    const alpha = rand() * 0.35 + 0.04;
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    const shapeIdx = Math.floor(rand() * 3);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rand() * Math.PI * 2);
    ctx.beginPath();
    if (shapeIdx === 0) {
      ctx.arc(0, 0, size, 0, Math.PI * 2);
    } else if (shapeIdx === 1) {
      ctx.rect(-size / 2, -size / 2, size, size * (rand() * 0.5 + 0.5));
    } else {
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.866, size * 0.5);
      ctx.lineTo(-size * 0.866, size * 0.5);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
  }
}

function drawWave(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  layer: PatternLayer,
  palette: string[],
  rand: () => number
) {
  const count = Math.floor(layer.density * 6) + 4;
  for (let l = 0; l < count; l++) {
    const color = paletteColor(palette, l, layer.paletteOffset);
    const [r, g, b] = hexToRgb(color);
    ctx.strokeStyle = `rgba(${r},${g},${b},${rand() * 0.25 + 0.05})`;
    ctx.lineWidth = (rand() * 3 + 1) * layer.scale;
    const amplitude = (rand() * h * 0.15 + 20) * layer.scale;
    const frequency = rand() * 0.01 + 0.003;
    const yOffset = rand() * h;
    const phase = rand() * Math.PI * 2;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 2) {
      const y = yOffset + amplitude * Math.sin(x * frequency + phase);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function drawBurst(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  layer: PatternLayer,
  palette: string[],
  rand: () => number
) {
  const cx = w * (rand() * 0.4 + 0.3);
  const cy = h * (rand() * 0.4 + 0.3);
  const rays = Math.floor(layer.density * 40) + 20;
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2;
    const len = (rand() * Math.max(w, h) * 0.8 + 100) * layer.scale;
    const color = paletteColor(palette, i, layer.paletteOffset);
    const [r, g, b] = hexToRgb(color);
    ctx.strokeStyle = `rgba(${r},${g},${b},${rand() * 0.2 + 0.02})`;
    ctx.lineWidth = rand() * 4 + 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
    ctx.stroke();
  }
}

function drawOrganic(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  layer: PatternLayer,
  palette: string[],
  rand: () => number
) {
  const blobs = Math.floor(layer.density * 8) + 4;
  for (let b = 0; b < blobs; b++) {
    const cx = rand() * w;
    const cy = rand() * h;
    const radius = (rand() * Math.min(w, h) * 0.2 + 40) * layer.scale;
    const color = paletteColor(palette, b, layer.paletteOffset);
    const [r, g, bv] = hexToRgb(color);
    ctx.fillStyle = `rgba(${r},${g},${bv},${rand() * 0.3 + 0.05})`;
    const points = 6;
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const jitter = rand() * radius * 0.4 + radius * 0.8;
      const x = cx + Math.cos(angle) * jitter;
      const y = cy + Math.sin(angle) * jitter;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
}

function createGrainPattern(rand: () => number): CanvasPattern | null {
  const size = 128;
  const tile = document.createElement("canvas");
  tile.width = size;
  tile.height = size;
  const tctx = tile.getContext("2d");
  if (!tctx) return null;
  const imageData = tctx.createImageData(size, size);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const v = Math.floor(rand() * 255);
    imageData.data[i] = v;
    imageData.data[i + 1] = v;
    imageData.data[i + 2] = v;
    imageData.data[i + 3] = 255;
  }
  tctx.putImageData(imageData, 0, 0);
  return tctx.createPattern(tile, "repeat");
}

interface Props {
  imageParams: ImageParams | LegacyImageParams;
  className?: string;
  style?: React.CSSProperties;
}

export default function CampaignCanvas({ imageParams: rawParams, className, style }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 1200;
    const H = 630;
    canvas.width = W;
    canvas.height = H;

    const params = normalizeImageParams(rawParams);
    const rand = mulberry32(params.seed);

    // Render shape layers onto an offscreen canvas so the glow pass can
    // redraw the same art blurred on top without re-running the RNG.
    const art = document.createElement("canvas");
    art.width = W;
    art.height = H;
    const actx = art.getContext("2d");
    if (!actx) return;

    actx.fillStyle = params.bg;
    actx.fillRect(0, 0, W, H);

    for (const layer of params.layers) {
      actx.save();
      actx.globalAlpha = layer.opacity;
      actx.globalCompositeOperation = (layer.blend as any);
      actx.translate(W / 2, H / 2);
      actx.rotate((layer.rotation * Math.PI) / 180);
      actx.translate(-W / 2, -H / 2);
      switch (layer.type) {
        case "geometric": drawGeometric(actx, W, H, layer, params.palette, rand); break;
        case "wave":      drawWave(actx, W, H, layer, params.palette, rand);      break;
        case "burst":     drawBurst(actx, W, H, layer, params.palette, rand);     break;
        case "organic":   drawOrganic(actx, W, H, layer, params.palette, rand);   break;
      }
      actx.restore();
    }

    if (params.grain > 0) {
      const pattern = createGrainPattern(rand);
      if (pattern) {
        actx.save();
        actx.globalAlpha = params.grain * 0.3;
        actx.globalCompositeOperation = "overlay";
        actx.fillStyle = pattern;
        actx.fillRect(0, 0, W, H);
        actx.restore();
      }
    }

    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(art, 0, 0);

    if (params.glow > 0) {
      ctx.save();
      ctx.filter = `blur(${Math.round(params.glow * 40)}px)`;
      ctx.globalAlpha = params.glow * 0.6;
      ctx.globalCompositeOperation = "screen";
      ctx.drawImage(art, 0, 0);
      ctx.restore();
    }

    // Contrast-aware readability scrim: darker overlay when bg is light,
    // lighter overlay when bg is already dark, so overlaid white text
    // stays readable regardless of the chosen palette.
    const lum = luminance(params.bg);
    const baseAlpha = 0.15 + lum * 0.55;
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, `rgba(0,0,0,${(baseAlpha * 0.3).toFixed(2)})`);
    grad.addColorStop(1, `rgba(0,0,0,${baseAlpha.toFixed(2)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }, [rawParams]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", aspectRatio: "1200/630", display: "block", ...style }}
    />
  );
}
