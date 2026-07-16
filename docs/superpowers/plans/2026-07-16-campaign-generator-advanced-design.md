# AI Fundraising Page Generator — Advanced Editing, Feedback Tweaking & Hero Redesign

**Date:** 2026-07-16
**Status:** Approved, pending implementation plan

## Problem

The current AI Fundraising Page Generator (`/campaigns/new`, `/campaigns/[id]/edit`) has two gaps:

1. **All-or-nothing editing.** The only way to change generated copy is "Regenerate," which re-runs the original Claude prompt from scratch and replaces headline/subheadline/body/CTA entirely. There's no way to fix one sentence, tighten the CTA, or nudge the tone without losing everything else that was already good.
2. **Weak visuals and generic copy.** The hero "image" is a flat procedural canvas (4 abstract shape patterns at low opacity) rendered as a separate strip above a plain text block — it doesn't read as a real hero image, all campaigns end up looking similar, and text sits below the art instead of on it. Separately, the Claude copywriting prompt asks for generic "punchy headline" / "motivating sentence" without pushing for actual persuasive, specific fundraising copy.

## Goals

- Let school admins tweak a generated campaign incrementally: direct inline field editing, and natural-language AI feedback that revises in place instead of regenerating from scratch.
- Keep the existing full "Regenerate" (start over from the cause description) as an escape hatch.
- Preserve and extend the existing version history (`CampaignVersion` + restore) so every kind of change — generate, tweak, manual edit, restore — is snapshotted and labeled.
- Redesign the hero so the generative art and headline/subheadline form one cohesive image, applied consistently in the new-campaign preview, the edit page, and the live public page.
- Expand visual variety via a composable, continuous-parameter layer system (not a small fixed enum) so the space of distinct-looking heroes is effectively unlimited, while staying fully procedural/canvas-based (no image-generation API, no added cost).
- Rewrite the copywriting prompt (used by both generate and tweak) to produce persuasive, specific fundraising copy rather than generic filler.

## Non-goals

- No real photography / external image API (Unsplash, DALL·E, etc.) — stays canvas-only per the existing no-image-API-cost direction.
- No multi-turn conversational memory of feedback (each tweak is a single-shot revision using current state + new feedback text, not a chat thread).
- No per-field feedback UI (separate feedback box per field) — one feedback box, Claude infers which field(s) to touch from the text.
- No new hero *layout* picker (split-screen vs. overlay vs. stacked) — one redesigned overlay-style hero, with variety coming from the composable layer system instead of layout choice.

## Design

### 1. Copywriting prompt rewrite

Both `POST /api/campaigns/generate` and the new tweak endpoint use a shared prompt-building function (`lib/campaign-prompt.ts`, new file) that asks Claude for:

- A headline that names the concrete ask or stakes (not a generic slogan).
- A subheadline that states a specific, credible detail pulled from the cause text (a number, a place, a deadline).
- Body copy following a short persuasive arc: concrete situation → why it matters now → what the funds specifically buy → a direct ask — 3-4 paragraphs, same as today's length budget.
- A CTA that implies urgency/specificity over generic "Donate Now" phrasing (existing `ctaText` field, same shape).

This changes prompt wording only — response JSON shape for copy fields is unchanged.

### 2. Hero visual system: composable layers, continuous parameters

Rather than picking from a small fixed enum (which caps variety at a countable number of looks), `ImageParams` becomes a stack of 1-4 independent **layers**, each with continuous-valued parameters. The shape algorithms (geometric/wave/burst/organic — existing, unchanged math) become *building blocks* that get composed, blended, and finished differently every time, rather than a single mutually-exclusive choice:

```ts
interface ImageParams {
  seed: number;
  bg: string;
  palette: string[];
  accent: string;
  layers: PatternLayer[];       // 1-4 layers, stacked in order
  grain: number;                 // 0-1 continuous noise-texture intensity
  glow: number;                  // 0-1 continuous blur/bloom amount
}

interface PatternLayer {
  type: "geometric" | "wave" | "burst" | "organic";
  blend: "normal" | "screen" | "multiply" | "overlay"; // canvas globalCompositeOperation
  density: number;    // 0-1
  scale: number;      // 0.5-2, size multiplier for this layer's shapes
  opacity: number;    // 0-1
  rotation: number;   // 0-360 degrees, layer-level rotation
  paletteOffset: number; // rotates which palette color this layer starts from
}
```

