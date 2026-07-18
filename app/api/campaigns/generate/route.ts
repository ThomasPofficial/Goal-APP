import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import type { Prisma } from "@prisma/client";
import { buildGeneratePrompt, parseCampaignResponse } from "@/lib/campaign-prompt";

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
      max_tokens: 1200,
      messages: [{ role: "user", content: buildGeneratePrompt(cause) }],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `AI service error: ${msg}` }, { status: 502 });
  }

  const rawText = message.content[0].type === "text" ? message.content[0].text : "";
  const parsed = parseCampaignResponse(rawText);
  if (!parsed) {
    return NextResponse.json({ error: "Failed to parse AI response. Please try again." }, { status: 500 });
  }

  const { headline, subheadline, body: bodyText, ctaText, imageParams } = parsed;
  const imageParamsJson = imageParams as unknown as Prisma.InputJsonValue;

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
        imageParams: imageParamsJson,
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
        imageParams: imageParamsJson,
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
      imageParams: imageParamsJson,
      source: "generate",
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
