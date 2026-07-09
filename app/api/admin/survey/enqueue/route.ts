import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchLinkedinProfile } from "@/lib/proxycurl";
import { extractPrefill, type SurveyPrefill } from "@/lib/survey-prefill";
import { sendSurveyEmail } from "@/lib/survey-email";

const LIMIT = 50;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function authorized(req: Request, role?: string | null): boolean {
  if (req.headers.get("Authorization") === `Bearer ${process.env.CRON_SECRET}`) return true;
  return role === "ADMIN" || role === "SCHOOL";
}

export async function POST(req: Request) {
  try {
  const session = await auth();
  if (!authorized(req, session?.user?.role as string | null))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const year = new Date().getFullYear();

  const pool = await prisma.user.findMany({
    where: {
      OR: [
        { isAlumni: true },
        { profile: { graduationYear: { lt: year } } },
      ],
      profile: { surveyOptOut: false },
    },
    select: {
      id: true,
      email: true,
      name: true,
      profile: {
        select: {
          displayName: true,
          linkedinUrl: true,
          linkedinScanOptOut: true,
        },
      },
      surveyTokens: { where: { year }, select: { id: true } },
    },
    skip: offset,
    take: LIMIT,
  });

  let sent = 0;
  let skipped = 0;

  for (const user of pool) {
    if (user.surveyTokens.length > 0 || !user.email) {
      skipped++;
      continue;
    }

    let prefill: SurveyPrefill | null = null;
    if (user.profile?.linkedinUrl && !user.profile.linkedinScanOptOut) {
      const raw = await fetchLinkedinProfile(user.profile.linkedinUrl);
      if (raw) prefill = await extractPrefill(raw);
      await sleep(1000);
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 60);

    const st = await prisma.surveyToken.create({
      data: {
        userId: user.id,
        year,
        expiresAt,
        prefillData: prefill ? JSON.stringify(prefill) : null,
      },
    });

    await sendSurveyEmail({
      to: user.email,
      name: user.profile?.displayName ?? user.name ?? "there",
      token: st.token,
      prefill,
    });

    sent++;
  }

  return NextResponse.json({ queued: pool.length, sent, skipped });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[survey/enqueue]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
