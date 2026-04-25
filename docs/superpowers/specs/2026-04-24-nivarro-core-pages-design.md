# Nivarro — Core Pages Design Spec
**Date:** 2026-04-24
**Status:** Approved
**Scope:** Infrastructure foundation → Onboarding → Dashboard → Peers → Orgs → Teams → Messages + Profile

---

## 1. Overview

Improvement pass on the existing Goal-APP Next.js platform. The base app (auth, quiz, people search, projects, messages) exists and works. This spec adds the pieces needed to transform it into the full Nivarro student platform: opportunity discovery, onboarding, rich profiles, organizations, teams with noteboard, and polished messaging.

**Not a rebuild.** Work with existing component structure, existing auth (NextAuth v5), existing Prisma/SQLite setup, existing quiz logic.

**Tech stack:** Next.js App Router + TypeScript · Tailwind CSS · Prisma/SQLite · NextAuth v5 · Socket.io (Render backend for real-time)

**Dark/light mode:** Every new or modified **component and page** file uses Tailwind `dark:` variants. Pure TypeScript utility/lib files (no JSX) are exempt. Existing untouched files may remain hardcoded dark. The transition is incremental.

---

## 2. Genius Type System

### Existing state
The DB stores genius types as the Prisma enum `GeniusType { DYNAMO BLAZE TEMPO STEEL }`. All existing code uses these uppercase keys. **This does not change.**

### New constant: `lib/geniusTypes.ts`
Single source of truth for all type display data. Keys remain uppercase to match the DB enum.

```typescript
export type GeniusTypeKey = 'DYNAMO' | 'BLAZE' | 'TEMPO' | 'STEEL'

export const GENIUS_TYPES: Record<GeniusTypeKey, {
  label: string           // "Dynamo" — display name
  tagline: string         // "Generative · Fast"
  description: string     // full paragraph
  tension: string         // growth edge
  color: string           // hex
  tailwindRing: string
  tailwindBg: string      // includes dark: variant
  tailwindText: string    // includes dark: variant
  tailwindBorder: string  // includes dark: variant
}> = {
  DYNAMO: {
    label: 'Dynamo', tagline: 'Generative · Fast',
    description: 'Dynamos are idea machines. They think in possibilities, make unexpected connections across domains, and get energized by starting things. Their minds run fast and wide — they\'re the ones who show up to a brainstorm and fill three whiteboards before anyone else has uncapped their marker. The archetype is the inventor and the entrepreneur: someone who sees a blank canvas as an opportunity, not a void.',
    tension: 'Dynamos can scatter energy across too many ideas before any of them land. Follow-through requires deliberate effort.',
    color: '#F59E0B',
    tailwindRing: 'ring-amber-400',
    tailwindBg: 'bg-amber-50 dark:bg-amber-950',
    tailwindText: 'text-amber-700 dark:text-amber-300',
    tailwindBorder: 'border-amber-400 dark:border-amber-500',
  },
  BLAZE: {
    label: 'Blaze', tagline: 'Generative · Broad',
    description: 'Blazes lead through energy, charisma, and the ability to move people. They rally teams around causes, give speeches that shift the mood, and turn strangers into collaborators within minutes. The archetype is the performer, the campaigner, the community builder — someone who can make a room believe in something.',
    tension: 'Blazes can prioritize momentum and relationships over rigor. They sometimes move people before the plan is solid, and can overcommit on enthusiasm alone.',
    color: '#F97316',
    tailwindRing: 'ring-orange-500',
    tailwindBg: 'bg-orange-50 dark:bg-orange-950',
    tailwindText: 'text-orange-700 dark:text-orange-300',
    tailwindBorder: 'border-orange-500 dark:border-orange-400',
  },
  TEMPO: {
    label: 'Tempo', tagline: 'Evaluative · Steady',
    description: 'Tempos think in processes, timelines, and dependencies. They\'re steady, reliable, and unusually good at seeing how things fit together over time. Where Dynamo sees the idea and Blaze rallies the people, Tempo figures out how it actually gets built — and in what order. The archetype is the strategist, the project manager, the architect.',
    tension: 'Tempos can over-optimize for the plan and under-adapt when things change unexpectedly. They can also get stuck waiting for perfect information before moving.',
    color: '#14B8A6',
    tailwindRing: 'ring-teal-500',
    tailwindBg: 'bg-teal-50 dark:bg-teal-950',
    tailwindText: 'text-teal-700 dark:text-teal-300',
    tailwindBorder: 'border-teal-500 dark:border-teal-400',
  },
  STEEL: {
    label: 'Steel', tagline: 'Evaluative · Deep',
    description: 'Steels are rigorous, precise, and deeply analytical. They do the research, interrogate the assumptions, and find the edge case everyone else missed. They won\'t ship until it\'s right, push back on weak reasoning, and bring credibility and craft to everything they touch. The archetype is the researcher, the engineer, the critic in the best sense of the word.',
    tension: 'Steels can get stuck in analysis or come across as withholding when the team needs momentum. They can also struggle to communicate findings to people who haven\'t done the same depth of reading.',
    color: '#6366F1',
    tailwindRing: 'ring-indigo-500',
    tailwindBg: 'bg-indigo-50 dark:bg-indigo-950',
    tailwindText: 'text-indigo-700 dark:text-indigo-300',
    tailwindBorder: 'border-indigo-500 dark:border-indigo-400',
  },
}
```

