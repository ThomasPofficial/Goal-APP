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
  id         String              @id @default(cuid())
  userId     String
  subject    String
  message    String
  path       String?
  status     SupportTicketStatus @default(OPEN)
  createdAt  DateTime            @default(now())
  resolvedAt DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([status, createdAt])
}
```

- `path` is the page the user was on when they opened the modal — captured automatically client-side (`usePathname()`), not a form field.
- No denormalized email/role snapshot on the ticket; the admin view joins through `user` (email, role, `profile.displayName`) the same way `Message`/`OrgReview` already do.
- Add `supportTickets SupportTicket[]` to `User`.
- Needs a manual migration file per [[Nivarro Dev Patterns]] (Render runs `prisma migrate deploy` at startup; `prisma generate` alone won't create the column).

## API

`app/api/support-tickets/route.ts`
- `POST` — any authenticated user. Body `{ subject: string, message: string, path?: string }` (zod-validated, same shape as the existing `app/api/feedback/route.ts`). Creates the row, then best-effort emails `team.nivarro@gmail.com` via `lib/resend.ts` (`from: "Nivarro Support <support@nivarro.co>"`), matching the existing feedback route's "log and swallow" error handling — email failure never fails the request.
- `GET` — ADMIN-only (`dbUser.role !== "ADMIN"` → 403). Returns all tickets, `status: OPEN` first, then `createdAt desc`, each with `user.email`, `user.role`, `user.profile.displayName`.

`app/api/support-tickets/[id]/route.ts`
- `PATCH` — ADMIN-only. Body `{ status: "OPEN" | "RESOLVED" }`. Updates `status` and sets/clears `resolvedAt`.

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

`app/(hq)/layout.tsx`: add `<Link href="/hq/support" className="hq-nav-link">Support</Link>` next to the existing "Schools" link.

## Removing the old feedback path

- Delete the "Platform Feedback" block, `feedback`/`feedbackSent` state, and `sendFeedback` handler from `app/(dashboard)/dashboard/DashboardClient.tsx`.
- Delete `app/api/feedback/route.ts` (now orphaned — grep confirms its only caller was `DashboardClient.tsx`).

## Out of scope

- In-app replies/threading — follow-up happens over email, same as today.
- User-facing ticket history/status page — admins triage via HQ; users get the confirmation toast and any reply by email. Can be added later as a follow-up if it turns out to be needed.
- Categories/severity — kept to subject + message per the design discussion; can be added as a column later without a breaking change if triage volume grows.
