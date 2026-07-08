import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateSlug } from "@/lib/campaign-slug";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const body = await req.json().catch(() => ({}));
  const { campaignId } = body;
  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, schoolId: session.user.id },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const slug = generateSlug(campaign.headline);

  const published = await prisma.campaign.update({
    where: { id: campaignId },
    data: { slug, active: true },
  });

  return NextResponse.json({ slug: published.slug });
}
