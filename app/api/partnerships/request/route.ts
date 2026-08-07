import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSchoolId } from "@/lib/communities";
import { isEligiblePartner, PARTNERSHIP_WINDOW_MS } from "@/lib/partnerships";
import { z } from "zod";

const requestSchema = z.object({
  toUserIds: z.array(z.string().min(1)).min(1),
  message: z.string().trim().max(500).optional(),
});

// POST — student/alumni requests a group partnership with any mix of people at their school
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const fromUserId = session.user.id;

  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const toUserIds = [...new Set(parsed.data.toUserIds)];
  const message = parsed.data.message || null;

  if (toUserIds.includes(fromUserId)) {
    return NextResponse.json({ error: "Cannot invite yourself" }, { status: 400 });
  }

  const fromUser = await prisma.user.findUnique({
    where: { id: fromUserId },
    select: { role: true },
  });
  if (!fromUser || fromUser.role === "SCHOOL") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const fromSchoolId = await getSchoolId(fromUserId);
  if (!fromSchoolId) {
    return NextResponse.json({ error: "Not in a school" }, { status: 400 });
  }

  const invitees = await prisma.user.findMany({
    where: { id: { in: toUserIds } },
    select: { id: true, profile: { select: { schoolId: true } } },
  });
  if (invitees.length !== toUserIds.length) {
    return NextResponse.json({ error: "One or more invitees not found" }, { status: 404 });
  }
  const allSameSchool = invitees.every((u) => u.profile?.schoolId === fromSchoolId);
  if (!allSameSchool) {
    return NextResponse.json({ error: "All invitees must be in your school" }, { status: 400 });
  }

  const eligibility = await Promise.all(toUserIds.map((id) => isEligiblePartner(id)));
  if (!eligibility.some(Boolean)) {
    return NextResponse.json({ error: "Include at least one alumni or teacher/staff member" }, { status: 400 });
  }

  const request = await prisma.partnershipRequest.create({
    data: {
      schoolId: fromSchoolId,
      fromUserId,
      message,
      expiresAt: new Date(Date.now() + PARTNERSHIP_WINDOW_MS),
      invites: { create: toUserIds.map((userId) => ({ userId })) },
    },
    include: { invites: true },
  });

  return NextResponse.json({ request });
}
