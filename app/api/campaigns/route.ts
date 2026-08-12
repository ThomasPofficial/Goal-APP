import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSlug } from "@/lib/campaign-slug";
import { requireSchoolCapability } from "@/lib/school-auth";

export async function GET() {
  const check = await requireSchoolCapability("campaigns:view");
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const campaigns = await prisma.campaign.findMany({
    where: { schoolId: check.schoolId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { pledges: true } } },
  });

  return NextResponse.json(
    campaigns.map((c) => ({
      id: c.id,
      slug: c.slug,
      headline: c.headline,
      subheadline: c.subheadline,
      imageParams: c.imageParams,
      active: c.active,
      pledgeCount: c._count.pledges,
      createdAt: c.createdAt,
    }))
  );
}

export async function POST(req: NextRequest) {
  const check = await requireSchoolCapability("campaigns:edit");
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = await req.json().catch(() => ({}));
  const { campaignId } = body;
  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, schoolId: check.schoolId },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Already published — just (re-)activate without touching the existing
  // slug, so re-publishing after an edit never breaks a link that's already
  // been shared.
  if (campaign.slug) {
    const reactivated = await prisma.campaign.update({
      where: { id: campaignId },
      data: { active: true },
    });
    return NextResponse.json({ slug: reactivated.slug });
  }

  const slug = generateSlug(campaign.headline);

  try {
    const published = await prisma.campaign.update({
      where: { id: campaignId },
      data: { slug, active: true },
    });
    return NextResponse.json({ slug: published.slug });
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
      const retry = generateSlug(campaign.headline);
      const published2 = await prisma.campaign.update({
        where: { id: campaignId },
        data: { slug: retry, active: true },
      });
      return NextResponse.json({ slug: published2.slug });
    }
    throw err;
  }
}
