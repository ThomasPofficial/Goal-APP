# Account Types Design — Base Plan

Status: DRAFT — decisions made in conversation with product owner, 2026-07-09. This is a **base plan only, no implementation**. Written so it can be handed to other agents to scope/build from.

## Why this exists

The app currently has 5 real dimensions on the User model (`role`: STUDENT/ORG/ADMIN/SCHOOL, plus `isAlumni` bool on STUDENT), but the product owner's mental model is 4 user-facing account types. An audit (see "Known bugs to fix" below) found the code doesn't cleanly express this — nav logic conflates ADMIN with ORG, several pages have zero role gating, and `isAlumni` is invisible outside two pages. This doc defines the target shape. ORG accounts and the site-wide super-admin role are explicitly out of scope for this pass.

## The 4 account types

1. **Standard** — `role=STUDENT`, `schoolId=null` forever. Open self-serve signup.
2. **Student** — `role=STUDENT`, `schoolId` set, `isAlumni=false`. Invite-only (see Signup below).
3. **Alum** — `role=STUDENT`, `schoolId` set, `isAlumni=true`. Same invite-only path as Student, flips to alumni post-graduation.
4. **Admin/Teacher** — `role=SCHOOL`. Scoped to their own school only.

**Out of scope, untouched:**
- **Organizations (ORG role)** — existing infra, conceptually treated like a Standard account for now, no changes.
- **Site super-admin** (`role=ADMIN`, `team.nivarro@gmail.com`) — stays a separate, invisible-to-schools role. This design also fixes the bug where it currently inherits ORG nav (`components/layout/Sidebar.tsx:65`, `app/(dashboard)/layout.tsx:29`).

## Signup / enrollment model

- **Standard**: fully open self-serve signup. No school ties, ever.
- **Student / Alum**: closed. A school's Admin/Teacher account pre-registers the student by their school email (via roster import or manual add), which generates a special invite link. The student cannot exist in the system until an admin has entered them.
- **Safeguard**: Student/Alum accounts have **no ability to invite other kids themselves** — there is intentionally no peer-referral/invite mechanism for this account type. All enrollment is admin-gated, by design, to prevent unauthorized signups into a school's roster.

---

## 1. Standard account

| Tab/Feature | Status | Notes |
|---|---|---|
| Dashboard | **Distinct version** | "Opportunities"-focused dashboard |
| Communities | **Yes** | Browse/join *any* community, no code entry |
| Peers | **Yes** | Peer directory/networking |
| **Organizations** (renamed from "Orgs") | **Yes** | Browse org directory + their posted projects, apply. Rename the label/nav item from "Orgs" to "Organizations" throughout. |
| Teams | **Yes** | Team formation/collaboration. Saved/applied organizations now surface *inside* Teams (see Saved below) |
| Saved | **Removed** | Cut as a standalone tab. Whatever it showed (saved orgs/opportunities) is now visible from within Teams instead |
| Messages | **Yes** | General P2P messaging |
| Profile / Quiz | **Yes** | Own profile + genius-type quiz |
| Notifications | **Yes** | |
| My School / Mentorship / Alumni Net / Destinations / Survey / Fundraise | **No** | School-only features |

## 2. Student account (school-affiliated, not yet graduated)

| Tab/Feature | Status | Notes |
|---|---|---|
| Dashboard | **Distinct version** | School-context dashboard, not the "opportunities" one |
| My School | **Yes** | Existing school-side profile view |
| Communities (general browse) | **No** | Walled off — no code entry, no general browsing |
| Peers | **No** | Walled off |
| Organizations / Projects | **No** | Confirmed — no browsing or applying to org-posted projects |
| Saved | **No** | N/A, no browsing to save from |
| Teams | **No** | |
| **School community chat** | **Yes** | The school-wide channel |
| **Mentorship messaging** | **Yes** | A distinct messaging surface for the assigned mentor thread — exists **outside/beyond** the community chat, not merely nested as a view inside it. Built on the existing Message/ConversationParticipant tables; thread is admin-created |
| Profile / Quiz | **No** | No self-service profile editing or genius-type quiz for this account type by default |
| Notifications | **Yes** | Scoped to community chat + mentorship activity |
| Alumni Net / Destinations / Survey / Fundraise | **No** | Staff-facing, not student-facing |

