# Profile Achievements & Projects — Design Spec

**Date:** 2026-08-13
**Status:** Approved, ready for planning

## Summary

Students can currently only see their org project history via private "Reviews" on their own profile. This adds two new **public** profile sections — **Projects** (curated pins of completed work already tracked in the system) and **Achievements** (free-text entries for things not tracked elsewhere, like awards or certifications) — so a profile becomes a real portfolio, visible to any viewer.

As part of the same pass, the **Animal Archetypes** feature is fully removed from the profile, following the same teardown pattern as the recent Genius Type removal (commit `e07d599` and preceding commits on `main`).

## Pre-condition

`main` is currently mid-merge (`git status` shows unresolved `<<<<<<<` conflicts in 5 files, left over from the "remove-genius-type" merge: `app/(dashboard)/layout.tsx`, `app/(dashboard)/my-school/SchoolHubClient.tsx`, `app/(dashboard)/school/roster/page.tsx`, `app/api/school/roster/members/route.ts`, `app/api/school/roster/route.ts`). This must be resolved before starting implementation — the schema migration and code changes here need to land on a clean `main`, not on top of unresolved conflict markers.

## Scope decisions (from brainstorming)

- **Projects** surface existing data — no manual re-entry. Two sources: self-organized `Project` records (status `COMPLETED`) and org-run `OrgProject` engagements (student's team `ACCEPTED` + project `closedAt` set).
- Students **curate** which completed projects show (pin/unpin) — not automatic.
- **Achievements** are new free-text entries (title, description, date, link) — for things with no existing model (awards, competitions, certifications).
- Both sections are **public** (visible to any profile viewer), unlike the existing "Reviews" section which is owner-only.
- No image support in v1 — there's no file-upload infrastructure in the app (`avatarUrl` is a plain pasted URL string; no upload endpoint or storage provider exists anywhere in the codebase). A link field covers "point to a certificate/article/etc." without new infra.
- No manual reordering — both sections sort reverse-chronologically.
- Animal Archetypes is removed in full (schema, API, UI, lib, seed data) as part of this same spec, at the user's request — not deferred to a separate spec, despite being an unrelated concern, because the user explicitly chose to bundle it.

## 1. Data model

```prisma
model Achievement {
  id          String    @id @default(cuid())
  profileId   String
  title       String
  description String?
  link        String?
  achievedAt  DateTime?   // optional; sort key, falls back to createdAt
  createdAt   DateTime  @default(now())

  profile Profile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@index([profileId])
}

model ProfileHighlight {
  id           String   @id @default(cuid())
  profileId    String
  projectId    String?     // self-organized Project (status COMPLETED)
  orgProjectId String?     // org-run OrgProject (accepted + closed)
  pinnedAt     DateTime @default(now())

  profile    Profile     @relation(fields: [profileId], references: [id], onDelete: Cascade)
  project    Project?    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  orgProject OrgProject? @relation(fields: [orgProjectId], references: [id], onDelete: Cascade)

  @@unique([profileId, projectId])
  @@unique([profileId, orgProjectId])
}
```

`ProfileHighlight` rows have exactly one of `projectId` / `orgProjectId` set — enforced at the application layer (not a DB constraint), since Prisma has no native XOR check. Real FKs (not a polymorphic `refId`) so cascade-delete works if the underlying `Project`/`OrgProject` is ever deleted, and both can be `include`d directly without manual reassembly.

**Eligibility for pinning** (computed at read-time, not stored):
- Self-organized: `Project` where the student is a `ProjectMember` and `status = COMPLETED`.
- Org-run: `OrgProject` where the student's `Team` has a `TeamApplication` with `status = ACCEPTED` and `OrgProject.closedAt` is set.

## 2. API routes

- `POST /api/achievements` — create. `title` required; `description`, `link`, `achievedAt` optional. `profileId` resolved from session, never trusted from the body.
- `PATCH /api/achievements/[id]` — edit. 404 unless the achievement's profile belongs to the caller.
- `DELETE /api/achievements/[id]` — same ownership check.
- `GET /api/profile/eligible-highlights` — returns the caller's own unpinned eligible completions (both kinds), for the pin picker. Own-profile only.
- `POST /api/profile-highlights` — body `{ projectId }` or `{ orgProjectId }`. Server re-validates eligibility before inserting — never trusts the picker list alone. The `@@unique` constraints make a duplicate pin a no-op/409, not a duplicate row.
- `DELETE /api/profile-highlights/[id]` — unpin; ownership check.

`app/api/profile/[handle]/route.ts` and `app/(dashboard)/profile/[handle]/page.tsx` extend their `select`/`include` to fetch `achievements` (ordered by `achievedAt` desc, `createdAt` desc as tiebreak) and `profileHighlights` (with `project` / `orgProject.org` included) for **any** viewer, not gated to `isOwn` — both sections are public.

## 3. UI — `ProfileClient.tsx`

Two new sections, placed after **Interests** and before the `isOwn`-only sections (Background, Reviews). Both render if there's content, or if `isOwn` (so the owner sees the empty/add state).

**Projects:**
- Pinned items render as compact cards — title, and for org-run ones the org name/logo (reusing the existing small logo-letter pattern from the Reviews section).
- `isOwn`: "+ Pin a project" button opens a modal listing eligible unpinned completions (from `/api/profile/eligible-highlights`), each with a "Pin" action. Empty state: "Complete a project to pin it here."
- `isOwn`: each pinned card gets an unpin (×) affordance.

**Achievements:**
- Each item: title, formatted date (if set), description, link rendered as "View →" if present.
- `isOwn`: "+ Add achievement" expands an inline form (title, date, link, description — same input styling as the existing Edit Profile drawer) directly in the section, not a separate drawer.
- `isOwn`: delete (×) per item. No edit-in-place for v1 — delete and re-add covers corrections.

Both sections follow the existing visual language (`#16161a`/`#2a2a33` cards, `text-xs uppercase tracking-wider` headers).

## 4. Animal Archetypes removal

**Delete entirely:**
- `lib/animalArchetypes.ts`
- `lib/runArchetypeAnalysis.ts`
- `app/api/profile/[handle]/analyze-archetype/route.ts`
- `components/AnimalArchetypeCard.tsx`

**Schema migration:** drop `Profile.animalArchetypes`, `Profile.archetypeAnalysis`, `Profile.archetypeUpdatedAt`.

**Edit:**
- `ProfileClient.tsx` — remove the Animal Archetypes section, its state (`archetypes`, `archetypeAnalysis`, `analyzingArchetype`, `archetypeError`), the `analyzeArchetype` function, and now-dead imports/interface fields.
- `app/(dashboard)/profile/[handle]/page.tsx` — drop the archetype fields from both `select` blocks and the `archetypeUpdatedAt.toISOString()` mapping (appears twice).
- `app/api/org-projects/[id]/reviews/route.ts` — remove the block that auto-triggers `runArchetypeAnalysis` after a qualifying review, and its import.
- `app/api/admin/seed-demo-accounts/route.ts` — remove the seeded `animalArchetypes`/`archetypeAnalysis`/`archetypeUpdatedAt` fields (4 profiles: priya, marcus, zoe, elena).

Confirmed via repo-wide search: no other production files reference these symbols (only hits outside the above were in stale `.claude/worktrees/*` copies).

## 5. Error handling & verification

- All mutation routes resolve `profileId`/ownership from the session server-side, never from the request body; 404 on records not owned by the caller.
- Pin creation re-validates eligibility server-side even though the picker only lists eligible items.
- `title` required on Achievement (400 if blank); `link` validated as well-formed URL if present (400 if not).
- No automated test framework exists in this repo. Verification: `npx tsc --noEmit` clean, `npm run lint` clean, migration applies cleanly, then manual QA — add/delete an achievement, pin/unpin both an org-run and self-organized completed project, confirm public visibility (viewer who isn't the owner still sees both sections), and confirm Animal Archetypes is fully gone with no console errors.
