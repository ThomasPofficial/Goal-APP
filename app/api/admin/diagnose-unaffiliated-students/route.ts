import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

// READ-ONLY. Reports every STUDENT-role account with no school affiliation
// (Profile.schoolId IS NULL) so a human can tell real signups apart from
// seeded/mock accounts before anything gets deleted. Makes no changes.

const KNOWN_SEED_BIOS = [
  "I build platforms that help ambitious people find each other.",
  "The best products come from teams that genuinely understand each other.",
  "I turn ambitious plans into running systems.",
  "I find the signal in the noise.",
  "I think in narratives and design in systems.",
];
const KNOWN_SEED_HEADLINES = [
  "Builder & Systems Thinker",
  "Team Builder & People Leader",
  "Operations & Execution Lead",
  "Data Researcher & Analytical Strategist",
  "Creative Strategist & Product Thinker",
];
const KNOWN_SEED_PASSWORDS = [
  "nivarro123",
  "password123",
  "demo2026",
  "scholar2026",
  "ridgepoint2026",
  "nivarro2026",
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== "niv-reset-2026") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const profiles = await prisma.profile.findMany({
    where: { schoolId: null, user: { role: "STUDENT" } },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          passwordHash: true,
          createdAt: true,
          _count: {
            select: {
              sentMessages: true,
              sessions: true,
              participations: true,
              endorsementsGiven: true,
              endorsementsReceived: true,
              projectMemberships: true,
              notes: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const report = [];

  for (const p of profiles) {
    const u = p.user;
    const activityTotal =
      u._count.sentMessages +
      u._count.sessions +
      u._count.participations +
      u._count.endorsementsGiven +
      u._count.endorsementsReceived +
      u._count.projectMemberships +
      u._count.notes;

    let seedPasswordMatch: string | null = null;
    if (u.passwordHash) {
      for (const pw of KNOWN_SEED_PASSWORDS) {
        if (await bcrypt.compare(pw, u.passwordHash)) {
          seedPasswordMatch = pw;
          break;
        }
      }
    }

    const bioIsSeedText = p.bio ? KNOWN_SEED_BIOS.includes(p.bio) : false;
    const headlineIsSeedText = p.headline ? KNOWN_SEED_HEADLINES.includes(p.headline) : false;

    const ownedOrgs = await prisma.org.findMany({
      where: { createdById: u.id },
      select: { id: true, name: true },
    });

    const signals: string[] = [];
    if (seedPasswordMatch) signals.push(`password still matches seed value "${seedPasswordMatch}"`);
    if (bioIsSeedText) signals.push("bio is verbatim seed-script text");
    if (headlineIsSeedText) signals.push("headline is verbatim seed-script text");
    if (p.isDemo) signals.push("Profile.isDemo = true");
    if (activityTotal === 0) signals.push("zero activity");
    if (ownedOrgs.length > 0) signals.push(`owns ${ownedOrgs.length} org(s)`);

    const strongSeedSignalCount = [seedPasswordMatch, bioIsSeedText, headlineIsSeedText, p.isDemo].filter(Boolean).length;
    const verdict =
      strongSeedSignalCount >= 2 || seedPasswordMatch
        ? "LIKELY_SEEDED"
        : activityTotal > 0
        ? "HAS_REAL_ACTIVITY"
        : "UNCERTAIN";

    report.push({
      email: u.email,
      name: u.name,
      createdAt: u.createdAt.toISOString(),
      activityTotal,
      activityBreakdown: u._count,
      signals,
      ownedOrgs: ownedOrgs.map((o) => o.name),
      verdict,
    });
  }

  return NextResponse.json({ count: report.length, accounts: report });
}
