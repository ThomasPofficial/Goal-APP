import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// One-time seed route — creates the Nivarro Team demo org.
// Only the platform creator (SEED_ADMIN_EMAIL env var) can call this.
export async function POST() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "team.nivarro@gmail.com";
  if (session.user.email !== adminEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.org.findFirst({ where: { name: "Nivarro Team" } });
  if (existing) {
    return NextResponse.json({ message: "Already seeded", orgId: existing.id });
  }

  const org = await prisma.org.create({
    data: {
      name: "Nivarro Team",
      tagline: "Help build the platform from the inside.",
      description:
        "Nivarro is looking for driven high school students to join our internal operations team. " +
        "You'll work directly on growing the platform — everything from community outreach and content creation " +
        "to UX feedback and ambassador programs. This is a chance to be part of building something from the ground up.",
      whatWeSeek:
        "Self-starters who communicate clearly, follow through on commitments, and care about building something real. " +
        "No prior experience required — just curiosity, work ethic, and a genuine interest in the platform's mission.",
      category: "FELLOWSHIP",
      status: "OPEN",
      accentColor: "#4A80F0",
      minTeamSize: 1,
      maxTeamSize: 4,
      format: "Remote",
      stipend: "Unpaid — equity in the community you help build",
      autoAccept: true,
      createdById: session.user.id,
    },
  });

  const project = await prisma.orgProject.create({
    data: {
      orgId: org.id,
      title: "Platform Growth & Community Team",
      description:
        "Join Nivarro's internal growth team. Responsibilities span community management, " +
        "ambassador outreach, content creation, and direct product feedback. " +
        "You'll be the first generation of the Nivarro Team — shaping what the platform becomes.",
      requiredSkills: JSON.stringify([
        "Communication",
        "Social Media",
        "Content Creation",
        "Community Building",
        "Research",
      ]),
      openSpots: 3,
      status: "OPEN",
    },
  });

  return NextResponse.json({ message: "Seeded", orgId: org.id, projectId: project.id }, { status: 201 });
}
