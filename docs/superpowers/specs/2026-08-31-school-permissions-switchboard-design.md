# School Permissions Switchboard — Design

**Date:** 2026-08-31
**Status:** Approved, ready for implementation plan

## Problem

Nivarro schools have exactly one authenticated admin account (`role: "SCHOOL"`), plus a `STAFF` role with tier-based delegated permissions, built in the Faculty Permission Tiers feature (`docs/superpowers/plans/2026-08-11-faculty-permission-tiers.md`, `lib/facultyPermissions.ts`, `lib/school-auth.ts`, `/school/staff`). That system only covers two feature areas (roster, campaigns) and has no concept of more than one full admin per school. The school wants:

1. Permission coverage extended to every school-admin feature area, not just roster/campaigns.
2. Per-person fine-tuning that can both grant extra and **revoke** capabilities a person's tier would otherwise give them (today's system is additive-only).
3. Multiple co-equal full admins ("Core Admins") for a school, not just one sole `SCHOOL` account — with a clear answer to how they're created and whether they can remove each other.
4. A proper dedicated settings surface for all of this, not a single page bolted onto the sidebar.

This design extends the existing tier/capability system rather than replacing it — no other account type (`ORG`, `ADMIN`, `STUDENT`) currently needs delegated permissions, so a general-purpose ACL rewrite would be speculative scope with no second consumer.

## Key architectural constraint

Nivarro has no separate `School` table. A school's identity **is** its single `SCHOOL`-role `User` row — every school-scoped record (`Profile.schoolId`, `FacultyTier.schoolId`, roster entries, campaigns, mentorship threads, partnership requests) stores that literal `User.id` as its foreign key. This means "multiple admins" cannot mean "multiple `SCHOOL`-role rows" — that would fragment one school into several. Instead, additional full admins are `STAFF`-role accounts (already scoped to a school via `profile.schoolId`) carrying a new flag that grants them Owner-equivalent power without being the data anchor.

## Roles & the Owner/Core Admin model

- **Owner** — the original `SCHOOL`-role account. Permanent: it is the literal anchor for every record in the school, so it can never be demoted or removed through this feature. Always has every capability and full admin-management power, unconditionally (same as today).
- **Core Admin** (new) — a `STAFF`-role account with `profile.isCoreAdmin = true`. Bypasses the tier/capability system entirely: implicitly has all capabilities, can create/edit/rename/delete `FacultyTier` definitions, can promote or demote any *other* Core Admin, and can grant/revoke `staff:manage` freely. Cannot demote or remove the Owner.
- **Staff (tiered or custom)** — unchanged concept: governed by the capability matrix below, via a tier and/or personal overrides/revocations.

**Promotion:** the Owner or any existing Core Admin can promote an existing `STAFF` member to Core Admin, or invite a brand-new person directly as one.

