# OpenClaw Agent API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Nivarro agent API production-ready so OpenClaw (and any other agent) can authenticate with a paid-org API key, search scholars, read profiles, and get project candidates — with a hard 100-calls/day rate limit enforced server-side.

**Architecture:** Extract the shared auth helper into `lib/agent-auth.ts`, add an `AgentCallLog` Prisma model to track daily call counts per org, wire the rate limit check into all three agent endpoints, add an admin-only API key generation endpoint, and ship an OpenClaw skill file so the agent knows exactly how to call the API.

**Tech Stack:** Next.js 15 App Router, Prisma (PostgreSQL), TypeScript, Node.js crypto (built-in, no dep needed)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `lib/agent-auth.ts` | Shared auth helper + rate limit check |
| Add model | `prisma/schema.prisma` | `AgentCallLog` model |
| New migration | `prisma/migrations/` | Created by `prisma migrate dev` |
| Modify | `app/api/agent/search/route.ts` | Use shared auth + rate limit |
| Modify | `app/api/agent/scholar/[id]/route.ts` | Use shared auth + rate limit |
| Modify | `app/api/agent/project/[id]/candidates/route.ts` | Use shared auth + rate limit |
| Create | `app/api/orgs/[id]/generate-api-key/route.ts` | Admin-only key generation |
| Create | `docs/openclaw-skill.md` | OpenClaw skill definition |

---

## Task 1: Add `AgentCallLog` to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the model**

Open `prisma/schema.prisma`. At the very end of the file, after the `AlgorithmQuota` model, add:

```prisma
// ─────────────────────────────────────────────
// AGENT RATE LIMITING (100 calls/day per paid org)
// ─────────────────────────────────────────────

model AgentCallLog {
  id        String   @id @default(cuid())
  orgId     String
  date      String   // YYYY-MM-DD UTC
  callCount Int      @default(0)

  org Org @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@unique([orgId, date])
}
```

Also add the reverse relation on the `Org` model. Find the `model Org {` block and add this line inside it (after the `reviews` relation line):

```prisma
  agentCallLogs AgentCallLog[]
```

- [ ] **Step 2: Run the migration**

```bash
npx prisma migrate dev --name add-agent-call-log
```

Expected output ends with: `✔ Generated Prisma Client`

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add AgentCallLog model for agent rate limiting"
```

---

## Task 2: Create `lib/agent-auth.ts` — shared auth + rate limit

**Files:**
- Create: `lib/agent-auth.ts`

This replaces the `resolveOrgFromApiKey` function duplicated in all three agent routes, and adds the 100-calls/day rate limit gate.

- [ ] **Step 1: Create the file**

```typescript
// lib/agent-auth.ts
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

const DAILY_LIMIT = 100;

export type AgentAuthResult =
  | { ok: true; orgId: string }
  | { ok: false; response: NextResponse };

export async function requireAgentAuth(req: Request): Promise<AgentAuthResult> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized — include Authorization: Bearer <api-key>" },
        { status: 401 }
      ),
    };
  }

  const org = await prisma.org.findUnique({ where: { apiKey: token } });

  if (!org) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized — API key not recognised" },
        { status: 401 }
      ),
    };
  }

  if (!org.isPaid) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Paid org tier required. Contact team.nivarro@gmail.com to upgrade." },
        { status: 403 }
      ),
    };
  }

  // Rate limit: increment call count for today, fail if already at limit
  const date = todayUTC();
  const log = await prisma.agentCallLog.upsert({
    where: { orgId_date: { orgId: org.id, date } },
    update: { callCount: { increment: 1 } },
    create: { orgId: org.id, date, callCount: 1 },
  });

  if (log.callCount > DAILY_LIMIT) {
    const resetAt = new Date();
    resetAt.setUTCHours(24, 0, 0, 0);
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Rate limit exceeded — 100 calls/day per paid org",
          resetsAt: resetAt.toISOString(),
          callCount: log.callCount,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(DAILY_LIMIT),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": resetAt.toISOString(),
          },
        }
      ),
    };
  }

  return { ok: true, orgId: org.id };
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no errors about `lib/agent-auth.ts`

- [ ] **Step 3: Commit**

```bash
git add lib/agent-auth.ts
git commit -m "feat: shared agent auth + 100-calls/day rate limit"
```

---

## Task 3: Wire `requireAgentAuth` into all three agent routes

**Files:**
- Modify: `app/api/agent/search/route.ts`
- Modify: `app/api/agent/scholar/[id]/route.ts`
- Modify: `app/api/agent/project/[id]/candidates/route.ts`

### `app/api/agent/search/route.ts`

- [ ] **Step 1: Replace the file**

Replace the entire file content with:

