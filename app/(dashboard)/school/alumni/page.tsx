import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AlumniClient from "./AlumniClient";

export default async function AlumniPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "SCHOOL" && dbUser?.role !== "ADMIN") redirect("/dashboard");

  const alumni = await prisma.user.findMany({
    where: { isAlumni: true },
    select: {
      id: true,
      name: true,
      profile: {
        select: {
          id: true,
          displayName: true,
          handle: true,
          avatarUrl: true,
          bio: true,
          industry: true,
          graduationYear: true,
          isAvailableToMentor: true,
          intendedCollege: true,
          teamMemberships: {
            select: {
              team: {
                select: {
                  name: true,
                  org: { select: { name: true } },
                },
              },
            },
            take: 3,
          },
          orgReviews: {
            select: { org: { select: { name: true } } },
            take: 3,
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const mentorshipGroups = await prisma.conversation.findMany({
    where: {
      type: "MENTORSHIP",
      participants: { some: { userId: { in: alumni.map((u) => u.id) } } },
    },
    select: {
      id: true,
      participants: {
        select: {
          userId: true,
          user: {
            select: {
              isAlumni: true,
              profile: { select: { displayName: true, staffTitle: true } },
            },
          },
        },
      },
    },
  });

  const groupsByAlumId = new Map<string, { id: string; students: string[] }[]>();
  for (const group of mentorshipGroups) {
    const mentorIds = group.participants
      .filter((p) => p.user.isAlumni)
      .map((p) => p.userId);
    if (mentorIds.length === 0) continue;
    const students = group.participants
      .filter((p) => !p.user.isAlumni && !p.user.profile?.staffTitle)
      .map((p) => p.user.profile?.displayName ?? "Student");
    if (students.length === 0) continue;
    for (const mentorId of mentorIds) {
      const existing = groupsByAlumId.get(mentorId) ?? [];
      existing.push({ id: group.id, students });
      groupsByAlumId.set(mentorId, existing);
    }
  }

  const formatted = alumni.map((u) => ({
    id: u.id,
    displayName: u.profile?.displayName ?? u.name ?? "Alumni",
    handle: u.profile?.handle ?? null,
    avatarUrl: u.profile?.avatarUrl ?? null,
    bio: u.profile?.bio ?? null,
    industry: u.profile?.industry ?? null,
    graduationYear: u.profile?.graduationYear ?? null,
    isAvailableToMentor: u.profile?.isAvailableToMentor ?? false,
    intendedCollege: u.profile?.intendedCollege ?? null,
    orgs: [
      ...new Set([
        ...(u.profile?.teamMemberships ?? []).map((m) => m.team.org?.name).filter(Boolean),
        ...(u.profile?.orgReviews ?? []).map((r) => r.org.name),
      ]),
    ].slice(0, 3) as string[],
    mentorshipGroups: groupsByAlumId.get(u.id) ?? [],
  }));

  return <AlumniClient alumni={formatted} />;
}
