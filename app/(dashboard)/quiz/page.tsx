import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import QuizClient from "./QuizClient";
import TraitQuizClient from "./TraitQuizClient";
import { CheckCircle2 } from "lucide-react";
import { GENIUS_TYPE_INFO } from "@/data/traits";
import type { GeniusType } from "@/data/traits";

const GENIUS_TYPES_ORDER: GeniusType[] = ["DYNAMO", "BLAZE", "TEMPO", "STEEL"];

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
      strengthSummary: true,
      traitLinks: {
        orderBy: { order: "asc" },
        include: { trait: true },
      },
    },
  });

  const geniusDone = !!profile?.geniusType;
  const traitsDone = (profile?.traitLinks?.length ?? 0) > 0;
  const existingTraits = profile?.traitLinks.map((l) => ({
    id: l.trait.id,
    slug: l.trait.slug,
    name: l.trait.name,
    category: l.trait.category,
  })) ?? [];

  return (
<<<<<<< Updated upstream
    <div>
      {/* Tab switcher */}
      <div className="max-w-lg mx-auto pt-8 pb-0">
        <div className="flex gap-1 bg-[#0d0d0e] border border-[#1c1c20] rounded-lg p-1 mb-1">
          <Link
            href="/quiz?tab=genius"
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium rounded-md px-4 py-2 transition-colors ${
              tab === "genius"
                ? "bg-[#c9a84c] text-[#080809]"
                : "text-[#909098] hover:text-[#eaeaea]"
            }`}
          >
            Genius Quiz
            {geniusDone && (
              <CheckCircle2
                className={`w-3.5 h-3.5 ${
                  tab === "genius" ? "text-[#080809]" : "text-[#4ADE80]"
                }`}
              />
            )}
          </Link>
          <Link
            href="/quiz?tab=traits"
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium rounded-md px-4 py-2 transition-colors ${
              tab === "traits"
                ? "bg-[#c9a84c] text-[#080809]"
                : "text-[#909098] hover:text-[#eaeaea]"
            }`}
          >
            Traits Quiz
            {traitsDone && (
              <CheckCircle2
                className={`w-3.5 h-3.5 ${
                  tab === "traits" ? "text-[#080809]" : "text-[#4ADE80]"
                }`}
              />
            )}
          </Link>
        </div>
        <p className="text-[10px] text-[#28282e] text-center mb-0">
          Complete both quizzes to build your full Skill Card
        </p>
      </div>

      {tab === "genius" ? (
        <QuizClient
          alreadyCompleted={geniusDone}
          existingType={profile?.geniusType ?? null}
        />
      ) : (
        <TraitQuizClient
          alreadyCompleted={traitsDone}
          existingTraits={existingTraits}
          existingSummary={profile?.strengthSummary ?? null}
        />
=======
    <div className="max-w-2xl mx-auto pt-8">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#e8e8ec] mb-1">Skill Assessment</h1>
        <p className="text-sm text-[#9898a8]">
          Two short quizzes to build your full Skill Card — shown on your profile and matched to opportunities.
        </p>
      </div>

      {/* ── Tab switcher ───────────────────────────────────── */}
      <div className="flex gap-1 bg-[#16161a] border border-[#2a2a33] rounded-lg p-1 mb-8">
        <Link
          href="/quiz?tab=genius"
          className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium rounded-md px-4 py-2.5 transition-colors ${
            tab === "genius"
              ? "bg-[#c9a84c] text-[#0f0f11]"
              : "text-[#9898a8] hover:text-[#e8e8ec]"
          }`}
        >
          {geniusDone && (
            <CheckCircle2 className={`w-3.5 h-3.5 ${tab === "genius" ? "text-[#0f0f11]" : "text-[#4ADE80]"}`} />
          )}
          Genius Type
          {!geniusDone && <span className="text-[10px] opacity-60 ml-1">Step 1</span>}
        </Link>
        <Link
          href="/quiz?tab=traits"
          className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium rounded-md px-4 py-2.5 transition-colors ${
            tab === "traits"
              ? "bg-[#c9a84c] text-[#0f0f11]"
              : "text-[#9898a8] hover:text-[#e8e8ec]"
          }`}
        >
          {traitsDone && (
            <CheckCircle2 className={`w-3.5 h-3.5 ${tab === "traits" ? "text-[#0f0f11]" : "text-[#4ADE80]"}`} />
          )}
          Core Traits
          {!traitsDone && <span className="text-[10px] opacity-60 ml-1">Step 2</span>}
        </Link>
      </div>

      {/* ── Genius tab ─────────────────────────────────────── */}
      {tab === "genius" && (
        <>
          {/* Type preview cards — always visible so users know what they're choosing */}
          <div className="mb-8">
            <p className="text-xs font-semibold text-[#5a5a6a] uppercase tracking-wider mb-3">
              The four genius types
            </p>
            <div className="grid grid-cols-2 gap-3">
              {GENIUS_TYPES_ORDER.map((key) => {
                const info = GENIUS_TYPE_INFO[key];
                const isYours = profile?.geniusType === key;
                return (
                  <div
                    key={key}
                    className="relative bg-[#16161a] border rounded-xl p-4 transition-all"
                    style={{
                      borderColor: isYours ? info.color : "#2a2a33",
                      boxShadow: isYours ? `0 0 0 1px ${info.color}40` : "none",
                    }}
                  >
                    {isYours && (
                      <div
                        className="absolute top-3 right-3 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: `${info.color}20`, color: info.color }}
                      >
                        You
                      </div>
                    )}
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-lg mb-3"
                      style={{ backgroundColor: `${info.color}18` }}
                    >
                      {info.icon}
                    </div>
                    <p className="text-sm font-bold text-[#e8e8ec] mb-0.5" style={{ color: info.color }}>
                      {info.label}
                    </p>
                    <p className="text-[11px] text-[#9898a8] mb-2 font-medium">{info.tagline}</p>
                    <p className="text-xs text-[#5a5a6a] leading-relaxed">{info.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <QuizClient
            alreadyCompleted={geniusDone}
            existingType={profile?.geniusType ?? null}
          />
        </>
      )}

      {/* ── Traits tab ─────────────────────────────────────── */}
      {tab === "traits" && (
        <TraitQuizClient alreadyCompleted={traitsDone} />
>>>>>>> Stashed changes
      )}
    </div>
  );
}
