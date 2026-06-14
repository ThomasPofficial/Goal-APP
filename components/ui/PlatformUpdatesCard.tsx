"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import NivarroMark from "@/components/ui/NivarroMark";

const WELCOME_KEY = "nv_welcome_v4";
const DISMISS_KEY = "nv_updates_dismissed_v1";

interface Update {
  id: string;
  title: string;
  body: string;
  emoji: string | null;
  createdAt: string;
}

export default function PlatformUpdatesCard() {
  const [show, setShow] = useState(false);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const welcomed = localStorage.getItem(WELCOME_KEY) === "1";
    const alreadyDismissed = localStorage.getItem(DISMISS_KEY) === "1";
    if (welcomed && !alreadyDismissed) setShow(true);
  }, []);

  useEffect(() => {
    if (!show) return;
    fetch("/api/platform-updates")
      .then((r) => r.json())
      .then((d) => setUpdates(d.updates ?? []))
      .catch(() => {});
  }, [show]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  if (!show || dismissed || updates.length === 0) return null;

  return (
    <div className="bracket-card border mb-6 snap-in" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2.5">
          <NivarroMark size={15} color="var(--blue)" />
          <p className="text-[10px] font-bold tracking-[0.16em] uppercase" style={{ color: "var(--text2)", fontFamily: "var(--font-mono)" }}>
            Platform Updates
          </p>
          <span className="live-dot ml-1" />
        </div>
        <button
          onClick={dismiss}
          className="text-[10px] font-medium px-2 py-1 transition-colors"
          style={{ color: "var(--muted)", border: "1px solid var(--border-md)", borderRadius: 0, background: "none", cursor: "pointer" }}
        >
          Dismiss
        </button>
      </div>

      {/* Updates list */}
      <div>
        {updates.map((u, i) => (
          <div
            key={u.id}
            className="px-5 py-4"
            style={{ borderBottom: i < updates.length - 1 ? "1px solid var(--border)" : "none" }}
          >
            <div className="flex items-start gap-3">
              {u.emoji && (
                <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{u.emoji}</span>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{u.title}</p>
                  <p className="text-[10px] flex-shrink-0" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                    {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}
                  </p>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text2)" }}>{u.body}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5" style={{ borderTop: "1px solid var(--border)" }}>
        <p className="text-[10px]" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
          FROM TEAM@NIVARRO.CO · {updates.length} UPDATE{updates.length !== 1 ? "S" : ""}
        </p>
      </div>
    </div>
  );
}
