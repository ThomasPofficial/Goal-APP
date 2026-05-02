"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { GENIUS_TYPES } from "@/lib/geniusTypes";
import type { GeniusTypeKey } from "@/lib/geniusTypes";
import { INTEREST_TAG_GROUPS, ALL_INTEREST_TAGS } from "@/lib/interestTags";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3 | 4;

const FOCUS_PLACEHOLDERS = [
  "Building a fintech app that helps teens invest…",
  "Writing a short film about first-gen college students…",
  "Researching renewable energy storage solutions…",
  "Launching a tutoring startup in my city…",
];

export default function OnboardingClient({ geniusType }: { geniusType: GeniusTypeKey }) {
  const router = useRouter();
  const { update } = useSession();
  const info = GENIUS_TYPES[geniusType];

  const [step, setStep] = useState<Step>(1);
  const [focus, setFocus] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [freeform, setFreeform] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [schoolName, setSchoolName] = useState("");
  const [isFirstGen, setIsFirstGen] = useState(false);
  const [isHomeschooled, setIsHomeschooled] = useState(false);
  const [isInternational, setIsInternational] = useState(false);
  const [saving, setSaving] = useState(false);

  // ─── Step 1: Quiz result reveal ─────────────────────────────────────────
  if (step === 1) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center"
        style={{ background: `radial-gradient(ellipse at center, ${info.color}18 0%, transparent 70%)` }}
      >
        <div className="max-w-xl w-full space-y-6">
          <p className="text-xs font-semibold text-gray-400 dark:text-[#9898a8] uppercase tracking-[0.2em]">
            Your Genius Type
          </p>
          <h1 className="text-7xl font-bold tracking-tight" style={{ color: info.color }}>
            {info.label}
          </h1>
          <p className={cn("text-sm font-medium tracking-wide", info.tailwindText)}>
            {info.tagline}
          </p>
          <p className="text-gray-600 dark:text-[#9898a8] leading-relaxed text-base max-w-md mx-auto">
            {info.description}
          </p>
          <div className={cn("border-l-4 p-4 rounded-r-lg text-left text-sm", info.tailwindBg, info.tailwindBorder)}>
            <span className={cn("font-semibold", info.tailwindText)}>Growth edge: </span>
            <span className="text-gray-600 dark:text-[#9898a8]">{info.tension}</span>
          </div>
          <button
            onClick={() => setStep(2)}
            className="mt-4 px-8 py-3 rounded-lg font-semibold text-sm text-white transition-opacity hover:opacity-90"
            style={{ background: info.color }}
          >
            Continue →
          </button>
        </div>
      </div>
    );
  }

  // ─── Step 2: Current Focus ───────────────────────────────────────────────
  if (step === 2) {
    const placeholder = FOCUS_PLACEHOLDERS[Math.floor(Date.now() / 10000) % FOCUS_PLACEHOLDERS.length];
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-lg w-full space-y-5">
          <StepHeader step={2} label="What are you working on?" />
          <p className="text-sm text-gray-500 dark:text-[#9898a8]">
            This shows at the top of your profile — first thing visitors read after your name.
          </p>
          <div>
            <textarea
              value={focus}
              onChange={(e) => setFocus(e.target.value.slice(0, 120))}
              placeholder={placeholder}
              rows={3}
              className="w-full resize-none rounded-lg border border-gray-200 dark:border-[#2a2a33] bg-white dark:bg-[#16161a] text-gray-900 dark:text-[#e8e8ec] placeholder-gray-400 dark:placeholder-[#5a5a6a] px-4 py-3 text-sm focus:outline-none focus:border-[#c9a84c] transition-colors"
            />
            <p className="text-right text-xs text-gray-400 dark:text-[#5a5a6a] mt-1">
              {focus.length}/120
            </p>
          </div>
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => setStep(3)}
              className="text-sm text-gray-400 dark:text-[#9898a8] hover:text-gray-600 dark:hover:text-[#e8e8ec] transition-colors"
            >
              Skip for now
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-[#c9a84c] hover:bg-[#e3c06a] text-[#0f0f11] transition-colors"
            >
              Continue →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Step 3: Interests ───────────────────────────────────────────────────
  if (step === 3) {
    const toggleInterest = (tag: string) => {
      setSelectedInterests((prev) =>
        prev.includes(tag)
          ? prev.filter((t) => t !== tag)
          : prev.length < 10
          ? [...prev, tag]
          : prev
      );
    };
    const addFreeform = () => {
      const trimmed = freeform.trim();
      if (trimmed && selectedInterests.length < 10 && !selectedInterests.includes(trimmed)) {
        setSelectedInterests((prev) => [...prev, trimmed]);
        setFreeform("");
      }
    };
    const freeformTags = selectedInterests.filter(
      (t) => !ALL_INTEREST_TAGS.includes(t as (typeof ALL_INTEREST_TAGS)[number])
    );

    return (
      <div className="min-h-screen flex flex-col items-center px-6 py-16">
        <div className="max-w-2xl w-full space-y-6">
          <StepHeader step={3} label="What are you interested in?" />
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-[#9898a8]">
              Select up to 10 — at least 1 required.
            </p>
            <span className="text-xs text-gray-400 dark:text-[#5a5a6a]">
              {selectedInterests.length}/10
            </span>
          </div>

          {(Object.entries(INTEREST_TAG_GROUPS) as [string, readonly string[]][]).map(([group, tags]) => (
            <div key={group}>
              <p className="text-xs font-semibold text-gray-500 dark:text-[#5a5a6a] uppercase tracking-wider mb-2">
                {group}
              </p>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const selected = selectedInterests.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleInterest(tag)}
                      className={cn(
                        "px-3 py-1 rounded-full text-sm border transition-all",
                        selected
                          ? cn(info.tailwindBg, info.tailwindText, info.tailwindBorder)
                          : "bg-gray-100 dark:bg-[#1e1e24] text-gray-600 dark:text-[#9898a8] border-transparent hover:border-gray-300 dark:hover:border-[#2a2a33]"
                      )}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-[#5a5a6a] uppercase tracking-wider mb-2">
              Other
            </p>
            <div className="flex gap-2">
              <input
                value={freeform}
                onChange={(e) => setFreeform(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addFreeform()}
                placeholder="Add your own…"
                className="flex-1 rounded-lg border border-dashed border-gray-300 dark:border-[#2a2a33] bg-transparent px-3 py-1.5 text-sm text-gray-900 dark:text-[#e8e8ec] placeholder-gray-400 dark:placeholder-[#5a5a6a] focus:outline-none focus:border-[#c9a84c]"
              />
              <button
                onClick={addFreeform}
                className="text-sm text-[#c9a84c] hover:text-[#e3c06a] transition-colors"
              >
                Add
              </button>
            </div>
            {freeformTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {freeformTags.map((tag) => (
                  <span
                    key={tag}
                    className={cn(
                      "inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm border",
                      info.tailwindBg,
                      info.tailwindText,
                      info.tailwindBorder
                    )}
                  >
                    {tag}
                    <button
                      onClick={() => setSelectedInterests((p) => p.filter((t) => t !== tag))}
                      className="ml-1 opacity-60 hover:opacity-100"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setStep(4)}
              disabled={selectedInterests.length === 0}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-[#c9a84c] hover:bg-[#e3c06a] text-[#0f0f11] transition-colors disabled:opacity-40"
            >
              Continue →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Step 4: Background + complete ──────────────────────────────────────
  const handleComplete = async () => {
    if (!grade) return;
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentFocus: focus || null,
          interests: selectedInterests,
          grade,
          schoolName: schoolName || null,
          isFirstGen,
          isHomeschooled,
          isInternational,
          onboardingComplete: true,
        }),
      });
      await update({ onboardingComplete: true });
      router.push("/dashboard");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
      <div className="max-w-lg w-full space-y-6">
        <StepHeader step={4} label="A bit about you" />
        <p className="text-sm text-gray-500 dark:text-[#9898a8]">
          Helps match you to relevant opportunities. Marked private — only you can see this.
        </p>

        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-[#9898a8] uppercase tracking-wider mb-2">
            Grade <span className="text-red-500">*</span>
          </p>
          <div className="flex gap-2">
            {[9, 10, 11, 12].map((g) => (
              <button
                key={g}
                onClick={() => setGrade(g)}
                className={cn(
                  "w-12 h-12 rounded-lg border text-sm font-semibold transition-all",
                  grade === g
                    ? cn(info.tailwindBg, info.tailwindText, info.tailwindBorder)
                    : "border-gray-200 dark:border-[#2a2a33] text-gray-600 dark:text-[#9898a8] hover:border-gray-300 dark:hover:border-[#3a3a44]"
                )}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-[#9898a8] uppercase tracking-wider">
            School name
          </label>
          <input
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            placeholder="Westlake High School"
            className="mt-1.5 w-full rounded-lg border border-gray-200 dark:border-[#2a2a33] bg-white dark:bg-[#16161a] text-gray-900 dark:text-[#e8e8ec] placeholder-gray-400 dark:placeholder-[#5a5a6a] px-3 py-2 text-sm focus:outline-none focus:border-[#c9a84c] transition-colors"
          />
        </div>

        <div className="space-y-3">
          {(
            [
              [isFirstGen, setIsFirstGen, "First-generation student"],
              [isHomeschooled, setIsHomeschooled, "Homeschooled"],
              [isInternational, setIsInternational, "International student"],
            ] as [boolean, (v: boolean) => void, string][]
          ).map(([val, setter, label]) => (
            <label key={label} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={val}
                onChange={(e) => setter(e.target.checked)}
                className="w-4 h-4 rounded accent-[#c9a84c]"
              />
              <span className="text-sm text-gray-700 dark:text-[#e8e8ec]">{label}</span>
            </label>
          ))}
        </div>

        <p className="text-xs text-gray-400 dark:text-[#5a5a6a]">
          🔒 This information is private and only used for opportunity matching.
        </p>

        <button
          onClick={handleComplete}
          disabled={!grade || saving}
          className="w-full py-3 rounded-lg font-semibold text-sm bg-[#c9a84c] hover:bg-[#e3c06a] text-[#0f0f11] transition-colors disabled:opacity-40"
        >
          {saving ? "Setting up your profile…" : "Complete setup →"}
        </button>
      </div>
    </div>
  );
}

function StepHeader({ step, label }: { step: number; label: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-gray-400 dark:text-[#5a5a6a]">Step {step} of 4</p>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-[#e8e8ec]">{label}</h1>
    </div>
  );
}
