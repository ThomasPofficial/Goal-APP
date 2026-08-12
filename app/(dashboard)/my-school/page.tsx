import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SchoolHubClient from "./SchoolHubClient";
import { finalizeExpiredPartnershipRequests } from "@/lib/partnerships";
import { getLinkedSchools } from "@/lib/communities";

export default async function MySchoolPage(props: {
  searchParams: Promise<{ school?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const linkedSchools = await getLinkedSchools(session.user.id);

  if (linkedSchools.length === 0) {
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

  const searchParams = await props.searchParams;
  const requestedId = searchParams.school;
  const activeSchool = linkedSchools.find((s) => s.id === requestedId) ?? linkedSchools[0];
  const schoolId = activeSchool.id;

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
    prisma.alumniSchool.findMany({
      where: {
        schoolId,
        profile: { userId: { not: session.user.id } },
      },
      select: {
        profile: {
          select: {
            userId: true,
            displayName: true,
            handle: true,
            avatarUrl: true,
            bio: true,
            industry: true,
            graduationYear: true,
            isAvailableToMentor: true,
            intendedCollege: true,
            user: { select: { name: true } },
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
      // AlumniSchool.createdAt is when this alum linked to THIS school (not Profile.createdAt,
      // which is account creation and can predate the link for multi-school alumni).
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

  const formattedAlumni = allAlumni.map((link) => {
    const p = link.profile;
    return {
      id: p.userId,
      displayName: p.displayName ?? p.user.name ?? "Alumni",
      handle: p.handle ?? null,
      avatarUrl: p.avatarUrl ?? null,
      bio: p.bio ?? null,
      industry: p.industry ?? null,
      graduationYear: p.graduationYear ?? null,
      isAvailableToMentor: p.isAvailableToMentor ?? false,
      intendedCollege: p.intendedCollege ?? null,
      orgs: [
        ...new Set([
          ...p.teamMemberships.map((m) => m.team.org?.name).filter(Boolean),
          ...p.orgReviews.map((r) => r.org.name),
        ]),
      ].slice(0, 3) as string[],
    };
  });

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
      otherSchools={linkedSchools.filter((s) => s.id !== schoolId)}
    />
  );
}
