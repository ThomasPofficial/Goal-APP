# AI Fundraising Page Generator — Advanced Editing, Feedback Tweaking & Hero Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the campaign generator's all-or-nothing "Regenerate" with inline field editing and single-shot AI feedback tweaking, redesign the hero into one cohesive image (canvas art + overlaid headline/subheadline) with an unlimited composable-layer visual engine, and rewrite the copywriting prompt to produce persuasive, specific fundraising copy — matching the design in `docs/superpowers/plans/2026-07-16-campaign-generator-advanced-design.md`.

**Architecture:** `CampaignVersion` gains `source`/`note` columns so every write path (generate, tweak, manual edit, restore) is labeled. A shared `lib/campaign-prompt.ts` builds both the full-generate and feedback-tweak prompts and parses Claude's JSON response, used by two Claude-calling endpoints (`generate`, new `tweak`) plus a non-AI `PATCH` endpoint for direct edits. `CampaignCanvas` is rewritten so `ImageParams` holds a `layers[]` array (each with continuous type/blend/density/scale/opacity/rotation/paletteOffset) plus global `grain`/`glow` knobs, composited with canvas blend modes, a noise-pattern grain pass, and a blur-based glow bloom pass — with a compatibility shim so old single-pattern rows still render. A new `CampaignHero` component overlays headline/subheadline directly on the canvas (editable or not), and a new `CampaignEditor` component consolidates the duplicated preview UI in the new-campaign flow and the edit page, adding inline body/CTA editing, an AI feedback box, and version history with source labels.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma/PostgreSQL, `@anthropic-ai/sdk` (model `claude-haiku-4-5-20251001`), native Canvas 2D API (no image-generation API).

## Global Constraints

