# AI Campaign Visual Generator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full AI-powered fundraising campaign builder for schools — canvas-rendered graphics, version history, public shareable pages, and a pledge modal — with zero external image API cost.

**Architecture:** Claude Haiku generates copy + design parameters (palette, pattern, seed); a deterministic canvas renderer turns those params into a unique graphic on every visit. Each generate call creates a `CampaignVersion` record immediately so no work is lost. Published campaigns get a unique slug and a public route `/c/[slug]` accessible without auth.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma/PostgreSQL, Anthropic SDK (claude-haiku-4-5-20251001), HTML5 Canvas, Resend (existing), Lucide icons, CSS variables (existing design system)

## Global Constraints

- Auth pattern: `const session = await auth(); if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });`
- School gate: `if (dbUser?.role !== "SCHOOL" && dbUser?.role !== "ADMIN")`
- CSS variables in use: `var(--text)`, `var(--surface)`, `var(--border)`, `var(--bg)`, `var(--amber)`, `var(--n-text2)`, `var(--n-bg3)`, `var(--font-mono)`, `var(--font-display)`, `var(--font-body)`
- All borders use `borderRadius: 0` (sharp corners throughout the design system)
- Migration files live in `prisma/migrations/YYYYMMDDHHMMSS_name/migration.sql` and use `IF NOT EXISTS` guards
- Manual migration required — Render runs `prisma migrate deploy` at startup; no migration = no column
- Always `git add && git commit && git push` before triggering deploy
- Model: `claude-haiku-4-5-20251001`
- No external image APIs. Canvas renders from stored `imageParams` JSON on every visit.

---

### Task 1: Schema + Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260705000000_add_campaign/migration.sql`

**Interfaces:**
- Produces: `Campaign`, `CampaignVersion` Prisma models; updated `CampaignPledge` with `campaignId`; `User` with `SchoolCampaigns` relation

- [ ] **Step 1: Add models to schema.prisma**

Add the following to `prisma/schema.prisma` (after the existing `CampaignPledge` block):

```prisma
model Campaign {
  id          String            @id @default(cuid())
  slug        String?           @unique
  schoolId    String
  school      User              @relation("SchoolCampaigns", fields: [schoolId], references: [id])
  cause       String            @db.Text
  headline    String
  subheadline String
  body        String            @db.Text
  ctaText     String
  imageParams Json
  videoUrl    String?
  active      Boolean           @default(false)
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
  pledges     CampaignPledge[]
  versions    CampaignVersion[]
}

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

- [ ] **Step 2: Update CampaignPledge and User in schema.prisma**

Replace the existing `CampaignPledge` model:

```prisma
model CampaignPledge {
  id           String    @id @default(cuid())
  causeText    String?
  donorName    String
  donorEmail   String
  donorPhone   String?
  pledgeAmount Decimal?  @db.Decimal(10, 2)
  campaignId   String?
  campaign     Campaign? @relation(fields: [campaignId], references: [id], onDelete: SetNull)
  createdAt    DateTime  @default(now())
}
```

Add `campaigns` relation to the `User` model (after the last existing relation line):

```prisma
  campaigns  Campaign[] @relation("SchoolCampaigns")
```

- [ ] **Step 3: Run prisma generate**

```bash
cd "C:\Users\thoma\Goal-APP"
npx prisma generate
```

Expected: "Generated Prisma Client" with no errors.

- [ ] **Step 4: Create the migration SQL file**

Create directory `prisma/migrations/20260705000000_add_campaign/` and write `migration.sql`:

```sql
-- Create Campaign table
CREATE TABLE IF NOT EXISTS "Campaign" (
  "id"          TEXT NOT NULL,
  "slug"        TEXT,
  "schoolId"    TEXT NOT NULL,
  "cause"       TEXT NOT NULL,
  "headline"    TEXT NOT NULL,
  "subheadline" TEXT NOT NULL,
  "body"        TEXT NOT NULL,
  "ctaText"     TEXT NOT NULL,
  "imageParams" JSONB NOT NULL,
  "videoUrl"    TEXT,
  "active"      BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Campaign_slug_key" ON "Campaign"("slug");

ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create CampaignVersion table
CREATE TABLE IF NOT EXISTS "CampaignVersion" (
  "id"           TEXT NOT NULL,
  "campaignId"   TEXT NOT NULL,
  "cause"        TEXT NOT NULL,
  "headline"     TEXT NOT NULL,
  "subheadline"  TEXT NOT NULL,
  "body"         TEXT NOT NULL,
  "ctaText"      TEXT NOT NULL,
  "imageParams"  JSONB NOT NULL,
  "restoredFrom" TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignVersion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CampaignVersion" ADD CONSTRAINT "CampaignVersion_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add campaignId to CampaignPledge
ALTER TABLE "CampaignPledge" ADD COLUMN IF NOT EXISTS "campaignId" TEXT;

ALTER TABLE "CampaignPledge" ADD CONSTRAINT "CampaignPledge_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260705000000_add_campaign/migration.sql
git commit -m "feat: add Campaign, CampaignVersion schema + migration"
```

---

### Task 2: Utility Libraries

**Files:**
- Create: `lib/prng.ts`
- Create: `lib/campaign-slug.ts`
- Create: `lib/video-embed.ts`

**Interfaces:**
- Produces:
  - `mulberry32(seed: number): () => number` — seeded PRNG
  - `generateSlug(headline: string): string` — URL-safe slug with 4-char suffix
  - `extractVideoId(url: string): { type: "youtube"|"vimeo"; id: string; url: string } | null`

- [ ] **Step 1: Create lib/prng.ts**

```typescript
export function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 2: Create lib/campaign-slug.ts**

```typescript
export function generateSlug(headline: string): string {
  const base = headline
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60)
    .replace(/-$/, "");
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}
```

- [ ] **Step 3: Create lib/video-embed.ts**

```typescript
export interface VideoEmbed {
  type: "youtube" | "vimeo";
  id: string;
  url: string;
}

export function extractVideoId(rawUrl: string): VideoEmbed | null {
  const ytMatch = rawUrl.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch) {
    return {
      type: "youtube",
      id: ytMatch[1],
      url: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`,
    };
  }
  const vimeoMatch = rawUrl.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return {
      type: "vimeo",
      id: vimeoMatch[1],
      url: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
    };
  }
  return null;
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/prng.ts lib/campaign-slug.ts lib/video-embed.ts
git commit -m "feat: add campaign utility libs — prng, slug, video-embed"
```

---

### Task 3: CampaignCanvas Component

**Files:**
- Create: `components/campaigns/CampaignCanvas.tsx`

**Interfaces:**
- Consumes: `mulberry32` from `lib/prng.ts`
- Produces: `ImageParams` interface (exported); `CampaignCanvas` default export — takes `imageParams: ImageParams`, renders deterministic 1200×630 canvas

- [ ] **Step 1: Create components/campaigns/CampaignCanvas.tsx**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add components/campaigns/CampaignCanvas.tsx
git commit -m "feat: deterministic canvas renderer — 4 patterns, mulberry32 PRNG"
```

