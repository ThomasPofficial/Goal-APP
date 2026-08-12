import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import TraitQuizClient from "./TraitQuizClient";

export default async function QuizPage() {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const dbUser = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, profile: { select: { schoolId: true } } },
      })
    : null;

  const isSchoolAffiliatedStudent = dbUser?.role === "STUDENT" && !!dbUser.profile?.schoolId;

  // Student/Alum accounts are walled off from this quiz entirely.
  if (isSchoolAffiliatedStudent) redirect("/dashboard");

  const profile = userId
    ? await prisma.profile.findUnique({
        where: { userId },
        select: {
          id: true,
          strengthSummary: true,
          traitLinks: {
            orderBy: { order: "asc" },
            include: { trait: true },
          },
        },
      })
    : null;

  const workflowSession = profile?.id
    ? await prisma.workflowSession.findUnique({
        where: { profileId: profile.id },
        select: { step: true },
      })
    : null;

  const traitsDone = (profile?.traitLinks?.length ?? 0) > 0;
  const hasActiveWorkflow = !!workflowSession;
  const existingTraits = profile?.traitLinks?.map((l) => ({
    id: l.trait.id,
    slug: l.trait.slug,
    name: l.trait.name,
    category: l.trait.category,
  })) ?? [];

  return (
    <div className="max-w-2xl mx-auto pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#e8e8ec] mb-1">Skill Assessment</h1>
        <p className="text-sm text-[#9898a8]">
          A short quiz to build your Skill Card — shown on your profile and matched to opportunities.
        </p>
      </div>

      <TraitQuizClient
        alreadyCompleted={traitsDone}
        existingTraits={existingTraits}
        existingSummary={profile?.strengthSummary ?? null}
        hasActiveWorkflow={hasActiveWorkflow}
      />
    </div>
  );
}
