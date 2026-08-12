import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import type { Prisma } from "@prisma/client";
import { buildTweakPrompt, parseCampaignResponse } from "@/lib/campaign-prompt";
import type { ImageParams } from "@/components/campaigns/CampaignCanvas";
import { requireSchoolCapability } from "@/lib/school-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const check = await requireSchoolCapability("campaigns:edit");
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI generation is not configured on this server." }, { status: 503 });
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id, schoolId: check.schoolId },
  });
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const feedback = typeof body.feedback === "string" ? body.feedback.trim() : "";
  if (!feedback || feedback.length < 3) {
    return NextResponse.json({ error: "Please describe what you'd like to change." }, { status: 400 });
  }
  if (feedback.length > 500) {
    return NextResponse.json({ error: "Feedback is too long (max 500 characters)." }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = buildTweakPrompt(
    {
      headline: campaign.headline,
      subheadline: campaign.subheadline,
      body: campaign.body,
      ctaText: campaign.ctaText,
      imageParams: campaign.imageParams as unknown as ImageParams,
    },
    feedback
  );

  let message: Awaited<ReturnType<typeof anthropic.messages.create>>;
  try {
    message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 2400,
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `AI service error: ${msg}` }, { status: 502 });
  }

  const rawText = message.content[0].type === "text" ? message.content[0].text : "";
  const revised = parseCampaignResponse(rawText);
  if (!revised) {
    return NextResponse.json({ error: "Failed to parse AI response. Please try again." }, { status: 500 });
  }

  const imageParamsJson = revised.imageParams as unknown as Prisma.InputJsonValue;

  const updated = await prisma.campaign.update({
    where: { id },
    data: {
      headline: revised.headline,
      subheadline: revised.subheadline,
      body: revised.body,
      ctaText: revised.ctaText,
      imageParams: imageParamsJson,
    },
  });

  await prisma.campaignVersion.create({
    data: {
      campaignId: id,
      cause: campaign.cause,
      headline: revised.headline,
      subheadline: revised.subheadline,
      body: revised.body,
      ctaText: revised.ctaText,
      imageParams: imageParamsJson,
      source: "tweak",
      note: feedback,
    },
  });

  return NextResponse.json({
    campaignId: updated.id,
    headline: updated.headline,
    subheadline: updated.subheadline,
    body: updated.body,
    ctaText: updated.ctaText,
    imageParams: updated.imageParams,
    videoUrl: updated.videoUrl,
  });
}
