"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QUIZ_QUESTIONS, GENIUS_TYPE_INFO } from "@/data/traits";
import type { GeniusType } from "@/data/traits";
import { Loader2, ArrowRight, RotateCcw } from "lucide-react";

interface Props {
  alreadyCompleted: boolean;
  existingType: string | null;
}

export default function QuizClient({ alreadyCompleted, existingType }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<"quiz" | "result">(
    alreadyCompleted ? "result" : "quiz"
  );
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<GeniusType[]>([]);
  const [selected, setSelected] = useState<GeniusType | null>(null);
  const [result, setResult] = useState<GeniusType | null>(
    (existingType as GeniusType | null) ?? null
  );
  const [saving, setSaving] = useState(false);

  const question = QUIZ_QUESTIONS[currentQ];
  const progress = ((currentQ) / QUIZ_QUESTIONS.length) * 100;

  function handleSelect(type: GeniusType) {
    setSelected(type);
  }

  async function handleNext() {
    if (!selected) return;
    const newAnswers = [...answers, selected];

    if (currentQ < QUIZ_QUESTIONS.length - 1) {
      setAnswers(newAnswers);
      setSelected(null);
      setCurrentQ((q) => q + 1);
    } else {
      // Calculate result
      const scores: Record<GeniusType, number> = {
        DYNAMO: 0,
        BLAZE: 0,
        TEMPO: 0,
        STEEL: 0,
      };
      for (const a of newAnswers) {
        scores[a]++;
      }
      const winner = (Object.entries(scores) as [GeniusType, number][]).sort(
        (a, b) => b[1] - a[1]
      )[0][0];

      setSaving(true);
      await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geniusType: winner }),
      });
      setSaving(false);
      setResult(winner);
      setStep("result");
    }
  }

  function handleRetake() {
    setStep("quiz");
    setCurrentQ(0);
    setAnswers([]);
    setSelected(null);
    setResult(null);
  }

  // ── RESULT SCREEN ────────────────────────────────────────────
  if (step === "result" && result) {
    const genius = GENIUS_TYPE_INFO[result];
    return (
      <div className="max-w-lg mx-auto text-center py-8">
        <div className="bg-[#16161a] border border-[#2a2a33] rounded-xl overflow-hidden">
          {/* Color band */}
          <div
            className="h-2 w-full"
            style={{ backgroundColor: genius.color }}
          />

          <div className="p-8">
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-full text-3xl mb-4"
              style={{ backgroundColor: `${genius.color}20` }}
            >
              {genius.icon}
            </div>

            <div className="text-xs text-[#5a5a6a] uppercase tracking-wider mb-2">
              Your Genius Type
            </div>
            <h1
              className="text-3xl font-bold mb-3"
              style={{ color: genius.color }}
            >
              {genius.label}
            </h1>
            <p className="text-sm text-[#9898a8] leading-relaxed mb-8">
              {genius.description}
            </p>

            <div className="space-y-2">
              <button
                onClick={() => router.push("/dashboard")}
                className="w-full flex items-center justify-center gap-2 bg-[#c9a84c] hover:bg-[#e3c06a] text-[#0f0f11] font-semibold rounded-md py-2.5 text-sm transition-colors"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleRetake}
                className="w-full flex items-center justify-center gap-2 text-[#5a5a6a] hover:text-[#9898a8] text-sm transition-colors py-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Retake quiz
              </button>
            </div>
          </div>
        </div>

        {/* Nudge toward traits */}
        <div className="mt-4 text-xs text-[#5a5a6a] px-4">
          As a <span style={{ color: genius.color }}>{genius.label}</span>, you
          may want to look at these categories when selecting your traits:{" "}
          <span className="text-[#9898a8]">
            {genius.nudgeCategories.join(", ")}
          </span>
        </div>
      </div>
    );
  }

  // ── QUIZ SCREEN ──────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#e8e8ec] mb-1">
          Genius Quiz
        </h1>
        <p className="text-sm text-[#9898a8]">
          8 questions to discover your archetype. Answer honestly — there are no
          wrong answers.
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between text-xs text-[#5a5a6a] mb-2">
          <span>
            Question {currentQ + 1} of {QUIZ_QUESTIONS.length}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1 bg-[#2a2a33] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#c9a84c] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question card */}
      <div
        key={currentQ}
        className="bg-[#16161a] border border-[#2a2a33] rounded-xl p-6 animate-[slideUp_0.2s_ease]"
      >
        <h2 className="text-base font-medium text-[#e8e8ec] mb-6 leading-relaxed">
          {question.question}
        </h2>

        <div className="space-y-2.5">
          {question.options.map((option, i) => (
            <button
              key={i}
              onClick={() => handleSelect(option.type)}
              className={`w-full text-left px-4 py-3.5 rounded-lg border text-sm leading-relaxed transition-all ${
                selected === option.type
                  ? "border-[#c9a84c] bg-[#c9a84c10] text-[#e8e8ec]"
                  : "border-[#2a2a33] text-[#9898a8] hover:border-[#3a3a44] hover:text-[#e8e8ec] hover:bg-[#1e1e24]"
              }`}
            >
              <span
                className={`inline-flex items-center justify-center w-5 h-5 rounded-full border text-xs mr-3 flex-shrink-0 align-middle ${
                  selected === option.type
                    ? "border-[#c9a84c] bg-[#c9a84c] text-[#0f0f11]"
                    : "border-[#3a3a44]"
                }`}
              >
                {selected === option.type ? "✓" : String.fromCharCode(65 + i)}
              </span>
              {option.text}
            </button>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleNext}
            disabled={!selected || saving}
            className="flex items-center gap-2 bg-[#c9a84c] hover:bg-[#e3c06a] text-[#0f0f11] font-semibold text-sm rounded-md px-5 py-2.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                {currentQ < QUIZ_QUESTIONS.length - 1
                  ? "Next question"
                  : "See my result"}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