```typescript
import { prisma } from "@/lib/prisma";
import { requireAgentAuth } from "@/lib/agent-auth";
import { NextResponse } from "next/server";
import type { GeniusType, Prisma } from "@prisma/client";

export async function POST(req: Request) {
  const auth = await requireAgentAuth(req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { query, filters = {} } = body as {
    query?: string;
    filters?: {
      geniusType?: GeniusType;
      minReviews?: number;
      grade?: number;
      interests?: string[];
    };
  };

  const where: Prisma.ProfileWhereInput = { onboardingComplete: true };

  if (filters.geniusType) where.geniusType = filters.geniusType;
  if (filters.grade) where.grade = filters.grade;

  if (query || (filters.interests && filters.interests.length > 0)) {
    const terms = [
      ...(query ? [query] : []),
      ...(filters.interests ?? []),
    ];
    where.OR = terms.flatMap((t) => [
      { displayName: { contains: t, mode: "insensitive" as const } },
      { headline: { contains: t, mode: "insensitive" as const } },
      { bio: { contains: t, mode: "insensitive" as const } },
      { interests: { contains: t, mode: "insensitive" as const } },
    ]);
  }

  const scholars = await prisma.profile.findMany({
    where,
    take: 50,
    select: {
      id: true,
      displayName: true,
      handle: true,
      headline: true,
      bio: true,
      strengthSummary: true,
      avatarUrl: true,
      geniusType: true,
      secondaryGeniusType: true,
      grade: true,
      schoolName: true,
      interests: true,
      traitLinks: {
        take: 5,
        include: { trait: { select: { slug: true, name: true, category: true } } },
        orderBy: { order: "asc" },
      },
      orgReviews: {
        select: {
          id: true,
          body: true,
          createdAt: true,
          org: { select: { name: true } },
          orgProject: { select: { title: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const minReviews = filters.minReviews ?? 0;
  const filtered = minReviews > 0
    ? scholars.filter((s) => s.orgReviews.length >= minReviews)
    : scholars;

  const ranked = filtered.sort((a, b) => b.orgReviews.length - a.orgReviews.length);

  return NextResponse.json({ scholars: ranked, total: ranked.length });
}
```

### `app/api/agent/scholar/[id]/route.ts`

- [ ] **Step 2: Replace the file**

```typescript
import { prisma } from "@/lib/prisma";
import { requireAgentAuth } from "@/lib/agent-auth";
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAgentAuth(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const scholar = await prisma.profile.findUnique({
    where: { id },
    select: {
      id: true,
      displayName: true,
      handle: true,
      headline: true,
      bio: true,
      strengthSummary: true,
      avatarUrl: true,
      geniusType: true,
      secondaryGeniusType: true,
      grade: true,
      schoolName: true,
      interests: true,
      currentFocus: true,
      isFirstGen: true,
      isInternational: true,
      traitLinks: {
        include: { trait: { select: { slug: true, name: true, category: true } } },
        orderBy: { order: "asc" },
      },
      orgReviews: {
        select: {
          id: true,
          body: true,
          createdAt: true,
          org: { select: { name: true } },
          orgProject: { select: { title: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!scholar) return NextResponse.json({ error: "Scholar not found" }, { status: 404 });

  return NextResponse.json({ scholar });
}
```

### `app/api/agent/project/[id]/candidates/route.ts`

- [ ] **Step 3: Replace the file**

```typescript
import { prisma } from "@/lib/prisma";
import { requireAgentAuth } from "@/lib/agent-auth";
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAgentAuth(req);
  if (!auth.ok) return auth.response;

  const { id: orgProjectId } = await params;

  const project = await prisma.orgProject.findFirst({
    where: { id: orgProjectId, orgId: auth.orgId },
  });
  if (!project) return NextResponse.json({ error: "Project not found for this org" }, { status: 404 });

  const filledCount = await prisma.teamApplication.count({
    where: { orgProjectId, status: "ACCEPTED" },
  });
  const spotsRemaining = Math.max(0, project.openSpots - filledCount);
  const dailyCap = spotsRemaining * 2;

  if (dailyCap === 0) {
    const resetAt = new Date();
    resetAt.setUTCHours(24, 0, 0, 0);
    return NextResponse.json({
      candidates: [],
      quota: { dailyCap: 0, resetsAt: resetAt.toISOString() },
      exhausted: true,
    });
  }

  let preferredTypes: string[] = [];
  try { preferredTypes = JSON.parse(project.preferredGeniusTypes ?? "[]"); } catch { preferredTypes = []; }

  const candidates = await prisma.profile.findMany({
    where: { onboardingComplete: true },
    take: dailyCap,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      displayName: true,
      handle: true,
      headline: true,
      bio: true,
      strengthSummary: true,
      avatarUrl: true,
      geniusType: true,
      secondaryGeniusType: true,
      grade: true,
      schoolName: true,
      interests: true,
      traitLinks: {
        take: 5,
        include: { trait: { select: { slug: true, name: true, category: true } } },
        orderBy: { order: "asc" },
      },
      orgReviews: {
        select: {
          id: true,
          body: true,
          createdAt: true,
          org: { select: { name: true } },
          orgProject: { select: { title: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const sorted = preferredTypes.length > 0
    ? [
        ...candidates.filter((c) => c.geniusType && preferredTypes.includes(c.geniusType)),
        ...candidates.filter((c) => !c.geniusType || !preferredTypes.includes(c.geniusType)),
      ]
    : candidates;

  const resetAt = new Date();
  resetAt.setUTCHours(24, 0, 0, 0);

  return NextResponse.json({
    candidates: sorted,
    quota: { dailyCap, resetsAt: resetAt.toISOString() },
    exhausted: false,
  });
}
```

