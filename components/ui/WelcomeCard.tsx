"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import NivarroMark from "@/components/ui/NivarroMark";

const STORAGE_KEY = "nv_welcome_v4";
const DISMISS_AFTER_MS = 22000;

export default function WelcomeCard() {
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
          We connect young people â€” high schoolers, college students, the ones who are hungry but stuck â€” to real opportunities in business and tech. The internships that build resumes. The programs that open rooms they were never supposed to be in. The experiences that turn potential into proof.
        </p>
        <p className="leading-relaxed" style={{ color: "var(--text2)", fontStyle: "italic", fontSize: "0.875rem", lineHeight: 1.72 }}>
          When that happens, something bigger follows. They find their people. They discover what they are actually built for. They go home feeling like their work meant something â€” and years from now, they pour that back into the communities they came from.
        </p>
      </div>

      {/* CTA */}
      <div className="flex items-center justify-between gap-4 px-5 py-3">
        <p className="text-xs" style={{ color: "var(--text2)" }}>
          Ready to get started?
        </p>
        <button
          onClick={dismiss}
          className="text-xs px-3 py-1.5 font-medium transition-colors"
          style={{ color: "var(--muted)", border: "1px solid var(--border-md)", borderRadius: 0, background: "none", cursor: "pointer" }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}

