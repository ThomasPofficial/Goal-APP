import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSchoolIds } from "@/lib/communities";
import { z } from "zod";

const requestSchema = z.object({
  toUserId: z.string().min(1),
  message: z.string().trim().max(500).optional(),
});

// POST — student/alumni requests a private connection with a teacher or alumnus
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fromUserId = session.user.id;

  const body = await req.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { toUserId, message } = parsed.data;

  if (toUserId === fromUserId) {
    return NextResponse.json({ error: "Cannot connect with yourself" }, { status: 400 });
  }

  const [fromUser, toUser] = await Promise.all([
    prisma.user.findUnique({
      where: { id: fromUserId },
      select: { role: true, isAlumni: true, profile: { select: { staffTitle: true } } },
    }),
    prisma.user.findUnique({
      where: { id: toUserId },
      select: { role: true, isAlumni: true, profile: { select: { staffTitle: true } } },
    }),
  ]);

  if (!fromUser || !toUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Requester is always a Student/Alum — teacher accounts only approve, never request.
  if (fromUser.role === "SCHOOL") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [fromSchoolIds, toSchoolIds] = await Promise.all([
    getSchoolIds(fromUserId),
    getSchoolIds(toUserId),
  ]);

  const sharedSchoolId = fromSchoolIds.find((id) => toSchoolIds.includes(id));

  if (!sharedSchoolId) {
    return NextResponse.json({ error: "Not in the same school" }, { status: 400 });
  }

  // No pure student <-> student requests — at least one side must be alumni or staff/teacher.
  // Staff/teacher accounts are role=STUDENT with a Profile.staffTitle (only the single
  // school admin login is role=SCHOOL), matching how /school/mentorship defines "mentor".
  // fromUser can never be SCHOOL here (rejected above).
  const fromEligible = fromUser.isAlumni || !!fromUser.profile?.staffTitle;
  const toEligible = toUser.role === "SCHOOL" || toUser.isAlumni || !!toUser.profile?.staffTitle;
  if (!fromEligible && !toEligible) {
    return NextResponse.json({ error: "Not an eligible mentor/staff connection" }, { status: 400 });
  }

  const existing = await prisma.connectionRequest.findFirst({
    where: {
      status: { in: ["PENDING", "ACCEPTED"] },
      OR: [
        { fromUserId, toUserId },
        { fromUserId: toUserId, toUserId: fromUserId },
      ],
    },
  });
  if (existing) {
    return NextResponse.json({ error: "A request already exists" }, { status: 409 });
  }

  const request = await prisma.connectionRequest.create({
    data: { schoolId: sharedSchoolId, fromUserId, toUserId, status: "PENDING", message: message || null },
  });

  return NextResponse.json({ request });
}
