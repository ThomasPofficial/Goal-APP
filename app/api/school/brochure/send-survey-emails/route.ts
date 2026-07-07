import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getResendClient } from "@/lib/resend";
import { surveyEmailHtml } from "@/lib/surveyEmailTemplate";
import { z } from "zod";
import { subMonths } from "date-fns";

const schema = z.object({ schoolId: z.string() });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (dbUser?.role !== "SCHOOL" && dbUser?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const { schoolId } = parsed.data;
  if (dbUser.role === "SCHOOL" && schoolId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const schoolUser = await prisma.user.findUnique({
    where: { id: schoolId },
    select: { name: true, profile: { select: { displayName: true } } },
  });
  const schoolName = schoolUser?.profile?.displayName ?? schoolUser?.name ?? "Your School";

  const cutoff = subMonths(new Date(), 11);

  const profilesWithIds = await prisma.profile.findMany({
    where: { schoolId },
    select: {
      id: true,
      user: { select: { email: true } },
      brochureData: { select: { lastEmailedAt: true } },
    },
  });

  const toEmail = profilesWithIds.filter((p) => {
    if (!p.user.email) return false;
    const last = p.brochureData?.lastEmailedAt;
    return !last || last < cutoff;
  });

  const resend = getResendClient();
  let sent = 0;
  const html = surveyEmailHtml(schoolName);
  const nowDate = new Date();

  for (const p of toEmail) {
    if (!p.user.email) continue;
    try {
      await resend.emails.send({
        from: "Nivarro <surveys@nivarro.co>",
        to: p.user.email,
        subject: `Update your outcomes — ${schoolName} annual survey`,
        html,
      });
      sent++;
    } catch {
      // Continue on individual failures
    }
    await prisma.studentBrochureData.upsert({
      where: { profileId: p.id },
      create: { profileId: p.id, lastEmailedAt: nowDate },
      update: { lastEmailedAt: nowDate },
    });
  }

  return NextResponse.json({ sent, skipped: profilesWithIds.length - sent });
}