**⚠️ Needs confirmation before build:** the line "Mentor can be a part of orgs" was unclear in dictation. Best-effort interpretation: the mentor pool (teachers + alumni, per earlier decision) isn't restricted from also having an Organization affiliation — i.e. a mentor being linked to an Org elsewhere in the system doesn't disqualify them from mentoring. This does **not** mean Student accounts get an Organizations tab (explicitly "no" above). Confirm this reading before it goes to implementation.

## 3. Alum account (school-affiliated, graduated)

Same walled-off shape as Student, plus:

| Tab/Feature | Status | Notes |
|---|---|---|
| School community chat + mentorship messaging | **Yes** | Same consolidated surface as Student |
| Alumni destination fields (LinkedIn, employer, jobTitle, confirmed college/major) | **Yes** | Existing Profile fields — this is distinct from the "quiz/onboarding profile" that Students don't get; alumni need career-tracking data |
| **Mentor eligibility** | **Yes** | Can be paired as a mentor to a current Student, not just as a mentee |
| Communities / Peers / Organizations / Teams / general Messages | **No** | Same wall-off as Student |

## 4. Admin/Teacher account (`role=SCHOOL`, scoped to their own school)

| Tab/Feature | Status | Notes |
|---|---|---|
| Destinations | **Yes** | Existing |
| Alumni Net | **Yes** | Existing |
| Community | **Yes** | Their school's community — admin view/moderation |
| Survey | **Yes** | Existing |
| Fundraise (campaigns) | **Yes** | Existing |
| **Mentorship pairing (new)** | **Yes** | New admin UI: create/edit pairs (teacher↔student, alum↔student). Lives here, not in HQ |
| **Quiz toggle (new)** | **Yes** | New setting: admin can switch the genius-type quiz on/off for their school's students |
| Roster management / invite generation | **Yes** | Existing CSV import + special invite link generation, confirmed as the only path Student/Alum accounts get created through |
| Site-wide admin (`/admin/org-categories`, `/admin/platform-updates`, `/admin/scraper-queue`) | **No** | Out of scope, stays on the separate super-admin role |
| HQ (`/hq/*`) | **No** | Confirmed `role==="ADMIN"`-only (Nivarro staff cross-school tool), not a per-school teacher surface |

---

## Known bugs to fix as part of this work (found in the 2026-07-09 audit)

1. `app/(dashboard)/peers/page.tsx` and `app/(dashboard)/orgs/page.tsx` have **zero server-side role/auth gating** today.
2. `app/(dashboard)/admin/org-categories/page.tsx` and `.../scraper-queue/page.tsx` hardcode `email !== "team@nivarro.co"` instead of checking `role==="ADMIN"` — and that email doesn't match `team.nivarro@gmail.com` used elsewhere.
3. `app/(dashboard)/admin/platform-updates/page.tsx` has no auth check on the page itself.
4. `components/layout/Sidebar.tsx:65` / `app/(dashboard)/layout.tsx:29`: `isOrg = role==="ORG" || role==="ADMIN"` — the bug behind ADMIN inheriting ORG nav. Must be fixed as part of splitting ADMIN out as its own thing.
5. `app/(dashboard)/communities/page.tsx:26` — variable named `isAdmin` actually checks `role==="SCHOOL"`. Rename for clarity when this page is reworked.
6. Dead code: `Sidebar.tsx:60-63` — unreachable branch appending `SCHOOL_NAV` to `studentNav` when `isNivarroAdmin` is true.
7. Three separate profile-viewing surfaces exist (`profile/page.tsx`, `profile/[handle]/ProfileClient.tsx`, `people/[userId]/page.tsx`) — the last one was not touched in a prior profile redesign and should probably redirect to `/profile/[handle]`.

## Explicitly deferred / not decided in this pass

- Organizations (ORG role) redesign
- Exact UI treatment of "mentorship messaging outside communities" (separate page vs. sidebar — decided it's a distinct surface, exact layout not specced)
- CSV import's third vocabulary (`"STUDENT"/"ALUMNI"/"STAFF"` strings, distinct from the `UserRole` enum) — not renamed, just needs to keep translating correctly into `role` + `isAlumni`
