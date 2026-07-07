import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import DashboardClient from "./DashboardClient";
import WhySchoolBanner from "@/components/school/WhySchoolBanner";
import type { GeniusTypeKey } from "@/lib/geniusTypes";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const userRole = (session.user as { role?: string }).role ?? "STUDENT";

  if (userRole === "SCHOOL") redirect("/school/destinations");

  // Only redirect ORG/ADMIN accounts to their org dashboard — students stay here
  if (userRole === "ORG" || userRole === "ADMIN") {
    const myOrg = await prisma.org.findFirst({
      where: { createdById: userId },
      select: { id: true },
    });
    if (myOrg) redirect(`/orgs/${myOrg.id}`);
  }

  const cookieStore = await cookies();
  const tutorialDismissed = cookieStore.get("nv_tutorial_dismissed")?.value === "1";

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: {
      id: true,
      displayName: true,
      handle: true,
      avatarUrl: true,
      geniusType: true,
      secondaryGeniusType: true,
      currentFocus: true,
      traitLinks: { select: { id: true } },
      savedOrgs: { select: { id: true } },
      savedOpportunities: { select: { id: true } },
      teamMemberships: {
        select: {
          teamId: true,
          team: {
            select: {
              id: true,
              name: true,
              conversation: {
                select: {
                  id: true,
                  participants: { where: { userId }, select: { lastReadAt: true } },
                  messages: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
                },
              },
            },
          },
        },
        take: 4,
      },
    },
  });

  // Banner: show "Why [School]?" if student is school-linked and admin enabled visibility
  let bannerData: { schoolName: string; studentsCount: number; collegesCount: number; jobsCount: number } | null = null;
  if (profile?.schoolId) {
    const [settings, schoolUser, studentCounts] = await Promise.all([
      prisma.schoolBrochureSettings.findUnique({
        where: { schoolId: profile.schoolId },
        select: { visibility: true },
      }),
      prisma.user.findUnique({
        where: { id: profile.schoolId },
        select: { name: true, profile: { select: { displayName: true } } },
      }),
      prisma.studentBrochureData.findMany({
        where: { profile: { schoolId: profile.schoolId } },
        select: { college: true, jobTitle: true, employer: true, internshipTitle: true, internshipOrg: true },
      }),
    ]);

    if (settings?.visibility === "STUDENTS") {
      const colleges = new Set(studentCounts.map((s) => s.college).filter(Boolean)).size;
      const jobs = studentCounts.filter((s) => (s.jobTitle && s.employer) || (s.internshipTitle && s.internshipOrg)).length;
      bannerData = {
        schoolName:    schoolUser?.profile?.displayName ?? schoolUser?.name ?? "Your School",
        studentsCount: studentCounts.length,
        collegesCount: colleges,
        jobsCount:     jobs,
      };
    }
  }

  const seenSpaces = new Set<string>();
  const spaces = (profile?.teamMemberships ?? [])
    .filter((m) => { if (seenSpaces.has(m.team.id)) return false; seenSpaces.add(m.team.id); return true; })
    .map((m) => {
      const convo = m.team.conversation[0];
      const lastRead = convo?.participants[0]?.lastReadAt;
      const lastMsg = convo?.messages[0]?.createdAt;
      const hasUnread = lastMsg && (!lastRead || lastMsg > lastRead);
      return { id: m.team.id, name: m.team.name, hasUnread: !!hasUnread };
    });

  const hasTeam = (profile?.teamMemberships?.length ?? 0) > 0;
  const hasApplied = profile?.id
    ? (await prisma.teamApplication.count({
        where: { team: { members: { some: { profileId: profile.id } } } },
      })) > 0
    : false;

  const traitsDone = (profile?.traitLinks?.length ?? 0) > 0;

  // Hide tutorial widget when there's an active workflow — two flows at once is confusing
  const hasActiveWorkflow = profile?.id
    ? (await prisma.workflowSession.count({ where: { profileId: profile.id } })) > 0
    : false;

  return (
    <>
      {bannerData && (
        <WhySchoolBanner
          schoolName={bannerData.schoolName}
          studentsCount={bannerData.studentsCount}
          collegesCount={bannerData.collegesCount}
          jobsCount={bannerData.jobsCount}
        />
      )}
      <DashboardClient
      profile={{
        displayName: profile?.displayName ?? session.user.name ?? "there",
        handle: profile?.handle ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
        geniusType: (profile?.geniusType as GeniusTypeKey | null) ?? null,
        secondaryGeniusType: (profile?.secondaryGeniusType as GeniusTypeKey | null) ?? null,
        currentFocus: profile?.currentFocus ?? null,
        savedCount: (profile?.savedOrgs?.length ?? 0) + (profile?.savedOpportunities?.length ?? 0),
      }}
      spaces={spaces}
      traitsDone={traitsDone}
      tutorialDismissed={tutorialDismissed || hasActiveWorkflow}
      tutorial={{
        hasGeniusType: !!profile?.geniusType,
        traitsDone,
        hasTeam,
        hasApplied,
        hasBrowsedOrgs: hasTeam || hasApplied,
      }}
    />
    </>
  );
}