---

### Task 4: PledgeModal Component

**Files:**
- Create: `components/campaigns/PledgeModal.tsx`

**Interfaces:**
- Consumes: `POST /api/campaigns/pledge` (existing route, will accept `campaignId` after Task 8)
- Produces: `PledgeModal` — props: `campaignId: string`, `ctaText: string`, `onClose: () => void`

- [ ] **Step 1: Create components/campaigns/PledgeModal.tsx**

```typescript
"use client";

import { useState } from "react";
import { X, Heart, CheckCircle, Loader2 } from "lucide-react";

interface Props {
  campaignId: string;
  ctaText: string;
  onClose: () => void;
}

export default function PledgeModal({ campaignId, ctaText, onClose }: Props) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", amount: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns/pledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          donorName: form.name,
          donorEmail: form.email,
          donorPhone: form.phone || undefined,
          pledgeAmount: form.amount ? parseFloat(form.amount) : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to record pledge");
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: 28, width: "100%", maxWidth: 440, position: "relative", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", color: "var(--n-text2)", cursor: "pointer" }}>
          <X size={18} />
        </button>
        {done ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <CheckCircle size={48} style={{ color: "#22c55e", margin: "0 auto 16px" }} />
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 8px" }}>Pledge Recorded!</h3>
            <p style={{ color: "var(--n-text2)", fontSize: 14, margin: 0 }}>Thank you. A confirmation has been sent to your email.</p>
          </div>
        ) : (
          <>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 4px" }}>{ctaText}</h3>
            <p style={{ color: "var(--n-text2)", fontSize: 13, margin: "0 0 20px" }}>Fill in your details to pledge your support.</p>
            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { key: "name",   label: "Full Name",               type: "text",   placeholder: "Alex Johnson",        required: true },
                { key: "email",  label: "Email",                   type: "email",  placeholder: "alex@example.com",    required: true },
                { key: "phone",  label: "Phone (optional)",        type: "tel",    placeholder: "+1 (555) 000-0000",   required: false },
                { key: "amount", label: "Pledge Amount (optional)", type: "number", placeholder: "50",                  required: false },
              ].map(({ key, label, type, placeholder, required }) => (
                <div key={key}>
                  <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--n-text2)", marginBottom: 4 }}>{label}</label>
                  <input
                    type={type}
                    placeholder={placeholder}
                    required={required}
                    value={form[key as keyof typeof form]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" }}
                  />
                </div>
              ))}
              {error && <p style={{ margin: 0, fontSize: 12, color: "#ef4444" }}>{error}</p>}
              <button
                type="submit"
                disabled={loading}
                style={{ padding: "10px 0", border: "none", background: "var(--amber)", color: "#000", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                {loading
                  ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Submitting…</>
                  : <><Heart size={14} /> Submit Pledge</>}
              </button>
            </form>
          </>
        )}
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/campaigns/PledgeModal.tsx
git commit -m "feat: PledgeModal component — shared between builder and public page"
```

---

### Task 5: Update Generate Route

**Files:**
- Modify: `app/api/campaigns/generate/route.ts`

**Interfaces:**
- Consumes: `prisma.campaign`, `prisma.campaignVersion`; Anthropic SDK
- Request body: `{ cause: string; campaignId?: string; videoUrl?: string }`
- Produces: `{ campaignId, headline, subheadline, body, ctaText, causeText, imageParams, videoUrl }`

