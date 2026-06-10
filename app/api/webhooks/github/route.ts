import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/github";
import { capture } from "@/lib/posthog-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Inbound GitHub webhook. Configure with content type `application/json`
 * and a shared secret stored in GITHUB_WEBHOOK_SECRET.
 *
 * For now we only react to `release` and `push` events, mirroring deploy
 * markers into PostHog so product dashboards line up with shipping work.
 */
export async function POST(req: Request) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[gh-webhook] GITHUB_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const rawBody = await req.text();
  const valid = verifyWebhookSignature({
    rawBody,
    signatureHeader: req.headers.get("x-hub-signature-256"),
    secret,
  });
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = req.headers.get("x-github-event") ?? "unknown";
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const repo =
    (payload.repository as { full_name?: string } | undefined)?.full_name ?? null;
  const sender =
    (payload.sender as { login?: string } | undefined)?.login ?? "github";

  if (event === "release") {
    const release = payload.release as
      | { tag_name?: string; html_url?: string; name?: string }
      | undefined;
    await capture({
      distinctId: sender,
      event: "deploy_completed",
      properties: {
        source: "github_release",
        repo,
        tag: release?.tag_name ?? null,
        url: release?.html_url ?? null,
      },
    });
  } else if (event === "push") {
    const ref = (payload.ref as string | undefined) ?? "";
    if (ref === "refs/heads/main" || ref === "refs/heads/master") {
      await capture({
        distinctId: sender,
        event: "main_push",
        properties: {
          repo,
          head: (payload.after as string | undefined) ?? null,
        },
      });
    }
  }

  return NextResponse.json({ ok: true, event });
}
