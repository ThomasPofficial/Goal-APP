"use client";

import { useState, useEffect } from "react";
import { X, Search, Check, Users } from "lucide-react";
import Avatar from "./Avatar";
import GeniusTypeBadge from "./GeniusTypeBadge";
import type { GeniusTypeKey } from "@/lib/geniusTypes";
import { cn } from "@/lib/utils";

interface Peer {
  id: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  geniusType: GeniusTypeKey | null;
  grade: number | null;
  schoolName: string | null;
}

interface ApplyModalProps {
  orgProjectId: string;
  projectTitle: string;
  orgName: string;
  maxTeamSize: number;
  onSuccess: (result: { teamId: string; status: string; autoAccepted: boolean }) => void;
  onClose: () => void;
}

export default function ApplyModal({
  orgProjectId, projectTitle, orgName, maxTeamSize, onSuccess, onClose,
}: ApplyModalProps) {
  const [peers, setPeers] = useState<Peer[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [whyJoin, setWhyJoin] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxOthers = Math.max(0, maxTeamSize - 1);

  useEffect(() => {
    fetch("/api/peers")
      .then((r) => r.json())
      .then((data) => setPeers(data.peers ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = peers.filter(
    (p) =>
      !q ||
      p.displayName.toLowerCase().includes(q.toLowerCase()) ||
      p.handle?.toLowerCase().includes(q.toLowerCase()) ||
      p.schoolName?.toLowerCase().includes(q.toLowerCase())
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < maxOthers) {
        next.add(id);
      }
      return next;
    });
  };

  const MIN_WHY_JOIN = 50;
  const whyJoinTrimmed = whyJoin.trim();
  const whyJoinValid = whyJoinTrimmed.length >= MIN_WHY_JOIN;

  const handleSubmit = async () => {
    if (!whyJoinValid) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/org-projects/${orgProjectId}/apply-with-team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberProfileIds: [...selected],
          whyJoin: whyJoinTrimmed,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      onSuccess({ teamId: data.team.id, status: data.application.status, autoAccepted: data.autoAccepted });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full sm:max-w-lg overflow-hidden flex flex-col"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-md)",
          maxHeight: "90vh",
          borderRadius: "var(--radius-lg)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between px-5 pt-5 pb-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div>
            <p className="text-xs font-medium mb-0.5" style={{ color: "var(--blue)" }}>{orgName}</p>
            <h2 className="text-base font-bold" style={{ color: "var(--text)" }}>Apply to {projectTitle}</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
              {maxOthers > 0
                ? `Pick up to ${maxOthers} teammate${maxOthers !== 1 ? "s" : ""} — or apply solo`
                : "Solo application"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg"
            style={{ color: "var(--muted)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Peer picker */}
        {maxOthers > 0 && (
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="px-5 py-3 flex-shrink-0 space-y-2">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: "var(--muted)" }}
                />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search peers…"
                  className="w-full pl-9 pr-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{
                    background: "var(--n-bg2)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                  }}
                />
              </div>
              {selected.size > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {[...selected].map((pid) => {
                    const peer = peers.find((p) => p.id === pid);
                    if (!peer) return null;
                    return (
                      <button
                        key={pid}
                        onClick={() => toggle(pid)}
                        className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
                        style={{
                          background: "rgba(74,128,240,0.15)",
                          color: "var(--blue)",
                          border: "1px solid rgba(74,128,240,0.3)",
                        }}
                      >
                        {peer.displayName} <X className="w-3 h-3" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="overflow-y-auto flex-1 px-5 pb-2">
              {loading ? (
                <div className="py-8 text-center text-sm" style={{ color: "var(--muted)" }}>
                  Loading peers…
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-8 text-center text-sm" style={{ color: "var(--muted)" }}>
                  No peers found
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filtered.map((peer) => {
                    const isSelected = selected.has(peer.id);
                    const isDisabled = !isSelected && selected.size >= maxOthers;
                    return (
                      <button
                        key={peer.id}
                        onClick={() => !isDisabled && toggle(peer.id)}
                        className={cn(
                          "w-full flex items-center gap-3 p-2.5 text-left transition-colors",
                          isDisabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"
                        )}
                        style={{
                          background: isSelected ? "rgba(74,128,240,0.1)" : "var(--n-bg2)",
                          border: `1px solid ${isSelected ? "rgba(74,128,240,0.35)" : "var(--border)"}`,
                          borderRadius: "var(--radius-md)",
                        }}
                      >
                        <Avatar
                          src={peer.avatarUrl}
                          name={peer.displayName}
                          geniusType={peer.geniusType}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                              {peer.displayName}
                            </span>
                            {peer.geniusType && <GeniusTypeBadge type={peer.geniusType} size="sm" />}
                          </div>
                          {(peer.schoolName || peer.grade) && (
                            <p className="text-xs truncate" style={{ color: "var(--muted)" }}>
                              {[peer.schoolName, peer.grade ? `Grade ${peer.grade}` : null]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                        </div>
                        <div
                          className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                          style={{
                            borderColor: isSelected ? "var(--blue)" : "var(--border-md)",
                            background: isSelected ? "var(--blue)" : "transparent",
                          }}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer: why join + submit */}
        <div
          className="px-5 pb-5 pt-4 flex-shrink-0 space-y-3"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium" style={{ color: "var(--text2)" }}>
                Why do you want to join? <span style={{ color: "#f87171" }}>*</span>
              </label>
              <span
                className="text-[11px]"
                style={{ color: whyJoinValid ? "#4ADE80" : "var(--muted)" }}
              >
                {whyJoinTrimmed.length}/{MIN_WHY_JOIN}
              </span>
            </div>
            <textarea
              value={whyJoin}
              onChange={(e) => setWhyJoin(e.target.value)}
              rows={4}
              placeholder="Tell the org what draws you to this project, what you'll bring to the team, and why you'd be a great fit. Be specific."
              className="w-full resize-none text-sm rounded-lg px-3 py-2 focus:outline-none"
              style={{
                background: "var(--n-bg2)",
                border: `1px solid ${whyJoin && !whyJoinValid ? "rgba(248,113,113,0.4)" : "var(--border)"}`,
                color: "var(--text)",
              }}
            />
            {whyJoin && !whyJoinValid && (
              <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                {MIN_WHY_JOIN - whyJoinTrimmed.length} more character{MIN_WHY_JOIN - whyJoinTrimmed.length !== 1 ? "s" : ""} needed
              </p>
            )}
          </div>
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-1.5 text-xs flex-shrink-0"
              style={{ color: "var(--muted)" }}
            >
              <Users className="w-3.5 h-3.5" />
              {selected.size + 1} / {maxTeamSize}
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting || !whyJoinValid}
              className="flex-1 py-2.5 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "var(--blue)", color: "var(--on-accent)", borderRadius: "var(--radius-md)" }}
            >
              {submitting ? "Submitting…" : "Apply"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
