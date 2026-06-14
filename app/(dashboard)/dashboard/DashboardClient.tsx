"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ExternalLink, ChevronRight, Save } from "lucide-react";
import TutorialWidget from "@/components/ui/TutorialWidget";
import WelcomeCard from "@/components/ui/WelcomeCard";
import PlatformUpdatesCard from "@/components/ui/PlatformUpdatesCard";
import type { GeniusTypeKey } from "@/lib/geniusTypes";

interface ProfileData {
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  geniusType: GeniusTypeKey | null;
  secondaryGeniusType: GeniusTypeKey | null;
  currentFocus: string | null;
  savedCount: number;
}

interface SpaceRow { id: string; name: string; hasUnread: boolean; }

interface TutorialData {
  hasGeniusType: boolean;
  traitsDone: boolean;
  hasTeam: boolean;
  hasApplied: boolean;
  hasBrowsedOrgs: boolean;
}

interface TickerItem {
  id: string; title: string; category: string; deadline: string | null;
  org: { id: string; name: string };
}

interface OppCard {
  id: string; title: string; description: string | null; category: string;
  deadline: string | null; isRemote: boolean; saved: boolean;
  org: { id: string; name: string; heroUrl: string | null; accentColor: string | null };
  gradeEligibility: string | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  ACCELERATOR: "#F59E0B", FELLOWSHIP: "#6366F1", INTERNSHIP: "#14B8A6",
  COMPETITION: "#F97316", BOOTCAMP: "#8B5CF6", RESEARCH: "#06B6D4", CLUB: "#10B981",
};

const card = {
  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "0",
};

