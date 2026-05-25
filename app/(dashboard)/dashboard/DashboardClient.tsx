"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ExternalLink, ChevronRight, Save } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import GeniusTypeBadge from "@/components/ui/GeniusTypeBadge";
import TutorialWidget from "@/components/ui/TutorialWidget";
import WelcomeCard from "@/components/ui/WelcomeCard";
import { GENIUS_TYPES } from "@/lib/geniusTypes";
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

  const typeInfo = profile.geniusType ? GENIUS_TYPES[profile.geniusType] : null;

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
  useEffect(() => { const id = setInterval(fetchTicker, 600000); return () => clearInterval(id); }, [fetchTicker]);

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
      <div className="w-full sm:w-[280px] sm:flex-shrink-0 space-y-4">

        {/* Identity */}
        <div
          className="bracket-card"
          style={{
            ...card,
            padding: "20px",
            ...(typeInfo ? { boxShadow: `0 0 48px ${typeInfo.color}12, 0 0 0 1px ${typeInfo.color}10` } : {}),
          }}
        >
          <div className="flex items-start gap-3 mb-3">
            <Avatar src={profile.avatarUrl} name={profile.displayName} geniusType={profile.geniusType} size="lg" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate" style={{ color: "var(--text)", fontFamily: "var(--font-display, sans-serif)" }}>
                {profile.displayName}
              </p>
              {profile.handle && <p className="text-xs" style={{ color: "var(--text2)" }}>@{profile.handle}</p>}
              {profile.geniusType && (
                <p className="text-[10px] font-medium tracking-[0.15em] uppercase mt-1" style={{ color: typeInfo?.color ?? "var(--muted)", fontFamily: "var(--font-mono)" }}>
                  {typeInfo?.label} · {profile.geniusType}
                </p>
              )}
              {profile.geniusType && <GeniusTypeBadge type={profile.geniusType} size="sm" className="mt-1.5" />}
            </div>
          </div>

          {profile.currentFocus && typeInfo && (
            <div className="border-l-4 pl-3 py-1 mb-3 text-xs italic leading-relaxed" style={{ borderColor: typeInfo.color, color: "var(--text2)" }}>
              {profile.currentFocus}
            </div>
          )}

          <div className="flex gap-4 text-center mb-4">
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{profile.savedCount}</p>
              <p className="text-[11px]" style={{ color: "var(--muted)" }}>Saved</p>
            </div>
          </div>

          <Link
            href="/profile/me"
            className="block w-full text-center text-xs font-medium py-2 transition-colors"
            style={{ border: "1px solid var(--border-md)", color: "var(--text2)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--gold)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--gold)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border-md)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--text2)"; }}
          >
            Edit profile
          </Link>
        </div>

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
          <div className="overflow-hidden h-10 flex items-center" style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
            <div className="overflow-hidden flex-1">
              <div className="flex gap-12 whitespace-nowrap" style={{ animation: "ticker-scroll 40s linear infinite" }}>
                {[...ticker, ...ticker].map((item, i) => (
                  <Link key={`${item.id}-${i}`} href={`/orgs/${item.org.id}`} className="inline-flex items-center gap-3 text-xs flex-shrink-0 transition-colors" style={{ color: "var(--text2)" }}>
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ color: CATEGORY_COLORS[item.category] ?? "var(--text2)", background: `${CATEGORY_COLORS[item.category] ?? "#888"}20` }}>
                      {item.category}
                    </span>
                    <span>{item.org.name}</span>
                    <span style={{ color: "var(--text)" }}>{item.title}</span>
                    {item.deadline && <span style={{ color: "var(--muted)" }}>· {format(new Date(item.deadline), "MMM d")}</span>}
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

      <style>{`@keyframes ticker-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </div>
  );
}

function OppCardComp({ opp, onSaveToggle }: { opp: OppCard; onSaveToggle: () => void }) {
  const accent = opp.org.accentColor ?? CATEGORY_COLORS[opp.category] ?? "var(--gold)";
  return (
    <div className="relative bracket-card flex" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="w-1 flex-shrink-0" style={{ background: accent }} />
      <div className="flex-1 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ color: accent, background: `${accent}20` }}>{opp.category}</span>
              <span className="text-xs" style={{ color: "var(--muted)" }}>{opp.org.name}</span>
            </div>
            <p className="font-medium text-sm truncate" style={{ color: "var(--text)" }}>{opp.title}</p>
            {opp.description && <p className="text-xs mt-1 line-clamp-2 leading-relaxed" style={{ color: "var(--text2)" }}>{opp.description}</p>}
          </div>
          <button onClick={onSaveToggle} className="flex-shrink-0 p-1.5 transition-colors" style={{ color: opp.saved ? "var(--gold)" : "var(--muted)" }} title={opp.saved ? "Unsave" : "Save"}>
            <Save className="w-4 h-4" fill={opp.saved ? "currentColor" : "none"} />
          </button>
        </div>
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          {opp.deadline && <span className="text-[11px]" style={{ color: "var(--muted)" }}>Due {format(new Date(opp.deadline), "MMM d, yyyy")}</span>}
          {opp.isRemote && <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: "var(--surface2)", color: "var(--text2)" }}>Remote</span>}
          <Link href={`/orgs/${opp.org.id}`} className="ml-auto text-[11px] flex items-center gap-1 transition-colors" style={{ color: "var(--gold)" }}>
            View org <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