- [ ] **Step 1: Replace app/api/campaigns/generate/route.ts entirely**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

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
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `You are a fundraising copywriter and visual designer for student organizations. Write compelling donation page copy AND choose visual design parameters for this cause:

"${cause}"

Respond ONLY with valid JSON (no markdown, no code fences):
{
  "headline": "6-12 word punchy headline",
  "subheadline": "one motivating sentence",
  "body": "3-4 compelling paragraphs separated by \\n\\n",
  "ctaText": "3-6 word call-to-action e.g. Support Our Journey",
  "imageParams": {
    "seed": <random integer 1000-9999>,
    "bg": "<dark hex color matching cause mood>",
    "palette": ["<hex1>", "<hex2>", "<hex3>"],
    "accent": "<most vibrant of the palette hexes>",
    "pattern": "<one of: geometric|wave|burst|organic>",
    "shapes": ["circle", "triangle", "rect"],
    "density": <float 0.4-0.9>
  }
}

Pattern guidance: water/environment → wave + blues; sports/energy → burst + bold warm colors; community/people → organic + warm tones; education/tech → geometric + cool tones.
Write with warmth, specificity, and authentic student voice.`,
        },
      ],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `AI service error: ${msg}` }, { status: 502 });
  }

  const rawText = message.content[0].type === "text" ? message.content[0].text : "";
  const cleaned = rawText.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response. Please try again." }, { status: 500 });
  }

  const required = ["headline", "subheadline", "body", "ctaText", "imageParams"];
  if (required.some((k) => !parsed[k])) {
    return NextResponse.json({ error: "Incomplete AI response. Please try again." }, { status: 500 });
  }

  const headline = parsed.headline as string;
  const subheadline = parsed.subheadline as string;
  const bodyText = parsed.body as string;
  const ctaText = parsed.ctaText as string;
  const imageParams = parsed.imageParams as Record<string, unknown>;

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
        imageParams,
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
        imageParams,
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
      imageParams,
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

- [ ] **Step 2: Commit**

```bash
git add app/api/campaigns/generate/route.ts
git commit -m "feat: generate route — extended imageParams, auto-create draft + version"
```

---

### Task 6: Campaign CRUD Routes

**Files:**
- Create: `app/api/campaigns/route.ts`
- Create: `app/api/campaigns/[id]/route.ts`

**Interfaces:**
- `GET /api/campaigns` → `Array<{ id, slug, headline, subheadline, imageParams, active, pledgeCount, createdAt }>`
- `POST /api/campaigns` body: `{ campaignId }` → `{ slug }`
- `PATCH /api/campaigns/[id]` body: `{ active?: boolean }` → `{ active }`
- `DELETE /api/campaigns/[id]` → `{ ok: true }`

- [ ] **Step 1: Create app/api/campaigns/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateSlug } from "@/lib/campaign-slug";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaigns = await prisma.campaign.findMany({
    where: { schoolId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { pledges: true } } },
  });

  return NextResponse.json(
    campaigns.map((c) => ({
      id: c.id,
      slug: c.slug,
      headline: c.headline,
      subheadline: c.subheadline,
      imageParams: c.imageParams,
      active: c.active,
      pledgeCount: c._count.pledges,
      createdAt: c.createdAt,
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { campaignId } = body;
  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, schoolId: session.user.id },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const slug = generateSlug(campaign.headline);

  const published = await prisma.campaign.update({
    where: { id: campaignId },
    data: { slug, active: true },
  });

  return NextResponse.json({ slug: published.slug });
}
```

- [ ] **Step 2: Create app/api/campaigns/[id]/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaign = await prisma.campaign.findFirst({
    where: { id, schoolId: session.user.id },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const updated = await prisma.campaign.update({
    where: { id },
    data: {
      ...(typeof body.active === "boolean" ? { active: body.active } : {}),
    },
  });

  return NextResponse.json({ active: updated.active });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaign = await prisma.campaign.findFirst({
    where: { id, schoolId: session.user.id },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.campaign.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/campaigns/route.ts app/api/campaigns/[id]/route.ts
git commit -m "feat: campaign CRUD routes — list, publish, active toggle, delete"
```

---

### Task 7: Version Routes

**Files:**
- Create: `app/api/campaigns/[id]/versions/route.ts`
- Create: `app/api/campaigns/[id]/versions/[versionId]/restore/route.ts`

**Interfaces:**
- `GET /api/campaigns/[id]/versions` → `Array<{ id, cause, headline, imageParams, restoredFrom, createdAt }>`
- `POST /api/campaigns/[id]/versions/[versionId]/restore` → `{ campaignId, headline, subheadline, body, ctaText, imageParams, cause }`

- [ ] **Step 1: Create app/api/campaigns/[id]/versions/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaign = await prisma.campaign.findFirst({
    where: { id, schoolId: session.user.id },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const versions = await prisma.campaignVersion.findMany({
    where: { campaignId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      cause: true,
      headline: true,
      imageParams: true,
      restoredFrom: true,
      createdAt: true,
    },
  });

  return NextResponse.json(versions);
}
```

- [ ] **Step 2: Create app/api/campaigns/[id]/versions/[versionId]/restore/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const { id, versionId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaign = await prisma.campaign.findFirst({
    where: { id, schoolId: session.user.id },
  });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const version = await prisma.campaignVersion.findFirst({
    where: { id: versionId, campaignId: id },
  });
  if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });

  const [updated] = await prisma.$transaction([
    prisma.campaign.update({
      where: { id },
      data: {
        cause: version.cause,
        headline: version.headline,
        subheadline: version.subheadline,
        body: version.body,
        ctaText: version.ctaText,
        imageParams: version.imageParams,
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
        imageParams: version.imageParams,
        restoredFrom: version.id,
      },
    }),
  ]);

  return NextResponse.json({
    campaignId: updated.id,
    headline: updated.headline,
    subheadline: updated.subheadline,
    body: updated.body,
    ctaText: updated.ctaText,
    imageParams: updated.imageParams,
    cause: updated.cause,
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/campaigns/[id]/versions/route.ts "app/api/campaigns/[id]/versions/[versionId]/restore/route.ts"
git commit -m "feat: version history routes — list versions + restore"
```

---

### Task 8: Public Route + Pledge Update

**Files:**
- Create: `app/api/campaigns/[slug]/public/route.ts`
- Modify: `app/api/campaigns/pledge/route.ts`

**Interfaces:**
- `GET /api/campaigns/[slug]/public` (no auth) → `{ id, headline, subheadline, body, ctaText, imageParams, videoUrl, active }`
- `POST /api/campaigns/pledge` now accepts optional `campaignId` in body

- [ ] **Step 1: Create app/api/campaigns/[slug]/public/route.ts**

Note: This file path clashes with `app/api/campaigns/[id]/route.ts` — Next.js treats `[slug]` and `[id]` as separate dynamic segments at the same level, but routes them by path. Since `/[slug]/public` has a sub-segment `public` and `/[id]` does not, they are distinct routes.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { slug },
    select: {
      id: true,
      headline: true,
      subheadline: true,
      body: true,
      ctaText: true,
      imageParams: true,
      videoUrl: true,
      active: true,
    },
  });

  if (!campaign || !campaign.active) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(campaign);
}
```

- [ ] **Step 2: Update app/api/campaigns/pledge/route.ts**

Find the destructuring line and replace it:

```typescript
// BEFORE:
const { causeText, donorName, donorEmail, donorPhone, pledgeAmount } = body;

