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
  { id: "c1", name: "Nivarro Design Guild",  members: 234, category: "Design",         color: "#6366F1" },
  { id: "c2", name: "The Builder's Circle",  members: 412, category: "Engineering",    color: "#14B8A6" },
  { id: "c3", name: "Founders Under 20",     members: 189, category: "Entrepreneurship", color: "#F59E0B" },
  { id: "c4", name: "Social Impact Network", members: 156, category: "Impact",         color: "#10B981" },
  { id: "c5", name: "Pre-Med Pipeline",      members: 298, category: "Healthcare",     color: "#06B6D4" },
  { id: "c6", name: "Code & Coffee",         members: 521, category: "Community",      color: "#F97316" },
];

/* ── Shared HUD section header ─────────────────────────────── */
function HudHeader({ label, href, linkLabel }: { label: string; href: string; linkLabel: string }) {
  return (
    <div className="hud-section">
      <span style={{ color: "var(--blue)", fontFamily: "var(--font-mono)", fontSize: 10, lineHeight: 1 }}>▸</span>
      <span style={{
        fontFamily: "var(--font-body)", fontSize: 11, fontWeight: "bold",
        letterSpacing: "0.22em", color: "var(--text)", textTransform: "uppercase",
      }}>
        [ {label} ]
      </span>
      <div className="hud-section-line" />
      <Link href={href} style={{
        fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em",
        color: "var(--muted)", textTransform: "uppercase", textDecoration: "none",
        transition: "color 120ms",
      }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--blue)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}
      >
        {linkLabel} ›
      </Link>
    </div>
  );
}

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
    <div className="space-y-10">

      {/* ── Intel widgets ─────────────────────────── */}
      <WelcomeCard hasGeniusType={tutorial.hasGeniusType} />
      <PlatformUpdatesCard />
      <TutorialWidget {...tutorial} serverDismissed={tutorialDismissed} />

      {!traitsDone && (
        <Link href="/quiz?tab=traits" className="bracket-card flex items-center justify-between gap-3 px-4 py-3 transition-colors group" style={{ background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.18)" }}>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 16 }}>✦</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Complete your Skill Card</p>
              <p className="text-xs" style={{ color: "var(--text2)" }}>Take the Traits Quiz to identify your 5 core strengths</p>
            </div>
          </div>
          <span className="text-xs font-medium group-hover:translate-x-0.5 transition-transform" style={{ color: "var(--gold)" }}>Start →</span>
        </Link>
      )}

      {/* ── Projects ──────────────────────────────── */}
      <section>
        <HudHeader label="Projects" href="/teams" linkLabel="View All" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {spaces.map((s) => <ProjectCard key={s.id} space={s} />)}
          <NewProjectButton />
        </div>
        {spaces.length === 0 && (
          <p className="text-xs mt-3" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}>
            NO ACTIVE OPERATIONS — join a team to get started.
          </p>
        )}
      </section>

      {/* ── Communities ───────────────────────────── */}
      <section>
        <HudHeader label="Communities" href="/communities" linkLabel="View All" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {MOCK_COMMUNITIES.map((c) => <CommunityCard key={c.id} community={c} />)}
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
        <HudHeader label="Opportunities" href="/orgs" linkLabel="Browse Orgs" />

        {/* Filters */}
        <div className="flex gap-2 flex-wrap mb-5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              style={{
                padding: "4px 12px",
                fontSize: 9,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                background: activeFilter === f ? "var(--blue)" : "transparent",
                border: `1px solid ${activeFilter === f ? "var(--blue)" : "rgba(59,130,246,0.22)"}`,
                color: activeFilter === f ? "#fff" : "var(--text2)",
                cursor: "pointer",
                transition: "all 120ms",
              }}
            >
              {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {feedLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse" style={{ background: "var(--surface)", border: "1px solid var(--border)" }} />)}
          </div>
        ) : opportunities.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm mb-3" style={{ color: "var(--text2)" }}>No opportunities found.</p>
            <button
              onClick={() => setActiveFilter("ALL")}
              style={{ fontSize: 9, fontFamily: "var(--font-mono)", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--blue)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              Clear Filter ›
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {opportunities.map((opp) => <OppCardComp key={opp.id} opp={opp} onSaveToggle={() => toggleSave(opp.id, opp.saved)} />)}
            {hasMore && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => { const next = page + 1; setPage(next); fetchFeed(next, activeFilter); }}
                  disabled={loadingMore}
                  className="spy-card bracket-card"
                  style={{
                    padding: "8px 24px",
                    fontSize: 9,
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--text2)",
                    background: "var(--surface)",
                    border: "1px solid rgba(59,130,246,0.18)",
                    cursor: "pointer",
                    opacity: loadingMore ? 0.5 : 1,
                    transition: "all 120ms",
                  }}
                >
                  {loadingMore ? "Loading…" : "Load More ›"}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Feedback ──────────────────────────────── */}
      <div className="bracket-card" style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "20px" }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>
          ▸ [ Platform Feedback ]
        </p>
        {feedbackSent ? (
          <p className="text-xs" style={{ color: "#4ade80", fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}>TRANSMISSION RECEIVED.</p>
        ) : (
          <div className="flex gap-2">
            <input
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendFeedback()}
              placeholder="Report anomaly or missing asset…"
              style={{ flex: 1, fontSize: 13, padding: "8px 12px", background: "var(--surface2)", border: "1px solid var(--border-md)", color: "var(--text)", fontFamily: "var(--font-body)", outline: "none" }}
            />
            <button
              onClick={sendFeedback}
              style={{ padding: "8px 16px", fontSize: 9, fontFamily: "var(--font-mono)", letterSpacing: "0.14em", textTransform: "uppercase", background: "var(--blue)", color: "#fff", border: "none", cursor: "pointer" }}
            >
              Send
            </button>
          </div>
        )}
      </div>

    </div>
  );
}

