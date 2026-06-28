import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== "niv-reset-2026") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // ── Mark priya, marcus, zoe as alumni + set profile fields ────────────
    const priya = await prisma.user.findUnique({ where: { email: "priya@nivarro.io" } });
    if (priya) {
      await prisma.user.update({ where: { id: priya.id }, data: { isAlumni: true } });
      const priyaProfile = await prisma.profile.findUnique({ where: { userId: priya.id } });
      if (priyaProfile) {
        await prisma.profile.update({
          where: { id: priyaProfile.id },
          data: {
            intendedCollege: "Stanford University",
            intendedMajor: "Computer Science",
            graduationYear: 2025,
            isAvailableToMentor: true,
            industry: "Technology",
          },
        });
      } else {
        await prisma.profile.create({
          data: {
            userId: priya.id,
            displayName: "Priya Nair",
            handle: "priyanair",
            headline: "Data Scientist & AI Researcher",
            bio: "I analyze systems nobody else thinks to question. Now doing CS at Stanford.",
            intendedCollege: "Stanford University",
            intendedMajor: "Computer Science",
            graduationYear: 2025,
            isAvailableToMentor: true,
            industry: "Technology",
            geniusType: "STEEL",
            onboardingComplete: true,
          },
        });
      }
    }

    const marcus = await prisma.user.findUnique({ where: { email: "marcus@nivarro.io" } });
    if (marcus) {
      await prisma.user.update({ where: { id: marcus.id }, data: { isAlumni: true } });
      const marcusProfile = await prisma.profile.findUnique({ where: { userId: marcus.id } });
      if (marcusProfile) {
        await prisma.profile.update({
          where: { id: marcusProfile.id },
          data: {
            intendedCollege: "University of Pennsylvania",
            intendedMajor: "Economics & Entrepreneurship",
            graduationYear: 2025,
            isAvailableToMentor: true,
            industry: "Venture & Startups",
          },
        });
      }
    }

    const zoe = await prisma.user.findUnique({ where: { email: "zoe@nivarro.io" } });
    if (zoe) {
      await prisma.user.update({ where: { id: zoe.id }, data: { isAlumni: true } });
      const zoeProfile = await prisma.profile.findUnique({ where: { userId: zoe.id } });
      if (zoeProfile) {
        await prisma.profile.update({
          where: { id: zoeProfile.id },
          data: {
            intendedCollege: "Carnegie Mellon University",
            intendedMajor: "Computer Science",
            graduationYear: 2025,
            isAvailableToMentor: false,
            industry: "Engineering",
          },
        });
      } else {
        await prisma.profile.create({
          data: {
            userId: zoe.id,
            displayName: "Zoe Kim",
            handle: "zoekim",
            headline: "Full-Stack Engineer & Open Source Contributor",
            bio: "I ship real products. Currently at CMU studying CS.",
            intendedCollege: "Carnegie Mellon University",
            intendedMajor: "Computer Science",
            graduationYear: 2025,
            isAvailableToMentor: false,
            industry: "Engineering",
            geniusType: "DYNAMO",
            onboardingComplete: true,
          },
        });
      }
    }

    // ── Student college destinations ───────────────────────────────────────
    const destinations: Array<{ email: string; college: string; major: string; year: number }> = [
      { email: "thomas@piacentine.dev",       college: "Stanford University",         major: "Computer Science",              year: 2027 },
      { email: "diego.ramirez@nivarro.demo",  college: "UC Berkeley",                major: "EECS",                          year: 2028 },
      { email: "aiko.tanaka@nivarro.demo",    college: "Carnegie Mellon University",  major: "Human-Computer Interaction",    year: 2027 },
      { email: "jordan.hayes@nivarro.demo",   college: "MIT",                         major: "Computer Science",              year: 2028 },
      { email: "elena@nivarro.demo",          college: "Yale University",             major: "Political Science",             year: 2027 },
      { email: "james@nivarro.demo",          college: "University of Chicago",       major: "Economics",                     year: 2028 },
      { email: "amara@nivarro.demo",          college: "Georgetown University",       major: "Government & Public Policy",    year: 2027 },
      { email: "noah@nivarro.demo",           college: "Harvard University",          major: "Government",                    year: 2028 },
      { email: "maya@nivarro.demo",           college: "Columbia University",         major: "Political Science",             year: 2027 },
    ];

    for (const d of destinations) {
      const user = await prisma.user.findUnique({ where: { email: d.email } });
      if (!user) continue;
      const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
      if (!profile) continue;
      await prisma.profile.update({
        where: { id: profile.id },
        data: {
          intendedCollege: d.college,
          intendedMajor: d.major,
          graduationYear: d.year,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      message: "School mock data seeded successfully",
      alumni: ["priya@nivarro.io", "marcus@nivarro.io", "zoe@nivarro.io"],
      destinations: destinations.map((d) => `${d.email} → ${d.college}`),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    return NextResponse.json({ error: msg, stack }, { status: 500 });
  }
}