Because `layers.length`, each layer's five continuous parameters, and the two global continuous knobs (`grain`, `glow`) are all free-valued (not enum picks), the combinatorial space is effectively unlimited rather than a countable 16 (or any fixed N). A single-layer, high-grain, low-glow organic shape reads as intimate/documentary; three layers (geometric + burst + wave) blended with `screen` and high `glow` reads as an energetic aurora-style glow; a single sparse geometric layer with near-zero density and high `grain` reads as minimal/editorial — and everything in between is reachable, not just those named examples.

Claude's generation prompt is given qualitative *guidance* (more layers + `screen`/`overlay` blend + high `glow` → energetic/vibrant moods; fewer layers + high `grain` + low `glow` → intimate/documentary moods; low `density` + few layers → minimal/confident moods) but chooses the actual numeric values itself per cause — it is not constrained to a fixed menu of combinations.

`CampaignCanvas` is updated to:
1. Render each layer in `layers[]` using the existing shape algorithms (geometric/wave/burst/organic — unchanged per-layer math, just parameterized by that layer's density/scale/rotation/paletteOffset), composited in order using each layer's `blend` mode and `opacity`.
2. Apply `grain` as a procedural noise-texture overlay scaled by its 0-1 value, and `glow` as a canvas `ctx.filter = "blur(Npx)"` bloom pass scaled by its 0-1 value.
3. Replace the fixed linear-gradient scrim with a contrast-aware scrim: compute background luminance from `bg` hex and scale the dark-overlay gradient stops so overlaid text stays readable regardless of chosen palette or layer composition.

Old `imageParams` rows using the previous flat shape (`pattern`/`shapes`/`density` at the top level, no `layers`) are rendered via a small compatibility shim: wrapped into a single-layer equivalent (`layers: [{ type: pattern, blend: "normal", density, scale: 1, opacity: 1, rotation: 0, paletteOffset: 0 }]`, `grain: 0`, `glow: 0`) so existing published campaigns keep rendering unchanged — no backfill migration needed since it's a `Json` column.

### 3. Unified hero component

New `components/campaigns/CampaignHero.tsx` renders `CampaignCanvas` as a full-bleed background with headline + subheadline absolutely-positioned on top (bold display type, sized via `clamp()`, using the contrast-aware scrim from #2 for legibility). Takes an `editable` prop:

- `editable=false` (public page): plain overlay text.
- `editable=true` (new-campaign preview, edit page): headline/subheadline become click-to-edit fields directly in the overlay (same interaction model as the body/CTA editing in #4).

Used in all three surfaces: `CampaignsNewClient` (preview step), `CampaignEditClient` (edit page), `CampaignPublicClient` (public page — the surface visitors actually see, so this is the one that matters most for the "does it look convincing" goal).

### 4. Inline editing + AI feedback tweaking

**Shared editor component.** `CampaignsNewClient`'s preview step and `CampaignEditClient` currently duplicate the same hero+content+CTA JSX. Both are refactored to use one new `components/campaigns/CampaignEditor.tsx`, taking the campaign data, a `mode: "preview" | "edit"` flag (controls whether Publish or "already live" chrome shows), and callbacks for save/tweak/regenerate/restore.

**Direct inline editing:**
- Headline/subheadline (via `CampaignHero editable`), body, and CTA text render as click-to-edit fields (click → becomes a text input/textarea in place, blur/Enter commits to local state).
- Local edits are tracked in a dirty-state diff; a "Save Changes" button appears only when dirty.
- Saving calls `PATCH /api/campaigns/[id]` (new endpoint) with only the changed fields — a plain DB update, no Claude call — then creates one `CampaignVersion` snapshot labeled as a manual edit.

**AI feedback tweaking:**
- A "Tweak with AI" input + Apply button sits next to the existing Regenerate button.
- Submits to `POST /api/campaigns/[id]/tweak` (new endpoint): loads the campaign's current headline/subheadline/body/ctaText/imageParams, sends Claude one message containing the current JSON plus the user's feedback text, instructed to revise only what the feedback implies and preserve everything else exactly (including `imageParams` unless the feedback references visuals/colors), returning the same JSON shape as generate.
- Response updates the `Campaign` row and creates a `CampaignVersion` snapshot labeled as a tweak, storing the feedback text.
- Existing "Regenerate" (full redo from the cause description, calling the existing `generate` endpoint) is kept, relabeled "Start Over from Description" so it reads as the more destructive option relative to the lighter tweak/edit paths.

**Version history labeling.** `CampaignVersion` gains two columns:
```prisma
source String  @default("generate") // "generate" | "tweak" | "manual" | "restore"
note   String? // feedback text for tweaks; null for generate/manual/restore
```
All four write paths (`generate`, new `tweak`, new manual `PATCH`, existing `restore`) set `source` accordingly; `tweak` also sets `note` to the feedback text. `VersionHistoryDrawer` shows a small badge per entry (Generated / Tweaked: "<note>" / Manual edit / Restored) instead of just headline + timestamp, and the versions `GET` endpoint selects the two new columns.

### Data flow summary

```
generate (full)  -> Claude (persuasive prompt) -> Campaign + CampaignVersion(source=generate)
tweak (feedback) -> Claude (current JSON + feedback) -> Campaign + CampaignVersion(source=tweak, note=feedback)
manual edit      -> direct DB update (no Claude) -> Campaign + CampaignVersion(source=manual)
restore          -> copy from CampaignVersion -> Campaign + CampaignVersion(source=restore, restoredFrom=id)
```

## Schema changes

```prisma
model CampaignVersion {
  ...
  source       String   @default("generate")
  note         String?
}
```
Requires a manual migration (per existing project convention — `prisma migrate deploy` runs at startup via `scripts/start.js`).

`ImageParams` TypeScript type is restructured to the `layers[]` + `grain` + `glow` shape described above. No DB migration needed — it's stored in the `Json` column, not a typed DB column — but a compatibility shim in `CampaignCanvas` normalizes pre-existing flat-shape rows into the new layer format at render time (see §2).

## New/changed files (implementation-plan input, not exhaustive)

- `lib/campaign-prompt.ts` (new) — shared persuasive-copy prompt builder + layer/mood guidance
- `components/campaigns/CampaignCanvas.tsx` — layer compositing engine, grain/glow passes, contrast-aware scrim, legacy-shape compatibility shim
- `components/campaigns/CampaignHero.tsx` (new) — unified overlay hero, editable/non-editable modes
- `components/campaigns/CampaignEditor.tsx` (new) — shared editing UI (inline fields, tweak box, regenerate, save)
- `components/campaigns/VersionHistoryDrawer.tsx` — badges for source/note
- `app/api/campaigns/generate/route.ts` — use shared prompt builder, set `source: "generate"`
- `app/api/campaigns/[id]/tweak/route.ts` (new)
- `app/api/campaigns/[id]/route.ts` (new) — `PATCH` for manual edits
- `app/api/campaigns/[id]/versions/route.ts` — select new columns
- `app/api/campaigns/[id]/versions/[versionId]/restore/route.ts` — set `source: "restore"`
- `app/(dashboard)/campaigns/new/CampaignsNewClient.tsx` — use `CampaignEditor`
- `app/(dashboard)/campaigns/[id]/edit/CampaignEditClient.tsx` — use `CampaignEditor`
- `app/c/[slug]/CampaignPublicClient.tsx` — use `CampaignHero` (non-editable)
- `prisma/schema.prisma` + new manual migration

## Open questions

None — all resolved during brainstorming. `style` defaulting and non-goals above capture the scope boundaries explicitly to avoid ambiguity during implementation.
