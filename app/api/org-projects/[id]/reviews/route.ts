import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { reviews } = body as { reviews?: { profileId: string; body: string }[] };

  if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
    return NextResponse.json({ error: "reviews array required" }, { status: 400 });
  }

  const project = await prisma.orgProject.findUnique({
    where: { id },
    include: { org: { select: { id: true, createdById: true } } },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (project.org.createdById !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  for (const r of reviews) {
    if (!r.body || r.body.trim().length < 50)
      return NextResponse.json({ error: "Each review body must be at least 50 characters" }, { status: 400 });
  }

  const deadline = new Date();
  deadline.setFullYear(deadline.getFullYear() + 1);

  let created = 0;
  for (const r of reviews) {
    await prisma.orgReview.upsert({
      where: { orgProjectId_profileId: { orgProjectId: id, profileId: r.profileId } },
      create: {
        orgId: project.org.id,
        orgProjectId: id,
        profileId: r.profileId,
        body: r.body.trim(),
        deadline,
      },
      update: { body: r.body.trim() },
    });
    created++;
  }

  return NextResponse.json({ created });
}
