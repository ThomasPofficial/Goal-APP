import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchLinkedinProfile } from "@/lib/proxycurl";
import { extractPrefill } from "@/lib/survey-prefill";
import { getResendClient } from "@/lib/resend";

const LIMIT = 20;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function authorized(req: Request, role?: string | null): boolean {
  if (req.headers.get("Authorization") === `Bearer ${process.env.CRON_SECRET}`) return true;
  return role === "ADMIN" || role === "SCHOOL";
}

export async function POST(req: Request) {
  const session = await auth();
  if (!authorized(req, session?.user?.role as string | null))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  const profiles = await prisma.profile.findMany({
    where: { linkedinUrl: { not: null }, linkedinScanOptOut: false },
    select: {
      id: true,
      userId: true,
      employer: true,
      jobTitle: true,
      confirmedCollege: true,
      confirmedMajor: true,
      linkedinUrl: true,
      user: { select: { name: true, email: true } },
    },
    orderBy: { lastLinkedinScan: "asc" },
    skip: offset,
    take: LIMIT,
  });

  const from   = process.env.FROM_EMAIL ?? "noreply@nivarro.co";
  const appUrl = process.env.AUTH_URL   ?? "https://app.nivarro.co";
  const admin  = await prisma.user.findFirst({
    where: { role: "SCHOOL" },
    select: { email: true },
  });
  const adminTo = admin?.email ?? from;

  let changes = 0;
  let errors  = 0;

  for (const p of profiles) {
    if (!p.linkedinUrl) continue;

    const raw = await fetchLinkedinProfile(p.linkedinUrl);
    await sleep(1000);
    if (!raw) { errors++; continue; }

    const fresh = await extractPrefill(raw);

    const checks = [
      { field: "employer",         prev: p.employer,         next: fresh.employer },
      { field: "jobTitle",         prev: p.jobTitle,         next: fresh.jobTitle },
      { field: "confirmedCollege", prev: p.confirmedCollege, next: fresh.college  },
      { field: "confirmedMajor",   prev: p.confirmedMajor,   next: fresh.major   },
    ];

    const detected = checks.filter((c) => c.next && c.next !== c.prev);

    if (detected.length > 0) {
      changes += detected.length;

      await prisma.linkedinScanEvent.createMany({
        data: detected.map((c) => ({
          userId:    p.userId,
          field:     c.field,
          prevValue: c.prev ?? null,
          newValue:  c.next ?? null,
          notified:  true,
        })),
      });

      const lines = detected
        .map((c) => `${c.field}: ${c.prev ?? "(none)"} → ${c.next}`)
        .join("<br>");

      await getResendClient().emails.send({
        from,
        to: adminTo,
        subject: `[Nivarro] Alumni update detected — ${p.user.name ?? "Unknown"}`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
  <h2 style="font-size:18px;margin:0 0 12px">${p.user.name ?? "An alumni"}'s LinkedIn shows changes</h2>
  <p style="background:#f5f5f5;padding:12px;font-size:13px;line-height:1.8">${lines}</p>
  <p style="font-size:13px;color:#58586a">Profile <strong>not</strong> auto-updated. <a href="${appUrl}/school/survey">View in survey dashboard</a>.</p>
</div>`,
      });
    }

    await prisma.profile.update({
      where: { id: p.id },
      data: { lastLinkedinScan: new Date() },
    });
  }

  return NextResponse.json({ scanned: profiles.length, changes, errors });
}
