import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { status } = await req.json();

  if (!["ACCEPTED", "REJECTED"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const application = await prisma.teamApplication.findUnique({
    where: { id },
    select: {
      id: true,
      teamId: true,
      status: true,
      orgProject: { select: { org: { select: { createdById: true } } } },
    },
  });

  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (application.orgProject.org.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (application.status !== "PENDING") {
    return NextResponse.json({ error: "Already decided" }, { status: 409 });
  }

  const updated = await prisma.teamApplication.update({
    where: { id },
    data: { status, decidedAt: new Date() },
  });

  if (status === "ACCEPTED") {
    await prisma.team.update({
      where: { id: application.teamId },
      data: { status: "ACCEPTED" },
    });
  }

  return NextResponse.json(updated);
}
