import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const appUrl = process.env.AUTH_URL ?? "https://app.nivarro.co";

  const st = await prisma.surveyToken.findUnique({
    where: { token },
    select: { userId: true },
  });

  if (st) {
    const profile = await prisma.profile.findUnique({
      where: { userId: st.userId },
      select: { id: true },
    });
    if (profile) {
      await prisma.profile.update({
        where: { id: profile.id },
        data: { surveyOptOut: true },
      });
    }
  }

  return NextResponse.redirect(`${appUrl}/survey/optout-confirmed`);
}