export default function DashboardClient({ profile, spaces, traitsDone, tutorialDismissed, tutorial }: { profile: ProfileData; spaces: SpaceRow[]; traitsDone: boolean; tutorialDismissed?: boolean; tutorial: TutorialData }) {
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [opportunities, setOpportunities] = useState<OppCard[]>([]);
  const [ticker, setTicker] = useState<TickerItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchTicker = useCallback(async () => {
    try { const res = await fetch("/api/opportunities/ticker"); const data = await res.json(); setTicker(data.opportunities ?? []); } catch {}
  }, []);

  const fetchFeed = useCallback(async (p: number, filter: string, replace = false) => {
    if (p === 1) setFeedLoading(true); else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (filter !== "ALL") params.set("category", filter);
      const res = await fetch(`/api/opportunities/recommended?${params}`);
      const data = await res.json();
      setOpportunities((prev) => replace ? data.opportunities : [...prev, ...data.opportunities]);
      setHasMore(p < data.pages);
    } catch {} finally { setFeedLoading(false); setLoadingMore(false); }
  }, []);

  useEffect(() => { fetchTicker(); }, [fetchTicker]);
  useEffect(() => { setPage(1); fetchFeed(1, activeFilter, true); }, [activeFilter, fetchFeed]);
  // Refresh ticker every 60s — live feel
  useEffect(() => { const id = setInterval(fetchTicker, 60000); return () => clearInterval(id); }, [fetchTicker]);

  const sendFeedback = async () => {
    if (!feedback.trim()) return;
    await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: feedback }) });
    setFeedback(""); setFeedbackSent(true); setTimeout(() => setFeedbackSent(false), 3000);
  };

  const toggleSave = async (id: string, saved: boolean) => {
    setOpportunities((prev) => prev.map((o) => o.id === id ? { ...o, saved: !saved } : o));
    try { await fetch(`/api/opportunities/${id}/save`, { method: saved ? "DELETE" : "POST" }); }
    catch { setOpportunities((prev) => prev.map((o) => o.id === id ? { ...o, saved } : o)); }
  };

  const FILTERS = ["ALL", "INTERNSHIP", "FELLOWSHIP", "COMPETITION", "ACCELERATOR", "BOOTCAMP", "RESEARCH"];

  return (
    <div className="flex flex-col sm:flex-row gap-6 min-h-0">
      {/* Left panel */}
      <div className="w-full sm:w-[260px] sm:flex-shrink-0 space-y-4">

        {/* Spaces */}
        <div className="bracket-card" style={{ ...card, overflow: "hidden", padding: 0 }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] flex items-center gap-1.5" style={{ color: "var(--text2)", fontFamily: "var(--font-display, sans-serif)" }}>
              <span className="text-[7px]" style={{ color: "var(--blue)" }}>◆</span>Spaces
            </p>
            <Link href="/teams" className="text-xs transition-colors" style={{ color: "var(--muted)" }}>View all</Link>
          </div>
          {spaces.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>No active spaces yet.</p>
              <Link href="/teams" className="text-xs" style={{ color: "var(--gold)" }}>Join or create a team →</Link>
            </div>
          ) : (
            <div style={{ borderTop: "1px solid transparent" }}>
              {spaces.map((s) => (
                <Link key={s.id} href={`/teams/${s.id}`} className="flex items-center justify-between px-4 py-3 transition-colors" style={{ borderTop: "1px solid var(--border)" }}>
                  <span className="text-sm truncate" style={{ color: "var(--text)" }}>{s.name}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {s.hasUnread && <span className="pulse-dot w-2 h-2 rounded-full flex-shrink-0" style={{ background: "var(--gold)" }} />}
                    <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--muted)" }} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Feedback */}
        <div className="bracket-card" style={{ ...card, padding: "16px" }}>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] flex items-center gap-1.5 mb-2" style={{ color: "var(--text2)", fontFamily: "var(--font-display, sans-serif)" }}>
            <span className="text-[7px]" style={{ color: "var(--blue)" }}>◆</span>Platform feedback
          </p>
          {feedbackSent ? (
            <p className="text-xs" style={{ color: "#4ade80" }}>Thanks — got it.</p>
          ) : (
            <div className="flex gap-2">
              <input
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendFeedback()}
                placeholder="Something broken or missing?"
                className="flex-1 text-xs px-3 py-2 focus:outline-none"
                style={{ background: "var(--surface2)", border: "1px solid var(--border-md)", color: "var(--text)", borderRadius: 0 }}
              />
              <button onClick={sendFeedback} className="text-xs px-3 py-2 font-medium" style={{ background: "var(--gold)", color: "#04070F", borderRadius: 0 }}>
                Send
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right column */}
      <div className="flex-1 min-w-0 space-y-4">

        <WelcomeCard hasGeniusType={tutorial.hasGeniusType} />
        <PlatformUpdatesCard />
        <TutorialWidget {...tutorial} serverDismissed={tutorialDismissed} />

        {!traitsDone && (
          <Link href="/quiz?tab=traits" className="bracket-card flex items-center justify-between gap-3 px-4 py-3 transition-colors group" style={{ background: "rgba(74,128,240,0.06)", border: "1px solid rgba(74,128,240,0.12)" }}>
            <div className="flex items-center gap-3">
              <span className="text-lg">✦</span>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Complete your Skill Card</p>
                <p className="text-xs" style={{ color: "var(--text2)" }}>Take the Traits Quiz to identify your 5 core strengths</p>
              </div>
            </div>
            <span className="text-xs font-medium group-hover:translate-x-0.5 transition-transform" style={{ color: "var(--gold)" }}>Start →</span>
          </Link>
        )}

        {ticker.length > 0 && (
          <div
            className="overflow-hidden flex items-center gap-3"
            style={{ height: 36, background: "var(--surface)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}
          >
            {/* LIVE badge */}
            <div
              className="flex items-center gap-1.5 flex-shrink-0 px-3"
              style={{ borderRight: "1px solid var(--border)", height: "100%" }}
            >
              <span className="live-dot" />
              <span className="text-[9px] font-bold tracking-[0.2em] uppercase" style={{ color: "var(--blue)", fontFamily: "var(--font-mono)" }}>LIVE</span>
            </div>
            <div className="overflow-hidden flex-1">
              <div className="ticker-track">
                {[...ticker, ...ticker].map((item, i) => (
                  <Link
                    key={`${item.id}-${i}`}
                    href={`/orgs/${item.org.id}`}
                    className="inline-flex items-center gap-3 text-xs flex-shrink-0 transition-colors"
                    style={{ color: "var(--text2)", textDecoration: "none" }}
                  >
                    <span
                      className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5"
                      style={{ color: CATEGORY_COLORS[item.category] ?? "var(--text2)", background: `${CATEGORY_COLORS[item.category] ?? "#888"}18` }}
                    >
                      {item.category}
                    </span>
                    <span style={{ color: "var(--muted)" }}>{item.org.name}</span>
                    <span style={{ color: "var(--text)", fontWeight: 500 }}>{item.title}</span>
                    {item.deadline && (
                      <span style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 10 }}>
                        · {format(new Date(item.deadline), "MMM d")}
                      </span>
                    )}
                    <span style={{ color: "rgba(59,130,246,0.3)" }}>·</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className="px-3 py-1 text-xs font-medium transition-all"
              style={{
                background: activeFilter === f ? "var(--gold)" : "transparent",
                border: `1px solid ${activeFilter === f ? "var(--gold)" : "var(--border-md)"}`,
                color: activeFilter === f ? "#04070F" : "var(--text2)",
                borderRadius: 0,
              }}
            >
              {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[8px]" style={{ color: "var(--blue)" }}>◆</span>
          <h2 className="text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--text)", fontFamily: "var(--font-display, sans-serif)" }}>Opportunities for you</h2>
        </div>

        {feedLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-36 rounded-xl animate-pulse" style={{ background: "var(--surface)" }} />)}
          </div>
        ) : opportunities.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm mb-2" style={{ color: "var(--text2)" }}>No opportunities found.</p>
            <button onClick={() => setActiveFilter("ALL")} className="text-xs" style={{ color: "var(--gold)" }}>Clear filter</button>
          </div>
        ) : (
          <div className="space-y-3">
            {opportunities.map((opp) => <OppCardComp key={opp.id} opp={opp} onSaveToggle={() => toggleSave(opp.id, opp.saved)} />)}
            {hasMore && (
              <button onClick={() => { const next = page + 1; setPage(next); fetchFeed(next, activeFilter); }} disabled={loadingMore} className="w-full py-3 text-sm transition-colors disabled:opacity-40" style={{ color: "var(--text2)" }}>
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

function OppCardComp({ opp, onSaveToggle }: { opp: OppCard; onSaveToggle: () => void }) {
  const accent = opp.org.accentColor ?? CATEGORY_COLORS[opp.category] ?? "var(--gold)";
  return (
    <div className="relative bracket-card flex" style={{ background: "var(--surface)", border: "1px solid var(--border)", height: "128px" }}>
      <div className="w-1 flex-shrink-0" style={{ background: accent }} />
      <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5" style={{ color: accent, background: `${accent}20` }}>{opp.category}</span>
              <span className="text-xs truncate" style={{ color: "var(--muted)" }}>{opp.org.name}</span>
            </div>
            <p className="font-medium text-sm truncate" style={{ color: "var(--text)" }}>{opp.title}</p>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text2)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: "2.5em" }}>
              {opp.description ?? ""}
            </p>
          </div>
          <button onClick={onSaveToggle} className="flex-shrink-0 p-1.5 transition-colors" style={{ color: opp.saved ? "var(--gold)" : "var(--muted)" }} title={opp.saved ? "Unsave" : "Save"}>
            <Save className="w-4 h-4" fill={opp.saved ? "currentColor" : "none"} />
          </button>
        </div>
        <div className="flex items-center gap-3">
          {opp.deadline && <span className="text-[11px]" style={{ color: "var(--muted)" }}>Due {format(new Date(opp.deadline), "MMM d, yyyy")}</span>}
          {opp.isRemote && <span className="text-[11px] px-1.5 py-0.5" style={{ background: "var(--surface2)", color: "var(--text2)" }}>Remote</span>}
          <Link href={`/orgs/${opp.org.id}`} className="ml-auto text-[11px] flex items-center gap-1 transition-colors" style={{ color: "var(--gold)" }}>
            View org <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
