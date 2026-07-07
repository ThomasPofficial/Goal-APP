import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const appUrl = process.env.AUTH_URL ?? "https://app.nivarro.co";
  const base = `${appUrl}/survey/${token}`;

  const st = await prisma.surveyToken.findUnique({
    where: { token },
    include: { user: { select: { profile: { select: { id: true } } } } },
  });

  if (!st)                       return NextResponse.redirect(`${base}?error=true`);
  if (st.expiresAt < new Date()) return NextResponse.redirect(`${base}?error=true`);
  if (st.respondedAt)            return NextResponse.redirect(`${base}?already=true`);

  const profileId = st.user.profile?.id;
  if (!profileId) return NextResponse.redirect(`${base}?error=true`);

  const ct = req.headers.get("content-type") ?? "";
  const body: Record<string, string> = {};
  if (ct.includes("application/json")) {
    Object.assign(body, await req.json());
  } else {
    const form = await req.formData();
    for (const [k, v] of form.entries()) body[k] = v.toString();
  }

  await prisma.profile.update({
    where: { id: profileId },
    data: {
      ...(body.confirmedCollege && { confirmedCollege: body.confirmedCollege }),
      ...(body.confirmedMajor   && { confirmedMajor:   body.confirmedMajor }),
      ...(body.industry         && { industry:         body.industry }),
      ...(body.employer         && { employer:         body.employer }),
      ...(body.jobTitle         && { jobTitle:         body.jobTitle }),
      ...(body.linkedinUrl      && { linkedinUrl:      body.linkedinUrl }),
    },
  });

  await prisma.surveyToken.update({
    where: { token },
    data: { respondedAt: new Date() },
  });

  return NextResponse.redirect(`${base}?success=true`);
}
