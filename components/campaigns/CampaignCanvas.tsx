"use client";

import { useEffect, useRef } from "react";
import { mulberry32 } from "@/lib/prng";

export interface ImageParams {
  seed: number;
  bg: string;
  palette: string[];
  accent: string;
  pattern: "geometric" | "wave" | "burst" | "organic";
  shapes: string[];
  density: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function drawGeometric(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  params: ImageParams,
  rand: () => number
) {
  const count = Math.floor(params.density * 30) + 10;
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const size = rand() * Math.min(w, h) * 0.22 + 20;
    const color = params.palette[Math.floor(rand() * params.palette.length)];
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
  params: ImageParams,
  rand: () => number
) {
  const layers = Math.floor(params.density * 6) + 4;
  for (let l = 0; l < layers; l++) {
    const color = params.palette[l % params.palette.length];
    const [r, g, b] = hexToRgb(color);
    ctx.strokeStyle = `rgba(${r},${g},${b},${rand() * 0.25 + 0.05})`;
    ctx.lineWidth = rand() * 3 + 1;
    const amplitude = rand() * h * 0.15 + 20;
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
  params: ImageParams,
  rand: () => number
) {
  const cx = w * (rand() * 0.4 + 0.3);
  const cy = h * (rand() * 0.4 + 0.3);
  const rays = Math.floor(params.density * 40) + 20;
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2;
    const len = rand() * Math.max(w, h) * 0.8 + 100;
    const color = params.palette[i % params.palette.length];
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
  params: ImageParams,
  rand: () => number
) {
  const blobs = Math.floor(params.density * 8) + 4;
  for (let b = 0; b < blobs; b++) {
    const cx = rand() * w;
    const cy = rand() * h;
    const radius = rand() * Math.min(w, h) * 0.2 + 40;
    const color = params.palette[b % params.palette.length];
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

interface Props {
  imageParams: ImageParams;
  className?: string;
  style?: React.CSSProperties;
}

export default function CampaignCanvas({ imageParams, className, style }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 1200;
    canvas.height = 630;

    ctx.fillStyle = imageParams.bg;
    ctx.fillRect(0, 0, 1200, 630);

    const rand = mulberry32(imageParams.seed);

    switch (imageParams.pattern) {
      case "geometric": drawGeometric(ctx, 1200, 630, imageParams, rand); break;
      case "wave":      drawWave(ctx, 1200, 630, imageParams, rand);      break;
      case "burst":     drawBurst(ctx, 1200, 630, imageParams, rand);     break;
      case "organic":   drawOrganic(ctx, 1200, 630, imageParams, rand);   break;
    }

    // Readability gradient overlay
    const grad = ctx.createLinearGradient(0, 0, 0, 630);
    grad.addColorStop(0, "rgba(0,0,0,0.1)");
    grad.addColorStop(1, "rgba(0,0,0,0.4)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1200, 630);
  }, [imageParams]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", aspectRatio: "1200/630", display: "block", ...style }}
    />
  );
}