**Never hardcode genius type colors inline.** Always derive from `GENIUS_TYPES[key]`.

---

## 3. Schema Additions (`prisma/schema.prisma`)

All additions. Nothing existing changes or is removed.

### Profile additions
```prisma
model Profile {
  // ... existing fields unchanged ...
  handle          String?  @unique
  currentFocus    String?            // max 120 chars, "What are you working on?"
  interests       String   @default("[]")  // JSON array of tag strings, e.g. '["Finance","Robotics"]'
  // Filtering on /peers is application-layer: fetch profiles, JSON.parse interests, filter in JS.
  // SQLite has no JSON indexing. Acceptable for v1.
  grade           Int?               // 9 | 10 | 11 | 12
  schoolName      String?
  isFirstGen      Boolean  @default(false)
  isHomeschooled  Boolean  @default(false)
  isInternational Boolean  @default(false)
  onboardingComplete Boolean @default(false)

  savedOpportunities SavedOpportunity[]
  contacts           Contact[]         @relation("ContactOwner")
  contactOf          Contact[]         @relation("ContactTarget")
  teamMemberships    TeamMember[]
}
```

### New models
```prisma
model Org {
  id             String    @id @default(cuid())
  name           String
  tagline        String?
  description    String?
  whatWeSeek     String?   // "What we're looking for"
  category       OrgCategory
  status         OrgStatus  @default(OPEN)
  heroUrl        String?
  accentColor    String?
  minTeamSize    Int        @default(1)
  maxTeamSize    Int        @default(5)
  gradeEligibility String?  // JSON array of ints
  deadline       DateTime?
  format         String?    // "in-person" | "remote" | "hybrid"
  location       String?
  stipend        String?
  createdAt      DateTime   @default(now())
  createdById    String

  opportunities  Opportunity[]
  teams          Team[]
}

enum OrgCategory {
  ACCELERATOR
  FELLOWSHIP
  INTERNSHIP
  COMPETITION
  BOOTCAMP
  RESEARCH
  CLUB
}

enum OrgStatus {
  OPEN
  CLOSED
  ROLLING
}

model Opportunity {
  id              String      @id @default(cuid())
  orgId           String
  title           String
  description     String?
  category        OrgCategory
  deadline        DateTime?
  gradeEligibility String?
  isRemote        Boolean     @default(false)
  createdAt       DateTime    @default(now())

  org             Org         @relation(fields: [orgId], references: [id], onDelete: Cascade)
  savedBy         SavedOpportunity[]
}

model SavedOpportunity {
  id            String   @id @default(cuid())
  profileId     String
  opportunityId String
  createdAt     DateTime @default(now())

  profile       Profile     @relation(fields: [profileId], references: [id], onDelete: Cascade)
  opportunity   Opportunity @relation(fields: [opportunityId], references: [id], onDelete: Cascade)

  @@unique([profileId, opportunityId])
}

model Contact {
  id        String   @id @default(cuid())
  ownerId   String
  targetId  String
  createdAt DateTime @default(now())

  owner  Profile @relation("ContactOwner", fields: [ownerId], references: [id], onDelete: Cascade)
  target Profile @relation("ContactTarget", fields: [targetId], references: [id], onDelete: Cascade)

  @@unique([ownerId, targetId])
}

model Team {
  id          String     @id @default(cuid())
  name        String
  description String?
  status      TeamStatus @default(ACTIVE)
  orgId       String?
  createdById String
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  org          Org?           @relation(fields: [orgId], references: [id])
  members      TeamMember[]
  messages     TeamMessage[]
  noteboardCards NoteboardCard[]
}

enum TeamStatus {
  ACTIVE
  SUBMITTED
  COMPLETED
}

model TeamMember {
  id        String     @id @default(cuid())
  teamId    String
  profileId String
  role      TeamRole   @default(MEMBER)
  joinedAt  DateTime   @default(now())

  team    Team    @relation(fields: [teamId], references: [id], onDelete: Cascade)
  profile Profile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@unique([teamId, profileId])
}

enum TeamRole {
  ADMIN
  MEMBER
}

model TeamMessage {
  id        String   @id @default(cuid())
  teamId    String
  senderId  String
  body      String
  createdAt DateTime @default(now())

  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)
}

model NoteboardCard {
  id        String          @id @default(cuid())
  teamId    String
  type      NoteboardType
  payload   String          // JSON blob — schema per type below
  creatorId String
  order     Int             @default(0)
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt

  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)
}

enum NoteboardType {
  NOTE
  TASK
  CHECKLIST
}

// NoteboardCard payload JSON schemas:
//
// NOTE:
// { body: string, color: string, reminderAt?: string | null }
//
// TASK:
// { title: string, assigneeIds: string[], dueDate?: string | null, status: 'todo' | 'inprogress' | 'done' }
//
// CHECKLIST:
// { title: string, items: { id: string, text: string, checked: boolean }[] }
```