- No test framework is configured in this repo (no `jest`/`vitest`, no `test` script in `package.json`). Verification for every task is `npx tsc --noEmit` (must show zero new errors) plus a manual browser or `curl` check — do not introduce a new test runner as part of this plan.
- Migrations are hand-authored SQL files under `prisma/migrations/`, not generated via `prisma migrate dev` (project convention).
- Inline `style={{...}}` objects everywhere (no CSS modules/Tailwind), matching every existing campaign file.
- Stays fully procedural/canvas-based for imagery — no image-generation API, no added per-campaign cost (per the design doc's non-goals).
- Existing auth/role-check pattern for campaign routes: `const dbUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } }); if (dbUser?.role !== "SCHOOL" && dbUser?.role !== "ADMIN") return 403;` — every new route reuses this exactly.
- Each tweak/manual-edit/generate/restore write path must create exactly one `CampaignVersion` row tagging `source` correctly, per the design doc's version-history requirement.

---

### Task 1: Add `source`/`note` columns to `CampaignVersion`

**Files:**
- Modify: `prisma/schema.prisma` (the `CampaignVersion` model, currently lines 814-826)
- Create: `prisma/migrations/20260716010000_campaign_version_source_note/migration.sql`

**Interfaces:**
- Produces: `CampaignVersion.source: string` (default `"generate"`), `CampaignVersion.note: string | null` — every later task that creates a `CampaignVersion` row sets `source` to one of `"generate" | "tweak" | "manual" | "restore"`, and `tweak` writes also set `note` to the feedback text.

- [ ] **Step 1: Edit the `CampaignVersion` model in `prisma/schema.prisma`**

Current:

```prisma
model CampaignVersion {
  id           String   @id @default(cuid())
  campaignId   String
  campaign     Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  cause        String   @db.Text
  headline     String
  subheadline  String
  body         String   @db.Text
  ctaText      String
  imageParams  Json
  restoredFrom String?
  createdAt    DateTime @default(now())
}
```

Change to:

```prisma
model CampaignVersion {
  id           String   @id @default(cuid())
  campaignId   String
  campaign     Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  cause        String   @db.Text
  headline     String
  subheadline  String
  body         String   @db.Text
  ctaText      String
  imageParams  Json
  // "generate" (full AI generation/regeneration) | "tweak" (AI feedback revision,
  // note holds the feedback text) | "manual" (direct field edit, no AI call) |
  // "restore" (copied from an earlier version, restoredFrom holds that version's id)
  source       String   @default("generate")
  note         String?
  restoredFrom String?
  createdAt    DateTime @default(now())
}
```

- [ ] **Step 2: Create the migration directory and SQL file**

```bash
mkdir -p prisma/migrations/20260716010000_campaign_version_source_note
```

Write `prisma/migrations/20260716010000_campaign_version_source_note/migration.sql`:

```sql
-- Label every CampaignVersion snapshot with how it was produced, so the
-- version history UI can show "Generated" / "Tweaked: <feedback>" /
-- "Manual edit" / "Restored" instead of a bare headline + timestamp.

ALTER TABLE "CampaignVersion" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'generate';
ALTER TABLE "CampaignVersion" ADD COLUMN IF NOT EXISTS "note" TEXT;
```

- [ ] **Step 3: Regenerate the Prisma client and verify no type errors**

Run: `npx prisma generate`
Expected: `✔ Generated Prisma Client` with no errors.

Run: `npx tsc --noEmit`
Expected: no new errors compared to a baseline run before this task.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260716010000_campaign_version_source_note/migration.sql
git commit -m "$(cat <<'EOF'
Add source/note columns to CampaignVersion

Labels every version snapshot with how it was produced (generate/tweak/
manual/restore) so the version history UI can show what actually
changed instead of just a headline and timestamp.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

### Task 2: Rewrite `CampaignCanvas` with a composable layer engine

**Files:**
- Modify: `components/campaigns/CampaignCanvas.tsx` (full rewrite)

**Interfaces:**
- Produces: `export interface PatternLayer { type: "geometric" | "wave" | "burst" | "organic"; blend: "normal" | "screen" | "multiply" | "overlay"; density: number; scale: number; opacity: number; rotation: number; paletteOffset: number; }` and `export interface ImageParams { seed: number; bg: string; palette: string[]; accent: string; layers: PatternLayer[]; grain: number; glow: number; }` — every later task (prompt builder, generate/tweak/PATCH routes, CampaignHero, CampaignEditor, both client refactors) imports these two types from this file.
- `CampaignCanvas` still accepts `{ imageParams, className?, style? }` and normalizes old flat-shape rows (`{ pattern, shapes, density }` with no `layers`) internally — no caller needs to know about the legacy shape.

- [ ] **Step 1: Replace the entire contents of `components/campaigns/CampaignCanvas.tsx`**

```tsx
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
      actx.globalCompositeOperation = layer.blend;
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
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: no new errors. Every file that consumes `ImageParams` across a server/client or fetch boundary does so via an `as unknown as ImageParams` cast or a `fetch().json() as SomeInterface` cast (checked in `app/(dashboard)/campaigns/page.tsx`, `app/(dashboard)/campaigns/[id]/edit/page.tsx`, `app/c/[slug]/page.tsx`), which bypasses structural literal checking — so changing the shape doesn't surface compile errors there. If `tsc` does report something in one of those files, stop and investigate before continuing; it means a literal object is being constructed against the type directly and needs fixing now rather than papering over it later.

- [ ] **Step 3: Manual visual check**

Run: `npm run dev`, open `http://localhost:3000/campaigns` (or wherever an existing published campaign card renders), and confirm the canvas still renders something (it will use the legacy compatibility path since no campaign has `layers` yet) — a blank white canvas would mean the compatibility shim is broken.

- [ ] **Step 4: Commit**

```bash
git add components/campaigns/CampaignCanvas.tsx
git commit -m "$(cat <<'EOF'
Rewrite CampaignCanvas as a composable layer engine

ImageParams becomes a stack of 1-4 layers (type/blend/density/scale/
opacity/rotation/paletteOffset) plus global grain/glow knobs, so the
space of distinct hero looks is continuous rather than a fixed enum.
Old flat-shape rows are normalized into a single-layer equivalent so
existing published campaigns keep rendering unchanged.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

### Task 3: Shared copywriting prompt builder (`lib/campaign-prompt.ts`)

**Files:**
- Create: `lib/campaign-prompt.ts`

**Interfaces:**
- Consumes: `ImageParams` type from `@/components/campaigns/CampaignCanvas` (Task 2).
- Produces: `export interface CampaignContent { headline: string; subheadline: string; body: string; ctaText: string; imageParams: ImageParams; }`, `export function buildGeneratePrompt(cause: string): string`, `export function buildTweakPrompt(current: CampaignContent, feedback: string): string`, `export function parseCampaignResponse(rawText: string): CampaignContent | null` — used by Task 4 (generate route) and Task 5 (tweak route).

- [ ] **Step 1: Write `lib/campaign-prompt.ts`**

```ts
import type { ImageParams } from "@/components/campaigns/CampaignCanvas";

export interface CampaignContent {
  headline: string;
  subheadline: string;
  body: string;
  ctaText: string;
  imageParams: ImageParams;
}

const RESPONSE_SHAPE = `{
  "headline": "6-12 word headline naming the concrete ask or stakes",
  "subheadline": "one sentence citing a specific, credible detail from the cause (a number, place, or deadline)",
  "body": "3-4 paragraphs separated by \\n\\n: the concrete situation, why it matters now, exactly what the funds buy, then a direct ask",
  "ctaText": "3-6 word call-to-action implying urgency or specificity, e.g. Fund Our Trip to Dallas",
  "imageParams": {
    "seed": <random integer 1000-9999>,
    "bg": "<dark or light hex color matching the cause's mood>",
    "palette": ["<hex1>", "<hex2>", "<hex3>", "<hex4>"],
    "accent": "<most vibrant of the palette hexes>",
    "layers": [
      {
        "type": "<one of: geometric|wave|burst|organic>",
        "blend": "<one of: normal|screen|multiply|overlay>",
        "density": <float 0-1>,
        "scale": <float 0.5-2>,
        "opacity": <float 0-1>,
        "rotation": <integer 0-360>,
        "paletteOffset": <integer 0-3>
      }
    ],
    "grain": <float 0-1>,
    "glow": <float 0-1>
  }
}`;

const MOOD_GUIDANCE = `Visual mood guidance — pick your own exact numeric values within these directions, do not just copy an example, and feel free to combine dimensions in ways not listed below so different causes don't converge on the same look:
- Energetic/vibrant causes (sports, competitions, performances): 2-3 layers, blend "screen" or "overlay", higher glow (0.5-0.9), moderate-to-high density, warm/bold palette.
- Intimate/documentary causes (community stories, individual hardship): 1 layer, type "organic", higher grain (0.4-0.7), low glow (0-0.2), muted palette.
- Confident/minimal causes (academic, robotics, tech): 1 layer, low density (0.1-0.3), low grain, low-to-moderate glow, one strong accent color against a near-neutral background.
- Calm/environmental causes (nature, water, sustainability): 1-2 layers, type "wave" or "organic", cool palette, low-to-moderate glow, low grain.`;

export function buildGeneratePrompt(cause: string): string {
  return `You are a fundraising copywriter and visual designer for student organizations. Write compelling, persuasive donation page copy AND choose visual design parameters for this cause:

"${cause}"

Write like an experienced fundraising copywriter, not a generic template: use concrete specifics from the cause description (names, numbers, places, deadlines) rather than vague enthusiasm, build a real emotional stake, and make the ask feel urgent and exact.

Respond ONLY with valid JSON (no markdown, no code fences):
${RESPONSE_SHAPE}

${MOOD_GUIDANCE}`;
}

export function buildTweakPrompt(current: CampaignContent, feedback: string): string {
  return `You are revising an existing student-organization fundraising page based on feedback. Here is the current page content and visual parameters as JSON:

${JSON.stringify(
  {
    headline: current.headline,
    subheadline: current.subheadline,
    body: current.body,
    ctaText: current.ctaText,
    imageParams: current.imageParams,
  },
  null,
  2
)}

User feedback: "${feedback}"

Revise ONLY what the feedback implies should change. Preserve every other field exactly as-is, character for character — including imageParams — unless the feedback specifically references colors, mood, or visuals. Keep the same persuasive, concrete fundraising-copywriter voice as the original.

Respond ONLY with valid JSON in this exact shape (no markdown, no code fences):
${RESPONSE_SHAPE}`;
}

export function parseCampaignResponse(rawText: string): CampaignContent | null {
  const cleaned = rawText.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  const required = ["headline", "subheadline", "body", "ctaText", "imageParams"];
  if (required.some((k) => !parsed[k])) return null;
  return {
    headline: parsed.headline as string,
    subheadline: parsed.subheadline as string,
    body: parsed.body as string,
    ctaText: parsed.ctaText as string,
    imageParams: parsed.imageParams as ImageParams,
  };
}
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by this file (pre-existing errors from Task 2's rewrite in `generate/route.ts` are unrelated and fixed in Task 4).

- [ ] **Step 3: Commit**

```bash
git add lib/campaign-prompt.ts
git commit -m "$(cat <<'EOF'
Add shared campaign copywriting prompt builder

Centralizes the persuasive-copy prompt (concrete specifics, real
stakes, urgent ask) and layer-based visual mood guidance so both the
full-generate and feedback-tweak endpoints share identical wording and
response parsing instead of duplicating prompt strings.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

### Task 4: Update `generate/route.ts` to use the shared prompt builder

**Files:**
- Modify: `app/api/campaigns/generate/route.ts` (full rewrite)

**Interfaces:**
- Consumes: `buildGeneratePrompt`, `parseCampaignResponse` from `@/lib/campaign-prompt` (Task 3).
- Produces: unchanged response shape `{ campaignId, headline, subheadline, body, ctaText, causeText, imageParams, videoUrl }`; every `CampaignVersion` row this route creates now has `source: "generate"`.

- [ ] **Step 1: Replace the entire contents of `app/api/campaigns/generate/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import type { Prisma } from "@prisma/client";
import { buildGeneratePrompt, parseCampaignResponse } from "@/lib/campaign-prompt";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "SCHOOL" && dbUser?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI generation is not configured on this server." }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const cause = typeof body.cause === "string" ? body.cause.trim() : "";
  const campaignId = typeof body.campaignId === "string" ? body.campaignId : null;
  const videoUrl = typeof body.videoUrl === "string" && body.videoUrl.trim() ? body.videoUrl.trim() : null;

  if (!cause || cause.length < 10) {
    return NextResponse.json({ error: "Please describe your cause (at least 10 characters)." }, { status: 400 });
  }
  if (cause.length > 1000) {
    return NextResponse.json({ error: "Cause description is too long (max 1000 characters)." }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let message: Awaited<ReturnType<typeof anthropic.messages.create>>;
  try {
    message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [{ role: "user", content: buildGeneratePrompt(cause) }],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `AI service error: ${msg}` }, { status: 502 });
  }

  const rawText = message.content[0].type === "text" ? message.content[0].text : "";
  const parsed = parseCampaignResponse(rawText);
  if (!parsed) {
    return NextResponse.json({ error: "Failed to parse AI response. Please try again." }, { status: 500 });
  }

  const { headline, subheadline, body: bodyText, ctaText, imageParams } = parsed;
  const imageParamsJson = imageParams as unknown as Prisma.InputJsonValue;

  // Upsert the draft Campaign
  let campaign;
  if (campaignId) {
    const existing = await prisma.campaign.findFirst({
      where: { id: campaignId, schoolId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }
    campaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        cause,
        headline,
        subheadline,
        body: bodyText,
        ctaText,
        imageParams: imageParamsJson,
        ...(videoUrl !== null ? { videoUrl } : {}),
      },
    });
  } else {
    campaign = await prisma.campaign.create({
      data: {
        schoolId: session.user.id,
        cause,
        headline,
        subheadline,
        body: bodyText,
        ctaText,
        imageParams: imageParamsJson,
        videoUrl,
        active: false,
      },
    });
  }

  // Always snapshot a version
  await prisma.campaignVersion.create({
    data: {
      campaignId: campaign.id,
      cause,
      headline,
      subheadline,
      body: bodyText,
      ctaText,
      imageParams: imageParamsJson,
      source: "generate",
    },
  });

  return NextResponse.json({
    campaignId: campaign.id,
    headline,
    subheadline,
    body: bodyText,
    ctaText,
    causeText: cause,
    imageParams,
    videoUrl: campaign.videoUrl,
  });
}
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: no new errors from this file. (Errors in client components that still expect the old `ImageParams` shape are fixed in later tasks.)

