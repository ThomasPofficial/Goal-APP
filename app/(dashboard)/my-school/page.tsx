import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SchoolHubClient from "./SchoolHubClient";
import { finalizeExpiredPartnershipRequests } from "@/lib/partnerships";

export default async function MySchoolPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { schoolId: true },
  });

  if (!profile?.schoolId) {
    return (
      <div style={{ maxWidth: 720 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 3vw, 36px)", letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 8px" }}>
          My School
        </h1>
        <p style={{ fontSize: 14, color: "var(--n-text2)", margin: "0 0 32px" }}>
          Your school hasn&apos;t set up a Nivarro hub yet.
        </p>
        <div style={{ padding: "40px 32px", border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 0, textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: "0 0 12px" }}>
            Not configured
          </p>
          <p style={{ fontSize: 14, color: "var(--n-text2)", margin: 0, maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}>
            Ask your school counselor to activate Nivarro for your school. Once they do, you&apos;ll see your alumni network, mentors, and staff here.
          </p>
        </div>
      </div>
    );
  }

  const schoolId = profile.schoolId;

  await finalizeExpiredPartnershipRequests(schoolId);

  const [school, staffProfiles, allAlumni, allStudents] = await Promise.all([
    prisma.user.findUnique({
      where: { id: schoolId },
      select: {
        name: true,
        profile: { select: { displayName: true, headline: true, bio: true } },
      },
    }),
    prisma.profile.findMany({
      where: { schoolId, staffTitle: { not: null }, userId: { not: session.user.id } },
      select: {
        userId: true,
        displayName: true,
        staffTitle: true,
        bio: true,
        avatarUrl: true,
        handle: true,
        industry: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      where: {
        isAlumni: true,
        profile: { schoolId },
        id: { not: session.user.id },
      },
      select: {
        id: true,
        name: true,
        profile: {
          select: {
            displayName: true,
            handle: true,
            avatarUrl: true,
            bio: true,
            industry: true,
            graduationYear: true,
            isAvailableToMentor: true,
            intendedCollege: true,
            teamMemberships: {
              select: { team: { select: { name: true, org: { select: { name: true } } } } },
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
    }),
    prisma.profile.findMany({
      where: { schoolId, staffTitle: null, user: { isAlumni: false }, userId: { not: session.user.id } },
      select: { userId: true, displayName: true, handle: true, avatarUrl: true, graduationYear: true },
      orderBy: { displayName: "asc" },
    }),
  ]);

  const schoolName = school?.profile?.displayName ?? school?.name ?? "Your School";
  const schoolTagline = school?.profile?.headline ?? "Your private Nivarro community";

  const formattedAlumni = allAlumni.map((u) => ({
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
  }));

  const mentors = formattedAlumni.filter((a) => a.isAvailableToMentor);

  const formattedStudents = allStudents.map((s) => ({
    id: s.userId,
    displayName: s.displayName,
    handle: s.handle,
    avatarUrl: s.avatarUrl,
    graduationYear: s.graduationYear,
  }));

  return (
    <SchoolHubClient
      schoolName={schoolName}
      schoolTagline={schoolTagline}
      staff={staffProfiles}
      alumni={formattedAlumni}
      mentors={mentors}
      students={formattedStudents}
      currentUserId={session.user.id}
    />
  );
}
