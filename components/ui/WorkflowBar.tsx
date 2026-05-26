"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, ChevronRight, Loader2 } from "lucide-react";

const STEPS = [
  { label: "Discover", short: "1" },
  { label: "Project", short: "2" },
  { label: "Build Team", short: "3" },
  { label: "Request", short: "4" },
  { label: "Apply", short: "5" },
];

interface WorkflowSession {
  id: string;
  step: number;
  rosterLocked: boolean;
  orgProject: {
    id: string;
    title: string;
    org: { id: string; name: string };
  };
}

export default function WorkflowBar() {
  const [session, setSession] = useState<WorkflowSession | null>(null);
  const [hasGeniusType, setHasGeniusType] = useState(false);
  const [traitsDone, setTraitsDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [abandoning, setAbandoning] = useState(false);

  useEffect(() => {
    fetch("/api/workflow")
      .then((r) => r.json())
      .then((d) => {
        setSession(d.session ?? null);
        setHasGeniusType(!!d.hasGeniusType);
        setTraitsDone(!!d.traitsDone);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const abandon = async () => {
    if (!confirm("Abandon this workflow? Your progress on this project won't be saved.")) return;
    setAbandoning(true);
    await fetch("/api/workflow", { method: "DELETE" });
    setSession(null);
    setAbandoning(false);
  };

  if (loading || !session) return null;

  const step = session.step;
  const projectUrl = `/orgs/${session.orgProject.org.id}/projects/${session.orgProject.id}`;

  // Step 3 gates on profile completeness before team creation
  const step3Url = !hasGeniusType ? "/quiz" : !traitsDone ? "/quiz?tab=traits" : "/teams";
  const step3Cta = !hasGeniusType ? "Take the quiz first" : !traitsDone ? "Add your traits" : "Build your team";

  const STEP_URLS: Record<number, string> = {
    1: "/orgs",
    2: projectUrl,
    3: step3Url,
    4: projectUrl,
    5: projectUrl,
  };
  const STEP_CTA: Record<number, string> = {
    1: "Browse orgs",
    2: "View project",
    3: step3Cta,
    4: "Recruit teammates",
    5: "Apply now",
  };

  const continueUrl = STEP_URLS[step] ?? projectUrl;
  const ctaLabel = STEP_CTA[step] ?? "Continue";

  return (
    <div
      className="bracket-card px-4 py-3 mb-6 flex items-center gap-3 flex-wrap"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-md)",
      }}
    >
      {/* Step indicators */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {STEPS.map((s, i) => {
          const stepNum = i + 1;
          const isActive = stepNum === step;
          const isDone = stepNum < step;
          return (
            <div key={s.label} className="flex items-center gap-1">
              <div
                className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold transition-all"
                style={{
                  background: isActive ? "rgba(59,130,246,0.18)" : isDone ? "rgba(59,130,246,0.08)" : "transparent",
                  border: isActive ? "1px solid rgba(59,130,246,0.5)" : isDone ? "1px solid rgba(59,130,246,0.25)" : "1px solid var(--border)",
                  color: isActive ? "var(--blue)" : isDone ? "var(--blue)" : "var(--muted)",
                }}
              >
                {isDone ? "✓" : stepNum}{isActive ? <span className="hidden sm:inline ml-1">{s.label}</span> : null}
              </div>
              {i < STEPS.length - 1 && (
                <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: "var(--border-md)" }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Project name */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-[0.1em] font-semibold" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
          Active workflow
        </p>
        <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>
          {session.orgProject.title}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link href={continueUrl} className="btn-primary px-3 py-1.5 text-xs">
          {ctaLabel} →
        </Link>
        <button
          onClick={abandon}
          disabled={abandoning}
          className="w-7 h-7 flex items-center justify-center transition-colors"
          style={{ color: "var(--muted)" }}
          title="Abandon workflow"
        >
          {abandoning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}
