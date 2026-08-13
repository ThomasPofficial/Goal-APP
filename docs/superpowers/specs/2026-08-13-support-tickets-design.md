# Support Tickets

## Problem

There's no way for any user to reach the Nivarro team from inside the app except a scrappy, dashboard-only "Platform Feedback" box (`DashboardClient.tsx` → `app/api/feedback/route.ts`) that: only appears on the standard student dashboard, is invisible to org/school/staff/walled-student roles, has no subject line, and isn't persisted anywhere — it's a fire-and-forget email.

We need one consistent way for **every** account type (student, walled/school-student, staff, org, school-admin) to file a support ticket, plus a place for the Nivarro team to see and triage what comes in.

## Data model

New model in `prisma/schema.prisma`:

```prisma
enum SupportTicketStatus {
  OPEN
  RESOLVED
}

model SupportTicket {
  id           String              @id @default(cuid())
  userId       String
  subject      String
  message      String
  path         String?
  status       SupportTicketStatus @default(OPEN)
  replyMessage String?
  createdAt    DateTime            @default(now())
  resolvedAt   DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([status, createdAt])
}
```

- `path` is the page the user was on when they opened the modal — captured automatically client-side (`usePathname()`), not a form field.
- `replyMessage` is the optional short note an admin attaches when resolving — set once, at resolve time (see Resolution notice below), not a running thread.
- No denormalized email/role snapshot on the ticket; the admin view joins through `user` (email, role, `profile.displayName`) the same way `Message`/`OrgReview` already do.
- Add `supportTickets SupportTicket[]` to `User`.
- Needs a manual migration file per [[Nivarro Dev Patterns]] (Render runs `prisma migrate deploy` at startup; `prisma generate` alone won't create the column).

## API

`app/api/support-tickets/route.ts`
- `POST` — any authenticated user. Body `{ subject: string, message: string, path?: string }` (zod-validated, same shape as the existing `app/api/feedback/route.ts`). Creates the row, then best-effort emails `team.nivarro@gmail.com` via `lib/resend.ts` (`from: "Nivarro Support <support@nivarro.co>"`), matching the existing feedback route's "log and swallow" error handling — email failure never fails the request.
- `GET` — ADMIN-only (`dbUser.role !== "ADMIN"` → 403). Returns all tickets, `status: OPEN` first, then `createdAt desc`, each with `user.email`, `user.role`, `user.profile.displayName`.

`app/api/support-tickets/[id]/route.ts`
- `PATCH` — ADMIN-only. Body `{ status: "OPEN" | "RESOLVED", replyMessage?: string }`. Updates `status` and sets/clears `resolvedAt`.
  - On transition to `RESOLVED`: stores `replyMessage` (if provided) and triggers the resolution notice (see below).
  - On transition back to `OPEN` (reopen): clears `resolvedAt`, leaves the prior `replyMessage` in place as history, does not re-notify.

## Entry point (all roles)

New `components/support/SupportTicketModal.tsx` (client component):
- Controlled `open`/`onClose` props.
- Subject input + message textarea, submit button, inline validation (both required).
- On submit: `POST /api/support-tickets` with `{ subject, message, path: pathname }`.
- Success state: "Ticket sent — we'll follow up by email," auto-closes after a short delay (mirrors the `feedbackSent` pattern being removed from `DashboardClient.tsx`).

`components/layout/Sidebar.tsx`:
- Add local `const [supportOpen, setSupportOpen] = useState(false)`.
- Add one row (LifeBuoy icon from `lucide-react`, label "Support") rendered unconditionally — placed next to the collapse-toggle button, which already renders regardless of `collapsed` state or role. This is a single addition, not a change to any of the five role-specific nav arrays (`STANDARD_NAV`, `SCHOOL_NAV`, `walledNav`, `staffNav`, `orgNav`), so every role gets it automatically and any future nav variant inherits it for free.
- Clicking it sets `supportOpen = true`; render `<SupportTicketModal open={supportOpen} onClose={...} />` at the bottom of the component.

## Admin view

`app/(hq)/hq/support/page.tsx` — server component, gated identically to `app/(hq)/hq/page.tsx` (`redirect("/login")` if no session, `redirect("/dashboard")` if `role !== "ADMIN"`).
- Fetches tickets via the same query the GET route uses (or calls it directly server-side via Prisma — no need to round-trip through the API from a server component).
- Renders open tickets first, then resolved. Each row: subject, message, submitter email/role/displayName, `path`, relative timestamp, and a resolve/reopen button.
- Resolve/reopen button is a small client subcomponent (`SupportTicketRow.tsx`) that calls the `PATCH` route and updates local state — same shape as other admin toggle actions in this codebase (e.g. `CloseProjectModal`).
- Resolving is a small inline form, not a bare button: an optional single-line/short-textarea "Reply (optional)" field next to the Resolve button. Submitting calls `PATCH` with `{ status: "RESOLVED", replyMessage }` (empty string sent as `undefined`). Reopening is a plain button, no reply field.

`app/(hq)/layout.tsx`: add `<Link href="/hq/support" className="hq-nav-link">Support</Link>` next to the existing "Schools" link.

## Resolution notice

When a ticket transitions to `RESOLVED` via the `PATCH` route, best-effort (log-and-swallow, never fails the request) on both channels:

Copy on both channels is branded as coming from Nivarro (the team), not attributed to an individual admin — the person resolving it is an internal implementation detail (`role === "ADMIN"` gating), never surfaced to the user.

- **Email** — via `lib/resend.ts` to `user.email`, `from: "Nivarro Support <support@nivarro.co>"`, subject `"Your Nivarro support ticket has been resolved"`. Body includes the original `subject`, and `replyMessage` if one was given (falls back to a generic "The Nivarro team has resolved your ticket" line if not) — signed off as "— The Nivarro Team," never "— [admin name]."
- **In-app** — surfaced on the existing `/notifications` page, which already aggregates unrelated domain events on the fly per role (donations, chat, recruitment requests/decisions in `NotificationsClient`; donations + chat in `WalledNotificationsClient`) rather than reading from a generic notification table. Add one more on-the-fly query in `app/(dashboard)/notifications/page.tsx`: `prisma.supportTicket.findMany({ where: { userId: session.user.id, status: "RESOLVED" }, orderBy: { resolvedAt: "desc" }, take: 20 })`, mapped into the same item shape both notification clients already consume (`kind: "support"`, `label`: `"Nivarro resolved your ticket: " + subject`, `lastMessage`: `replyMessage`, `updatedAt: resolvedAt`, `unread: false` — matching how donations already render with no per-item read state; omit `href`, there's no ticket detail page to link to). Included in both the SCHOOL/walled-student branch and the standard branch of that page.
- Org accounts are out of scope for the in-app half of this notice — `orgNav` has no "Notifications" link, and per this discussion we're not addressing that now. Org submitters still get the email notice; that's sufficient for the moment.

## Removing the old feedback path

- Delete the "Platform Feedback" block, `feedback`/`feedbackSent` state, and `sendFeedback` handler from `app/(dashboard)/dashboard/DashboardClient.tsx`.
- Delete `app/api/feedback/route.ts` (now orphaned — grep confirms its only caller was `DashboardClient.tsx`).

## Out of scope

- Ongoing reply threading — an admin gets exactly one `replyMessage`, attached at the moment they resolve the ticket. No back-and-forth conversation, no per-message history. If the user needs to follow up, they file a new ticket.
- User-facing ticket history/status page — no page listing "my past tickets." Users get the submission confirmation toast, then the resolution notice (email + notifications-page item) when it's closed out. Can be added later as a follow-up if it turns out to be needed.
- Categories/severity — kept to subject + message per the design discussion; can be added as a column later without a breaking change if triage volume grows.