**Demotion — symmetric peers:** any Core Admin, including a newly promoted one, can demote any *other* Core Admin. Demotion returns them to whatever tier/custom permissions they had before promotion (preserved, not wiped — store the prior `staffTierId`/`staffPermissionOverrides` unchanged; promotion only sets the flag, it doesn't clear tier data). No Core Admin, however senior, can demote or remove the Owner. There is no lockout risk from mutual demotion — the Owner always exists as a fallback re-promoter.

**Privilege boundary:** a plain `staff:manage` capability holder (not a Core Admin) can invite staff and reassign existing tiers, and can grant/revoke any of the 9 non-`staff:manage` capabilities on a specific person's overrides/revocations — but cannot grant/revoke `staff:manage` itself, cannot create/edit tier definitions, and cannot promote/demote Core Admins. Those three actions require Core Admin (or Owner) status. This is the same shape as today's rule, just generalized: "editing `staff:manage` or the admin roster is Core-Admin-only; everything else a `staff:manage` holder can already touch stays touchable."

## Capabilities (expanded from 5 to 10)

| Capability | Governs |
|---|---|
| `roster:view` | View roster (unchanged) |
| `roster:edit` | Add/edit/delete/import roster, resend roster invites (unchanged, now also covers the resend-invite route which was hard-`SCHOOL`-gated) |
| `campaigns:view` | View fundraising campaigns (unchanged) |
| `campaigns:edit` | Create/manage campaigns (unchanged) |
| `mentorship:view` | View mentor/student pairings and threads (`/school/mentorship` API, Mentorship tab in `/school/alumni`) |
| `mentorship:edit` | Create/edit pairings |
| `partnerships:view` | View the partnership/connection request queue and history (`/school/partnerships`, `/school/connections`) |
| `partnerships:edit` | Approve/reject partnership and connection requests |
| `community:manage` | Access the school's community admin panel and set the school join code (`/communities`, `/api/communities/school-code`) — single toggle, not split view/edit, since it's one small action rather than a workflow |
| `staff:manage` | Invite staff, assign existing tiers/custom permissions to people (unchanged). Grant/revoke of this specific capability, and all admin-roster actions, are Core-Admin-only regardless of who holds it. |

## Default tiers (seeded per school on first use, fully editable after — unchanged mechanism, updated defaults)

| Tier | roster | campaigns | mentorship | partnerships | community | staff:manage |
|---|---|---|---|---|---|---|
| Principal | view+edit | view+edit | view+edit | view+edit | ✓ | ✓ |
| Guidance Counselor | view+edit | view | view+edit | view | | |
| IT Manager | view+edit | | | | | ✓ |
| Teacher | view | | | | | |

These remain starting points — a Core Admin can rename, edit, delete, or add tiers freely via the Permissions tab.

## Data model changes

```prisma
enum UserRole {
  STUDENT
  ORG
  ADMIN
  SCHOOL
  STAFF   // unchanged
}

model Profile {
  // ...existing fields unchanged...
  staffTierId                String?      // unchanged
  staffTier                  FacultyTier? @relation(fields: [staffTierId], references: [id])
  staffPermissionOverrides   String       @default("[]") // unchanged: additive grants
  staffPermissionRevocations String       @default("[]") // NEW: JSON array of capability strings to subtract from the tier's grants
  isCoreAdmin                Boolean      @default(false) // NEW
  staffInvited               Boolean      @default(false) // unchanged
}
```

Manual SQL migration required for the two new `Profile` columns (per project convention — `prisma generate` alone won't produce the migration file Render applies on deploy):
`ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "staffPermissionRevocations" TEXT NOT NULL DEFAULT '[]';`
`ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "isCoreAdmin" BOOLEAN NOT NULL DEFAULT false;`

`FacultyTier` is unchanged (still just `id`, `schoolId`, `name`, `permissions`, `isSystemDefault`, timestamps).

## Effective permissions logic (`lib/facultyPermissions.ts`)

`computeEffectivePermissions` gains a `revocations` argument:

```ts
export function computeEffectivePermissions(args: {
  tierPermissions: string | null | undefined;
  overrides: string | null | undefined;
  revocations: string | null | undefined;
}): Capability[] {
  const overrides = parseCapabilityList(args.overrides);
  const revocations = parseCapabilityList(args.revocations);
  if (!args.tierPermissions) {
    // No tier: overrides ARE the complete set. Revocations are meaningless here
    // (nothing to revoke below) and ignored/cleared by the UI in this state.
    return overrides;
  }
  const tierPerms = parseCapabilityList(args.tierPermissions);
  const granted = new Set([...tierPerms, ...overrides]);
  for (const r of revocations) granted.delete(r);
  return Array.from(granted);
}
```

`CAPABILITIES` grows to the 10 listed above; `DEFAULT_TIERS` updated to the new defaults table.

## Enforcement (`lib/school-auth.ts`)

`requireSchoolCapability(capability)` gains a third branch:

- `role === "SCHOOL"` or `role === "ADMIN"` → always authorized (unchanged).
- `role === "STAFF"` and `profile.isCoreAdmin` → always authorized (**new**).
- `role === "STAFF"` (not Core Admin) → authorize on `computeEffectivePermissions(tier, overrides, revocations)` (unchanged shape, now revocation-aware).
- else → 403.

New `requireCoreAdmin()` helper (same shape as `getSchoolSession` today) for the three Core-Admin-only actions: tier CRUD, admin promote/demote, and granting/revoking `staff:manage` specifically. Replaces the plain `getSchoolSession()` calls currently in `app/api/school/staff/tiers/route.ts` and `[tierId]/route.ts`.

**Routes to sweep from hard `role !== "SCHOOL"` / `getSchoolSession()` checks to `requireSchoolCapability`:**

| Route | New capability |
|---|---|
| `app/api/school/mentorship/route.ts` (GET) | `mentorship:view` |
| `app/api/school/mentorship/route.ts` (POST, pairing) | `mentorship:edit` |
| `app/api/school/mentorship/[conversationId]/route.ts` | `mentorship:view`/`mentorship:edit` per method |
| `app/(dashboard)/school/partnerships/page.tsx` | `mentorship:view` OR `partnerships:view` (see note below) |
| `app/api/school/partnerships/[id]/approve/route.ts`, `reject/route.ts` | `partnerships:edit` |
| `app/api/school/connections/route.ts` (GET) | `partnerships:view` |
| `app/api/school/connections/[id]/approve/route.ts` | `partnerships:edit` |
| `app/(dashboard)/communities/page.tsx` (`isAdmin` panel) | `community:manage` |
| `app/api/communities/school-code/route.ts` | `community:manage` |
| `app/api/school/roster/members/[userId]/resend-invite/route.ts` | `roster:edit` |

**Correction to note on `/school/partnerships`:** this single page (`SchoolPartnershipsClient.tsx`) is actually three sections in one — mentorship pairing creation/ending (calls `/api/school/mentorship`), partnership request approval, and legacy 1:1 connection-request approval (both of the latter call the `partnerships`/`connections` APIs). It is not, as an earlier draft of this doc assumed, hosted inside the Alumni Net page — Alumni Net (`/school/alumni`) is a separate, read-only alumni directory that merely *displays* mentorship-group badges for context and stays out of scope (unchanged, still `SCHOOL`/`ADMIN`-only, not part of this feature). The page itself is reachable by anyone with `mentorship:view` OR `partnerships:view`; each section inside it independently hides/shows based on which of the four capabilities (`mentorship:view/edit`, `partnerships:view/edit`) the viewer actually has — someone with only `mentorship:edit` sees just the pairing tool, someone with only `partnerships:view` sees the request queues read-only, etc.

Routes/actions that stay `requireCoreAdmin()`-gated (not opened to plain `staff:manage`): `app/api/school/staff/tiers/route.ts`, `[tierId]/route.ts` (tier CRUD), the new admin promote/demote endpoint, and the `staff:manage` field specifically inside the per-person permission editor.

Everywhere one of these routes currently trusts `session.user.id` directly as `schoolId` (`connections`, `partnerships` approve/reject), switch to the `schoolId` returned by `requireSchoolCapability`/`requireCoreAdmin`, so a Core Admin or capable `STAFF` acting on behalf of the school resolves to the Owner's `schoolId`, not their own id — same fix already applied in the roster/staff routes.

**Enforcement principle:** every capability check above is a server-side gate on the API route (or the page's server component, for pages with no separate API). Client-side hiding of nav entries, tabs, or sections is a UX convenience only — never the actual boundary. This matches how the earlier donation-eligibility bug in this codebase was fixed (`lib/donationEligibility.ts`): a shared component/page silently inheriting reach it wasn't meant to have because a check existed only in the UI layer, not the API.

## New admin-management endpoints

- `GET /api/school/admins` — list the Owner + all Core Admins.
- `PATCH /api/school/admins/[userId]` — `{ isCoreAdmin: boolean }`. Guarded by `requireCoreAdmin()`. Rejects if `userId` is the Owner (`role === "SCHOOL"`) or refers to a user outside this school. Promoting a `STUDENT`-role pending invite is not allowed — must already be `STAFF` (i.e., must have accepted their invite first); promotion happens from the Staff tab or Admins tab once they're active.

## Invite/create form update

`POST /api/school/staff` gains optional `name` and `title` fields (in addition to existing `email` + `tierId`/`customPermissions`), and an optional `makeCoreAdmin` boolean (only honored if the caller is a Core Admin/Owner — silently ignored otherwise, same defensive pattern as other capability checks). Pre-fills `User.name` and `Profile.staffTitle` on the created/updated row. The invitee can still edit their own name/title on the accept-invite page — the admin's entry is a starting point, not a lock.

## UI: the Settings surface

`/school/staff` is restructured into a tabbed settings page (keeping the existing URL so no redirect/bookmark churn — same pattern as `/school/connections` → `/school/partnerships`), with its sidebar label changed from **"Staff"** to **"Settings"**. Visible to the Owner, any Core Admin, and any `STAFF` with at least one manageable capability (`staff:manage` at minimum to see the Staff tab).

**Tab 1 — Staff** (visible to anyone with `staff:manage`, or Core Admin/Owner):
- Invite form: email, name, title, then tier-or-custom picker (unchanged mechanic), plus a "Make Core Admin" checkbox visible only to Core Admin/Owner callers.
- Active staff list: each row expandable into a **3-state capability grid** — for a tiered person, each of the 10 capabilities shows as:
  - *Inherited (checked, dimmed)* — granted by their tier; clicking it adds a revocation, turning it off for this person only.
  - *Personal grant (checked, highlighted)* — added via override beyond their tier; clicking removes the override.
  - *Off* — not granted; clicking adds an override (or, if already inherited-but-revoked, removes the revocation).
  - For an untiered/Custom person, this collapses to a plain checkbox list (overrides ARE the whole set, as today).
  - The `staff:manage` cell in this grid is disabled/read-only for callers who aren't Core Admin/Owner.
- Pending invites list (unchanged).

**Tab 2 — Permissions** (Core Admin/Owner only): the tier matrix — rows are tiers, columns are the 10 capabilities, checkbox at each intersection, inline rename, add-tier and delete-tier controls. Replaces today's per-tier chip list.

**Tab 3 — Admins** (Core Admin/Owner only): lists the Owner (labeled, no action available) and all Core Admins with a "Remove Core Admin" action per row (any Core Admin can act on any other; no self-protection needed since demotion just returns someone to their prior tier, and the Owner is the permanent fallback).

## Nav wiring

`components/layout/Sidebar.tsx`:
- `buildStaffNav()` renames the `staff:manage`-gated entry from "Staff" to "Settings" (still `/school/staff`), and adds a single `Partnerships` entry (`/school/partnerships`) gated on `mentorship:view || mentorship:edit || partnerships:view || partnerships:edit`, following the existing `if (caps.includes(...))` pattern. `Alumni Net` is not added to `buildStaffNav` — it stays out of scope, `SCHOOL`/`ADMIN`-only, unchanged.
- `SCHOOL_NAV` (Owner) is unchanged — Owner already sees everything.

## Testing

- Unit tests for `computeEffectivePermissions` covering: tier + override, tier + revocation, tier + override + revocation (revocation always wins for that capability), untiered/custom (revocations ignored).
- Enforcement tests for each swept route: 403 for a `STAFF` lacking the capability, 200 for one with it via tier, override, or Core Admin bypass; confirm `schoolId` resolves to the Owner's id in all cases, not the actor's own id.
- Admin endpoint tests: non-Core-Admin `STAFF` gets 403 on promote/demote; attempt to demote the Owner is rejected; a newly promoted Core Admin can immediately demote a different pre-existing Core Admin (symmetric peers).
- Manual walkthrough: invite a teacher with name/title prefilled, confirm accept-invite still allows editing them; promote to Core Admin, confirm tier-editor and Admins tab become visible; demote, confirm they fall back to their prior tier's actual permissions (not zeroed out).

## Out of scope / explicitly deferred

- Real email delivery for invites (still mocked, unchanged from the existing feature).
- Any change to the Owner account itself being transferable or removable — flagged as a known structural limitation (the schoolId-anchor problem), not solved here.
- Audit log / history of who changed whose permissions (worth a future pass if the school asks "who gave X this access," not requested now).
- Extending this capability system to `ORG` or top-level `ADMIN` accounts — no second consumer exists yet, so generalizing beyond `SCHOOL`/`STAFF` would be speculative.