---

## 4. New Files

```
lib/
  geniusTypes.ts          — GENIUS_TYPES constant (Section 2 above)
  interestTags.ts         — INTEREST_TAG_GROUPS + ALL_INTEREST_TAGS
  types/profile.ts        — StudentProfile TypeScript type
  socket.ts               — socket.io-client singleton + useSocket() hook

components/ui/
  Avatar.tsx              — circular avatar, genius type ring-2, initials fallback
  GeniusTypeBadge.tsx     — "✦ Dynamo" pill, colors from GENIUS_TYPES
```

### `lib/interestTags.ts`
```typescript
export const INTEREST_TAG_GROUPS = {
  'Business & Economics': ['Entrepreneurship','Finance','Marketing','Consulting','Social Enterprise','Product Management','Real Estate','Investing'],
  'Technology': ['Software Engineering','AI & Machine Learning','Cybersecurity','Robotics','Web Development','Data Science','Hardware'],
  'Science & Research': ['Biology','Neuroscience','Chemistry','Physics','Environmental Science','Psychology','Public Health'],
  'Arts & Media': ['Film & Video','Photography','Graphic Design','Music','Creative Writing','Journalism','Animation','Architecture'],
  'Social Impact': ['Climate & Environment','Education Equity','Policy & Advocacy','Global Health','Community Organizing','Human Rights'],
  'Humanities': ['History','Philosophy','Political Science','International Relations','Law','Linguistics'],
} as const

export const ALL_INTEREST_TAGS = Object.values(INTEREST_TAG_GROUPS).flat()
```

### `lib/socket.ts`
One connection to the Render Socket.io server. Components call `useSocket()` — never `io()` directly inside a component.

```typescript
import { io, Socket } from 'socket.io-client'
import { useRef } from 'react'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, { autoConnect: false, reconnection: true })
  }
  return socket
}

export function useSocket() {
  const ref = useRef(getSocket())
  return ref.current
}
```

**Connection lifecycle:**
- Connect: called once after successful NextAuth session is established (in root layout or auth provider, after `useSession` returns `authenticated`)
- Disconnect: called on logout (in the signOut callback)
- Reconnection: handled automatically by socket.io-client (`reconnection: true`)
- Reconnection state: the UI does not need to surface reconnection state in v1 — socket.io handles it silently

**Architecture note — relay-only pattern:** The Render Socket.io server is a pure relay. It receives events from clients and broadcasts to rooms. It does **not** read or write to the Prisma/SQLite database. All data persistence goes through Next.js API routes on Vercel. This resolves the SQLite file-sharing conflict between Vercel and Render. Example flow for a team message:
1. Client emits `team_message_send` to Render socket server
2. Server broadcasts `team_message_receive` to all room participants
3. Client simultaneously calls `POST /api/teams/[id]/messages` to persist to SQLite via Prisma

---

## 5. Route Structure

