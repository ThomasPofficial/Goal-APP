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
- Expand visual variety via an independent `pattern` × `style` system (16 combinations) so different causes produce visually distinct pages, while staying fully procedural/canvas-based (no image-generation API, no added cost).
- Rewrite the copywriting prompt (used by both generate and tweak) to produce persuasive, specific fundraising copy rather than generic filler.

## Non-goals

- No real photography / external image API (Unsplash, DALL·E, etc.) — stays canvas-only per the existing no-image-API-cost direction.
- No multi-turn conversational memory of feedback (each tweak is a single-shot revision using current state + new feedback text, not a chat thread).
- No per-field feedback UI (separate feedback box per field) — one feedback box, Claude infers which field(s) to touch from the text.
- No new hero *layout* picker (split-screen vs. overlay vs. stacked) — one redesigned overlay-style hero, with variety coming from the pattern/style dimensions instead of layout choice.

## Design

### 1. Copywriting prompt rewrite

Both `POST /api/campaigns/generate` and the new tweak endpoint use a shared prompt-building function (`lib/campaign-prompt.ts`, new file) that asks Claude for:

- A headline that names the concrete ask or stakes (not a generic slogan).
- A subheadline that states a specific, credible detail pulled from the cause text (a number, a place, a deadline).
- Body copy following a short persuasive arc: concrete situation → why it matters now → what the funds specifically buy → a direct ask — 3-4 paragraphs, same as today's length budget.
- A CTA that implies urgency/specificity over generic "Donate Now" phrasing (existing `ctaText` field, same shape).

This changes prompt wording only — response JSON shape for copy fields is unchanged.

### 2. Hero visual system: `pattern` × `style`

`ImageParams` (currently `{ seed, bg, palette, accent, pattern, shapes, density }`) gains a `style` field:

```ts
style: "aurora" | "grain" | "duotone" | "mono"
```

- **pattern** (existing, unchanged logic) chooses the shape algorithm: geometric / wave / burst / organic.
- **style** (new) chooses the finish applied on top:
  - `aurora` — soft blurred glowing color blobs via canvas `ctx.filter = "blur(Npx)"`, dark background, vibrant palette.
  - `grain` — muted palette + procedural noise texture overlay (per-pixel or tiled noise pattern), editorial/documentary feel.
  - `duotone` — two-color high-contrast treatment: background flattened to two palette colors via a duotone-style pass over the shape layer.
  - `mono` — minimal: one accent color on a light/neutral field, shapes rendered sparse and small (low density), leaving room for bold overlaid type.

Claude's generation prompt picks both `pattern` and `style` based on the cause's mood (guidance table extended, e.g. environment/water → `wave` + `aurora`; sports/energy → `burst` + `duotone`; community/people → `organic` + `grain`; education/tech → `geometric` + `mono`). This is prompt guidance, not a hard rule — Claude may pick any valid combination.

`CampaignCanvas` is updated to:
1. Render the existing pattern shape logic (geometric/wave/burst/organic — unchanged functions).
2. Apply the `style` finish as a compositing pass (blur+glow for aurora, noise overlay for grain, duotone remap, or sparse/minimal treatment for mono).
3. Replace the fixed linear-gradient scrim with a contrast-aware scrim: compute background luminance from `bg` hex and scale the dark-overlay gradient stops so overlaid text stays readable regardless of chosen palette.

Old `imageParams` rows without a `style` field default to `"aurora"` at render time (no backfill migration needed — `CampaignCanvas` treats missing `style` as `"aurora"`).

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

`ImageParams` TypeScript type gains `style: "aurora" | "grain" | "duotone" | "mono"`, defaulted to `"aurora"` at render time for pre-existing rows with no migration needed (it's stored in the `Json` column, not a typed DB column).

## New/changed files (implementation-plan input, not exhaustive)

- `lib/campaign-prompt.ts` (new) — shared persuasive-copy prompt builder + pattern/style mood guidance
- `components/campaigns/CampaignCanvas.tsx` — add `style` compositing pass, contrast-aware scrim
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
