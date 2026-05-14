import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ status: z.enum(["ACCEPTED", "DECLINED"]) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const myProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!myProfile) return NextResponse.json({ error: "No profile" }, { status: 404 });

  const request = await prisma.recruitmentRequest.findUnique({ where: { id } });
  if (!request || request.toProfileId !== myProfile.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.recruitmentRequest.update({
    where: { id },
    data: { status: parsed.data.status },
  });

  if (parsed.data.status === "ACCEPTED") {
    const alreadyMember = await prisma.teamMember.findUnique({
      where: { teamId_profileId: { teamId: request.teamId, profileId: myProfile.id } },
    });
    if (!alreadyMember) {
      await prisma.teamMember.create({
        data: { teamId: request.teamId, profileId: myProfile.id, role: "MEMBER" },
      });
    }
  }

  return NextResponse.json({ request: updated });
}