| New route | Maps from | Notes |
|-----------|-----------|-------|
| `/peers` | `/people` | Renamed. Keeps filter logic. Improves visuals. |
| `/orgs` | — | New. Org directory. |
| `/orgs/[orgId]` | — | New. Full org detail page. |
| `/teams/[teamId]` | `/team` (partial) | New. Full team workspace. |
| `/onboarding` | — | New. 4-step flow (quiz reveal → focus → interests → background). |
| `/profile/[handle]` | `/profile` | Dynamic handle route. `/profile/me` = own profile. |

`/projects` and `/team` (old) remain accessible but are no longer in the sidebar nav.

### Sidebar nav (updated)
Dashboard · Peers · Orgs · Teams · Messages

---

## 6. Onboarding Gate

`middleware.ts` runs on all requests:

1. **Unauthenticated** requests to protected routes → NextAuth redirects to `/login` (existing, unchanged)
2. **Authenticated** requests where `onboardingComplete === false` → redirect to `/onboarding`
3. **Excluded from gate** (never redirected): `/onboarding`, `/quiz`, `/api/*`, `/_next/*`, `/favicon.ico`, `/login`, `/register`
4. `/onboarding` is in the exclusion list — no redirect loop possible

**Routes gated:** `/dashboard`, `/peers`, `/orgs`, `/teams`, `/messages`, `/profile`

If `onboardingComplete` is missing on an old account, treat as `false`.

Onboarding flow:
1. **Quiz result reveal** — full-screen, type name + tagline + description + tension + "Continue →"
2. **Step 2 — Current Focus** — single textarea, 120 char limit, live counter, cycling placeholders, "Skip for now"
3. **Step 3 — Interests** — grouped tag grid, selected in type accent color, 10 max, 1 required, freeform input
4. **Step 4 — Background** — grade pills (required), school name, checkboxes for firstGen/homeschool/international; privacy note
5. On complete: `PATCH /api/profile` sets `onboardingComplete: true` → redirect `/dashboard`

---

## 7. Dashboard (`/dashboard`)

Two-column desktop (left ~320px, right flex-1). Single column mobile.

### Left column
- **Identity panel**: Avatar (genius type ring) + display name + @handle + GeniusTypeBadge + currentFocus callout (left border in type color) + stats (N saved · N orgs · N teams) + "Edit profile" link
- **Spaces pulse**: up to 4 team/org rows with unread badge (Socket.io live); "View all" link; empty state
- **Platform updates + feedback**: up to 3 update entries (expandable) + always-visible feedback input → `POST /api/feedback`

### Center column
- **Opportunity ticker** (top): Horizontally scrolling strip, always near-black bg in both modes. Category label + org name + opportunity title + deadline. CSS marquee, pauses on hover. Clicking → `/orgs/[orgId]`. Data: `GET /api/opportunities/ticker?limit=20`, re-fetches every 10 min.
- **Opportunity feed**: "Opportunities for you" header. Filter chips (All/Internship/Fellowship/Competition/Accelerator/Grant/Bootcamp). Cards with: left accent bar in category color, org logo + name, title, description (2-line), chips (deadline, grade, format), Save toggle + "View organization →". Recommendation signals: interest overlap, grade filter, genius type affinity, eligibility flags, recency. Refresh every 5 min or on visibilitychange. Infinite scroll.

---

## 8. Peers (`/peers`)

Filter sidebar (left, collapsible mobile) + results grid (right). Full search bar spanning top.

- **Search**: debounced 300ms, active filter chips below bar with ×, "Clear all"
- **Filters** (existing logic preserved, visual improvement only): genius type colored pills, interests grouped multi-select, grade checkboxes, "Looking to team up" toggle, "Near my school" toggle
- **Student card** (3-col desktop, 2-col tablet, 1-col mobile): Avatar + genius type ring, display name, GeniusTypeBadge, up to 3 interest chips + "+N more", "Looking to team up" indicator, school name, mutual orgs count, saved contact heart (top-right). Entire card clickable → Student Panel.
- **Student Panel** (slide-in right): Avatar + name + @handle + badges + currentFocus callout + full interest cloud + school/grade + shared orgs + "Message" (primary) + "Save contact" (outlined). Close ×.
- **Group Message FAB**: bottom-right "+". Modal: student search + avatar chips (max 10) + "Start conversation" → creates group thread → `/messages?group=[id]`
- Saved contacts pinned above grid (collapsed if >6)

---