- [ ] **Step 3: Manual check**

With the dev server running and logged in as a `SCHOOL`/`ADMIN` test account, `curl` the endpoint (replace `<session-cookie>` with a real cookie from the browser devtools):

```bash
curl -X POST http://localhost:3000/api/campaigns/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{"cause":"We need $3000 to send our debate team to the state finals in Austin next month."}'
```

Expected: JSON response with `headline`, `subheadline`, `body`, `ctaText`, and `imageParams.layers` being a non-empty array (confirms Claude followed the new response shape).

- [ ] **Step 4: Commit**

```bash
git add app/api/campaigns/generate/route.ts
git commit -m "$(cat <<'EOF'
Use shared prompt builder in the generate endpoint

Replaces the inline prompt string and ad-hoc JSON parsing with
lib/campaign-prompt's buildGeneratePrompt/parseCampaignResponse, and
tags the version snapshot this route creates with source: "generate".

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

### Task 5: New AI feedback tweak endpoint

**Files:**
- Create: `app/api/campaigns/[id]/tweak/route.ts`

**Interfaces:**
- Consumes: `buildTweakPrompt`, `parseCampaignResponse` from `@/lib/campaign-prompt` (Task 3); `ImageParams` from `@/components/campaigns/CampaignCanvas` (Task 2).
- Produces: `POST /api/campaigns/[id]/tweak` — request body `{ feedback: string }`, response `{ campaignId, headline, subheadline, body, ctaText, imageParams, videoUrl }`. Creates one `CampaignVersion` with `source: "tweak"`, `note: <feedback text>`. Consumed by Task 10's `CampaignEditor`.

- [ ] **Step 1: Write `app/api/campaigns/[id]/tweak/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import type { Prisma } from "@prisma/client";
import { buildTweakPrompt, parseCampaignResponse } from "@/lib/campaign-prompt";
import type { ImageParams } from "@/components/campaigns/CampaignCanvas";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "SCHOOL" && dbUser?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI generation is not configured on this server." }, { status: 503 });
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id, schoolId: session.user.id },
  });
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const feedback = typeof body.feedback === "string" ? body.feedback.trim() : "";
  if (!feedback || feedback.length < 3) {
    return NextResponse.json({ error: "Please describe what you'd like to change." }, { status: 400 });
  }
  if (feedback.length > 500) {
    return NextResponse.json({ error: "Feedback is too long (max 500 characters)." }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = buildTweakPrompt(
    {
      headline: campaign.headline,
      subheadline: campaign.subheadline,
      body: campaign.body,
      ctaText: campaign.ctaText,
      imageParams: campaign.imageParams as unknown as ImageParams,
    },
    feedback
  );

  let message: Awaited<ReturnType<typeof anthropic.messages.create>>;
  try {
    message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `AI service error: ${msg}` }, { status: 502 });
  }

  const rawText = message.content[0].type === "text" ? message.content[0].text : "";
  const revised = parseCampaignResponse(rawText);
  if (!revised) {
    return NextResponse.json({ error: "Failed to parse AI response. Please try again." }, { status: 500 });
  }

  const imageParamsJson = revised.imageParams as unknown as Prisma.InputJsonValue;

  const updated = await prisma.campaign.update({
    where: { id },
    data: {
      headline: revised.headline,
      subheadline: revised.subheadline,
      body: revised.body,
      ctaText: revised.ctaText,
      imageParams: imageParamsJson,
    },
  });

  await prisma.campaignVersion.create({
    data: {
      campaignId: id,
      cause: campaign.cause,
      headline: revised.headline,
      subheadline: revised.subheadline,
      body: revised.body,
      ctaText: revised.ctaText,
      imageParams: imageParamsJson,
      source: "tweak",
      note: feedback,
    },
  });

  return NextResponse.json({
    campaignId: updated.id,
    headline: updated.headline,
    subheadline: updated.subheadline,
    body: updated.body,
    ctaText: updated.ctaText,
    imageParams: updated.imageParams,
    videoUrl: updated.videoUrl,
  });
}
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: no new errors from this file.

- [ ] **Step 3: Manual check**

Using a campaign id you own (from `/campaigns`) and a session cookie:

```bash
curl -X POST http://localhost:3000/api/campaigns/<campaignId>/tweak \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{"feedback":"make the headline shorter and more urgent"}'
```

Expected: 200 response with a revised `headline` different from before, but `body`/`ctaText` recognizably similar (not a full rewrite). Then `curl http://localhost:3000/api/campaigns/<campaignId>/versions -H "Cookie: <session-cookie>"` and confirm the newest entry has `"source":"tweak"` and `"note":"make the headline shorter and more urgent"`.

- [ ] **Step 4: Commit**