- [ ] **Step 4: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add app/api/agent/search/route.ts app/api/agent/scholar/[id]/route.ts app/api/agent/project/[id]/candidates/route.ts
git commit -m "feat: wire shared agent auth + rate limit into all three agent routes"
```

---

## Task 4: API key generation endpoint

**Files:**
- Create: `app/api/orgs/[id]/generate-api-key/route.ts`

Lets the Nivarro admin (`team.nivarro@gmail.com`) generate or rotate a paid org's API key. Returns the key once — if the org loses it, they call this again and the old key is invalidated.

- [ ] **Step 1: Create the route**

```typescript
// app/api/orgs/[id]/generate-api-key/route.ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.email !== "team.nivarro@gmail.com") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const org = await prisma.org.findUnique({ where: { id } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });
  if (!org.isPaid) return NextResponse.json({ error: "Org must be on paid tier before generating an API key" }, { status: 400 });

  // 32 random bytes → 64-char hex string. Prefix with "niv_" for easy identification.
  const apiKey = "niv_" + randomBytes(32).toString("hex");

  await prisma.org.update({ where: { id }, data: { apiKey } });

  return NextResponse.json({
    apiKey,
    note: "Store this key securely — it will not be shown again. Call this endpoint again to rotate it.",
  });
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Test manually**

Start the dev server: `npm run dev`

In a separate terminal, first get the org ID from the DB:
```bash
npx prisma studio
```
Open the Org table, find the org you want to key up, copy its `id`.

Then call the endpoint (replace `<ORG_ID>` and use your Nivarro admin session cookie from the browser):
```bash
node -e "
const https = require('https');
const data = JSON.stringify({});
// Use fetch from Node 18+ — run this in the browser console instead:
// fetch('/api/orgs/<ORG_ID>/generate-api-key', { method: 'POST' }).then(r => r.json()).then(console.log)
console.log('Run in browser console while logged in as team.nivarro@gmail.com:');
console.log(\"fetch('/api/orgs/<ORG_ID>/generate-api-key', { method: 'POST' }).then(r => r.json()).then(console.log)\");
"
```

Or open the browser console while logged in as `team.nivarro@gmail.com` and run:
```javascript
fetch('/api/orgs/<ORG_ID>/generate-api-key', { method: 'POST' }).then(r => r.json()).then(console.log)
```

Expected response:
```json
{
  "apiKey": "niv_<64 hex chars>",
  "note": "Store this key securely — it will not be shown again."
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/orgs/[id]/generate-api-key/route.ts
git commit -m "feat: admin-only API key generation endpoint for paid orgs"
```

---

## Task 5: OpenClaw skill file

**Files:**
- Create: `docs/openclaw-skill.md`

This is the skill definition OpenClaw loads. It tells the agent what the API does, how to authenticate, what endpoints exist, and gives it example calls it can adapt.

- [ ] **Step 1: Create the skill file**

