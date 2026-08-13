import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import SchoolDetailClient from "./SchoolDetailClient";
import { getSchoolRosterMembers } from "@/lib/school-roster";

export default async function SchoolDetailPage({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (dbUser?.role !== "ADMIN") redirect("/dashboard");

  const { schoolId } = await params;

  // Fetch school
  const schoolUser = await prisma.user.findUnique({
    where: { id: schoolId, role: "SCHOOL" },
    select: {
      id: true,
      email: true,
      createdAt: true,
      profile: {
        select: {
          displayName: true,
          headline: true,
          advancementEmail: true,
        },
      },
    },
  });

  if (!schoolUser) {
    return (
      <div>
        <p
          style={{
            color: "var(--muted)",
            fontSize: 15,
            marginBottom: 16,
          }}
        >
          School not found.
        </p>
        <Link
          href="/hq"
          style={{
            color: "var(--amber)",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          &larr; Back to Schools
        </Link>
      </div>
    );
  }

  // Fetch all members linked to this school (direct + AlumniSchool-linked alumni)
  const members = await getSchoolRosterMembers(schoolId);

  const school = {
    id: schoolUser.id,
    email: schoolUser.email ?? null,
    createdAt: schoolUser.createdAt.toISOString(),
    profile: schoolUser.profile,
  };

  // Fetch campaigns for this school
  const rawCampaigns = await prisma.campaign.findMany({
    where: { schoolId },
    include: { pledges: { select: { pledgeAmount: true } } },
    orderBy: { createdAt: "desc" },
  });

  const campaigns = rawCampaigns.map((c) => {
    const pledgeTotal = c.pledges.reduce((sum, p) => {
      return sum + (p.pledgeAmount ? parseFloat(p.pledgeAmount.toString()) : 0);
    }, 0);
    return {
      id: c.id,
      title: c.headline,
      cause: c.cause,
      goalAmount: c.goalAmount ? parseFloat(c.goalAmount.toString()) : null,
      manualAdjustment: parseFloat(c.manualAdjustment.toString()),
      pledgeTotal,
      active: c.active,
      createdAt: c.createdAt.toISOString(),
    };
  });

  return <SchoolDetailClient school={school} members={members} campaigns={campaigns} />;
}
