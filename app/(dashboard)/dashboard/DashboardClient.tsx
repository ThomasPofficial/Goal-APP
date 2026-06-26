"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ExternalLink, Save } from "lucide-react";
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

const MOCK_COMMUNITIES = [
  { id: "c1", name: "Nivarro Design Guild", members: 234, category: "Design", color: "#6366F1" },
  { id: "c2", name: "The Builder's Circle", members: 412, category: "Engineering", color: "#14B8A6" },
  { id: "c3", name: "Founders Under 20", members: 189, category: "Entrepreneurship", color: "#F59E0B" },
  { id: "c4", name: "Social Impact Network", members: 156, category: "Impact", color: "#10B981" },
  { id: "c5", name: "Pre-Med Pipeline", members: 298, category: "Healthcare", color: "#06B6D4" },
  { id: "c6", name: "Code & Coffee", members: 521, category: "Community", color: "#F97316" },
];

export default function DashboardClient({ profile, spaces, traitsDone, tutorialDismissed, tutorial }: {
  profile: ProfileData; spaces: SpaceRow[]; traitsDone: boolean; tutorialDismissed?: boolean; tutorial: TutorialData;
}) {
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
    <div className="space-y-8">

      {/* Welcome + platform updates */}
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

      {/* ── Projects ─────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[8px]" style={{ color: "var(--blue)" }}>◆</span>
            <h2 className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "var(--text)" }}>Projects</h2>
          </div>
          <Link href="/teams" className="text-xs transition-colors hover:underline" style={{ color: "var(--muted)" }}>View all →</Link>
        </div>
        <div className="overflow-x-auto pb-2" style={{ scrollbarWidth: "thin" }}>
          <div className="flex gap-4" style={{ minWidth: "max-content" }}>
            {spaces.length === 0 ? (
              <div className="flex items-center justify-center" style={{ width: 200, height: 148, background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="text-center px-4">
                  <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>No active projects yet.</p>
                  <Link href="/teams" className="text-xs" style={{ color: "var(--gold)" }}>Join a team →</Link>
                </div>
              </div>
            ) : (
              spaces.map((s) => <ProjectCard key={s.id} space={s} />)
            )}
            <Link href="/teams" className="flex flex-col items-center justify-center gap-2 transition-opacity hover:opacity-70" style={{ width: 200, height: 148, background: "transparent", border: "1px dashed var(--border-md)", flexShrink: 0, textDecoration: "none" }}>
              <span style={{ fontSize: 22, color: "var(--muted)" }}>+</span>
              <span className="text-xs" style={{ color: "var(--muted)" }}>New project</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Communities ───────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[8px]" style={{ color: "var(--blue)" }}>◆</span>
            <h2 className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "var(--text)" }}>Communities</h2>
          </div>
          <Link href="/communities" className="text-xs transition-colors hover:underline" style={{ color: "var(--muted)" }}>View all →</Link>
        </div>
        <div className="overflow-x-auto pb-2" style={{ scrollbarWidth: "thin" }}>
          <div className="flex gap-4" style={{ minWidth: "max-content" }}>
            {MOCK_COMMUNITIES.map((c) => <CommunityCard key={c.id} community={c} />)}
          </div>
        </div>
      </section>

      {/* ── Live ticker ───────────────────────────── */}
      {ticker.length > 0 && (
        <div className="overflow-hidden flex items-center gap-3" style={{ height: 36, background: "var(--surface)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-1.5 flex-shrink-0 px-3" style={{ borderRight: "1px solid var(--border)", height: "100%" }}>
            <span className="live-dot" />
            <span className="text-[9px] font-bold tracking-[0.2em] uppercase" style={{ color: "var(--blue)", fontFamily: "var(--font-mono)" }}>LIVE</span>
          </div>
          <div className="overflow-hidden flex-1">
            <div className="ticker-track">
              {[...ticker, ...ticker].map((item, i) => (
                <Link key={`${item.id}-${i}`} href={`/orgs/${item.org.id}`} className="inline-flex items-center gap-3 text-xs flex-shrink-0 transition-colors" style={{ color: "var(--text2)", textDecoration: "none" }}>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5" style={{ color: CATEGORY_COLORS[item.category] ?? "var(--text2)", background: `${CATEGORY_COLORS[item.category] ?? "#888"}18` }}>{item.category}</span>
                  <span style={{ color: "var(--muted)" }}>{item.org.name}</span>
                  <span style={{ color: "var(--text)", fontWeight: 500 }}>{item.title}</span>
                  {item.deadline && <span style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 10 }}>· {format(new Date(item.deadline), "MMM d")}</span>}
                  <span style={{ color: "rgba(59,130,246,0.3)" }}>·</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Opportunities ─────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[8px]" style={{ color: "var(--blue)" }}>◆</span>
          <h2 className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "var(--text)" }}>Opportunities for you</h2>
        </div>

        <div className="flex gap-2 flex-wrap mb-4">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setActiveFilter(f)} className="px-3 py-1 text-xs font-medium transition-all" style={{ background: activeFilter === f ? "var(--gold)" : "transparent", border: `1px solid ${activeFilter === f ? "var(--gold)" : "var(--border-md)"}`, color: activeFilter === f ? "#04070F" : "var(--text2)", borderRadius: 0 }}>
              {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {feedLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-36 animate-pulse" style={{ background: "var(--surface)" }} />)}
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
      </section>

      {/* ── Feedback ──────────────────────────────── */}
      <div className="bracket-card" style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "16px" }}>
        <p className="text-xs font-semibold uppercase tracking-[0.1em] flex items-center gap-1.5 mb-2" style={{ color: "var(--text2)" }}>
          <span className="text-[7px]" style={{ color: "var(--blue)" }}>◆</span>Platform feedback
        </p>
        {feedbackSent ? (
          <p className="text-xs" style={{ color: "#4ade80" }}>Thanks — got it.</p>
        ) : (
          <div className="flex gap-2">
            <input value={feedback} onChange={(e) => setFeedback(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendFeedback()} placeholder="Something broken or missing?" className="flex-1 text-xs px-3 py-2 focus:outline-none" style={{ background: "var(--surface2)", border: "1px solid var(--border-md)", color: "var(--text)", borderRadius: 0 }} />
            <button onClick={sendFeedback} className="text-xs px-3 py-2 font-medium" style={{ background: "var(--gold)", color: "#04070F", borderRadius: 0 }}>Send</button>
          </div>
        )}
      </div>

    </div>
  );
}

function ProjectCard({ space }: { space: SpaceRow }) {
  return (
    <Link
      href={`/teams/${space.id}`}
      className="bracket-card"
      style={{
        width: 200, height: 148, flexShrink: 0, textDecoration: "none",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        padding: "16px", background: "var(--surface)", border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={space.hasUnread ? "spy-pulse" : undefined}
          style={{
            display: "inline-block", width: 6, height: 6, borderRadius: "50%",
            background: space.hasUnread ? "var(--blue)" : "var(--muted)",
          }}
        />
        <span className="text-[9px] uppercase tracking-[0.18em] font-semibold" style={{ color: space.hasUnread ? "var(--blue)" : "var(--muted)", fontFamily: "var(--font-mono)" }}>
          {space.hasUnread ? "Active" : "Project"}
        </span>
      </div>
      <div>
        <p className="font-semibold text-sm leading-snug mb-2" style={{ color: "var(--text)" }}>{space.name}</p>
        <span className="text-xs font-medium" style={{ color: "var(--gold)" }}>Resume →</span>
      </div>
    </Link>
  );
}

function CommunityCard({ community }: { community: typeof MOCK_COMMUNITIES[0] }) {
  return (
    <Link
      href="/communities"
      className="bracket-card"
      style={{
        width: 200, height: 148, flexShrink: 0, textDecoration: "none",
        display: "flex", flexDirection: "column", padding: 0,
        background: "var(--surface)", border: "1px solid var(--border)", overflow: "hidden",
      }}
    >
      <div style={{ height: 3, background: community.color, width: "100%", flexShrink: 0 }} />
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
        <div>
          <span className="text-[9px] uppercase tracking-[0.18em] font-semibold" style={{ color: community.color, fontFamily: "var(--font-mono)" }}>
            {community.category}
          </span>
          <p className="font-semibold text-sm leading-snug mt-1" style={{ color: "var(--text)" }}>{community.name}</p>
        </div>
        <p className="text-[11px]" style={{ color: "var(--muted)" }}>
          {community.members.toLocaleString()} members
        </p>
      </div>
    </Link>
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