## 9. Organizations (`/orgs`, `/orgs/[orgId]`)

### Directory (`/orgs`)
Tabs: Discover (default) | My organizations. Sticky filter bar: search + category chips + "Open applications only" toggle.

**Org card**: banner/gradient, avatar overlapping, name, category badge, short description (2-line), team size + grade + deadline chips, status badge. Click → `/orgs/[orgId]` (never modal).

**My organizations**: same grid + role badge + unread badge + "Open workspace" → `/orgs/[orgId]/workspace`

### Detail (`/orgs/[orgId]`)
Wide hero → two-column (left: content, right: sticky sidebar).

**Left**: About + "What we're looking for" (indented, left border) · Program details (format, duration, location, stipend, deadline) · Team requirements (min/max size bold, required roles, grade) · Organizers section · FAQ accordion

**Right sidebar**: deadline countdown + status + "Apply with your team" CTA (disabled if closed, "Go to workspace" if member) + Save toggle + Share + quick stats

**Application flow** (3 steps): Build team (contacts picker, eligibility filter, min/max warnings) → Application details (org custom fields + "Why join?" textarea) → Review & submit (team avatars + genius types + answers). Post-submit: success + "View application" link.

---

## 10. Teams (`/teams/[teamId]`)

Full-width header → two-column (chat left ~60%, noteboard right ~40%). Mobile: tabbed.

**Header**: org logo + affiliation OR "Independent team" · project name (bold) · description (2-line expandable) · stacked member avatars with genius type rings (up to 6 + "+N more") · status badge · "Invite member" + "Team settings" (admin)

**Member list** (collapsible): each row: Avatar + name + role + last active + message icon → DM

### Team Chat
Real-time Socket.io. Same thread in `/messages` under "Team chats."
- Date separators + sender grouping (avatar only on first in a run)
- Own messages right-aligned, bubble tinted in genius type accent (10% opacity bg)
- System messages centered muted (e.g. "Jordan joined the team")
- Reactions (emoji hover-add) + hover actions (React / Reply / Copy / Delete own)
- Typing indicator "[Name] is typing..."
- Sticky auto-expanding input, Enter to send, Shift+Enter newline
- Events: `join_team_room`, `leave_team_room`, `team_message_send`, `team_message_receive`, `typing_start`, `typing_stop`, `typing`

### Digital Noteboard
Shared real-time collaborative board. Masonry 2-col desktop, 1-col mobile. Drag-to-reorder.