```markdown
# Nivarro Scholar Search — OpenClaw Skill

## What this skill does

Search the Nivarro platform for high school scholars matching your project's needs.
Nivarro is a talent platform where scholars build teams and apply to verified org projects.
You can search by genius type, interests, grade level, and minimum review count.
Reviews are written by orgs after project completion — they are the data moat.

## Auth

All requests require a paid-org API key in the Authorization header:

```
Authorization: Bearer niv_<your-api-key>
```

API keys are issued by the Nivarro team. Contact team.nivarro@gmail.com.

Rate limit: 100 API calls per day. The response includes `X-RateLimit-Remaining`.

## Base URL

```
https://nivarro.co
```

## Endpoints

### 1. Search scholars

`POST /api/agent/search`

Find scholars matching a query or structured filters. Returns up to 50 results, ranked by review count (most reviewed first).

Request body (all fields optional):
```json
{
  "query": "machine learning Python",
  "filters": {
    "geniusType": "STEEL",
    "minReviews": 1,
    "grade": 11,
    "interests": ["research", "data science"]
  }
}
```

Genius types: `STEEL` (analytical/systematic), `BLAZE` (creative/bold), `DYNAMO` (energetic/driven), `TEMPO` (steady/reliable).

Response:
```json
{
  "scholars": [
    {
      "id": "clxxx",
      "displayName": "Priya Sharma",
      "handle": "priya-s",
      "headline": "ML researcher + hackathon finalist",
      "geniusType": "STEEL",
      "grade": 11,
      "interests": "[\"machine learning\",\"Python\",\"research\"]",
      "orgReviews": [
        {
          "body": "Priya delivered a working prototype ahead of schedule...",
          "createdAt": "2026-03-01T00:00:00.000Z",
          "org": { "name": "Research Cohort" },
          "orgProject": { "title": "AI Climate Study" }
        }
      ]
    }
  ],
  "total": 1
}
```

### 2. Get full scholar profile

`GET /api/agent/scholar/:id`

Full profile + all reviews for a specific scholar. Use `id` from search results.

Response:
```json
{
  "scholar": {
    "id": "clxxx",
    "displayName": "Priya Sharma",
    "bio": "...",
    "strengthSummary": "...",
    "geniusType": "STEEL",
    "grade": 11,
    "isFirstGen": true,
    "traitLinks": [
      { "trait": { "slug": "analytical", "name": "Analytical", "category": "ANALYTICAL" } }
    ],
    "orgReviews": [ ... ]
  }
}
```

### 3. Get project candidates

`GET /api/agent/project/:id/candidates`

Today's algorithm-recommended candidates for a specific project. Number of results = (open spots remaining) × 2. Preferred genius types surface first.

Response:
```json
{
  "candidates": [ ... ],
  "quota": {
    "dailyCap": 6,
    "resetsAt": "2026-05-21T00:00:00.000Z"
  },
  "exhausted": false
}
```

### 4. Get API schema

`GET /api/agent/schema`

No auth required. Returns the machine-readable schema for all endpoints.

## Example OpenClaw workflow

```
1. POST /api/agent/search with { query: "biology research", filters: { minReviews: 1 } }
2. Review top 3 results. For each, GET /api/agent/scholar/:id for full review text.
3. Build a shortlist. Return it to the user with scholar IDs, names, and review excerpts.
```

## Error codes

| Status | Meaning |
|--------|---------|
| 401 | Missing or invalid API key |
| 403 | Org is not on paid tier |
| 404 | Scholar or project not found |
| 429 | Rate limit exceeded — check `resetsAt` in response body |
```

- [ ] **Step 2: Commit**

```bash
git add docs/openclaw-skill.md
git commit -m "docs: OpenClaw skill file for Nivarro agent API"
```

---

## Task 6: Deploy and smoke test

- [ ] **Step 1: Push to main and trigger deploy**

```bash
git push origin main
```

Then trigger the Render deploy hook (Node.js — curl has SSL issues in this env):

```bash
node -e "const https = require('https'); https.get('https://api.render.com/deploy/srv-d7o25h68bjmc7395irug?key=XETPeUTTsjo', r => { console.log(r.statusCode); r.on('data', d => process.stdout.write(d)); });"
```

- [ ] **Step 2: Smoke test the live API**

Once deployed, generate an API key for the Nivarro org (use browser console at nivarro.co):
```javascript
fetch('/api/agent/schema').then(r => r.json()).then(console.log)
```

Then test search with the real key:
```bash
node -e "
const https = require('https');
const body = JSON.stringify({ query: 'research' });
const req = https.request({
  hostname: 'nivarro.co',
  path: '/api/agent/search',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer niv_YOUR_KEY_HERE',
    'Content-Length': Buffer.byteLength(body),
  }
}, res => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => console.log(JSON.parse(data)));
});
req.write(body);
req.end();
"
```

Expected: `{ scholars: [...], total: N }`

- [ ] **Step 3: Verify rate limit header**

Check the response headers include:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0   ← only if limit is hit
```

---

## Self-Review

**Spec coverage check:**
- ✅ `POST /api/agent/search` — exists, now uses shared auth + rate limit
- ✅ `GET /api/agent/scholar/:id` — exists, wired up
- ✅ `GET /api/agent/project/:id/candidates` — exists, wired up
- ✅ Rate limit 100 calls/day — Task 1 + Task 2
- ✅ API key generation — Task 4
- ✅ OpenClaw skill file — Task 5
- ✅ Schema at `/api/agent/schema` — already existed, untouched (no changes needed)
- ✅ `Authorization: Bearer` pattern — already in existing routes, preserved
- ✅ Deploy hook — Task 6

**No placeholders found.**

**Type consistency:** `auth.orgId` introduced in Task 2 and used in Task 3 (candidates route). `AgentCallLog` model introduced in Task 1, referenced in Task 2 via `prisma.agentCallLog.upsert`. All consistent.
