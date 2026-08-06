# Mentorship Page Improvements (school-side) — Design

Date: 2026-08-06
Scope: `app/(dashboard)/school/mentorship/` (admin pairing UI) and the shared messages surface it opens into. This is a narrow follow-up to a round of voice-dictated school-side feedback — only the Mentorship-page items are covered here.

## Background

The school-side Mentorship page (`/school/mentorship`) lets an admin pair students with teacher/alumni mentors into an admin-curated, shared message thread (`Conversation.type = "MENTORSHIP"`). Reviewing it surfaced three asks:

1. The student-selection list in the "New Pairing" modal has no way to search/filter, which is painful for a large school.
2. Concern that some students might not be showing up in that list.
3. Alumni and teacher mentors should be able to name their mentorship group chat (students should not).

## 1. Search bar for students (and mentors)

`MentorshipClient.tsx`'s "New Pairing" modal renders the full student and mentor lists as checkbox rows inside a `maxHeight: 160` scroll box, with no filtering.

- Add a text input above each list (`Filter students…` / `Filter mentors…`) that live-filters by `displayName` (case-insensitive substring match), client-side — the full list is already fetched, no new API needed.
- Increase `maxHeight` from 160 to ~260px so more rows are visible without scrolling.
- Add a small caption above each list showing the count, e.g. `12 of 47 shown` when filtered, or `47 students` when not — this doubles as the fix for item 2 below.

## 2. "Some students might be missing" — investigation result

Traced the data path:
- `/api/school/mentorship` (GET) sources the student list from `prisma.profile.findMany({ where: { schoolId, staffTitle: null, user: { isAlumni: false } } })` — the same shape the roster page itself uses to distinguish students from staff/alumni.
- Checked the one plausible bug I could think of — clearing a staff member's "Job Title" on edit silently reclassifying them as a student (`staffTitle: null` matches the student filter). Confirmed this is already guarded: `PATCH /api/school/roster/members/[userId]` only updates `staffTitle` when `jobTitle` is present in the request body; the roster edit form sends `undefined` (omitted key) when the field is left blank, so an existing title is never wiped by accident.
- No other filtering/pagination found that would drop valid roster rows from either list.

**Conclusion: no data bug found.** The most likely explanation is the cramped 160px scroll box (item 1) making the list feel incomplete. The enlarged list + explicit count from item 1 resolves this — no separate backend fix is needed. If specific students are still confirmed missing after this ships, that's a new, more targeted bug report rather than a list-display issue.

## 3. Let alumni/teacher mentors name their group chat

Current state:
- `Conversation.communityName String?` already exists on the schema (used today only for `COMMUNITY`-type rooms) — no migration needed, we're reusing it as the generic "custom conversation name" field.
- `MessagesClient.tsx` already has display support: `ConvSummary.name` and `convDisplayName()` return `conv.name` when set, falling back to joined participant names otherwise.
- That wiring is currently dead: `app/(dashboard)/messages/page.tsx` hardcodes `name: null` for every conversation instead of passing `c.communityName`.

Changes:
- **`messages/page.tsx`**: select `communityName` in the conversations query and map `name: c.communityName ?? null` instead of the hardcoded `null`. (This also makes named community rooms display correctly in the main list for the first time — a pre-existing latent bug, fixed as a side effect.)
- **New `PATCH /api/conversations/[id]/route.ts`**: accepts `{ name: string }` (trimmed, 1–80 chars). Loads the conversation, verifies the requester is a participant, verifies `conversation.type === "MENTORSHIP"`, and verifies the requester is a mentor in that thread (their `Profile.staffTitle` is set, or `User.isAlumni` is true) — a student participant gets a 403. Updates `communityName`.
- **`MessagesClient.tsx`**: in the thread header, when `activeConv.type === "MENTORSHIP"` and the viewer is allowed to rename (new `canRenameMentorship` prop, computed server-side per conversation and threaded down from `page.tsx`), show a small pencil icon next to the title that turns it into an inline text input; Enter/blur saves via the new PATCH endpoint and updates local state.
- Students in the thread and the school admin see the resulting name but get no edit affordance — matches "give the alumni as well as the teachers the ability to name it."

Out of scope: no name field added to the admin's "New Pairing" creation modal — naming happens from inside the chat, by the mentor(s), after the pairing exists.

## Files touched

- `app/(dashboard)/school/mentorship/MentorshipClient.tsx` — search inputs, count captions, taller lists
- `app/(dashboard)/messages/page.tsx` — pass through `communityName`, compute + pass `canRenameMentorship` per conversation
- `app/(dashboard)/messages/MessagesClient.tsx` — rename affordance in thread header
- `app/api/conversations/[id]/route.ts` — new file, `PATCH` handler

No schema/migration changes.
