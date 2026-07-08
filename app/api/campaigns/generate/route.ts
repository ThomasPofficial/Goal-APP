import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import type { Prisma } from "@prisma/client";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "SCHOOL" && dbUser?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI generation is not configured on this server." }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const cause = typeof body.cause === "string" ? body.cause.trim() : "";
  const campaignId = typeof body.campaignId === "string" ? body.campaignId : null;
  const videoUrl = typeof body.videoUrl === "string" && body.videoUrl.trim() ? body.videoUrl.trim() : null;

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
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `You are a fundraising copywriter and visual designer for student organizations. Write compelling donation page copy AND choose visual design parameters for this cause:

"${cause}"

Respond ONLY with valid JSON (no markdown, no code fences):
{
  "headline": "6-12 word punchy headline",
  "subheadline": "one motivating sentence",
  "body": "3-4 compelling paragraphs separated by \\n\\n",
  "ctaText": "3-6 word call-to-action e.g. Support Our Journey",
  "imageParams": {
    "seed": <random integer 1000-9999>,
    "bg": "<dark hex color matching cause mood>",
    "palette": ["<hex1>", "<hex2>", "<hex3>"],
    "accent": "<most vibrant of the palette hexes>",
    "pattern": "<one of: geometric|wave|burst|organic>",
    "shapes": ["circle", "triangle", "rect"],
    "density": <float 0.4-0.9>
  }
}

Pattern guidance: water/environment → wave + blues; sports/energy → burst + bold warm colors; community/people → organic + warm tones; education/tech → geometric + cool tones.
Write with warmth, specificity, and authentic student voice.`,
        },
      ],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `AI service error: ${msg}` }, { status: 502 });
  }

  const rawText = message.content[0].type === "text" ? message.content[0].text : "";
  const cleaned = rawText.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response. Please try again." }, { status: 500 });
  }

  const required = ["headline", "subheadline", "body", "ctaText", "imageParams"];
  if (required.some((k) => !parsed[k])) {
    return NextResponse.json({ error: "Incomplete AI response. Please try again." }, { status: 500 });
  }

  const headline = parsed.headline as string;
  const subheadline = parsed.subheadline as string;
  const bodyText = parsed.body as string;
  const ctaText = parsed.ctaText as string;
  const imageParams = parsed.imageParams as Prisma.InputJsonValue;

  // Upsert the draft Campaign
  let campaign;
  if (campaignId) {
    const existing = await prisma.campaign.findFirst({
      where: { id: campaignId, schoolId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }
    campaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        cause,
        headline,
        subheadline,
        body: bodyText,
        ctaText,
        imageParams,
        ...(videoUrl !== null ? { videoUrl } : {}),
      },
    });
  } else {
    campaign = await prisma.campaign.create({
      data: {
        schoolId: session.user.id,
        cause,
        headline,
        subheadline,
        body: bodyText,
        ctaText,
        imageParams,
        videoUrl,
        active: false,
      },
    });
  }

  // Always snapshot a version
  await prisma.campaignVersion.create({
    data: {
      campaignId: campaign.id,
      cause,
      headline,
      subheadline,
      body: bodyText,
      ctaText,
      imageParams,
    },
  });

  return NextResponse.json({
    campaignId: campaign.id,
    headline,
    subheadline,
    body: bodyText,
    ctaText,
    causeText: cause,
    imageParams,
    videoUrl: campaign.videoUrl,
  });
}