/* ── Project card ─────────────────────────────────────────── */
function ProjectCard({ space }: { space: SpaceRow }) {
  return (
    <Link
      href={`/teams/${space.id}`}
      className="spy-card bracket-card"
      style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 12, textDecoration: "none", minHeight: 140 }}
    >
      {/* Status */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            className={space.hasUnread ? "spy-pulse" : undefined}
            style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: space.hasUnread ? "#3B82F6" : "var(--muted)", flexShrink: 0 }}
          />
          <span style={{ fontSize: 9, letterSpacing: "0.2em", color: space.hasUnread ? "var(--blue)" : "var(--muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>
            {space.hasUnread ? "Active" : "Standby"}
          </span>
        </div>
        <span style={{ fontSize: 8, letterSpacing: "0.12em", color: "var(--muted)", fontFamily: "var(--font-mono)" }}>FIELD / OP</span>
      </div>

      {/* Name */}
      <p style={{ fontSize: 16, fontWeight: "bold", color: "var(--text)", lineHeight: 1.25, fontFamily: "var(--font-body)", flex: 1 }}>
        {space.name}
      </p>

      {/* CTA */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, letterSpacing: "0.18em", color: "var(--blue)", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>
          Resume ›
        </span>
      </div>
    </Link>
  );
}

function NewProjectButton() {
  return (
    <Link
      href="/teams"
      className="spy-card bracket-card"
      style={{
        padding: "20px", display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: 8, textDecoration: "none", minHeight: 140,
        border: "1px dashed rgba(59,130,246,0.25)",
        boxShadow: "none",
        background: "transparent",
      }}
    >
      <span style={{ fontSize: 20, color: "var(--muted)" }}>+</span>
      <span style={{ fontSize: 9, letterSpacing: "0.18em", color: "var(--muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>
        New Operation
      </span>
    </Link>
  );
}

/* ── Community card ───────────────────────────────────────── */
function CommunityCard({ community }: { community: typeof MOCK_COMMUNITIES[0] }) {
  return (
    <Link
      href="/communities"
      className="spy-card bracket-card"
      style={{ display: "flex", flexDirection: "column", textDecoration: "none", overflow: "hidden", minHeight: 140 }}
    >
      <div style={{ height: 2, background: community.color, flexShrink: 0 }} />
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 9, letterSpacing: "0.2em", color: community.color, fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>
            {community.category}
          </span>
          <span style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
            {community.members.toLocaleString()}
          </span>
        </div>
        <p style={{ fontSize: 15, fontWeight: "bold", color: "var(--text)", lineHeight: 1.3, fontFamily: "var(--font-body)", flex: 1 }}>
          {community.name}
        </p>
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          <span style={{ fontSize: 9, letterSpacing: "0.18em", color: "var(--blue)", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>
            Join ›
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ── Opportunity card ─────────────────────────────────────── */
function OppCardComp({ opp, onSaveToggle }: { opp: OppCard; onSaveToggle: () => void }) {
  const accent = opp.org.accentColor ?? CATEGORY_COLORS[opp.category] ?? "var(--gold)";
  return (
    <div className="spy-card bracket-card flex" style={{ height: "128px" }}>
      <div style={{ width: 2, background: accent, flexShrink: 0 }} />
      <div style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", padding: "1px 6px", color: accent, background: `${accent}20`, fontFamily: "var(--font-mono)" }}>{opp.category}</span>
              <span style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opp.org.name}</span>
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opp.title}</p>
            <p style={{ fontSize: 11, color: "var(--text2)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: "2.4em", marginTop: 2 }}>
              {opp.description ?? ""}
            </p>
          </div>
          <button onClick={onSaveToggle} style={{ flexShrink: 0, padding: "4px", color: opp.saved ? "var(--gold)" : "var(--muted)", background: "none", border: "none", cursor: "pointer", transition: "color 80ms" }} title={opp.saved ? "Unsave" : "Save"}>
            <Save size={15} fill={opp.saved ? "currentColor" : "none"} />
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {opp.deadline && <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>Due {format(new Date(opp.deadline), "MMM d, yyyy")}</span>}
          {opp.isRemote && <span style={{ fontSize: 10, padding: "1px 6px", background: "var(--surface2)", color: "var(--text2)" }}>Remote</span>}
          <Link href={`/orgs/${opp.org.id}`} style={{ marginLeft: "auto", fontSize: 10, display: "flex", alignItems: "center", gap: 4, color: "var(--gold)", textDecoration: "none" }}>
            View org <ExternalLink size={11} />
          </Link>
        </div>
      </div>
    </div>
  );
}
