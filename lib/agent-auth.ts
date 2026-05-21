// lib/agent-auth.ts
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

const DAILY_LIMIT = 100;

export type AgentAuthResult =
  | { ok: true; orgId: string; callsRemaining: number }
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

  return { ok: true, orgId: org.id, callsRemaining: Math.max(0, DAILY_LIMIT - log.callCount) };
}
