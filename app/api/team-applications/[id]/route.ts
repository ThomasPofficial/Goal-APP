import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ status: z.enum(["ACCEPTED", "REJECTED"]) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const application = await prisma.teamApplication.findUnique({
    where: { id },
    include: { orgProject: { select: { orgId: true } } },
  });
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.teamApplication.update({
    where: { id },
    data: { status: parsed.data.status, decidedAt: new Date() },
  });

  if (parsed.data.status === "ACCEPTED") {
    await prisma.team.update({
      where: { id: application.teamId },
      data: { status: "ACCEPTED" },
    });
  }

  return NextResponse.json({ application: updated });
}
