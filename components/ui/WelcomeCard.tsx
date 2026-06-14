"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { X, ArrowRight, Zap } from "lucide-react";
import NivarroMark from "@/components/ui/NivarroMark";

const STORAGE_KEY = "nv_welcome_v4";
const DISMISS_AFTER_MS = 22000;

const GENIUS_TYPES = [
  {
    emoji: "⚡",
    label: "Dynamo",
    color: "#F59E0B",
    line: "You think in systems and move fast. You see the full product before anyone else does — then you build it.",
  },
  {
    emoji: "🔥",
    label: "Blaze",
    color: "#EF4444",
    line: "You change the energy of a room. Orgs don't just want your skills — they want you in the room.",
  },
  {
    emoji: "🎯",
    label: "Tempo",
    color: "#10B981",
    line: "You turn big ideas into working plans. You're the reason ambitious projects actually ship.",
  },
  {
    emoji: "🛡️",
    label: "Steel",
    color: "#6366F1",
    line: "You go deep where others go fast. You find what's wrong before it breaks, and you fix it right.",
  },
];

export default function WelcomeCard({ hasGeniusType }: { hasGeniusType: boolean }) {
  const [dismissed, setDismissed] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [progress, setProgress] = useState(100);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || dismissed) return;

    startTimeRef.current = Date.now();

    const tick = () => {
      const elapsed = Date.now() - (startTimeRef.current ?? Date.now());
      const pct = Math.max(0, 100 - (elapsed / DISMISS_AFTER_MS) * 100);
      setProgress(pct);
      if (pct > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        dismiss();
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [mounted, dismissed]);

  const dismiss = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  };

  if (!mounted || dismissed) return null;

  return (
    <div className="bracket-card border mb-6 snap-in" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2.5">
          <NivarroMark size={16} color="var(--blue)" />
          <p className="text-[10px] font-bold tracking-[0.16em] uppercase" style={{ color: "var(--text2)", fontFamily: "var(--font-mono)" }}>
            What Nivarro is
          </p>
          <span className="live-dot ml-1" />
        </div>
        <div className="flex items-center gap-3">
          <p className="text-[10px]" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
            auto-closing
          </p>
          <button
            onClick={dismiss}
            className="w-5 h-5 flex items-center justify-center transition-colors"
            style={{ color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}
            aria-label="Dismiss"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Countdown bar */}
      <div style={{ height: 1, background: "var(--border)" }}>
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: "var(--blue)",
            boxShadow: "0 0 6px rgba(59,130,246,0.5)",
            transition: "none",
          }}
        />
      </div>

      {/* Mission */}
      <div className="px-5 pt-5 pb-5" style={{ borderBottom: "1px solid var(--border)" }}>
        <p className="leading-relaxed mb-4" style={{ color: "var(--text)", fontSize: "0.9rem", lineHeight: 1.72 }}>
          We connect young people — high schoolers, college students, the ones who are hungry but stuck — to real opportunities in business and tech. The internships that build resumes. The programs that open rooms they were never supposed to be in. The experiences that turn potential into proof.
        </p>
        <p className="leading-relaxed" style={{ color: "var(--text2)", fontStyle: "italic", fontSize: "0.875rem", lineHeight: 1.72 }}>
          When that happens, something bigger follows. They find their people. They discover what they are actually built for. They go home feeling like their work meant something — and years from now, they pour that back into the communities they came from.
        </p>
      </div>

      {/* Genius types */}
      <div className="px-5 pt-4 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 mb-3">
          <Zap size={11} style={{ color: "var(--blue)", flexShrink: 0 }} />
          <p className="text-[10px] font-bold tracking-[0.14em] uppercase" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
            Every scholar has a Genius Type
          </p>
        </div>
        <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--text2)" }}>
          Your Genius Type is how you naturally think, lead, and build. Orgs and teammates use it to understand the exact role you play on a project.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {GENIUS_TYPES.map((t) => (
            <div
              key={t.label}
              className="px-3 py-2.5"
              style={{ background: "var(--surface2)", borderLeft: `2px solid ${t.color}` }}
            >
              <p
                className="text-[10px] font-bold tracking-[0.1em] uppercase mb-1"
                style={{ color: t.color, fontFamily: "var(--font-mono)" }}
              >
                {t.emoji} {t.label}
              </p>
              <p className="text-[11px] leading-relaxed" style={{ color: "var(--text2)" }}>{t.line}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="flex items-center justify-between gap-4 px-5 py-3">
        <p className="text-xs" style={{ color: "var(--text2)" }}>
          {hasGeniusType
            ? "Your type is set. Keep building."
            : "3-minute quiz. Find out where you fit."}
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={dismiss}
            className="text-xs px-3 py-1.5 font-medium transition-colors"
            style={{ color: "var(--muted)", border: "1px solid var(--border-md)", borderRadius: 0, background: "none", cursor: "pointer" }}
          >
            Got it
          </button>
          {!hasGeniusType && (
            <Link
              href="/quiz"
              onClick={dismiss}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5"
              style={{ background: "var(--blue)", color: "#fff", borderRadius: 0, textDecoration: "none" }}
            >
              Take the quiz <ArrowRight size={11} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
