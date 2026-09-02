"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { X, Check, ChevronDown, ChevronRight, BookOpen, ArrowRight } from "lucide-react";

const LS_KEY = "nv_tutorial_v4_dismissed";

interface TutorialState {
  hasTeam: boolean;
  hasApplied: boolean;
  hasBrowsedOrgs: boolean;
}

interface Step {
  label: string;
  description: string;
  href: string;
  ctaLabel: string;
  done: boolean;
  guide: string[];
}

interface Props extends TutorialState {
  serverDismissed?: boolean;
}

export default function TutorialWidget({ serverDismissed = false, ...initialProps }: Props) {
  const [dismissed, setDismissed] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<TutorialState>(initialProps);
  const [expanded, setExpanded] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/tutorial-status");
      if (res.ok) setState(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    const locallyDismissed = localStorage.getItem(LS_KEY) === "1";
    setDismissed(serverDismissed || locallyDismissed);
    setMounted(true);

    if (!serverDismissed && !locallyDismissed) {
      refresh();
      const onFocus = () => refresh();
      window.addEventListener("focus", onFocus);
      const iv = setInterval(refresh, 45_000);
      return () => { window.removeEventListener("focus", onFocus); clearInterval(iv); };
    }
  }, [refresh, serverDismissed]);

  const dismiss = async () => {
    localStorage.setItem(LS_KEY, "1");
    setDismissed(true);
    try { await fetch("/api/tutorial/dismiss", { method: "POST" }); } catch {}
  };

  if (!mounted || dismissed) return null;

  const { hasApplied, hasBrowsedOrgs } = state;

  const steps: Step[] = [
    {
      label: "Browse organizations",
      description: "Find orgs posting open projects",
      href: "/orgs",
      ctaLabel: "Browse orgs",
      done: hasBrowsedOrgs,
      guide: [
        "Visit the Orgs page to see organizations accepting applications.",
        "Read each org's mission and open projects to find ones that match your interests.",
        "Look at what skills they're seeking — compare with your own profile.",
        "Save orgs you like to revisit, or jump straight to a project page to apply.",
      ],
    },
    {
      label: "Apply to an org project",
      description: "Submit your application directly from a project page",
      href: "/orgs",
      ctaLabel: "Find a project",
      done: hasApplied,
      guide: [
        "Find an org project you're excited about and navigate to its page.",
        "Click the Apply button — you can apply solo or bring up to a few teammates.",
        "Write a short pitch about why you're a great fit for the project.",
        "Track your application status from your Teams page once submitted.",
      ],
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const progress = (completedCount / steps.length) * 100;
  const allDone = completedCount === steps.length;
  const toggle = (i: number) => setExpanded(expanded === i ? null : i);

  return (
    <div
      className="bracket-card border p-5 mb-6"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(74,128,240,0.12)", border: "1px solid rgba(74,128,240,0.2)" }}
          >
            <BookOpen className="w-4 h-4" style={{ color: "var(--blue)" }} />
          </div>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text)", fontFamily: "var(--font-display, sans-serif)" }}>
              {allDone ? "You're all set!" : "Get started on Nivarro"}
            </h2>
            <p className="text-[11px]" style={{ color: "var(--text2)" }}>
              {completedCount} of {steps.length} steps complete
            </p>
          </div>
        </div>
        <button
          onClick={dismiss}
          className="w-7 h-7 flex items-center justify-center transition-colors flex-shrink-0 mt-0.5"
          style={{ color: "var(--muted)" }}
          aria-label="Dismiss guide"
          title="Dismiss guide"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 mb-4" style={{ background: "var(--border-md)" }}>
        <div className="h-1 transition-all duration-500" style={{ width: `${progress}%`, background: "var(--blue)" }} />
      </div>

      {/* Steps */}
      <div className="space-y-1">
        {steps.map((step, i) => {
          const isOpen = expanded === i;
          return (
            <div key={i}>
              <button
                onClick={() => !step.done && toggle(i)}
                className="w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left group"
                style={{
                  background: step.done ? "transparent" : isOpen ? "var(--surface3)" : "var(--surface2)",
                  opacity: step.done ? 0.55 : 1,
                  cursor: step.done ? "default" : "pointer",
                }}
              >
                <div
                  className="w-6 h-6 flex items-center justify-center flex-shrink-0"
                  style={{
                    background: step.done ? "rgba(74,128,240,0.15)" : "var(--surface3)",
                    border: step.done ? "1px solid rgba(74,128,240,0.3)" : "1px solid var(--border-md)",
                  }}
                >
                  {step.done ? (
                    <Check className="w-3 h-3" style={{ color: "var(--blue)" }} />
                  ) : (
                    <span className="text-[10px] font-bold" style={{ color: "var(--muted)" }}>{i + 1}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: step.done ? "var(--text2)" : "var(--text)" }}>
                    {step.label}
                  </p>
                  {!step.done && !isOpen && (
                    <p className="text-xs" style={{ color: "var(--text2)" }}>{step.description}</p>
                  )}
                </div>
                {!step.done && (
                  isOpen
                    ? <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "var(--blue)" }} />
                    : <ChevronRight className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--blue)" }} />
                )}
              </button>

              {isOpen && !step.done && (
                <div
                  className="mx-3 mb-1 px-4 py-3"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border-md)" }}
                >
                  <ul className="space-y-2 mb-3">
                    {step.guide.map((line, j) => (
                      <li key={j} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 mt-1.5 flex-shrink-0" style={{ background: "var(--blue)", display: "block" }} />
                        <p className="text-xs leading-relaxed" style={{ color: "var(--text2)" }}>{line}</p>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={step.href}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 transition-colors"
                    style={{ background: "var(--blue)", color: "#fff" }}
                  >
                    {step.ctaLabel}
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>
          );
        })}
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
