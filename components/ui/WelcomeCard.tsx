"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, ArrowRight } from "lucide-react";
import NivarroMark from "@/components/ui/NivarroMark";

const STORAGE_KEY = "nv_welcome_v1";

const GENIUS_TYPES = [
  {
    emoji: "⚡",
    key: "DYNAMO",
    label: "Dynamo",
    color: "#F59E0B",
    line: "The Visionary Builder — sees the gap between what exists and what's possible, then builds the bridge.",
  },
  {
    emoji: "🔥",
    key: "BLAZE",
    label: "Blaze",
    color: "#EF4444",
    line: "The Bold Connector — turns cold rooms warm. The one people follow when the path isn't clear.",
  },
  {
    emoji: "🎯",
    key: "TEMPO",
    label: "Tempo",
    color: "#10B981",
    line: "The Steady Strategist — makes ambitious plans actually work. The infrastructure beneath every breakthrough.",
  },
  {
    emoji: "🛡️",
    key: "STEEL",
    label: "Steel",
    color: "#6366F1",
    line: "The Deep Thinker — goes where others won't on hard problems. The one you trust when precision matters.",
  },
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
    <div
      className="bracket-card border mb-6"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <NivarroMark size={20} color="var(--text)" />
          <p
            className="text-xs font-semibold tracking-[0.12em] uppercase"
            style={{ color: "var(--text)", fontFamily: "var(--font-display)" }}
          >
            Welcome to Nivarro
          </p>
        </div>
        <button
          onClick={dismiss}
          className="w-6 h-6 flex items-center justify-center transition-colors"
          style={{ color: "var(--muted)" }}
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Mission */}
      <div className="px-5 pt-4 pb-3">
        <p
          className="text-sm leading-relaxed mb-1"
          style={{ color: "var(--text)", fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "1rem" }}
        >
          &ldquo;There is a generation out there right now doing everything right — studying, grinding, showing up every single day — and still finding nothing on the other side.
        </p>
        <p
          className="text-sm leading-relaxed"
          style={{ color: "var(--text2)", fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "1rem" }}
        >
          Nivarro was built to close that gap. Real opportunities in business and tech — for the ones who are hungry but stuck.&rdquo;
        </p>
      </div>

      {/* Divider with label */}
      <div className="flex items-center gap-3 px-5 py-3">
        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
        <p className="text-[10px] font-semibold tracking-[0.14em] uppercase flex-shrink-0" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
          Your Genius Type
        </p>
        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
      </div>

      {/* Genius types */}
      <div className="px-5 pb-4 space-y-3">
        <p className="text-xs leading-relaxed" style={{ color: "var(--text2)" }}>
          Every scholar on Nivarro has a Genius Type — the way you naturally think, lead, and contribute. Orgs and teammates use it to understand what role you'd play on a team. There are no wrong answers.
        </p>
        <div className="grid grid-cols-1 gap-2">
          {GENIUS_TYPES.map((t) => (
            <div
              key={t.key}
              className="flex items-start gap-3 px-3 py-2.5"
              style={{ background: "var(--surface2)", borderLeft: `2px solid ${t.color}` }}
            >
              <span className="text-base flex-shrink-0 mt-px">{t.emoji}</span>
              <div className="flex-1 min-w-0">
                <p
                  className="text-xs font-semibold tracking-[0.06em] uppercase mb-0.5"
                  style={{ color: t.color, fontFamily: "var(--font-mono)" }}
                >
                  {t.label}
                </p>
                <p className="text-[11px] leading-relaxed" style={{ color: "var(--text2)" }}>
                  {t.line}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div
        className="flex items-center justify-between gap-4 px-5 py-3"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        {!hasGeniusType ? (
          <p className="text-xs" style={{ color: "var(--text2)" }}>
            Take the 3-minute quiz to find your type.
          </p>
        ) : (
          <p className="text-xs" style={{ color: "var(--text2)" }}>
            Your type is set. Keep building.
          </p>
        )}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={dismiss}
            className="text-xs px-3 py-1.5 font-medium transition-colors"
            style={{ color: "var(--muted)", border: "1px solid var(--border-md)", borderRadius: 0 }}
          >
            Got it
          </button>
          {!hasGeniusType && (
            <Link
              href="/quiz"
              onClick={dismiss}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 transition-colors"
              style={{ background: "var(--blue)", color: "#fff", borderRadius: 0 }}
            >
              Take the quiz <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
