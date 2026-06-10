import { NextResponse } from "next/server";
import { z } from "zod";
import { capture } from "@/lib/posthog-server";
import { sendWelcomeEmail } from "@/lib/welcome-email";
import { createNotionPage, N } from "@/lib/notion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Inbound webhook from a Google Apps Script attached to a Google Form.
 *
 * Apps Script must POST JSON like:
 *   { email: "user@example.com", name?: "Jane", source?: "signup-form",
 *     formId?: "...", answers?: { ... } }
 * and include header `X-Form-Secret: <FORM_WEBHOOK_SECRET>`.
 *
 * Side effects on success:
 *   1. PostHog event `form_submitted`
 *   2. Notion row in NOTION_SIGNUPS_DB_ID (if configured)
 *   3. Welcome email — DISABLED by default. Set
 *      `WELCOME_EMAIL_ENABLED=true` to opt in. Until then this route is
 *      data-collection only.
 *
 * All side effects are best-effort: a single failure is logged but does not
 * 500 the webhook (Apps Script will retry on 5xx and we don't want dupes).
 */

const Body = z.object({
  email: z.string().email().optional(),
  name: z.string().max(200).optional(),
  source: z.string().max(80).optional(),
  formId: z.string().max(120).optional(),
  answers: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string().optional(),
});

export async function POST(req: Request) {
  const secret = process.env.FORM_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[form-submit] FORM_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const provided = req.headers.get("x-form-secret");
  if (provided !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const data = parsed.data;
  const distinctId = data.email ?? `anon:${data.formId ?? "unknown"}:${Date.now()}`;

  // 1. PostHog
  await capture({
    distinctId,
    event: "form_submitted",
    properties: {
      source: data.source ?? null,
      formId: data.formId ?? null,
      hasEmail: Boolean(data.email),
    },
  });

  // 2. Notion row
  let notion: { written: boolean; pageId?: string; error?: string } = {
    written: false,
  };
  const notionDb = process.env.NOTION_SIGNUPS_DB_ID;
  if (notionDb) {
    try {
      const page = await createNotionPage({
        databaseId: notionDb,
        properties: {
          // Adjust to match your DB schema. "Name" must be a Title prop.
          Name: N.title(data.name ?? data.email ?? "Form submission"),
          ...(data.email ? { Email: N.email(data.email) } : {}),
          Source: N.text(data.source ?? "unknown"),
          FormId: N.text(data.formId ?? ""),
          SubmittedAt: N.date(data.timestamp ?? new Date().toISOString()),
        },
      });
      notion = { written: true, pageId: page.id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[form-submit] notion write failed:", msg);
      notion = { written: false, error: msg };
    }
  }

  // 3. Welcome email — gated. Off until Thomas explicitly turns it on.
  let welcome: { sent: boolean; skipped?: boolean; error?: string } = {
    sent: false,
    skipped: true,
  };
  if (
    process.env.WELCOME_EMAIL_ENABLED === "true" &&
    data.email &&
    data.source === "signup-form"
  ) {
    try {
      const r = await sendWelcomeEmail({ to: data.email, name: data.name });
      welcome = { sent: true };
      await capture({
        distinctId,
        event: "welcome_email_sent",
        properties: { messageId: r.id },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[form-submit] welcome email failed:", msg);
      welcome = { sent: false, error: msg };
    }
  }

  return NextResponse.json({
    ok: true,
    notion,
    welcome,
  });
}