// AFTER:
const { causeText, donorName, donorEmail, donorPhone, pledgeAmount, campaignId } = body;
```

Find the `prisma.campaignPledge.create` data block and replace:

```typescript
// BEFORE:
data: {
  causeText: causeText ?? null,
  donorName: donorName.trim(),
  donorEmail: donorEmail.trim(),
  donorPhone: donorPhone?.trim() ?? null,
  pledgeAmount: pledgeAmount ? pledgeAmount : null,
},

// AFTER:
data: {
  causeText: causeText ?? null,
  donorName: donorName.trim(),
  donorEmail: donorEmail.trim(),
  donorPhone: donorPhone?.trim() ?? null,
  pledgeAmount: pledgeAmount ? pledgeAmount : null,
  campaignId: typeof campaignId === "string" ? campaignId : null,
},
```

- [ ] **Step 3: Commit**

```bash
git add app/api/campaigns/[slug]/public/route.ts app/api/campaigns/pledge/route.ts
git commit -m "feat: public campaign fetch route + link pledges to campaignId"
```

---

### Task 9: Campaign Builder (CampaignsNewClient overhaul)

**Files:**
- Modify: `app/(dashboard)/campaigns/new/CampaignsNewClient.tsx`

**Interfaces:**
- Consumes: `POST /api/campaigns/generate`, `POST /api/campaigns`
- Consumes: `CampaignCanvas` from `components/campaigns/CampaignCanvas.tsx`
- Consumes: `PledgeModal` from `components/campaigns/PledgeModal.tsx`
- Consumes: `extractVideoId` from `lib/video-embed.ts`

- [ ] **Step 1: Replace CampaignsNewClient.tsx entirely**

```typescript
"use client";

import { useState } from "react";
import { Sparkles, Heart, Loader2, Check, Copy, ExternalLink, RefreshCw } from "lucide-react";
import CampaignCanvas, { type ImageParams } from "@/components/campaigns/CampaignCanvas";
import PledgeModal from "@/components/campaigns/PledgeModal";
import { extractVideoId } from "@/lib/video-embed";

interface GeneratedCampaign {
  campaignId: string;
  headline: string;
  subheadline: string;
  body: string;
  ctaText: string;
  imageParams: ImageParams;
  videoUrl: string | null;
}