```bash
git add app/api/campaigns/\[id\]/tweak/route.ts
git commit -m "$(cat <<'EOF'
Add AI feedback tweak endpoint

POST /api/campaigns/[id]/tweak sends Claude the campaign's current
copy/imageParams plus a natural-language feedback string and asks it
to revise only what the feedback implies, instead of regenerating
everything from the original cause description. Snapshots a
CampaignVersion tagged source: "tweak" with the feedback as its note.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

### Task 6: New manual-edit `PATCH` endpoint

**Files:**
- Create: `app/api/campaigns/[id]/route.ts`

**Interfaces:**
- Produces: `PATCH /api/campaigns/[id]` — request body accepts any subset of `{ headline?, subheadline?, body?, ctaText? }` (all strings), response `{ campaignId, headline, subheadline, body, ctaText, imageParams }`. Creates one `CampaignVersion` with `source: "manual"`. Consumed by Task 10's `CampaignEditor`.

- [ ] **Step 1: Write `app/api/campaigns/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "SCHOOL" && dbUser?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id, schoolId: session.user.id },
  });
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Prisma.CampaignUpdateInput = {};

  if (typeof body.headline === "string") {
    const v = body.headline.trim();
    if (!v) return NextResponse.json({ error: "Headline cannot be empty." }, { status: 400 });
    data.headline = v;
  }
  if (typeof body.subheadline === "string") {
    const v = body.subheadline.trim();
    if (!v) return NextResponse.json({ error: "Subheadline cannot be empty." }, { status: 400 });
    data.subheadline = v;
  }
  if (typeof body.body === "string") {
    const v = body.body.trim();
    if (!v) return NextResponse.json({ error: "Body cannot be empty." }, { status: 400 });
    data.body = v;
  }
  if (typeof body.ctaText === "string") {
    const v = body.ctaText.trim();
    if (!v) return NextResponse.json({ error: "CTA text cannot be empty." }, { status: 400 });
    data.ctaText = v;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const updated = await prisma.campaign.update({ where: { id }, data });

  await prisma.campaignVersion.create({
    data: {
      campaignId: id,
      cause: updated.cause,
      headline: updated.headline,
      subheadline: updated.subheadline,
      body: updated.body,
      ctaText: updated.ctaText,
      imageParams: updated.imageParams as Prisma.InputJsonValue,
      source: "manual",
    },
  });

  return NextResponse.json({
    campaignId: updated.id,
    headline: updated.headline,
    subheadline: updated.subheadline,
    body: updated.body,
    ctaText: updated.ctaText,
    imageParams: updated.imageParams,
  });
}
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: no new errors from this file.

- [ ] **Step 3: Manual check**

```bash
curl -X PATCH http://localhost:3000/api/campaigns/<campaignId> \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{"ctaText":"Fund Our Finals Trip"}'
```

Expected: 200 with `"ctaText":"Fund Our Finals Trip"` in the response and unchanged `headline`/`body`. Then check `GET /api/campaigns/<campaignId>/versions` shows a newest entry with `"source":"manual"`.

- [ ] **Step 4: Commit**

```bash
git add app/api/campaigns/\[id\]/route.ts
git commit -m "$(cat <<'EOF'
Add manual-edit PATCH endpoint for campaigns

Direct DB update for headline/subheadline/body/ctaText with no Claude
call, for the inline-editing flow. Snapshots a CampaignVersion tagged
source: "manual" so edits show up in version history distinctly from
AI-generated or AI-tweaked changes.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

### Task 7: Tag restore versions and expose `source`/`note` from the versions list

**Files:**
- Modify: `app/api/campaigns/[id]/versions/[versionId]/restore/route.ts`
- Modify: `app/api/campaigns/[id]/versions/route.ts`

**Interfaces:**
- Produces: `GET /api/campaigns/[id]/versions` response items now include `source: string` and `note: string | null`. Consumed by Task 8's `VersionHistoryDrawer`.

- [ ] **Step 1: Edit `app/api/campaigns/[id]/versions/[versionId]/restore/route.ts`**

Current (the `$transaction` block):

```ts
  const [updated] = await prisma.$transaction([
    prisma.campaign.update({
      where: { id },
      data: {
        cause: version.cause,
        headline: version.headline,
        subheadline: version.subheadline,
        body: version.body,
        ctaText: version.ctaText,
        imageParams,
      },
    }),
    prisma.campaignVersion.create({
      data: {
        campaignId: id,
        cause: version.cause,
        headline: version.headline,
        subheadline: version.subheadline,
        body: version.body,
        ctaText: version.ctaText,
        imageParams,
        restoredFrom: version.id,
      },
    }),
  ]);
```

Change to:

```ts
  const [updated] = await prisma.$transaction([
    prisma.campaign.update({
      where: { id },
      data: {
        cause: version.cause,
        headline: version.headline,
        subheadline: version.subheadline,
        body: version.body,
        ctaText: version.ctaText,
        imageParams,
      },
    }),
    prisma.campaignVersion.create({
      data: {
        campaignId: id,
        cause: version.cause,
        headline: version.headline,
        subheadline: version.subheadline,
        body: version.body,
        ctaText: version.ctaText,
        imageParams,
        source: "restore",
        restoredFrom: version.id,
      },
    }),
  ]);
```

- [ ] **Step 2: Edit `app/api/campaigns/[id]/versions/route.ts`**

Current `select`:

```ts
    select: {
      id: true,
      cause: true,
      headline: true,
      imageParams: true,
      restoredFrom: true,
      createdAt: true,
    },
```

Change to:

```ts
    select: {
      id: true,
      cause: true,
      headline: true,
      imageParams: true,
      source: true,
      note: true,
      restoredFrom: true,
      createdAt: true,
    },
```

- [ ] **Step 3: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: no new errors from these two files.

- [ ] **Step 4: Manual check**

Restore an older version via `curl -X POST http://localhost:3000/api/campaigns/<campaignId>/versions/<versionId>/restore -H "Cookie: <session-cookie>"`, then `GET /api/campaigns/<campaignId>/versions` and confirm the newest entry has `"source":"restore"`.

- [ ] **Step 5: Commit**

```bash
git add app/api/campaigns/\[id\]/versions/\[versionId\]/restore/route.ts app/api/campaigns/\[id\]/versions/route.ts
git commit -m "$(cat <<'EOF'
Tag restore versions and expose source/note in the versions list

Restore now creates its CampaignVersion with source: "restore", and
the versions GET endpoint selects the new source/note columns so the
history drawer (next task) can label every entry correctly.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

### Task 8: Label version history entries by source

**Files:**
- Modify: `components/campaigns/VersionHistoryDrawer.tsx`

**Interfaces:**
- Produces: `export interface VersionSummary { id: string; cause: string; headline: string; imageParams: ImageParams; source: string; note: string | null; restoredFrom: string | null; createdAt: string; }` — consumed by Task 10 (`CampaignEditor`) and both client refactors (Tasks 11-12).

- [ ] **Step 1: Replace the entire contents of `components/campaigns/VersionHistoryDrawer.tsx`**

```tsx
"use client";

import { X, RotateCcw } from "lucide-react";
import CampaignCanvas, { type ImageParams } from "./CampaignCanvas";

export interface VersionSummary {
  id: string;
  cause: string;
  headline: string;
  imageParams: ImageParams;
  source: string;
  note: string | null;
  restoredFrom: string | null;
  createdAt: string;
}

interface Props {
  versions: VersionSummary[];
  onRestore: (versionId: string) => void;
  onClose: () => void;
}

function versionLabel(v: VersionSummary): string {
  if (v.source === "tweak") {
    const note = v.note ?? "";
    const trimmed = note.length > 60 ? note.slice(0, 60) + "…" : note;
    return `Tweaked: "${trimmed}"`;
  }
  if (v.source === "manual") return "Manual edit";
  if (v.source === "restore") return "Restored";
  return "Generated";
}

