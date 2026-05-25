"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, ArrowRight } from "lucide-react";
import NivarroMark from "@/components/ui/NivarroMark";

const STORAGE_KEY = "nv_welcome_v3";

const OUTCOMES = [
  "They find their people.",
  "They discover what they are actually built for.",
  "They go home feeling like their work meant something.",
];

const GENIUS_TYPES = [
  { emoji: "⚡", label: "Dynamo", color: "#F59E0B", line: "Visionary Builder — turns big ideas into moving parts." },
  { emoji: "🔥", label: "Blaze",  color: "#EF4444", line: "Bold Connector — the one rooms shift toward." },
  { emoji: "🎯", label: "Tempo",  color: "#10B981", line: "Steady Strategist — makes ambitious plans actually land." },
  { emoji: "🛡️", label: "Steel",  color: "#6366F1", line: "Deep Thinker — precision and integrity under pressure." },
];

export default function WelcomeCard({ hasGeniusType }: { hasGeniusType: boolean }) {
  const [dismissed, setDismissed] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    setMounted(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  };

  if (!mounted || dismissed) return null;

  return (
    <div className="bracket-card border mb-6" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <NivarroMark size={18} color="var(--text)" />
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: "var(--text)", fontFamily: "var(--font-mono)" }}>
            What Nivarro is
          </p>
        </div>
        <button onClick={dismiss} className="w-6 h-6 flex items-center justify-center transition-colors" style={{ color: "var(--muted)" }} aria-label="Dismiss">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Mission — two paragraphs verbatim */}
      <div className="px-5 pt-5 pb-5" style={{ borderBottom: "1px solid var(--border)" }}>
        <p className="leading-relaxed mb-4" style={{ color: "var(--text)", fontFamily: "var(--font-serif)", fontSize: "1rem", lineHeight: 1.7 }}>
          We connect young people — high schoolers, college students, the ones who are hungry but stuck — to real opportunities in business and tech. The internships that build resumes. The programs that open rooms they were never supposed to be in. The experiences that turn potential into proof.
        </p>
        <p className="leading-relaxed" style={{ color: "var(--text2)", fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "1rem", lineHeight: 1.7 }}>
          When we do that, something bigger happens. They find their people. They discover what they are actually built for. They go home at the end of the day feeling like their work meant something. And years from now, they provide for families of their own, strengthen the communities they came from, and pour back into an American economy that is desperately waiting on them.
        </p>
      </div>

      {/* Genius types */}
      <div className="px-5 pt-4 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <p className="text-[10px] font-semibold tracking-[0.14em] uppercase mb-3" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
          Your Genius Type shapes how you contribute
        </p>
        <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--text2)" }}>
          Every scholar has a Genius Type — the way you naturally think, lead, and build. Orgs and teammates use it to understand the role you would play.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {GENIUS_TYPES.map((t) => (
            <div key={t.label} className="px-3 py-2.5" style={{ background: "var(--surface2)", borderLeft: `2px solid ${t.color}` }}>
              <p className="text-[10px] font-semibold tracking-[0.08em] uppercase mb-1" style={{ color: t.color, fontFamily: "var(--font-mono)" }}>
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
          {hasGeniusType ? "Your type is set. Keep building." : "Take the 3-minute quiz to find your type."}
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={dismiss} className="text-xs px-3 py-1.5 font-medium transition-colors" style={{ color: "var(--muted)", border: "1px solid var(--border-md)", borderRadius: 0 }}>
            Got it
          </button>
          {!hasGeniusType && (
            <Link href="/quiz" onClick={dismiss} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5" style={{ background: "var(--blue)", color: "#fff", borderRadius: 0 }}>
              Take the quiz <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
