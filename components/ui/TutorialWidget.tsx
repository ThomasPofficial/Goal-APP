"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { X, Check, ChevronRight, BookOpen } from "lucide-react";

const STORAGE_KEY = "nivarro_tutorial_v1_dismissed";

interface TutorialState {
  hasGeniusType: boolean;
  traitsDone: boolean;
  hasTeam: boolean;
  hasApplied: boolean;
  hasBrowsedOrgs: boolean;
}

interface Props extends TutorialState {}

export default function TutorialWidget(initialProps: Props) {
  const [dismissed, setDismissed] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<TutorialState>(initialProps);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/tutorial-status");
      if (res.ok) {
        const data = await res.json();
        setState(data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    setMounted(true);
    refresh();

    // Re-check whenever user tabs back in (after completing a step elsewhere)
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);

    // Periodic poll every 45s so progress updates without needing full page reload
    const interval = setInterval(refresh, 45_000);

    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(interval);
    };
  }, [refresh]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  };

  if (!mounted || dismissed) return null;

  const { hasGeniusType, traitsDone, hasTeam, hasApplied, hasBrowsedOrgs } = state;

  const steps = [
    {
      label: "Set up your Genius profile",
      description: "Take the quiz to discover your type",
      href: "/quiz",
      done: hasGeniusType,
    },
    {
      label: "Add your traits",
      description: "Tell the community what you&apos;re skilled at",
      href: "/quiz?tab=traits",
      done: traitsDone,
    },
    {
      label: "Browse organizations",
      description: "Find orgs posting open projects for teams",
      href: "/orgs",
      done: hasBrowsedOrgs,
    },
    {
      label: "Build or join a team",
      description: "Create your team or accept a recruitment invite",
      href: "/teams",
      done: hasTeam,
    },
    {
      label: "Apply to an org project",
      description: "Submit your team&apos;s application from a project page",
      href: "/orgs",
      done: hasApplied,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const progress = (completedCount / steps.length) * 100;
  const allDone = completedCount === steps.length;

  return (
    <div
      className="rounded-2xl border p-5 mb-6"
      style={{ background: "var(--surface)", borderColor: "var(--border-md)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(74,128,240,0.12)", border: "1px solid rgba(74,128,240,0.2)" }}
          >
            <BookOpen className="w-4 h-4" style={{ color: "var(--blue)" }} />
          </div>
          <div>
            <h2
              className="text-sm font-semibold"
              style={{ color: "var(--text)", fontFamily: "var(--font-display, sans-serif)" }}
            >
              {allDone ? "You&apos;re all set!" : "Get started on Nivarro"}
            </h2>
            <p className="text-[11px]" style={{ color: "var(--text2)" }}>
              {completedCount} of {steps.length} steps complete
            </p>
          </div>
        </div>
        <button
          onClick={dismiss}
          className="w-7 h-7 flex items-center justify-center rounded-full transition-colors flex-shrink-0 mt-0.5"
          style={{ color: "var(--muted)" }}
          aria-label="Dismiss guide"
          title="Dismiss guide"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full mb-4" style={{ background: "var(--border-md)" }}>
        <div
          className="h-1 rounded-full transition-all duration-500"
          style={{ width: `${progress}%`, background: "var(--blue)" }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-1">
        {steps.map((step, i) => (
          <Link
            key={i}
            href={step.href}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors group"
            style={{
              background: step.done ? "transparent" : "var(--surface2)",
              opacity: step.done ? 0.55 : 1,
            }}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                background: step.done ? "rgba(74,128,240,0.15)" : "var(--surface3)",
                border: step.done
                  ? "1px solid rgba(74,128,240,0.3)"
                  : "1px solid var(--border-md)",
              }}
            >
              {step.done ? (
                <Check className="w-3 h-3" style={{ color: "var(--blue)" }} />
              ) : (
                <span className="text-[10px] font-bold" style={{ color: "var(--muted)" }}>
                  {i + 1}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-medium"
                style={{ color: step.done ? "var(--text2)" : "var(--text)" }}
                dangerouslySetInnerHTML={{ __html: step.label }}
              />
              {!step.done && (
                <p
                  className="text-xs"
                  style={{ color: "var(--text2)" }}
                  dangerouslySetInnerHTML={{ __html: step.description }}
                />
              )}
            </div>
            {!step.done && (
              <ChevronRight
                className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: "var(--blue)" }}
              />
            )}
          </Link>
        ))}
      </div>

      {allDone && (
        <p className="mt-3 text-xs text-center" style={{ color: "var(--text2)" }}>
          You&apos;ve completed the guide —{" "}
          <button onClick={dismiss} className="underline" style={{ color: "var(--blue)" }}>
            dismiss it
          </button>
        </p>
      )}
    </div>
  );
}
