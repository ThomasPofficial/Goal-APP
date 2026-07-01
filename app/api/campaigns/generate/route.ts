import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI generation is not configured on this server." }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const cause = typeof body.cause === "string" ? body.cause.trim() : "";

  if (!cause || cause.length < 10) {
    return NextResponse.json({ error: "Please describe your cause (at least 10 characters)." }, { status: 400 });
  }
  if (cause.length > 1000) {
    return NextResponse.json({ error: "Cause description is too long (max 1000 characters)." }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let message: Awaited<ReturnType<typeof anthropic.messages.create>>;
  try {
    message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: `You are a fundraising copywriter for a student-run organization. Write compelling donation page copy for the following cause:

"${cause}"

Respond with ONLY a valid JSON object (no markdown, no code fences) with these exact keys:
- headline: A punchy 6-12 word headline (no quotes)
- subheadline: A motivating one-sentence subheadline (no quotes)
- body: 3-4 compelling paragraphs that tell the story, explain the impact, and create urgency (use \\n\\n to separate paragraphs)
- ctaText: A short (3-6 word) call-to-action button text like "Support Our Journey" or "Fund This Mission"
- causeText: The original cause input, verbatim

Write with warmth, specificity, and student voice. Make donors feel the impact of their contribution.`,
        },
      ],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `AI service error: ${msg}` }, { status: 502 });
  }

  const rawText = message.content[0].type === "text" ? message.content[0].text : "";

  let parsed: Record<string, string>;
  try {
    const cleaned = rawText.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response. Please try again." }, { status: 500 });
  }

  const required = ["headline", "subheadline", "body", "ctaText"];
  if (required.some((k) => !parsed[k])) {
    return NextResponse.json({ error: "Incomplete AI response. Please try again." }, { status: 500 });
  }

  return NextResponse.json({
    headline: parsed.headline,
    subheadline: parsed.subheadline,
    body: parsed.body,
    ctaText: parsed.ctaText,
    causeText: cause,
  });
}
