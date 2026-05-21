# Changelog

## [0.2.0] — 2026-05-21

### Added

- **Agent API rate limiting** — `AgentCallLog` Prisma model tracks calls per org per day (UTC). Hard cap of 100 calls/day enforced server-side via atomic upsert.
- **Shared auth helper** (`lib/agent-auth.ts`) — extracts `requireAgentAuth` from all three agent routes. Returns `callsRemaining` for header injection.
- **`X-RateLimit-Remaining` header** — included on all successful agent API responses so OpenClaw and other agents can self-throttle.
- **Admin API key generation endpoint** (`POST /api/orgs/[id]/generate-api-key`) — restricted to `team.nivarro@gmail.com`. Generates a `niv_`-prefixed 68-char key, stores it on the org, returns it once. Rotate by calling again.
- **OpenClaw skill file** (`docs/openclaw-skill.md`) — full skill definition covering all 4 endpoints, auth format, genius type legend, rate limit behaviour, example workflow, and error codes.
- **CLAUDE.md skill routing rules** — gstack skill routing so Claude Code knows which skill to invoke per task type.
- **Implementation plan** (`docs/superpowers/plans/2026-05-20-openclaw-agent-api.md`) — full task-by-task plan with spec coverage self-review.

### Changed

- All three agent routes (`/api/agent/search`, `/api/agent/scholar/[id]`, `/api/agent/project/[id]/candidates`) now use `requireAgentAuth` instead of inline auth logic. No behaviour change for callers.
- `POST /api/agent/search` and `GET /api/agent/scholar/[id]` now return `X-RateLimit-Remaining` on 200 responses.
- `GET /api/agent/project/[id]/candidates` scopes project lookup to the calling org's ID (`where: { orgId: auth.orgId }`) to prevent cross-org project access.

### Database

- New table: `AgentCallLog` (`id`, `orgId`, `date`, `callCount`). Unique index on `(orgId, date)`. Migration at `prisma/migrations/20260520000000_add_agent_call_log/`.
- Org model gains `agentCallLogs AgentCallLog[]` reverse relation (schema only, no data migration needed).

---

## [0.1.0] — initial release

Initial platform: scholar profiles, genius type quiz, messaging, dashboard, peers, orgs, teams, notifications, org visual identity, roster panel.
