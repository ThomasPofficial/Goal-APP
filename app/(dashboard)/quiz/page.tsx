import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import QuizClient from "./QuizClient";
import TraitQuizClient from "./TraitQuizClient";
import { CheckCircle2 } from "lucide-react";

export default async function QuizPage(props: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const searchParams = await props.searchParams;
  const tab = searchParams.tab === "traits" ? "traits" : "genius";

  const session = await auth();
  const userId = session!.user!.id;

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: {
      geniusType: true,
      traitLinks: { select: { id: true } },
    },
  });

  const geniusDone = !!profile?.geniusType;
  const traitsDone = (profile?.traitLinks?.length ?? 0) > 0;

  return (
    <div>
      {/* Tab switcher */}
      <div className="max-w-lg mx-auto pt-8 pb-0">
        <div className="flex gap-1 bg-[#16161a] border border-[#2a2a33] rounded-lg p-1 mb-1">
          <Link
            href="/quiz?tab=genius"
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium rounded-md px-4 py-2 transition-colors ${
              tab === "genius"
                ? "bg-[#c9a84c] text-[#0f0f11]"
                : "text-[#9898a8] hover:text-[#e8e8ec]"
            }`}
          >
            Genius Quiz
            {geniusDone && (
              <CheckCircle2
                className={`w-3.5 h-3.5 ${
                  tab === "genius" ? "text-[#0f0f11]" : "text-[#4ADE80]"
                }`}
              />
            )}
          </Link>
          <Link
            href="/quiz?tab=traits"
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium rounded-md px-4 py-2 transition-colors ${
              tab === "traits"
                ? "bg-[#c9a84c] text-[#0f0f11]"
                : "text-[#9898a8] hover:text-[#e8e8ec]"
            }`}
          >
            Traits Quiz
            {traitsDone && (
              <CheckCircle2
                className={`w-3.5 h-3.5 ${
                  tab === "traits" ? "text-[#0f0f11]" : "text-[#4ADE80]"
                }`}
              />
            )}
          </Link>
        </div>
        <p className="text-[10px] text-[#3a3a44] text-center mb-0">
          Complete both quizzes to build your full Skill Card
        </p>
      </div>

      {tab === "genius" ? (
        <QuizClient
          alreadyCompleted={geniusDone}
          existingType={profile?.geniusType ?? null}
        />
      ) : (
        <TraitQuizClient alreadyCompleted={traitsDone} />
      )}
    </div>
  );
}
