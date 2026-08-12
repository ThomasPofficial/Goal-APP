import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSchoolSession } from "@/lib/school-auth";
import { createAccountInvite } from "@/lib/account-invite";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const check = await getSchoolSession();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { schoolId } = check;
  const { userId } = await params;

  // Security: only resend for a member that belongs to this school
  const profile = await prisma.profile.findFirst({
    where: { userId, schoolId },
    include: { user: { select: { email: true, emailVerified: true } } },
  });

  if (!profile || !profile.user.email) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  if (profile.user.emailVerified) {
    return NextResponse.json(
      { error: "This member has already activated their account." },
      { status: 404 }
    );
  }

  const invite = await createAccountInvite({
    email: profile.user.email,
    name: profile.displayName,
  });

  return NextResponse.json({ activateUrl: invite.activateUrl });
}
