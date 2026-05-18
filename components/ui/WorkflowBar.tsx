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
  const [loading, setLoading] = useState(true);
  const [abandoning, setAbandoning] = useState(false);

  useEffect(() => {
    fetch("/api/workflow")
      .then((r) => r.json())
      .then((d) => { setSession(d.session ?? null); setLoading(false); })
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
  const continueUrl = step === 1 ? "/orgs" : projectUrl;

  return (
    <div
      className="rounded-xl px-4 py-3 mb-6 flex items-center gap-3 flex-wrap"
      style={{
        background: "linear-gradient(135deg, rgba(10,30,82,0.95) 0%, rgba(6,13,26,0.98) 100%)",
        border: "1px solid rgba(16,96,216,0.35)",
        boxShadow: "0 4px 24px rgba(16,96,216,0.15)",
      }}
    >
      {/* Step indicator */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {STEPS.map((s, i) => {
          const stepNum = i + 1;
          const isActive = stepNum === step;
          const isDone = stepNum < step;
          return (
            <div key={s.label} className="flex items-center gap-1">
              <div
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all"
                style={{
                  background: isActive
                    ? "rgba(16,96,216,0.25)"
                    : isDone
                    ? "rgba(16,96,216,0.1)"
                    : "transparent",
                  border: isActive
                    ? "1px solid rgba(16,96,216,0.6)"
                    : isDone
                    ? "1px solid rgba(16,96,216,0.3)"
                    : "1px solid rgba(255,255,255,0.08)",
                  color: isActive ? "#6A9FFF" : isDone ? "#4a80f0" : "#5a7898",
                }}
              >
                {isDone ? "✓" : stepNum} {isActive ? <span className="hidden sm:inline">{s.label}</span> : null}
              </div>
              {i < STEPS.length - 1 && (
                <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: "#1e3a68" }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Project name */}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] truncate" style={{ color: "#5a7898" }}>Active workflow</p>
        <p className="text-sm font-semibold truncate" style={{ color: "#d8eeff", fontFamily: "'Cormorant Garamond', serif" }}>
          {session.orgProject.title}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href={continueUrl}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: "linear-gradient(135deg, #0a3ea0, #1060d8)",
            color: "#fff",
            boxShadow: "0 2px 8px rgba(16,96,216,0.4)",
          }}
        >
          Continue →
        </Link>
        <button
          onClick={abandon}
          disabled={abandoning}
          className="w-7 h-7 flex items-center justify-center rounded-full transition-colors"
          style={{ color: "#5a7898" }}
          title="Abandon workflow"
        >
          {abandoning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}
