"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TRAIT_QUIZ_QUESTIONS } from "@/data/traitQuiz";
import { TRAIT_CATEGORY_COLORS } from "@/data/traits";
import type { TraitCategory } from "@/data/traits";
import TraitBadge from "@/components/profile/TraitBadge";
import {
  Loader2,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

interface TraitResult {
  traitSlugs: string[];
  traitIds: string[];
  traitData: TraitData[];
  explanation: string;
}

interface TraitData {
  id: string;
  slug: string;
  name: string;
  category: string;
}

interface Props {
  alreadyCompleted: boolean;
  existingTraits: TraitData[];
  existingSummary: string | null;
}

export default function TraitQuizClient({ alreadyCompleted, existingTraits, existingSummary }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<"quiz" | "analyzing" | "result">(
    alreadyCompleted ? "result" : "quiz"
  );
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<TraitResult | null>(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState("");

  const question = TRAIT_QUIZ_QUESTIONS[currentQ];
  const progress = (currentQ / TRAIT_QUIZ_QUESTIONS.length) * 100;
  const isLastQuestion = currentQ === TRAIT_QUIZ_QUESTIONS.length - 1;

  async function handleNext() {
    if (selected === null) return;
    const newAnswers = [...answers, selected];

    if (!isLastQuestion) {
      setAnswers(newAnswers);
      setSelected(null);
      setCurrentQ((q) => q + 1);
      return;
    }

    // Submit for analysis
    setStep("analyzing");
    try {
      const res = await fetch("/api/quiz/traits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: newAnswers }),
      });

      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      setResult(data);
      setStep("result");
    } catch {
      setError("Something went wrong. Please try again.");
      setStep("quiz");
      setCurrentQ(TRAIT_QUIZ_QUESTIONS.length - 1);
      setAnswers(answers);
      setSelected(selected);
    }
  }

  async function handleApply() {
    if (!result || applying) return;
    setApplying(true);
    setError("");

    try {
      const res = await fetch("/api/quiz/traits/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          traitIds: result.traitIds,
          strengthSummary: result.explanation,
        }),
      });

      if (!res.ok) throw new Error("Failed to apply");
      setApplied(true);
      router.refresh();
    } catch {
      setError("Failed to apply traits. Please try again.");
    } finally {
      setApplying(false);
    }
  }

  function handleRetake() {
    setStep("quiz");
    setCurrentQ(0);
    setAnswers([]);
    setSelected(null);
    setResult(null);
    setApplied(false);
    setError("");
  }

  // ── ANALYZING SCREEN ─────────────────────────
  if (step === "analyzing") {
    return (
      <div className="max-w-lg mx-auto py-12 text-center">
        <div className="bg-[#0d0d0e] border border-[#1c1c20] rounded-xl p-10">
          <Loader2 className="w-8 h-8 text-[#c9a84c] animate-spin mx-auto mb-4" />
          <h2 className="text-sm font-semibold text-[#eaeaea] mb-2">
            Analyzing your answers
          </h2>
          <p className="text-xs text-[#58586a]">
            Identifying the traits that most accurately describe you...
          </p>
        </div>
      </div>
    );
  }

  // ── RESULT SCREEN ─────────────────────────────
  if ((step === "result" || alreadyCompleted) && result) {
    return (
      <div className="max-w-lg mx-auto py-8">
        <div className="bg-[#0d0d0e] border border-[#1c1c20] rounded-xl overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-[#7B61FF] via-[#c9a84c] to-[#4ECDC4]" />

          <div className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <Sparkles className="w-4 h-4 text-[#c9a84c]" />
              <span className="text-xs font-semibold text-[#909098] uppercase tracking-wider">
                Your Recommended Traits
              </span>
            </div>

            {/* Trait badges */}
            <div className="flex flex-wrap gap-2.5 mb-5">
              {result.traitData.map((trait) => (
                <TraitBadge
                  key={trait.slug}
                  name={trait.name}
                  category={trait.category as TraitCategory}
                  size="md"
                />
              ))}
            </div>

            {/* Explanation */}
            <div className="bg-[#131315] border border-[#1c1c20] rounded-lg p-4 mb-5">
              <p className="text-sm text-[#909098] leading-relaxed">
                {result.explanation}
              </p>
            </div>

            {/* Trait breakdown */}
            <div className="space-y-2 mb-6">
              {result.traitData.map((trait) => {
                const color =
                  TRAIT_CATEGORY_COLORS[trait.category as TraitCategory];
                return (
                  <div
                    key={trait.slug}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#131315]"
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs font-medium text-[#eaeaea]">
                      {trait.name}
                    </span>
                    <span
                      className="text-[10px] ml-auto"
                      style={{ color }}
                    >
                      {trait.category
                        .toLowerCase()
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (c) => c.toUpperCase())}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            {error && (
              <p className="text-xs text-[#f87171] mb-3">{error}</p>
            )}

            {applied ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-sm text-[#4ADE80] mb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Traits applied to your profile</span>
                </div>
                <button
                  onClick={() => router.push("/profile")}
                  className="w-full flex items-center justify-center gap-2 bg-[#c9a84c] hover:bg-[#e3c06a] text-[#080809] font-semibold rounded-md py-2.5 text-sm transition-colors"
                >
                  View Profile
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => router.push("/dashboard")}
                  className="w-full text-center text-xs text-[#58586a] hover:text-[#909098] transition-colors py-1.5"
                >
                  Go to Dashboard
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={handleApply}
                  disabled={applying}
                  className="w-full flex items-center justify-center gap-2 bg-[#c9a84c] hover:bg-[#e3c06a] text-[#080809] font-semibold rounded-md py-2.5 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {applying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Apply to Profile
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
                <button
                  onClick={() => router.push("/profile")}
                  className="w-full text-center text-xs text-[#909098] hover:text-[#eaeaea] border border-[#1c1c20] hover:border-[#28282e] rounded-md py-2 transition-colors"
                >
                  Review & customize in Profile
                </button>
                <button
                  onClick={handleRetake}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-[#58586a] hover:text-[#909098] transition-colors py-1.5"
                >
                  <RotateCcw className="w-3 h-3" />
                  Retake quiz
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-[#58586a] text-center mt-4 px-4">
          These are recommendations based on your answers. You can always
          adjust your final traits in your profile.
        </p>
      </div>
    );
  }

  // Already completed but no result loaded (page refresh state) — show saved traits
  if (alreadyCompleted && !result) {
    return (
      <div className="max-w-lg mx-auto py-8">
        <div className="bg-[#0d0d0e] border border-[#1c1c20] rounded-xl overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-[#7B61FF] via-[#c9a84c] to-[#4ECDC4]" />
          <div className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <CheckCircle2 className="w-4 h-4 text-[#4ADE80]" />
              <span className="text-xs font-semibold text-[#909098] uppercase tracking-wider">
                Your Current Traits
              </span>
            </div>

            {existingTraits.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-2.5 mb-5">
                  {existingTraits.map((trait) => (
                    <TraitBadge
                      key={trait.slug}
                      name={trait.name}
                      category={trait.category as TraitCategory}
                      size="md"
                    />
                  ))}
                </div>

                {existingSummary && (
                  <div className="bg-[#131315] border border-[#1c1c20] rounded-lg p-4 mb-5">
                    <p className="text-sm text-[#909098] leading-relaxed">
                      {existingSummary}
                    </p>
                  </div>
                )}

                <div className="space-y-2 mb-6">
                  {existingTraits.map((trait) => {
                    const color = TRAIT_CATEGORY_COLORS[trait.category as TraitCategory];
                    return (
                      <div key={trait.slug} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#131315]">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-xs font-medium text-[#eaeaea]">{trait.name}</span>
                        <span className="text-[10px] ml-auto" style={{ color }}>
                          {trait.category.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-xs text-[#909098] mb-5">Your traits are set on your profile.</p>
            )}

            <div className="space-y-2">
              <button
                onClick={() => router.push("/profile")}
                className="w-full flex items-center justify-center gap-2 bg-[#c9a84c] hover:bg-[#e3c06a] text-[#080809] font-semibold rounded-md py-2.5 text-sm transition-colors"
              >
                View Profile
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleRetake}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-[#58586a] hover:text-[#909098] transition-colors py-1.5"
              >
                <RotateCcw className="w-3 h-3" />
                Retake quiz
              </button>
            </div>
          </div>
        </div>
        <p className="text-xs text-[#58586a] text-center mt-4 px-4">
          These traits appear on your Skill Card. You can always adjust them in your profile.
        </p>
      </div>
    );
  }

  // ── QUIZ SCREEN ───────────────────────────────
  const clusters = [...new Set(TRAIT_QUIZ_QUESTIONS.map((q) => q.cluster))];
  const currentCluster = question.cluster;

  return (
    <div className="max-w-lg mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#eaeaea] mb-1">
          Traits Quiz
        </h1>
        <p className="text-sm text-[#909098]">
          15 questions to identify your 5 core traits. Answer as you actually
          are, not as you want to be.
        </p>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-[#58586a] mb-2">
          <span className="text-[#909098]">{currentCluster}</span>
          <span>
            {currentQ + 1} / {TRAIT_QUIZ_QUESTIONS.length}
          </span>
        </div>
        <div className="h-1 bg-[#1c1c20] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#c9a84c] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        {/* Cluster dots */}
        <div className="flex gap-1.5 mt-2 justify-center">
          {clusters.map((cluster) => {
            const clusterQuestions = TRAIT_QUIZ_QUESTIONS.filter(
              (q) => q.cluster === cluster
            );
            const allAnswered = clusterQuestions.every(
              (q) => answers[q.id - 1] !== undefined
            );
            const isCurrent = cluster === currentCluster;
            return (
              <div
                key={cluster}
                className={`h-1 rounded-full transition-all duration-300 ${
                  allAnswered
                    ? "bg-[#c9a84c]"
                    : isCurrent
                    ? "bg-[#c9a84c60]"
                    : "bg-[#1c1c20]"
                }`}
                style={{ width: `${100 / clusters.length - 2}%` }}
                title={cluster}
              />
            );
          })}
        </div>
      </div>

      {/* Question card */}
      <div
        key={currentQ}
        className="bg-[#0d0d0e] border border-[#1c1c20] rounded-xl p-6 animate-[slideUp_0.2s_ease]"
      >
        <h2 className="text-base font-medium text-[#eaeaea] mb-5 leading-relaxed">
          {question.question}
        </h2>

        <div className="space-y-2.5">
          {question.options.map((option, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={`w-full text-left px-4 py-3.5 rounded-lg border text-sm leading-relaxed transition-all ${
                selected === i
                  ? "border-[#c9a84c] bg-[#c9a84c10] text-[#eaeaea]"
                  : "border-[#1c1c20] text-[#909098] hover:border-[#28282e] hover:text-[#eaeaea] hover:bg-[#131315]"
              }`}
            >
              <span
                className={`inline-flex items-center justify-center w-5 h-5 rounded-full border text-xs mr-3 flex-shrink-0 align-middle ${
                  selected === i
                    ? "border-[#c9a84c] bg-[#c9a84c] text-[#080809]"
                    : "border-[#28282e]"
                }`}
              >
                {selected === i ? "✓" : String.fromCharCode(65 + i)}
              </span>
              {option.text}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-xs text-[#f87171] mt-3">{error}</p>
        )}

        <div className="mt-6 flex items-center justify-between">
          {currentQ > 0 ? (
            <button
              onClick={() => {
                setCurrentQ((q) => q - 1);
                setAnswers((a) => a.slice(0, -1));
                setSelected(answers[currentQ - 1] ?? null);
              }}
              className="text-xs text-[#58586a] hover:text-[#909098] transition-colors"
            >
              ← Back
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={handleNext}
            disabled={selected === null}
            className="flex items-center gap-2 bg-[#c9a84c] hover:bg-[#e3c06a] text-[#080809] font-semibold text-sm rounded-md px-5 py-2.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLastQuestion ? "Analyze my traits" : "Next"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
