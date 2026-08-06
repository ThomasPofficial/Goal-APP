import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const campaign = await prisma.campaign.findFirst({
    where: { id, schoolId: session.user.id },
  });
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  // Active toggle (pre-existing behavior, used by the campaigns list "Active/Draft" switch)
  if (typeof body.active === "boolean") {
    const updated = await prisma.campaign.update({
      where: { id },
      data: { active: body.active },
    });
    return NextResponse.json({ active: updated.active });
  }

  const data: Prisma.CampaignUpdateInput = {};

  if (typeof body.headline === "string") {
    const v = body.headline.trim();
    if (!v) return NextResponse.json({ error: "Headline cannot be empty." }, { status: 400 });
    data.headline = v;
  }
  if (typeof body.subheadline === "string") {
    const v = body.subheadline.trim();
    if (!v) return NextResponse.json({ error: "Subheadline cannot be empty." }, { status: 400 });
    data.subheadline = v;
  }
  if (typeof body.body === "string") {
    const v = body.body.trim();
    if (!v) return NextResponse.json({ error: "Body cannot be empty." }, { status: 400 });
    data.body = v;
  }
  if (typeof body.ctaText === "string") {
    const v = body.ctaText.trim();
    if (!v) return NextResponse.json({ error: "CTA text cannot be empty." }, { status: 400 });
    data.ctaText = v;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const updated = await prisma.campaign.update({ where: { id }, data });

  await prisma.campaignVersion.create({
    data: {
      campaignId: id,
      cause: updated.cause,
      headline: updated.headline,
      subheadline: updated.subheadline,
      body: updated.body,
      ctaText: updated.ctaText,
      imageParams: updated.imageParams as Prisma.InputJsonValue,
      source: "manual",
    },
  });

  return NextResponse.json({
    campaignId: updated.id,
    headline: updated.headline,
    subheadline: updated.subheadline,
    body: updated.body,
    ctaText: updated.ctaText,
    imageParams: updated.imageParams,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (dbUser?.role !== "SCHOOL" && dbUser?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id, schoolId: session.user.id },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.campaign.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
