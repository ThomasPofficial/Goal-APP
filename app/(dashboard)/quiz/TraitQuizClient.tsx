"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TRAIT_QUIZ_QUESTIONS } from "@/data/traitQuiz";
import { TRAIT_CATEGORY_COLORS } from "@/data/traits";
import type { TraitCategory } from "@/data/traits";
import TraitBadge from "@/components/profile/TraitBadge";
import { Loader2, ArrowRight, RotateCcw, CheckCircle2, Sparkles } from "lucide-react";

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
  hasActiveWorkflow?: boolean;
}

export default function TraitQuizClient({ alreadyCompleted, existingTraits, existingSummary, hasActiveWorkflow }: Props) {
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
  const progress = ((currentQ) / TRAIT_QUIZ_QUESTIONS.length) * 100;
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
        body: JSON.stringify({ traitIds: result.traitIds, strengthSummary: result.explanation }),
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

  // ── ANALYZING ────────────────────────────────
  if (step === "analyzing") {
    return (
      <div className="max-w-lg py-12 text-center">
        <div className="bracket-card border p-10" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <Loader2 className="w-7 h-7 animate-spin mx-auto mb-4" style={{ color: "var(--blue)" }} />
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>Analyzing your answers</p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>Identifying the traits that most accurately describe you...</p>
        </div>
      </div>
    );
  }

  // ── RESULT ───────────────────────────────────
  if ((step === "result" || alreadyCompleted) && result) {
    return (
      <div className="max-w-lg py-8">
        <div className="bracket-card border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="h-0.5 w-full" style={{ background: "var(--blue)" }} />
          <div className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <Sparkles className="w-4 h-4" style={{ color: "var(--blue)" }} />
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                Your Recommended Traits
              </span>
            </div>

            <div className="flex flex-wrap gap-2.5 mb-5">
              {result.traitData.map((trait) => (
                <TraitBadge key={trait.slug} name={trait.name} category={trait.category as TraitCategory} size="md" />
              ))}
            </div>

            <div className="p-4 mb-5" style={{ background: "var(--surface2)", borderLeft: "2px solid var(--blue)" }}>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text2)" }}>{result.explanation}</p>
            </div>

            <div className="space-y-1.5 mb-6">
              {result.traitData.map((trait) => {
                const color = TRAIT_CATEGORY_COLORS[trait.category as TraitCategory];
                return (
                  <div key={trait.slug} className="flex items-center gap-3 px-3 py-2" style={{ background: "var(--surface2)" }}>
                    <div className="w-1.5 h-1.5 flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-xs font-medium" style={{ color: "var(--text)" }}>{trait.name}</span>
                    <span className="text-[10px] ml-auto" style={{ color, fontFamily: "var(--font-mono)" }}>
                      {trait.category.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </span>
                  </div>
                );
              })}
            </div>

            {error && <p className="text-xs mb-3" style={{ color: "#f87171" }}>{error}</p>}

            {applied ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-sm mb-1" style={{ color: "#4ADE80" }}>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Traits applied to your profile</span>
                </div>
                {hasActiveWorkflow ? (
                  <>
                    <p className="text-xs text-center" style={{ color: "var(--muted)" }}>
                      Your profile is complete — time to build your team.
                    </p>
                    <button onClick={() => router.push("/teams")} className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 text-sm">
                      Build your team <ArrowRight className="w-4 h-4" />
                    </button>
                    <button onClick={() => router.push("/profile")} className="w-full text-center text-xs py-1.5 transition-colors" style={{ color: "var(--muted)" }}>
                      View profile first
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => router.push("/profile")} className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 text-sm">
                      View Profile <ArrowRight className="w-4 h-4" />
                    </button>
                    <button onClick={() => router.push("/dashboard")} className="w-full text-center text-xs py-1.5 transition-colors" style={{ color: "var(--muted)" }}>
                      Go to Dashboard
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <button onClick={handleApply} disabled={applying} className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Apply to Profile</span><ArrowRight className="w-4 h-4" /></>}
                </button>
                <button onClick={() => router.push("/profile")} className="w-full text-center text-xs py-2 border transition-colors" style={{ color: "var(--muted)", borderColor: "var(--border)" }}>
                  Review &amp; customize in Profile
                </button>
                <button onClick={handleRetake} className="w-full flex items-center justify-center gap-1.5 text-xs py-1.5 transition-colors" style={{ color: "var(--muted)" }}>
                  <RotateCcw className="w-3 h-3" /> Retake quiz
                </button>
              </div>
            )}
          </div>
        </div>
        <p className="text-xs text-center mt-4" style={{ color: "var(--muted)" }}>
          These are recommendations. You can adjust your final traits in your profile.
        </p>
      </div>
    );
  }

  // ── ALREADY COMPLETED, no result in state ────
  if (alreadyCompleted && !result) {
    return (
      <div className="max-w-lg py-8">
        <div className="bracket-card border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="h-0.5 w-full" style={{ background: "var(--blue)" }} />
          <div className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <CheckCircle2 className="w-4 h-4" style={{ color: "#4ADE80" }} />
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                Your Current Traits
              </span>
            </div>

            {existingTraits.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-2.5 mb-5">
                  {existingTraits.map((trait) => (
                    <TraitBadge key={trait.slug} name={trait.name} category={trait.category as TraitCategory} size="md" />
                  ))}
                </div>
                {existingSummary && (
                  <div className="p-4 mb-5" style={{ background: "var(--surface2)", borderLeft: "2px solid var(--blue)" }}>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text2)" }}>{existingSummary}</p>
                  </div>
                )}
                <div className="space-y-1.5 mb-6">
                  {existingTraits.map((trait) => {
                    const color = TRAIT_CATEGORY_COLORS[trait.category as TraitCategory];
                    return (
                      <div key={trait.slug} className="flex items-center gap-3 px-3 py-2" style={{ background: "var(--surface2)" }}>
                        <div className="w-1.5 h-1.5 flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-xs font-medium" style={{ color: "var(--text)" }}>{trait.name}</span>
                        <span className="text-[10px] ml-auto" style={{ color, fontFamily: "var(--font-mono)" }}>
                          {trait.category.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-xs mb-5" style={{ color: "var(--muted)" }}>Your traits are set on your profile.</p>
            )}

            <div className="space-y-2">
              <button onClick={() => router.push("/profile")} className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 text-sm">
                View Profile <ArrowRight className="w-4 h-4" />
              </button>
              <button onClick={handleRetake} className="w-full flex items-center justify-center gap-1.5 text-xs py-1.5 transition-colors" style={{ color: "var(--muted)" }}>
                <RotateCcw className="w-3 h-3" /> Retake quiz
              </button>
            </div>
          </div>
        </div>
        <p className="text-xs text-center mt-4" style={{ color: "var(--muted)" }}>
          These traits appear on your Skill Card. You can always adjust them in your profile.
        </p>
      </div>
    );
  }

  // ── QUIZ SCREEN ──────────────────────────────
  return (
    <div className="max-w-lg py-8">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] mb-1" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
          Traits Quiz
        </p>
        <p className="text-sm" style={{ color: "var(--text2)" }}>
          15 questions · Answer as you actually are, not as you want to be.
        </p>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-xs mb-2">
          <span style={{ color: "var(--text2)" }}>{question.cluster}</span>
          <span style={{ color: "var(--muted)" }}>{currentQ + 1} / {TRAIT_QUIZ_QUESTIONS.length}</span>
        </div>
        <div className="h-0.5 w-full" style={{ background: "var(--border-md)" }}>
          <div className="h-full transition-all duration-300" style={{ width: `${progress}%`, background: "var(--blue)" }} />
        </div>
      </div>

      {/* Question card */}
      <div key={currentQ} className="bracket-card border p-6 animate-[slideUp_0.2s_ease]" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <h2 className="text-base font-semibold mb-5 leading-relaxed" style={{ color: "var(--text)" }}>
          {question.question}
        </h2>

        <div className="space-y-2">
          {question.options.map((option, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className="w-full text-left px-4 py-3 border text-sm transition-all flex items-center gap-3"
              style={{
                background: selected === i ? "rgba(59,130,246,0.08)" : "var(--surface2)",
                borderColor: selected === i ? "var(--blue)" : "var(--border)",
                color: selected === i ? "var(--text)" : "var(--text2)",
              }}
            >
              <span
                className="inline-flex items-center justify-center w-5 h-5 border text-xs flex-shrink-0"
                style={{
                  background: selected === i ? "var(--blue)" : "transparent",
                  borderColor: selected === i ? "var(--blue)" : "var(--border-md)",
                  color: selected === i ? "#fff" : "var(--muted)",
                }}
              >
                {selected === i ? "✓" : String.fromCharCode(65 + i)}
              </span>
              <span>{option.text}</span>
            </button>
          ))}
        </div>

        {error && <p className="text-xs mt-3" style={{ color: "#f87171" }}>{error}</p>}

        <div className="mt-6 flex items-center justify-between">
          {currentQ > 0 ? (
            <button
              onClick={() => { setCurrentQ((q) => q - 1); setAnswers((a) => a.slice(0, -1)); setSelected(answers[currentQ - 1] ?? null); }}
              className="text-xs transition-colors"
              style={{ color: "var(--muted)" }}
            >
              ← Back
            </button>
          ) : <div />}
          <button
            onClick={handleNext}
            disabled={selected === null}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLastQuestion ? "Analyze my traits" : "Next"} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
