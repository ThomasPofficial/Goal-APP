# Org Profile Edit — Design

## Context

`/orgs/[orgId]` (`OrgDetailClient.tsx`) is the org's own public-facing profile page. When the logged-in org owner (`isAdmin` = `org.createdById === session.user.id`) views it, a "Settings" tab exists in the admin tab switcher — but it only renders four fields (Org Name, Description, Contact Email, What Interns Build) as plain read-only `<p>` text. There is no edit UI and no save action anywhere on this page.

Server-side, `PATCH /api/orgs/[id]` exists but is hardcoded to a single purpose: platform-admin-only ownership transfer (gated on `session.user.email === "team.nivarro@gmail.com"`). There is no endpoint an org owner can call to update their own org's profile fields.

By contrast, the org creation wizard (`OrgNewClient.tsx`, used once at `/orgs/new`) already has a complete, well-styled 3-step form (Basics, Brand, Mission) covering most of the profile — color pickers, tag-chip inputs, styled text fields — via a shared `Field` component and `inputStyle`/`colorPickerStyle` constants. None of this is reachable again after org creation.

**Cross-checked against `prisma/schema.prisma`'s `Org` model:** fields the wizard captures (name, category, website, founded, headquartersLocation, tagline, description, whatWeSeek, whatInternsBuild, contactEmail, values, logoLetter, logoBg, logoColor, accentColor) are all real `Org` columns. Other `Org` columns (`deadline`, `location`, `format`, `minTeamSize`/`maxTeamSize`, `gradeEligibility`, `status`, `socialProof`, `orgType`, `memberCount`, `bannerGradient`, `focusTags`) are never set by the wizard — they're either legacy/vestigial (superseded by per-listing fields on `OrgProject`) or simply unwired. This spec does not touch them.

## Goal

Let an org owner quickly edit their own org's profile — the same fields captured at creation — from the existing Settings tab, with a UI that matches the visual quality of the creation wizard instead of plain text.

**Non-goals:** image/file upload (logo and banner stay color-picker/gradient-based, matching the wizard exactly); editing the legacy/unwired `Org` fields listed above; editing individual `OrgProject` listings (already handled elsewhere); multi-step wizard UX (single form instead, see below).

## API

Extend `PATCH /api/orgs/[id]` (`app/api/orgs/[id]/route.ts`) with a second branch, keeping the existing ownership-transfer behavior intact:

```ts
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const org = await prisma.org.findUnique({ where: { id } });
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  // Platform admin: ownership transfer (existing behavior, unchanged)
  if (session.user.email === "team.nivarro@gmail.com" && ("createdById" in body || "email" in body)) {
    // ...existing logic...
  }

  // Org owner: profile self-edit (new)
  if (org.createdById === session.user.id) {
    const {
      name, category, website, founded, headquartersLocation,
      tagline, logoLetter, logoBg, logoColor, accentColor,
      description, whatWeSeek, whatInternsBuild, contactEmail, values,
    } = body;
    if (!name?.trim() || !category) {
      return NextResponse.json({ error: "name and category are required" }, { status: 400 });
    }
    const updated = await prisma.org.update({
      where: { id },
      data: {
        name: name.trim(), category, website, founded, headquartersLocation,
        tagline, logoLetter, logoBg, logoColor, accentColor,
        description, whatWeSeek, whatInternsBuild, contactEmail,
        values: JSON.stringify(values ?? []),
      },
    });
    return NextResponse.json({ org: updated });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

Same validation rule as creation (`name` and `category` required); every other field optional/nullable, matching the `Org` schema.

## UI

Replace the Settings tab body (`OrgDetailClient.tsx` lines ~372–395) with a single scrollable form, reusing `OrgNewClient.tsx`'s `Field` component, `inputStyle`, `colorPickerStyle`, and tag-chip-with-Enter pattern (for `values`) verbatim — extracted into a shared location (see Implementation notes) rather than duplicated.

Layout — one form, three visually separated sections with headers, pre-filled from current `org` props:

1. **Basics** — Organization name*, Category* (select), Website, Founded year, Headquarters/Location
2. **Brand** — live logo preview (swatch + letter, same as wizard), Logo letter, Logo background color, Letter color, Accent color, Tagline
3. **Mission** — Description, What we look for in students, What students actually build here, Core values (tag chips), Contact email

One "Save changes" button at the bottom of the form (not per-section). On submit:
- `PATCH /api/orgs/[orgId]` with the form state.
- On success: update the `org` state held in `OrgDetailClient` (currently props-derived; needs to become local state seeded from props, same pattern already used for `apiKeyState`/`projectStatuses`) so the About section, logo, tagline, and values on the public-facing view re-render immediately without a page reload.
- On failure: inline error message above the Save button (same visual pattern as the wizard's `error` state), form stays populated, no data loss.
- While saving: button shows a spinner + "Saving…", disabled to prevent double-submit (matches wizard's `submitting` pattern).

No client-side routing change — this all stays inside the existing `adminTab === "settings"` branch.

## Implementation notes

- `Field`, `inputStyle`, `colorPickerStyle` currently live inline in `OrgNewClient.tsx`. Extract them to a shared module (e.g. `components/org/OrgFormFields.tsx`) and import from both `OrgNewClient.tsx` and the new Settings form, rather than copy-pasting — avoids drift between creation and edit styling.
- `OrgDetailClient`'s `org` prop becomes locally-stateful (`const [orgState, setOrgState] = useState(org)`), mirroring the existing `apiKeyState`/`projectStatuses` local-override pattern already in this file, so a successful save updates the rendered profile without a refetch.
- `values` is stored as a JSON string on `Org` (`values: String @default("[]")`) — parse to `string[]` for the form (already done today via `JSON.parse(org.values || "[]")`), stringify back on submit, matching the wizard's existing convention.

## Testing

- Save with all fields populated → profile view (hero, logo, tagline, About, values, contact) reflects changes immediately.
- Clear a required field (name or category) → Save is blocked / server returns 400, existing form state preserved.
- Attempt PATCH as a non-owner, non-platform-admin user → 403.
- Existing platform-admin ownership-transfer PATCH still works unchanged (regression check).
