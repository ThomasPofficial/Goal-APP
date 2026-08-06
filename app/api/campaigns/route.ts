import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateSlug } from "@/lib/campaign-slug";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (dbUser?.role !== "SCHOOL" && dbUser?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const campaigns = await prisma.campaign.findMany({
    where: { schoolId: session.user.id },
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
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser2 = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (dbUser2?.role !== "SCHOOL" && dbUser2?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { campaignId } = body;
  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, schoolId: session.user.id },
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
