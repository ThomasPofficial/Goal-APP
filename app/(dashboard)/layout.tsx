import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isWalledStudent } from "@/lib/accountGate";
import SidebarShell from "@/components/layout/SidebarShell";
import { CAPABILITIES, computeEffectivePermissions } from "@/lib/facultyPermissions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Always read role from DB — never from JWT, which can be stale after seed/role changes.
  // Single primary-key lookup: O(1) for any number of users.
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      isAlumni: true,
      profile: {
        select: {
          displayName: true,
          schoolId: true,
          isCoreAdmin: true,
          staffPermissionOverrides: true,
          staffPermissionRevocations: true,
          staffTier: { select: { permissions: true } },
        },
      },
    },
  });

  const role = dbUser?.role ?? "STUDENT";
  const isSchool = role === "SCHOOL";
  const isOrg = role === "ORG" || role === "ADMIN";
  const isNivarroAdmin = role === "ADMIN";
  const profile = dbUser?.profile ?? null;
  // A STAFF account with no schoolId can't pass requireSchoolCapability (it keys
  // every check off profile.schoolId), so the sidebar must not advertise
  // Roster/Fundraise/Staff links it would be denied — never promise what the API denies.
  const isStaff = role === "STAFF" && !!profile?.schoolId;
  // Student/Alum account = STUDENT role with a school affiliation — walled-off nav.
  // (Standard = STUDENT role with no school affiliation; that's just "none of the above" here.)
  const isWalledStudentAccount = await isWalledStudent(session.user.id);
  const isAlumni = !!dbUser?.isAlumni;
  // A Core Admin bypasses the tier system entirely — treat them as having every
  // capability for nav-gating purposes, same as requireSchoolCapability does server-side.
  const staffCapabilities = !isStaff
    ? []
    : profile?.isCoreAdmin
      ? [...CAPABILITIES]
      : computeEffectivePermissions({
          tierPermissions: profile?.staffTier?.permissions ?? null,
          overrides: profile?.staffPermissionOverrides ?? "[]",
          revocations: profile?.staffPermissionRevocations ?? "[]",
        });

  // Org lookup only runs for org/admin accounts.
  // ADMIN: structural query finds the platform org regardless of which email is logged in.
  // ORG: createdById lookup (indexed) is O(1) at any scale.
  // ADMIN fallback: if no org is directly linked, find the platform org by structural identity.
  let myOrg: { id: string; name: string } | null = null;
  if (isOrg) {
    myOrg = await prisma.org.findFirst({
      where: { createdById: session.user.id },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    });
    if (!myOrg && isNivarroAdmin) {
      myOrg = await prisma.org.findFirst({
        where: { isPaid: true, verified: true, category: "FELLOWSHIP" },
        select: { id: true, name: true },
      });
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <SidebarShell
        userName={profile?.displayName ?? session.user.name}
        userEmail={session.user.email}
        myOrgId={myOrg?.id ?? null}
        myOrgName={myOrg?.name ?? null}
        isOrg={isOrg}
        isNivarroAdmin={isNivarroAdmin}
        isSchool={isSchool}
        isStaff={isStaff}
        staffCapabilities={staffCapabilities}
        isWalledStudent={isWalledStudentAccount}
        isAlumni={isAlumni}
      />
      <main className="dashboard-main min-h-screen pt-14 pb-[60px] md:pt-0 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