export default function CampaignsNewClient() {
  const [view, setView] = useState<"input" | "preview" | "saved">("input");
  const [causeInput, setCauseInput] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedCampaign | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [showPledge, setShowPledge] = useState(false);
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
        body: JSON.stringify({
          cause: causeInput,
          videoUrl: videoUrl || undefined,
          campaignId: generated?.campaignId,
        }),
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
            Describe your cause and let Claude generate a complete campaign page in seconds.
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
            style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 14, lineHeight: 1.5, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
          />
          <div style={{ marginTop: 12 }}>
            <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--n-text2)", marginBottom: 4 }}>
              YouTube / Vimeo URL (optional)
            </label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}
            />
          </div>
          {error && <p style={{ margin: "12px 0 0", fontSize: 13, color: "#ef4444" }}>{error}</p>}
          <button
            onClick={generate}
            disabled={generating || !causeInput.trim()}
            style={{ marginTop: 16, padding: "10px 20px", border: "none", background: generating || !causeInput.trim() ? "var(--n-bg3)" : "var(--amber)", color: generating || !causeInput.trim() ? "var(--n-text2)" : "#000", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: generating || !causeInput.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}
          >
            {generating ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Generating…</> : <><Sparkles size={16} /> Generate Campaign Page</>}
          </button>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (view === "preview" && generated) {
    const embed = generated.videoUrl ? extractVideoId(generated.videoUrl) : null;
    return (
      <div style={{ maxWidth: 900 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--n-text2)" }}>Preview</span>
          <button onClick={() => setView("input")} style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--n-text2)", background: "none", border: "1px solid var(--border)", padding: "4px 10px", cursor: "pointer" }}>
            ← Edit Prompt
          </button>
          <button onClick={generate} disabled={generating} style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--n-text2)", background: "none", border: "1px solid var(--border)", padding: "4px 10px", cursor: generating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            {generating ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Regenerating…</> : <><RefreshCw size={12} /> Regenerate</>}
          </button>
          <button onClick={publish} disabled={publishing} style={{ marginLeft: "auto", padding: "8px 20px", border: "none", background: "var(--amber)", color: "#000", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: publishing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            {publishing ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Publishing…</> : "Save & Publish →"}
          </button>
        </div>
        {error && <p style={{ marginBottom: 12, fontSize: 13, color: "#ef4444" }}>{error}</p>}
        <div style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
          <CampaignCanvas imageParams={generated.imageParams} />
          {embed && (
            <div style={{ position: "relative", paddingBottom: "56.25%", background: "#000" }}>
              <iframe src={embed.url} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }} allow="autoplay; fullscreen" title="Campaign video" />
            </div>
          )}
          <div style={{ padding: "32px 40px" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(24px, 3vw, 40px)", letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 12px", lineHeight: 1.2 }}>{generated.headline}</h2>
            <p style={{ fontSize: 18, color: "var(--amber)", fontWeight: 600, margin: "0 0 24px" }}>{generated.subheadline}</p>
            <div style={{ fontSize: 15, color: "var(--n-text2)", lineHeight: 1.75, whiteSpace: "pre-wrap", marginBottom: 32 }}>{generated.body}</div>
            <button onClick={() => setShowPledge(true)} style={{ padding: "14px 28px", border: "none", background: "var(--amber)", color: "#000", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Heart size={16} /> {generated.ctaText}
            </button>
          </div>
          <div style={{ padding: "12px 40px", borderTop: "1px solid var(--border)", color: "var(--n-text2)", fontSize: 12, fontFamily: "var(--font-mono)" }}>Powered by Nivarro · app.nivarro.co</div>
        </div>
        {showPledge && <PledgeModal campaignId={generated.campaignId} ctaText={generated.ctaText} onClose={() => setShowPledge(false)} />}
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
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
          <input readOnly value={url} style={{ flex: 1, padding: "10px 12px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, fontFamily: "var(--font-mono)" }} />
          <button onClick={() => copyUrl(url)} style={{ padding: "10px 16px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
          </button>
          <a href={url} target="_blank" rel="noopener noreferrer" style={{ padding: "10px 16px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
            <ExternalLink size={14} /> Open
          </a>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => { setView("input"); setGenerated(null); setCauseInput(""); setVideoUrl(""); setPublishedSlug(null); }} style={{ padding: "10px 20px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}>
            New Campaign
          </button>
          <a href="/campaigns" style={{ padding: "10px 20px", border: "none", background: "var(--amber)", color: "#000", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none", display: "inline-block" }}>
            My Campaigns →
          </a>
        </div>
      </div>
    );
  }

  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(dashboard)/campaigns/new/CampaignsNewClient.tsx"
git commit -m "feat: campaign builder — 3-state UI with canvas preview and publish"
```

---

### Task 10: My Campaigns Dashboard + Sidebar

**Files:**
- Create: `app/(dashboard)/campaigns/page.tsx`
- Create: `app/(dashboard)/campaigns/CampaignsListClient.tsx`
- Create: `components/campaigns/CampaignCard.tsx`
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1: Create app/(dashboard)/campaigns/page.tsx**

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import CampaignsListClient from "./CampaignsListClient";
import type { ImageParams } from "@/components/campaigns/CampaignCanvas";

export default async function CampaignsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "SCHOOL" && dbUser?.role !== "ADMIN") redirect("/dashboard");

  const campaigns = await prisma.campaign.findMany({
    where: { schoolId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { pledges: true } } },
  });

  return (
    <CampaignsListClient
      campaigns={campaigns.map((c) => ({
        id: c.id,
        slug: c.slug,
        headline: c.headline,
        subheadline: c.subheadline,
        imageParams: c.imageParams as ImageParams,
        active: c.active,
        pledgeCount: c._count.pledges,
        createdAt: c.createdAt.toISOString(),
      }))}
    />
  );
}
```

- [ ] **Step 2: Create app/(dashboard)/campaigns/CampaignsListClient.tsx**

```typescript
"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import CampaignCard from "@/components/campaigns/CampaignCard";
import type { ImageParams } from "@/components/campaigns/CampaignCanvas";

interface CampaignSummary {
  id: string;
  slug: string | null;
  headline: string;
  subheadline: string;
  imageParams: ImageParams;
  active: boolean;
  pledgeCount: number;
  createdAt: string;
}

export default function CampaignsListClient({ campaigns: initial }: { campaigns: CampaignSummary[] }) {
  const [campaigns, setCampaigns] = useState(initial);

  const toggleActive = async (id: string, active: boolean) => {
    await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, active } : c)));
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm("Delete this campaign and all its pledges? This cannot be undone.")) return;
    await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 3vw, 36px)", letterSpacing: "-0.02em", color: "var(--text)", margin: 0 }}>My Campaigns</h1>
          <p style={{ fontSize: 14, color: "var(--n-text2)", marginTop: 4, marginBottom: 0 }}>
            {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/campaigns/new" style={{ padding: "10px 20px", border: "none", background: "var(--amber)", color: "#000", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
          <Plus size={14} /> New Campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div style={{ padding: "64px 0", textAlign: "center", border: "1px solid var(--border)", background: "var(--surface)" }}>
          <p style={{ color: "var(--n-text2)", fontSize: 15, margin: "0 0 20px" }}>No campaigns yet.</p>
          <Link href="/campaigns/new" style={{ padding: "10px 20px", border: "none", background: "var(--amber)", color: "#000", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none" }}>
            Create your first campaign
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {campaigns.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              onToggleActive={(active) => toggleActive(c.id, active)}
              onDelete={() => deleteCampaign(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create components/campaigns/CampaignCard.tsx**

```typescript
"use client";

import Link from "next/link";
import { useState } from "react";
import { Copy, Check, Pencil, Trash2 } from "lucide-react";
import CampaignCanvas, { type ImageParams } from "./CampaignCanvas";

interface CampaignSummary {
  id: string;
  slug: string | null;
  headline: string;
  subheadline: string;
  imageParams: ImageParams;
  active: boolean;
  pledgeCount: number;
  createdAt: string;
}

interface Props {
  campaign: CampaignSummary;
  onToggleActive: (active: boolean) => void;
  onDelete: () => void;
}

export default function CampaignCard({ campaign, onToggleActive, onDelete }: Props) {
  const [copied, setCopied] = useState(false);

  const publicUrl = campaign.slug
    ? `${typeof window !== "undefined" ? window.location.origin : "https://app.nivarro.co"}/c/${campaign.slug}`
    : null;

  const copy = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ border: "1px solid var(--border)", background: "var(--surface)", overflow: "hidden" }}>
      <div style={{ aspectRatio: "1200/630", overflow: "hidden", pointerEvents: "none" }}>
        <CampaignCanvas imageParams={campaign.imageParams} />
      </div>
      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15, letterSpacing: "-0.01em", color: "var(--text)", margin: 0, lineHeight: 1.3 }}>{campaign.headline}</h3>
          <span style={{ flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", padding: "2px 8px", background: campaign.pledgeCount > 0 ? "rgba(34,197,94,0.15)" : "var(--n-bg3)", color: campaign.pledgeCount > 0 ? "#22c55e" : "var(--n-text2)" }}>
            {campaign.pledgeCount} pledge{campaign.pledgeCount !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <button
            onClick={() => onToggleActive(!campaign.active)}
            style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: campaign.active ? "#22c55e" : "var(--n-text2)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: campaign.active ? "#22c55e" : "var(--border)", display: "inline-block" }} />
            {campaign.active ? "Active" : "Draft"}
          </button>
          {!campaign.slug && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--n-text2)" }}>— not published</span>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/campaigns/${campaign.id}/edit`} style={{ flex: 1, padding: "6px 0", border: "1px solid var(--border)", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <Pencil size={11} /> Edit
          </Link>
          {publicUrl && (
            <button onClick={copy} style={{ flex: 1, padding: "6px 0", border: "1px solid var(--border)", background: "none", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
              {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy Link</>}
            </button>
          )}
          <button onClick={onDelete} style={{ padding: "6px 10px", border: "1px solid var(--border)", background: "none", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update Sidebar.tsx — change Fundraise link from /campaigns/new to /campaigns**

In `components/layout/Sidebar.tsx`, find the `SCHOOL_NAV` array and change the href:

```typescript
// BEFORE:
{ href: "/campaigns/new", label: "Fundraise", Icon: HeartHandshake },

// AFTER:
{ href: "/campaigns",     label: "Fundraise", Icon: HeartHandshake },
```

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/campaigns/page.tsx" "app/(dashboard)/campaigns/CampaignsListClient.tsx" components/campaigns/CampaignCard.tsx components/layout/Sidebar.tsx
git commit -m "feat: My Campaigns dashboard — grid, pledge counts, active toggle, delete"
```

---

### Task 11: Edit Page + Version History Drawer

**Files:**
- Create: `app/(dashboard)/campaigns/[id]/edit/page.tsx`
- Create: `app/(dashboard)/campaigns/[id]/edit/CampaignEditClient.tsx`
- Create: `components/campaigns/VersionHistoryDrawer.tsx`

- [ ] **Step 1: Create app/(dashboard)/campaigns/[id]/edit/page.tsx**

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import CampaignEditClient from "./CampaignEditClient";
import type { ImageParams } from "@/components/campaigns/CampaignCanvas";

export default async function CampaignEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const campaign = await prisma.campaign.findFirst({
    where: { id, schoolId: session.user.id },
  });
  if (!campaign) notFound();

  const versions = await prisma.campaignVersion.findMany({
    where: { campaignId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, cause: true, headline: true, imageParams: true, restoredFrom: true, createdAt: true },
  });

  return (
    <CampaignEditClient
      campaign={{
        id: campaign.id,
        slug: campaign.slug,
        cause: campaign.cause,
        headline: campaign.headline,
        subheadline: campaign.subheadline,
        body: campaign.body,
        ctaText: campaign.ctaText,
        imageParams: campaign.imageParams as ImageParams,
        videoUrl: campaign.videoUrl,
        active: campaign.active,
      }}
      versions={versions.map((v) => ({
        id: v.id,
        cause: v.cause,
        headline: v.headline,
        imageParams: v.imageParams as ImageParams,
        restoredFrom: v.restoredFrom,
        createdAt: v.createdAt.toISOString(),
      }))}
    />
  );
}
```

- [ ] **Step 2: Create components/campaigns/VersionHistoryDrawer.tsx**

```typescript
"use client";

import { X, RotateCcw } from "lucide-react";
import CampaignCanvas, { type ImageParams } from "./CampaignCanvas";

export interface VersionSummary {
  id: string;
  cause: string;
  headline: string;
  imageParams: ImageParams;
  restoredFrom: string | null;
  createdAt: string;
}

interface Props {
  versions: VersionSummary[];
  onRestore: (versionId: string) => void;
  onClose: () => void;
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
                  {v.restoredFrom && (
                    <span style={{ flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--n-text2)" }}>Restored</span>
                  )}
                </div>
                <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--n-text2)", lineHeight: 1.4 }}>
                  {v.cause.length > 80 ? v.cause.slice(0, 80) + "…" : v.cause}
                </p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--n-text2)" }}>
                    {new Date(v.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
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

- [ ] **Step 3: Create app/(dashboard)/campaigns/[id]/edit/CampaignEditClient.tsx**

```typescript
"use client";

import { useState } from "react";
import { RefreshCw, Loader2, History, Heart, ExternalLink } from "lucide-react";
import CampaignCanvas, { type ImageParams } from "@/components/campaigns/CampaignCanvas";
import PledgeModal from "@/components/campaigns/PledgeModal";
import VersionHistoryDrawer, { type VersionSummary } from "@/components/campaigns/VersionHistoryDrawer";
import { extractVideoId } from "@/lib/video-embed";

interface CampaignData {
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

interface Props {
  campaign: CampaignData;
  versions: VersionSummary[];
}

export default function CampaignEditClient({ campaign: initial, versions: initialVersions }: Props) {
  const [current, setCurrent] = useState(initial);
  const [versions, setVersions] = useState(initialVersions);
  const [causeInput, setCauseInput] = useState(initial.cause);
  const [videoUrl, setVideoUrl] = useState(initial.videoUrl ?? "");
  const [generating, setGenerating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPledge, setShowPledge] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshVersions = async () => {
    const res = await fetch(`/api/campaigns/${current.id}/versions`);
    if (res.ok) setVersions(await res.json() as VersionSummary[]);
  };

  const regenerate = async () => {
    setGenerating(true);
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
      const data = await res.json() as { headline: string; subheadline: string; body: string; ctaText: string; imageParams: ImageParams; videoUrl: string | null };
      setCurrent((prev) => ({ ...prev, ...data }));
      await refreshVersions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  };

  const restore = async (versionId: string) => {
    try {
      const res = await fetch(`/api/campaigns/${current.id}/versions/${versionId}/restore`, { method: "POST" });
      if (!res.ok) throw new Error("Restore failed");
      const data = await res.json() as CampaignData;
      setCurrent((prev) => ({ ...prev, ...data }));
      setCauseInput(data.cause);
      await refreshVersions();
      setShowHistory(false);
    } catch {
      setError("Failed to restore version");
    }
  };

  const embed = current.videoUrl ? extractVideoId(current.videoUrl) : null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", minHeight: "calc(100vh - 56px)" }}>
      {/* Left panel */}
      <div style={{ borderRight: "1px solid var(--border)", padding: 20, background: "var(--surface)", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--amber)" }}>Edit Campaign</span>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {current.slug && (
              <a href={`/c/${current.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--n-text2)", display: "flex" }}>
                <ExternalLink size={13} />
              </a>
            )}
            <button
              onClick={() => setShowHistory(true)}
              style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--n-text2)", background: "none", border: "none", cursor: "pointer" }}
            >
              <History size={13} /> History ({versions.length})
            </button>
          </div>
        </div>

        <div>
          <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--n-text2)", marginBottom: 6 }}>
            Cause Description
          </label>
          <textarea
            value={causeInput}
            onChange={(e) => setCauseInput(e.target.value)}
            rows={8}
            style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, lineHeight: 1.5, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--n-text2)", marginBottom: 6 }}>
            Video URL (optional)
          </label>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" }}
          />
        </div>

        {error && <p style={{ margin: 0, fontSize: 12, color: "#ef4444" }}>{error}</p>}

        <button
          onClick={regenerate}
          disabled={generating || !causeInput.trim()}
          style={{ padding: "10px 0", border: "none", background: generating || !causeInput.trim() ? "var(--n-bg3)" : "var(--amber)", color: generating || !causeInput.trim() ? "var(--n-text2)" : "#000", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: generating || !causeInput.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          {generating
            ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Regenerating…</>
            : <><RefreshCw size={14} /> Regenerate</>}
        </button>
      </div>

      {/* Right panel — live preview */}
      <div style={{ overflowY: "auto" }}>
        <div style={{ borderBottom: "1px solid var(--border)", padding: "8px 20px", background: "var(--surface)" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--n-text2)" }}>Live Preview</span>
        </div>
        <CampaignCanvas imageParams={current.imageParams} />
        {embed && (
          <div style={{ position: "relative", paddingBottom: "56.25%", background: "#000" }}>
            <iframe src={embed.url} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }} allow="autoplay; fullscreen" title="Campaign video" />
          </div>
        )}
        <div style={{ padding: "40px 48px", background: "var(--bg)" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 2.5vw, 38px)", letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 12px", lineHeight: 1.2 }}>{current.headline}</h2>
          <p style={{ fontSize: 17, color: "var(--amber)", fontWeight: 600, margin: "0 0 24px" }}>{current.subheadline}</p>
          <div style={{ fontSize: 14, color: "var(--n-text2)", lineHeight: 1.75, whiteSpace: "pre-wrap", marginBottom: 32 }}>{current.body}</div>
          <button onClick={() => setShowPledge(true)} style={{ padding: "12px 24px", border: "none", background: "var(--amber)", color: "#000", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Heart size={16} /> {current.ctaText}
          </button>
        </div>
      </div>

      {showHistory && (
        <VersionHistoryDrawer versions={versions} onRestore={restore} onClose={() => setShowHistory(false)} />
      )}
      {showPledge && (
        <PledgeModal campaignId={current.id} ctaText={current.ctaText} onClose={() => setShowPledge(false)} />
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/campaigns/[id]/edit/page.tsx" "app/(dashboard)/campaigns/[id]/edit/CampaignEditClient.tsx" components/campaigns/VersionHistoryDrawer.tsx
git commit -m "feat: campaign edit page — split-panel editor + version history drawer"
```

---

### Task 12: Public Campaign Page

**Files:**
- Create: `app/c/[slug]/page.tsx`
- Create: `app/c/[slug]/CampaignPublicClient.tsx`

**Interfaces:**
- Consumes: `prisma.campaign.findUnique({ where: { slug } })`; no auth
- Consumes: `CampaignCanvas`, `PledgeModal`, `extractVideoId`

- [ ] **Step 1: Create app/c/[slug]/page.tsx**

```typescript
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import CampaignPublicClient from "./CampaignPublicClient";
import type { ImageParams } from "@/components/campaigns/CampaignCanvas";

export default async function CampaignPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { slug },
    select: {
      id: true,
      headline: true,
      subheadline: true,
      body: true,
      ctaText: true,
      imageParams: true,
      videoUrl: true,
      active: true,
    },
  });

  if (!campaign || !campaign.active) notFound();

  return (
    <CampaignPublicClient
      campaign={{ ...campaign, imageParams: campaign.imageParams as ImageParams }}
    />
  );
}
```

- [ ] **Step 2: Create app/c/[slug]/CampaignPublicClient.tsx**

```typescript
"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import CampaignCanvas, { type ImageParams } from "@/components/campaigns/CampaignCanvas";
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
      <CampaignCanvas imageParams={campaign.imageParams} />

      {embed && (
        <div style={{ position: "relative", paddingBottom: "56.25%", background: "#000" }}>
          <iframe
            src={embed.url}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
            allow="autoplay; fullscreen; picture-in-picture"
            title="Campaign video"
          />
        </div>
      )}

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "56px 24px" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4vw, 52px)", letterSpacing: "-0.03em", color: "#fff", margin: "0 0 16px", lineHeight: 1.15 }}>
          {campaign.headline}
        </h1>
        <p style={{ fontSize: 20, color: "#e8893a", fontWeight: 600, margin: "0 0 32px", lineHeight: 1.4 }}>
          {campaign.subheadline}
        </p>
        <div style={{ fontSize: 16, color: "rgba(255,255,255,0.75)", lineHeight: 1.8, whiteSpace: "pre-wrap", marginBottom: 48 }}>
          {campaign.body}
        </div>
        <button
          onClick={() => setShowPledge(true)}
          style={{ padding: "16px 36px", border: "none", background: "#e8893a", color: "#000", fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 10 }}
        >
          <Heart size={18} /> {campaign.ctaText}
        </button>
      </div>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: "24px", textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>
          Powered by Nivarro · app.nivarro.co
        </p>
      </div>

      {showPledge && (
        <PledgeModal campaignId={campaign.id} ctaText={campaign.ctaText} onClose={() => setShowPledge(false)} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify the public page has no auth middleware blocking it**

Check `middleware.ts` (or `middleware.js`) in the project root. If it exists and protects all routes, add `/c` to the public paths matcher so `/c/[slug]` is accessible without login.

Run:
```bash
# check if middleware exists
ls C:\Users\thoma\Goal-APP\middleware.ts 2>/dev/null || echo "no middleware"
```

If it exists, read it and ensure the matcher excludes `/c/(.*)`.

- [ ] **Step 4: Commit**

```bash
git add app/c/[slug]/page.tsx app/c/[slug]/CampaignPublicClient.tsx
git commit -m "feat: public campaign page /c/[slug] — canvas, video, story, pledge modal"
```

---

### Task 13: Push + Deploy

- [ ] **Step 1: Build check**

```bash
cd "C:\Users\thoma\Goal-APP"
npx tsc --noEmit
```

Fix any TypeScript errors before proceeding.

- [ ] **Step 2: Push to GitHub**

```bash
git push
```

- [ ] **Step 3: Trigger Render deploy**

```bash
node --use-system-ca -e "
const https = require('https');
const url = new URL(process.env.RENDER_DEPLOY_HOOK_URL || '');
https.get({ hostname: url.hostname, path: url.pathname + url.search }, (r) => {
  console.log('Deploy triggered:', r.statusCode);
});
"
```

The `RENDER_DEPLOY_HOOK_URL` env var should be set — check `C:\Users\thoma\.claude\projects\C--Users-thoma\memory\project_render_deploy.md` for the URL if needed.

- [ ] **Step 4: Smoke test**

1. Log in as `school@nivarro.demo` (or any SCHOOL role account)
2. Visit `/campaigns` — should show empty state with "Create your first campaign"
3. Click "New Campaign" → `/campaigns/new`
4. Type a cause description, click "Generate Campaign Page"
5. Verify canvas graphic renders with the correct pattern
6. Click "Save & Publish" — verify public URL appears
7. Open the public URL in a new incognito window — verify it loads without login
8. Click "Commit to Support" — fill the modal, submit, verify "Pledge Recorded!" confirmation
9. Back in the dashboard, go to `/campaigns/[id]/edit`
10. Change the cause text, click "Regenerate" — verify canvas updates and History count increments
11. Open History drawer — verify past versions appear with thumbnails
12. Click "Restore" on an older version — verify the preview updates

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| Canvas renderer with 4 patterns + seeded PRNG | Task 3 |
| imageParams generated by Claude | Task 5 |
| Draft campaign auto-created on first generate | Task 5 |
| CampaignVersion saved on every generate | Task 5 |
| Publish sets slug + active=true | Task 6 |
| List campaigns with pledge counts | Task 6, 10 |
| Active/inactive toggle | Task 6, 10 |
| Delete campaign | Task 6, 10 |
| GET versions list | Task 7 |
| Restore version (transaction + restoredFrom) | Task 7 |
| Public fetch by slug, no auth | Task 8 |
| pledgeAmount links to campaignId | Task 8 |
| 3-state builder (input → preview → saved) | Task 9 |
| Regenerate reuses campaignId | Task 9 |
| My Campaigns grid | Task 10 |
| CampaignCard with thumbnail | Task 10 |
| Sidebar Fundraise → /campaigns | Task 10 |
| Split-panel edit page | Task 11 |
| VersionHistoryDrawer | Task 11 |
| Public page /c/[slug] | Task 12 |
| Video embed (YouTube + Vimeo) | Task 12, 9, 11 |
| Pledge modal shared | Task 4 |

**Placeholder scan:** None found — all steps contain actual code.

**Type consistency:** `ImageParams` exported from `CampaignCanvas.tsx` and imported consistently in all consumers. `VersionSummary` exported from `VersionHistoryDrawer.tsx` and used in `CampaignEditClient.tsx`. `params` uses `Promise<{ id: string }>` pattern (Next.js 15 async params).