export default function VersionHistoryDrawer({ versions, onRestore, onClose }: Props) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex" }}>
      <div style={{ flex: 1, background: "rgba(0,0,0,0.4)" }} onClick={onClose} />
      <div style={{ width: 380, background: "var(--surface)", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text)" }}>
            Version History
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--n-text2)", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {versions.map((v, i) => (
            <div key={v.id} style={{ border: "1px solid var(--border)", background: "var(--bg)", overflow: "hidden" }}>
              <div style={{ aspectRatio: "1200/630", pointerEvents: "none" }}>
                <CampaignCanvas imageParams={v.imageParams} />
              </div>
              <div style={{ padding: "10px 12px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--text)", fontWeight: 600, lineHeight: 1.3 }}>{v.headline}</span>
                  {i === 0 && (
                    <span style={{ flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--amber)", padding: "1px 6px", border: "1px solid var(--amber)" }}>Current</span>
                  )}
                </div>
                <p style={{ margin: "0 0 4px", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.05em", color: "var(--n-text2)" }}>
                  {versionLabel(v)}
                </p>
                <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--n-text2)", lineHeight: 1.4 }}>
                  {v.cause.length > 80 ? v.cause.slice(0, 80) + "…" : v.cause}
                </p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--n-text2)" }}>
                    {new Date(v.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {i > 0 && (
                    <button
                      onClick={() => onRestore(v.id)}
                      style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--n-text2)", background: "none", border: "1px solid var(--border)", padding: "3px 8px", cursor: "pointer" }}
                    >
                      <RotateCcw size={10} /> Restore
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: new errors will appear at every call site that constructs a `VersionSummary`-shaped object without `source`/`note` (the edit page's server component, and `CampaignsNewClient`/`CampaignEditClient` if not yet updated) — confirm these are limited to the files touched in Tasks 11-12, and fix them there.

- [ ] **Step 3: Commit**

```bash
git add components/campaigns/VersionHistoryDrawer.tsx
git commit -m "$(cat <<'EOF'
Label version history entries by how they were produced

Shows "Generated" / "Tweaked: <feedback>" / "Manual edit" / "Restored"
per entry instead of just a headline and timestamp, using the
source/note columns added in Task 1.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

### Task 9: Unified overlay hero component

**Files:**
- Create: `components/campaigns/CampaignHero.tsx`

**Interfaces:**
- Consumes: `CampaignCanvas`, `ImageParams` from `@/components/campaigns/CampaignCanvas` (Task 2).
- Produces: `export default function CampaignHero(props: { imageParams: ImageParams; headline: string; subheadline: string; editable?: boolean; onHeadlineChange?: (value: string) => void; onSubheadlineChange?: (value: string) => void; }): JSX.Element` — consumed by Task 10 (`CampaignEditor`, `editable=true`) and Task 13 (`CampaignPublicClient`, `editable` omitted/false).

- [ ] **Step 1: Write `components/campaigns/CampaignHero.tsx`**

```tsx
"use client";

import { useState } from "react";
import CampaignCanvas, { type ImageParams } from "./CampaignCanvas";

interface Props {
  imageParams: ImageParams;
  headline: string;
  subheadline: string;
  editable?: boolean;
  onHeadlineChange?: (value: string) => void;
  onSubheadlineChange?: (value: string) => void;
}

export default function CampaignHero({
  imageParams,
  headline,
  subheadline,
  editable = false,
  onHeadlineChange,
  onSubheadlineChange,
}: Props) {
  const [editingHeadline, setEditingHeadline] = useState(false);
  const [editingSubheadline, setEditingSubheadline] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <CampaignCanvas imageParams={imageParams} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "32px 40px",
        }}
      >
        {editable && editingHeadline ? (
          <textarea
            autoFocus
            value={headline}
            onChange={(e) => onHeadlineChange?.(e.target.value)}
            onBlur={() => setEditingHeadline(false)}
            rows={2}
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(24px, 3vw, 44px)",
              letterSpacing: "-0.02em",
              color: "#fff",
              background: "rgba(0,0,0,0.35)",
              border: "1px dashed rgba(255,255,255,0.5)",
              lineHeight: 1.15,
              margin: "0 0 12px",
              padding: 4,
              resize: "vertical",
              width: "100%",
              boxSizing: "border-box",
            }}
          />
        ) : (
          <h2
            onClick={() => editable && setEditingHeadline(true)}
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(24px, 3vw, 44px)",
              letterSpacing: "-0.02em",
              color: "#fff",
              margin: "0 0 12px",
              lineHeight: 1.15,
              cursor: editable ? "text" : "default",
              textShadow: "0 2px 12px rgba(0,0,0,0.5)",
            }}
          >
            {headline}
          </h2>
        )}

        {editable && editingSubheadline ? (
          <input
            autoFocus
            value={subheadline}
            onChange={(e) => onSubheadlineChange?.(e.target.value)}
            onBlur={() => setEditingSubheadline(false)}
            style={{
              fontSize: 18,
              color: "#e8893a",
              fontWeight: 600,
              background: "rgba(0,0,0,0.35)",
              border: "1px dashed rgba(255,255,255,0.5)",
              padding: 4,
              width: "100%",
              boxSizing: "border-box",
            }}
          />
        ) : (
          <p
            onClick={() => editable && setEditingSubheadline(true)}
            style={{
              fontSize: 18,
              color: "#e8893a",
              fontWeight: 600,
              margin: 0,
              cursor: editable ? "text" : "default",
              textShadow: "0 1px 8px rgba(0,0,0,0.6)",
            }}
          >
            {subheadline}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: no new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add components/campaigns/CampaignHero.tsx
git commit -m "$(cat <<'EOF'
Add unified overlay hero component

Renders CampaignCanvas as a full-bleed background with headline and
subheadline overlaid directly on top (bold display type, contrast
scrim from CampaignCanvas keeps it readable), replacing the old
separate "canvas strip then plain text block" layout. `editable` prop
turns the overlay text into click-to-edit fields for the dashboard
editor; the public page uses it read-only.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

### Task 10: Shared `CampaignEditor` (inline editing + AI tweak + regenerate + history)

**Files:**
- Create: `components/campaigns/CampaignEditor.tsx`

**Interfaces:**
- Consumes: `CampaignHero` (Task 9), `ImageParams` from `CampaignCanvas` (Task 2), `VersionHistoryDrawer`/`VersionSummary` (Task 8), `PledgeModal` (existing, unchanged — `{ campaignId, ctaText, schoolId?, onClose }`), `extractVideoId` from `@/lib/video-embed` (existing, unchanged), the `tweak` endpoint (Task 5), the `PATCH` endpoint (Task 6), the `generate` endpoint (Task 4), and the restore endpoint (existing, unchanged).
- Produces: `export interface CampaignEditorData { id: string; slug: string | null; cause: string; headline: string; subheadline: string; body: string; ctaText: string; imageParams: ImageParams; videoUrl: string | null; active: boolean; }` and `export default function CampaignEditor(props: { campaign: CampaignEditorData; versions: VersionSummary[]; schoolId?: string; onPublish?: () => void | Promise<void>; publishing?: boolean; }): JSX.Element` — consumed by Task 11 (`CampaignsNewClient`, passes `onPublish`/`publishing`) and Task 12 (`CampaignEditClient`, omits them).

- [ ] **Step 1: Write `components/campaigns/CampaignEditor.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Loader2, History, Heart, ExternalLink, Sparkles, Save } from "lucide-react";
import CampaignHero from "@/components/campaigns/CampaignHero";
import type { ImageParams } from "@/components/campaigns/CampaignCanvas";
import PledgeModal from "@/components/campaigns/PledgeModal";
import VersionHistoryDrawer, { type VersionSummary } from "@/components/campaigns/VersionHistoryDrawer";
import { extractVideoId } from "@/lib/video-embed";

export interface CampaignEditorData {
  id: string;
  slug: string | null;
  cause: string;
  headline: string;
  subheadline: string;
  body: string;
  ctaText: string;
  imageParams: ImageParams;
  videoUrl: string | null;
  active: boolean;
}

interface GeneratedFields {
  headline: string;
  subheadline: string;
  body: string;
  ctaText: string;
  imageParams: ImageParams;
  videoUrl: string | null;
}

interface Props {
  campaign: CampaignEditorData;
  versions: VersionSummary[];
  schoolId?: string;
  onPublish?: () => void | Promise<void>;
  publishing?: boolean;
}

type EditableField = "headline" | "subheadline" | "body" | "ctaText";

export default function CampaignEditor({ campaign: initial, versions: initialVersions, schoolId, onPublish, publishing }: Props) {
  const [current, setCurrent] = useState(initial);
  const [versions, setVersions] = useState(initialVersions);
  const [causeInput, setCauseInput] = useState(initial.cause);
  const [videoUrl, setVideoUrl] = useState(initial.videoUrl ?? "");
  const [feedback, setFeedback] = useState("");
  const [dirty, setDirty] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [tweaking, setTweaking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPledge, setShowPledge] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshVersions = async () => {
    const res = await fetch(`/api/campaigns/${current.id}/versions`);
    if (res.ok) setVersions(await res.json() as VersionSummary[]);
  };

  // Always sync history on mount — the "new campaign" flow starts with an
  // empty versions array even though `generate` already created one row.
  useEffect(() => {
    refreshVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateField = (key: EditableField, value: string) => {
    setCurrent((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const saveChanges = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline: current.headline,
          subheadline: current.subheadline,
          body: current.body,
          ctaText: current.ctaText,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? "Failed to save changes");
      }
      setDirty(false);
      await refreshVersions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const applyFeedback = async () => {
    if (feedback.trim().length < 3) return;
    setTweaking(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${current.id}/tweak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: feedback.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? "Failed to apply feedback");
      }
      const data = await res.json() as GeneratedFields;
      setCurrent((prev) => ({ ...prev, ...data }));
      setDirty(false);
      setFeedback("");
      await refreshVersions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setTweaking(false);
    }
  };

  const regenerate = async () => {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cause: causeInput, campaignId: current.id, videoUrl: videoUrl || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? "Failed to regenerate");
      }
      const data = await res.json() as GeneratedFields;
      setCurrent((prev) => ({ ...prev, ...data, cause: causeInput }));
      setDirty(false);
      await refreshVersions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setRegenerating(false);
    }
  };

  const restore = async (versionId: string) => {
    try {
      const res = await fetch(`/api/campaigns/${current.id}/versions/${versionId}/restore`, { method: "POST" });
      if (!res.ok) throw new Error("Restore failed");
      const data = await res.json() as { cause: string; headline: string; subheadline: string; body: string; ctaText: string; imageParams: ImageParams };
      setCurrent((prev) => ({ ...prev, ...data }));
      setCauseInput(data.cause);
      setDirty(false);
      await refreshVersions();
      setShowHistory(false);
    } catch {
      setError("Failed to restore version");
    }
  };

  const embed = current.videoUrl ? extractVideoId(current.videoUrl) : null;
  const busy = regenerating || tweaking || saving;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        {current.slug && (
          <a href={`/c/${current.slug}`} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--n-text2)", textDecoration: "none" }}>
            <ExternalLink size={13} /> View live
          </a>
        )}
        <button onClick={() => setShowHistory(true)} style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--n-text2)", background: "none", border: "1px solid var(--border)", padding: "4px 10px", cursor: "pointer" }}>
          <History size={13} /> History ({versions.length})
        </button>
        {onPublish && (
          <button onClick={onPublish} disabled={publishing} style={{ marginLeft: "auto", padding: "8px 20px", border: "none", background: "var(--amber)", color: "#000", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: publishing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            {publishing ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Publishing…</> : "Save & Publish →"}
          </button>
        )}
      </div>

      {error && <p style={{ marginBottom: 12, fontSize: 13, color: "#ef4444" }}>{error}</p>}

      <div style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
        <CampaignHero
          imageParams={current.imageParams}
          headline={current.headline}
          subheadline={current.subheadline}
          editable
          onHeadlineChange={(v) => updateField("headline", v)}
          onSubheadlineChange={(v) => updateField("subheadline", v)}
        />
        {embed && (
          <div style={{ position: "relative", paddingBottom: "56.25%", background: "#000" }}>
            <iframe src={embed.url} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }} allow="autoplay; fullscreen" title="Campaign video" />
          </div>
        )}
        <div style={{ padding: "32px 40px" }}>
          <textarea
            value={current.body}
            onChange={(e) => updateField("body", e.target.value)}
            rows={8}
            style={{ width: "100%", fontSize: 15, color: "var(--n-text2)", lineHeight: 1.75, whiteSpace: "pre-wrap", marginBottom: 24, fontFamily: "inherit", border: "1px dashed var(--border)", background: "var(--bg)", padding: 10, boxSizing: "border-box", resize: "vertical" }}
          />
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--n-text2)", marginBottom: 4 }}>
              CTA button text
            </label>
            <input
              value={current.ctaText}
              onChange={(e) => updateField("ctaText", e.target.value)}
              style={{ padding: "8px 12px", border: "1px dashed var(--border)", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, letterSpacing: "0.05em", boxSizing: "border-box" }}
            />
          </div>
          <button onClick={() => setShowPledge(true)} style={{ padding: "14px 28px", border: "none", background: "var(--amber)", color: "#000", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Heart size={16} /> Preview donor view: {current.ctaText}
          </button>
        </div>
        <div style={{ padding: "12px 40px", borderTop: "1px solid var(--border)", color: "var(--n-text2)", fontSize: 12, fontFamily: "var(--font-mono)" }}>Powered by Nivarro · app.nivarro.co</div>
      </div>

      {dirty && (
        <button onClick={saveChanges} disabled={saving} style={{ marginTop: 12, padding: "10px 20px", border: "none", background: saving ? "var(--n-bg3)" : "var(--amber)", color: saving ? "var(--n-text2)" : "#000", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          {saving ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Saving…</> : <><Save size={14} /> Save Changes</>}
        </button>
      )}

      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--n-text2)", marginBottom: 6 }}>
            Tweak with AI feedback
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="e.g. make the headline punchier, shorten the body"
              style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, fontFamily: "inherit" }}
            />
            <button onClick={applyFeedback} disabled={busy || feedback.trim().length < 3} style={{ padding: "8px 16px", border: "none", background: busy || feedback.trim().length < 3 ? "var(--n-bg3)" : "var(--amber)", color: busy || feedback.trim().length < 3 ? "var(--n-text2)" : "#000", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: busy || feedback.trim().length < 3 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
              {tweaking ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={13} />} Apply
            </button>
          </div>
        </div>

        <div>
          <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--n-text2)", marginBottom: 6 }}>
            Start over from description
          </label>
          <textarea
            value={causeInput}
            onChange={(e) => setCauseInput(e.target.value)}
            rows={4}
            style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, lineHeight: 1.5, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 8 }}
          />
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=... (optional video)"
            style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 8 }}
          />
          <button onClick={regenerate} disabled={busy || causeInput.trim().length < 10} style={{ padding: "10px 20px", border: "1px solid var(--border)", background: "none", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", cursor: busy || causeInput.trim().length < 10 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            {regenerating ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Regenerating…</> : <><RefreshCw size={14} /> Start Over From Description</>}
          </button>
        </div>
      </div>

      {showHistory && (
        <VersionHistoryDrawer versions={versions} onRestore={restore} onClose={() => setShowHistory(false)} />
      )}
      {showPledge && (
        <PledgeModal campaignId={current.id} ctaText={current.ctaText} schoolId={schoolId} onClose={() => setShowPledge(false)} />
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: no new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add components/campaigns/CampaignEditor.tsx
git commit -m "$(cat <<'EOF'
Add shared CampaignEditor with inline editing and AI feedback tweaking

Consolidates the editing UI that will replace the duplicated preview
JSX in CampaignsNewClient and CampaignEditClient: click-to-edit
headline/subheadline (via CampaignHero)/body/CTA with a Save Changes
button (PATCH, no AI call), a "Tweak with AI feedback" box (calls the
new tweak endpoint), "Start Over From Description" as the full-redo
escape hatch, and version history with restore.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

### Task 11: Refactor `CampaignsNewClient` to use `CampaignEditor`

**Files:**
- Modify: `app/(dashboard)/campaigns/new/CampaignsNewClient.tsx` (full rewrite)

**Interfaces:**
- Consumes: `CampaignEditor`, `CampaignEditorData` (Task 10).

- [ ] **Step 1: Replace the entire contents of `app/(dashboard)/campaigns/new/CampaignsNewClient.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Sparkles, Loader2, Check, Copy, ExternalLink } from "lucide-react";
import CampaignEditor from "@/components/campaigns/CampaignEditor";
import type { ImageParams } from "@/components/campaigns/CampaignCanvas";

interface GeneratedCampaign {
  campaignId: string;
  headline: string;
  subheadline: string;
  body: string;
  ctaText: string;
  imageParams: ImageParams;
  videoUrl: string | null;
}

interface CampaignsNewClientProps {
  schoolId?: string;
}

export default function CampaignsNewClient({ schoolId }: CampaignsNewClientProps) {
  const [view, setView] = useState<"input" | "preview" | "saved">("input");
  const [causeInput, setCauseInput] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedCampaign | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!causeInput.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cause: causeInput, videoUrl: videoUrl || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Failed to generate");
      }
      const data = await res.json() as GeneratedCampaign;
      setGenerated(data);
      setView("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  };

  const publish = async () => {
    if (!generated) return;
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: generated.campaignId }),
      });
      if (!res.ok) throw new Error("Failed to publish");
      const data = await res.json() as { slug: string };
      setPublishedSlug(data.slug);
      setView("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPublishing(false);
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (view === "input") {
    return (
      <div style={{ maxWidth: 720 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 3vw, 36px)", letterSpacing: "-0.02em", color: "var(--text)", margin: 0 }}>
            AI Fundraising Page Generator
          </h1>
          <p style={{ fontSize: 14, color: "var(--n-text2)", marginTop: 4, marginBottom: 0 }}>
            Describe your cause and let Claude generate a complete campaign page in seconds — you can tweak or edit anything afterward.
          </p>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: 20, marginBottom: 16 }}>
          <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--amber)", marginBottom: 8 }}>
            What are you raising funds for?
          </label>
          <textarea
            value={causeInput}
            onChange={(e) => setCauseInput(e.target.value)}
            placeholder="e.g. We're raising money to send 12 students from our robotics club to the national championship in Dallas. We need $8,000 for travel, lodging, and registration fees."
            rows={5}
            style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 14, lineHeight: 1.5, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", borderRadius: 0 }}
          />
          <div style={{ marginTop: 12 }}>
            <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--n-text2)", marginBottom: 2 }}>
              Campaign Video (optional)
            </label>
            <p style={{ fontSize: 11, color: "var(--n-text2)", margin: "0 0 6px", lineHeight: 1.4 }}>
              Paste a YouTube or Vimeo link to embed a video on your public fundraising page — great for a student pitch or team intro.
            </p>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", borderRadius: 0 }}
            />
          </div>
          {error && <p style={{ margin: "12px 0 0", fontSize: 13, color: "#ef4444" }}>{error}</p>}
          <button
            onClick={generate}
            disabled={generating || causeInput.trim().length < 10}
            style={{ marginTop: 16, padding: "10px 20px", border: "none", background: generating || causeInput.trim().length < 10 ? "var(--n-bg3)" : "var(--amber)", color: generating || causeInput.trim().length < 10 ? "var(--n-text2)" : "#000", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: generating || causeInput.trim().length < 10 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, borderRadius: 0 }}
          >
            {generating ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Generating…</> : <><Sparkles size={16} /> Generate Campaign</>}
          </button>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (view === "preview" && generated) {
    return (
      <div style={{ maxWidth: 900 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--n-text2)" }}>Preview — edit anything below, then publish</span>
          <button onClick={() => setView("input")} style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--n-text2)", background: "none", border: "1px solid var(--border)", padding: "4px 10px", cursor: "pointer", borderRadius: 0 }}>
            ← Edit Prompt
          </button>
        </div>
        <CampaignEditor
          campaign={{
            id: generated.campaignId,
            slug: null,
            cause: causeInput,
            headline: generated.headline,
            subheadline: generated.subheadline,
            body: generated.body,
            ctaText: generated.ctaText,
            imageParams: generated.imageParams,
            videoUrl: generated.videoUrl,
            active: false,
          }}
          versions={[]}
          schoolId={schoolId}
          onPublish={publish}
          publishing={publishing}
        />
      </div>
    );
  }

  if (view === "saved" && publishedSlug) {
    const url = typeof window !== "undefined" ? `${window.location.origin}/c/${publishedSlug}` : `/c/${publishedSlug}`;
    return (
      <div style={{ maxWidth: 600, padding: "48px 0" }}>
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 28, letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 8px" }}>Campaign is live!</h2>
          <p style={{ color: "var(--n-text2)", fontSize: 14, margin: 0 }}>Share this link with your community to start collecting pledges.</p>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <input readOnly value={url} style={{ flex: 1, padding: "10px 12px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, fontFamily: "var(--font-mono)", borderRadius: 0 }} />
          <button onClick={() => copyUrl(url)} style={{ padding: "10px 16px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, borderRadius: 0 }}>
            {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
          </button>
          <a href={url} target="_blank" rel="noopener noreferrer" style={{ padding: "10px 16px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none", display: "flex", alignItems: "center", gap: 6, borderRadius: 0 }}>
            <ExternalLink size={14} /> Open
          </a>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => { setView("input"); setGenerated(null); setCauseInput(""); setVideoUrl(""); setPublishedSlug(null); }} style={{ padding: "10px 20px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", borderRadius: 0 }}>
            New Campaign
          </button>
          <a href="/campaigns" style={{ padding: "10px 20px", border: "none", background: "var(--amber)", color: "#000", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none", display: "inline-block", borderRadius: 0 }}>
            My Campaigns →
          </a>
        </div>
      </div>
    );
  }

  return null;
}
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: no new errors from this file.

- [ ] **Step 3: Manual browser check**

Run `npm run dev`, log in as a `SCHOOL`/`ADMIN` test account, go to `/campaigns/new`, enter a cause description, click "Generate Campaign," and confirm: the hero shows headline/subheadline overlaid directly on the art (not below it), clicking the headline/subheadline/body/CTA lets you edit them inline, a "Save Changes" button appears after an edit, the "Tweak with AI feedback" box revises copy without wiping unrelated fields, and "Save & Publish" still works end to end.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/campaigns/new/CampaignsNewClient.tsx"
git commit -m "$(cat <<'EOF'
Use CampaignEditor in the new-campaign preview flow

Removes the duplicated preview JSX in favor of the shared editor, so
the "new campaign" screen gets inline editing, AI feedback tweaking,
and version history for free.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

### Task 12: Refactor `CampaignEditClient` to use `CampaignEditor`

**Files:**
- Modify: `app/(dashboard)/campaigns/[id]/edit/CampaignEditClient.tsx` (full rewrite)

**Interfaces:**
- Consumes: `CampaignEditor`, `CampaignEditorData` (Task 10), `VersionSummary` (Task 8).

- [ ] **Step 1: Replace the entire contents of `app/(dashboard)/campaigns/[id]/edit/CampaignEditClient.tsx`**

```tsx
"use client";

import CampaignEditor, { type CampaignEditorData } from "@/components/campaigns/CampaignEditor";
import type { VersionSummary } from "@/components/campaigns/VersionHistoryDrawer";

interface Props {
  campaign: CampaignEditorData;
  versions: VersionSummary[];
}

export default function CampaignEditClient({ campaign, versions }: Props) {
  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ marginBottom: 20 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--amber)" }}>
          Edit Campaign
        </span>
      </div>
      <CampaignEditor campaign={campaign} versions={versions} />
    </div>
  );
}
```

- [ ] **Step 2: Update the server component that feeds it, `app/(dashboard)/campaigns/[id]/edit/page.tsx`**

Current `select` for `versions`:

```ts
  const versions = await prisma.campaignVersion.findMany({
    where: { campaignId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, cause: true, headline: true, imageParams: true, restoredFrom: true, createdAt: true },
  });
```

Change to:

```ts
  const versions = await prisma.campaignVersion.findMany({
    where: { campaignId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, cause: true, headline: true, imageParams: true, source: true, note: true, restoredFrom: true, createdAt: true },
  });
```

And the `versions.map(...)` passed to `<CampaignEditClient>` — current:

```ts
      versions={versions.map((v) => ({
        id: v.id,
        cause: v.cause,
        headline: v.headline,
        imageParams: v.imageParams as unknown as ImageParams,
        restoredFrom: v.restoredFrom,
        createdAt: v.createdAt.toISOString(),
      }))}
```

Change to:

```ts
      versions={versions.map((v) => ({
        id: v.id,
        cause: v.cause,
        headline: v.headline,
        imageParams: v.imageParams as unknown as ImageParams,
        source: v.source,
        note: v.note,
        restoredFrom: v.restoredFrom,
        createdAt: v.createdAt.toISOString(),
      }))}
```

- [ ] **Step 3: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: no new errors from either file.

- [ ] **Step 4: Manual browser check**

Open `/campaigns/[id]/edit` for an existing campaign, confirm the hero/body/CTA are editable inline, "Tweak with AI feedback" and "Save Changes" both work, and the History drawer shows labeled entries (older ones show "Generated" from before this change, since existing rows default to `source: "generate"`).

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/campaigns/[id]/edit/CampaignEditClient.tsx" "app/(dashboard)/campaigns/[id]/edit/page.tsx"
git commit -m "$(cat <<'EOF'
Use CampaignEditor on the campaign edit page

Replaces the duplicated preview/edit JSX with the shared editor, and
passes source/note through from the server component so version
history labels render correctly here too.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

### Task 13: Redesign the public campaign page hero

**Files:**
- Modify: `app/c/[slug]/CampaignPublicClient.tsx` (full rewrite)

**Interfaces:**
- Consumes: `CampaignHero` (Task 9, `editable` omitted so it defaults to `false`).

- [ ] **Step 1: Replace the entire contents of `app/c/[slug]/CampaignPublicClient.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import CampaignHero from "@/components/campaigns/CampaignHero";
import type { ImageParams } from "@/components/campaigns/CampaignCanvas";
import PledgeModal from "@/components/campaigns/PledgeModal";
import { extractVideoId } from "@/lib/video-embed";

interface Props {
  campaign: {
    id: string;
    headline: string;
    subheadline: string;
    body: string;
    ctaText: string;
    imageParams: ImageParams;
    videoUrl: string | null;
    active: boolean;
  };
}

export default function CampaignPublicClient({ campaign }: Props) {
  const [showPledge, setShowPledge] = useState(false);
  const embed = campaign.videoUrl ? extractVideoId(campaign.videoUrl) : null;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#fff" }}>
      <CampaignHero
        imageParams={campaign.imageParams}
        headline={campaign.headline}
        subheadline={campaign.subheadline}
      />

      {embed && (
        <div style={{ position: "relative", paddingBottom: "56.25%", background: "#000" }}>
          <iframe
            src={embed.url}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              border: "none",
            }}
            allow="autoplay; fullscreen; picture-in-picture"
            title="Campaign video"
          />
        </div>
      )}

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "56px 24px" }}>
        <div
          style={{
            fontSize: 16,
            color: "rgba(255,255,255,0.75)",
            lineHeight: 1.8,
            whiteSpace: "pre-wrap",
            marginBottom: 48,
          }}
        >
          {campaign.body}
        </div>
        <button
          onClick={() => setShowPledge(true)}
          style={{
            padding: "16px 36px",
            border: "none",
            background: "#e8893a",
            color: "#000",
            fontFamily: "var(--font-mono)",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Heart size={18} /> {campaign.ctaText}
        </button>
      </div>

      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.08)",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "rgba(255,255,255,0.3)",
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.08em",
          }}
        >
          Powered by Nivarro · app.nivarro.co
        </p>
      </div>

      {showPledge && (
        <PledgeModal
          campaignId={campaign.id}
          ctaText={campaign.ctaText}
          onClose={() => setShowPledge(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: zero errors across the whole project now (this is the last file that referenced the old hero layout).

- [ ] **Step 3: Manual browser check**

Publish a campaign (via `/campaigns/new`) and open its public `/c/[slug]` page. Confirm the headline/subheadline are overlaid directly on the generative-art hero (not in a separate block below it), text stays readable regardless of the chosen palette, and the pledge flow still works.

- [ ] **Step 4: Commit**

```bash
git add "app/c/[slug]/CampaignPublicClient.tsx"
git commit -m "$(cat <<'EOF'
Redesign public campaign page hero as one cohesive image

Uses CampaignHero so headline/subheadline overlay the generative art
directly, matching the dashboard preview/edit views, instead of a
separate canvas strip followed by a plain text block.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Post-plan manual QA checklist

After all 13 tasks are complete, do one end-to-end pass as a `SCHOOL`/`ADMIN` test account:

1. `/campaigns/new` → generate a campaign → confirm hero text overlays the art, edit the headline inline and Save, apply an AI feedback tweak, publish.
2. `/campaigns/[id]/edit` on that same campaign → open History → confirm you see "Generated," "Manual edit," and "Tweaked: ..." entries in order → restore an older version → confirm it round-trips correctly.
3. Visit the public `/c/[slug]` page → confirm it matches the edited copy and the redesigned hero.
4. Open `/campaigns` (the list) → confirm `CampaignCard` still renders thumbnails correctly for both old (pre-migration) and new campaigns, since it uses `CampaignCanvas` directly and relies on the Task 2 compatibility shim.