Card types:
- **Note**: jewel-tone or white/black bg (deep emerald, midnight navy, warm burgundy, rich violet, slate charcoal). Creator avatar + timestamp. Body up to 500 chars. Optional reminder. Text color auto-contrast.
- **Task**: neutral surface + left border in assignee's genius type color. Title + assignee chips + due date. Status toggle: To do → In progress → Done. On Done: strikethrough + system message to chat.
- **Checklist**: neutral surface. Title + progress bar (fill in creator's type color). Checkbox list, any member can toggle. "+ Add item" inline. On all checked: green border pulse + "✓ Complete" badge.

Creation: "+ Add" → dropdown → inline form (not modal). Color swatch picker for Note cards.

Events: `noteboard_card_create`, `noteboard_card_update`, `noteboard_card_delete`, `noteboard_checklist_toggle`, `noteboard_task_status`

---

## 11. Messages (`/messages`)

Two-panel desktop (list left ~320px, thread right). Single-panel mobile.

**Conversation list**: search bar + three collapsible sections (Direct messages / Group chats / Team chats). Each row: stacked avatars + genius type rings + name + last message preview + timestamp + unread badge + online dot (DMs). "New message" button → user picker.

**Message thread**:
- Header: DM (avatar + name + online) | Group (stacked avatars + "Group · N") | Team (name + "Open workspace" link)
- Date groups + sender groups (avatar on first of run)
- Own messages right-aligned, tinted in genius type accent (10% opacity)
- Unread divider "N new messages"
- Reactions + hover actions
- Typing indicator
- Sticky input (Enter send, Shift+Enter newline)
- DM only: collapsible right panel with counterpart profile + shared orgs
- Auto-scroll to bottom on open; "↓ New messages" pill if scrolled up
- Per-room draft state preserved on tab switch

Socket.io events: `join_room`, `leave_room`, `send_message`, `receive_message`, `typing_start`, `typing_stop`, `typing`, `user_online`, `message_reaction`, `read_receipt`, `unread_count`

Team chat threads are bidirectional — same Socket.io room as `/teams/[teamId]`.

---

## 12. Profile (`/profile/[handle]`)

Own profile at `/profile/me`. Public-facing.

**Two-column desktop** (left: identity, right: content). Single-column mobile.

**Left**: Avatar + genius type ring · display name + @handle · GeniusTypeBadge (click expands inline description + tension card, dismiss on click outside) · secondary type badge (smaller, muted) · **currentFocus** callout block (left border in type color — first thing visitor reads after name) · stats (N saved · N orgs · N teams) · "Message" + "Save contact" (other profiles only)

**Right**: Interests tag cloud (preset tags in type accent color, freeform dashed border, clicking tag on other profile → Peers pre-filtered) · Background (own profile only, marked private): grade + school + eligibility flags + "Edit" link

**Edit profile drawer** (own profile, slide-in right): editable fields (avatar, displayName, currentFocus, bio, interests, schoolName, grade, flags). geniusType shown read-only + "Retake quiz" link (requires confirmation). Save → PATCH + optimistic update + success toast.

---

## 13. Shared Behavior

- **Optimistic UI** on: save opportunity, save contact, checklist toggle, task status change. On API error: immediately revert the optimistic state to the previous value and show an error toast ("Something went wrong — try again"). Never leave the UI in an inconsistent state.
- **`/people` → `/peers` migration:** The old `/people` route gets a Next.js `redirect()` (301) in its `page.tsx` pointing to `/peers`. The `/people` folder is kept with only a redirect — all logic moves to `/peers`.
- **Skeleton screens** (not spinners) on all initial data loads: dashboard feed, peers grid, orgs directory, noteboard.
- **Empty states** on every list and feed: small SVG icon + message + CTA. No blank areas.
- **Mobile nav**: AppShell bottom tab bar — Dashboard, Peers, Orgs, Teams, Messages.
- **No goals anywhere.** No goals page, field, or reference in any new component or API. The existing dashboard (`DashboardClient.tsx`) references a `goal` field on the Project model — leave that untouched (it belongs to Projects, not the Goals feature). Do not add any new `goal` references.
- **Team access control:** Only `TeamMember` records for a given team may view or interact with `/teams/[teamId]`, its chat, or its noteboard. Non-members get a 403. Team creator is auto-added as ADMIN. API routes for `/api/teams/[id]/*` check session userId against TeamMember table before responding.
- **API auth:** All API routes except `/api/auth/*` require a valid NextAuth session. Unauthenticated requests return 401. This applies to every route listed in Section 14.

---

## 14. API Routes (new)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/opportunities/ticker` | Latest N opportunities for ticker |
| GET | `/api/opportunities/recommended` | Personalized feed with signals |
| POST | `/api/feedback` | Submit platform feedback |
| GET | `/api/orgs` | Org directory with filters |
| GET | `/api/orgs/[id]` | Single org detail |
| POST | `/api/orgs/[id]/apply` | Submit team application |
| GET | `/api/teams/[id]` | Team detail |
| POST | `/api/teams/[id]/messages` | Send team message |
| GET | `/api/teams/[id]/noteboard` | Fetch noteboard cards |
| POST | `/api/teams/[id]/noteboard` | Create noteboard card |
| PATCH | `/api/teams/[id]/noteboard/[cardId]` | Update card |
| DELETE | `/api/teams/[id]/noteboard/[cardId]` | Delete card |
| PATCH | `/api/profile` | Update profile fields |
| GET | `/api/profile/[handle]` | Public profile by handle |
| POST | `/api/contacts` | Save contact |
| DELETE | `/api/contacts/[id]` | Remove contact |

---

## 15. Build Order Summary

| Phase | Tasks |
|-------|-------|
| 1 — Foundation | Schema migration, geniusTypes.ts, interestTags.ts, types/profile.ts, Avatar, GeniusTypeBadge, socket.ts, sidebar update |
| 2 — Onboarding | Quiz reveal screen, Steps 2/3/4, middleware gate |
| 3 — Dashboard | Identity panel + spaces pulse + feedback, ticker, feed |
| 4 — Peers | /peers route, student card, slide-in panel, group FAB |
| 5 — Orgs | Directory, detail page, application flow |
| 6 — Teams | Header + member list, team chat, noteboard |
| 7 — Messages + Profile | Conversation sections, thread improvements, /profile/[handle] + edit drawer |
