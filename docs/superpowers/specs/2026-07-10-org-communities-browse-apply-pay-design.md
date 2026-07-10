# Org Communities: Browse → Apply → Pay — Design Spec
_2026-07-10_

## Problem
Today "communities" means exactly one thing: a school's private code-gated chat room (`SchoolCodeGate` in `CommunitiesClient.tsx`, see [2026-07-02-school-community-rooms-design.md](./2026-07-02-school-community-rooms-design.md)). That flow is correct for Student/Alum accounts and does not change.

But `docs/account-types-design.md` (2026-07-09) already specs a second, distinct capability for **Standard** accounts: "Browse/join *any* community, no code entry" (line 33), and flags `communities/page.tsx` for rework (line 96). Standard accounts currently have no such experience — this spec builds it.

## Users in scope
- **Standard accounts** (`role=STUDENT`, `schoolId=null`) — can browse org-run communities, request to join, get approved, pay, and land in the community's chat.
- **Org accounts** (`org.createdById === session.user.id`) — can create a community under their org, review join requests, accept/reject.
- **Student/Alum/School accounts** — entirely unaffected. They keep the existing `SchoolCodeGate` → single school community chat flow. Role branching in `communities/page.tsx` determines which experience renders.

## Schema changes
Two new models, one new enum, one new relation on `Conversation`. Reuses the existing `ApplicationStatus` enum (`PENDING/ACCEPTED/REJECTED/WITHDRAWN`) rather than inventing a parallel status vocabulary.

```prisma
model Community {
  id          String   @id @default(cuid())
  orgId       String
  name        String
  description String?
  priceCents  Int?      // null or 0 = free community
  createdAt   DateTime  @default(now())

  org          Org                   @relation(fields: [orgId], references: [id], onDelete: Cascade)
  memberships  CommunityMembership[]
  conversation Conversation?
}

model CommunityMembership {
  id            String            @id @default(cuid())
  communityId   String
  userId        String
  status        ApplicationStatus @default(PENDING)
  paymentStatus PaymentStatus     @default(NONE)
  submittedAt   DateTime          @default(now())
  decidedAt     DateTime?

  community Community @relation(fields: [communityId], references: [id], onDelete: Cascade)
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([communityId, userId])
}

enum PaymentStatus {
  NONE            // not yet accepted, or free community
  PENDING_PAYMENT // accepted, priced, awaiting payment
  PAID
}

// Conversation model gains:
//   communityId String? @unique
//   community   Community? @relation(fields: [communityId], references: [id])
```

`Community.conversation` is created lazily — not at community-creation time — the first time a membership reaches `paymentStatus: PAID`. This mirrors `ensureSchoolGeneralRoom`'s find-or-create pattern.

As with all schema changes in this repo, a manual SQL migration file (`prisma/migrations/<timestamp>_add_communities/migration.sql`) must be written by hand — `prisma generate` alone does not produce one, and Render's `prisma migrate deploy` at startup will crash without it.

## Flow

1. **Org creates a community.** New panel on the org dashboard (`OrgDetailClient.tsx`, alongside the existing `AdminApplicationsPanel`): name, description, optional price. `POST /api/communities`.
2. **Standard user browses.** `/communities` (Standard branch) lists all `Community` records — name, description, org, price (or "Free"). No code entry anywhere in this path.
3. **Standard user applies.** One click, "Request to join" — no form, mirrors `TeamApplication`'s pattern (whyJoin was explicitly rejected for this flow — request only). Creates `CommunityMembership(status: PENDING, paymentStatus: NONE)`. `POST /api/communities/[id]/apply`.
4. **Org decides.** `PATCH /api/communities/[id]/membership` flips `status` to `ACCEPTED` or `REJECTED`.
   - On `ACCEPTED` with `priceCents` null/0: `paymentStatus` auto-set to `PAID` in the same transaction, user is immediately added to the community's conversation (find-or-create, same as `ensureSchoolGeneralRoom`).
   - On `ACCEPTED` with `priceCents` > 0: `paymentStatus` set to `PENDING_PAYMENT`. User is not yet added to the conversation.
   - On `REJECTED`: terminal state, no further action.
5. **Standard user pays (stub).** For `PENDING_PAYMENT` memberships, user sees a "Pay to join" screen with the price. `POST /api/communities/[id]/pay` flips `paymentStatus` to `PAID` with **no real charge** — this is an explicit placeholder. Real Stripe (or other gateway) integration is out of scope for this pass and will replace the body of this route later. On success, adds the user to the community's conversation.
6. **Chat.** Once `paymentStatus: PAID`, the user is a `ConversationParticipant` on `Community.conversation` (type `COMMUNITY`) and uses the exact same chat UI/API/socket events as school rooms (`/api/conversations/[id]/messages`, `join_conversation`/`conversation_message` socket events). No new chat code.

## API surface
| Method | Route | Purpose | Caller |
|--------|-------|---------|--------|
| GET | `/api/communities` | List all communities (browse) | Standard |
| POST | `/api/communities` | Create a community under caller's org | Org |
| POST | `/api/communities/[id]/apply` | Request to join | Standard |
| PATCH | `/api/communities/[id]/membership` | Accept/reject a pending membership | Org |
| POST | `/api/communities/[id]/pay` | Stub payment — flips PENDING_PAYMENT → PAID | Standard |

## Page: `/communities` (branch by role)
- **SCHOOL / STUDENT+schoolId / ALUMNI** — unchanged: existing `SchoolCodeGate` → single school chat.
- **STANDARD** (`role=STUDENT`, `schoolId=null`) — new: browse list of `Community` cards (name, org, description, price). Clicking a community the user hasn't joined shows apply/pending/pay states; clicking one they're a `PAID` member of opens the existing chat UI (reused `CommunitiesClient` chat rendering, keyed by the community's conversation instead of the school's).
- **ORG** — sees their org's communities with a "+ New Community" action and a pending-requests panel per community (accept/reject), surfaced from the org dashboard rather than `/communities`.

## What is NOT changing
- `SchoolCodeGate`, `AdminCodePanel`, and the school-code join flow — untouched.
- `Conversation`, `Message`, `ConversationParticipant` models — only extended (one new optional FK).
- `/api/conversations/[id]/messages` routes and socket.io events — reused as-is.
- No real payment processing. `POST /api/communities/[id]/pay` is a stub that always succeeds; wiring an actual payment gateway is a distinct, later task.
- `TeamApplication` / `OrgProject` flows — untouched; `CommunityMembership` is a separate, parallel model, not a reuse of `TeamApplication`.

## Confirmed
An org can have any number of communities, each independently priced (`Community.orgId` is not unique). Confirmed with user 2026-07-10.
