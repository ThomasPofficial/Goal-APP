"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Copy, Check, Link2 } from "lucide-react";
import CampaignCard from "@/components/campaigns/CampaignCard";
import type { ImageParams } from "@/components/campaigns/CampaignCanvas";

interface CampaignSummary {
  id: string;
  slug: string | null;
  headline: string;
  subheadline: string;
  imageParams: ImageParams;
  active: boolean;
  pledgeCount: number;
  raised: number;
  goalAmount: number | null;
  createdAt: string;
}

type FilterKey = "all" | "active" | "draft";
type SortKey = "newest" | "raised" | "pledges";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "draft", label: "Draft" },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "raised", label: "Most Raised" },
  { key: "pledges", label: "Most Pledges" },
];

export default function CampaignsListClient({ campaigns: initial }: { campaigns: CampaignSummary[] }) {
  const [campaigns, setCampaigns] = useState(initial);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [view, setView] = useState<"campaigns" | "share">("campaigns");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyShareLink = (campaignId: string, slug: string) => {
    const url = `${typeof window !== "undefined" ? window.location.origin : "https://app.nivarro.co"}/c/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedId(campaignId);
    setTimeout(() => setCopiedId((prev) => (prev === campaignId ? null : prev)), 2000);
  };

  const toggleActive = async (id: string, active: boolean) => {
    await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, active } : c)));
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm("Delete this campaign and all its pledges? This cannot be undone.")) return;
    await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
  };

  const stats = useMemo(() => {
    const totalRaised = campaigns.reduce((sum, c) => sum + c.raised, 0);
    const activeCount = campaigns.filter((c) => c.active).length;
    const totalPledges = campaigns.reduce((sum, c) => sum + c.pledgeCount, 0);
    return { totalRaised, activeCount, totalPledges };
  }, [campaigns]);

  const visible = useMemo(() => {
    let list = campaigns;
    if (filter === "active") list = list.filter((c) => c.active);
    if (filter === "draft") list = list.filter((c) => !c.active);

    list = [...list];
    if (sort === "raised") list.sort((a, b) => b.raised - a.raised);
    else if (sort === "pledges") list.sort((a, b) => b.pledgeCount - a.pledgeCount);
    else list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return list;
  }, [campaigns, filter, sort]);

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {([["campaigns", "Campaigns"], ["share", "Share Links"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            aria-pressed={view === key}
            style={{
              padding: "8px 16px",
              border: "1px solid var(--border)",
              background: view === key ? "var(--amber)" : "var(--surface)",
              color: view === key ? "#000" : "var(--n-text2)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "campaigns" ? (
        <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 3vw, 36px)", letterSpacing: "-0.02em", color: "var(--text)", margin: 0 }}>My Campaigns</h1>
          <p style={{ fontSize: 14, color: "var(--n-text2)", marginTop: 4, marginBottom: 0 }}>
            {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/campaigns/new" style={{ padding: "10px 20px", border: "none", background: "var(--amber)", color: "#000", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
          <Plus size={14} /> New Campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div style={{ padding: "64px 0", textAlign: "center", border: "1px solid var(--border)", background: "var(--surface)" }}>
          <p style={{ color: "var(--n-text2)", fontSize: 15, margin: "0 0 20px" }}>No campaigns yet.</p>
          <Link href="/campaigns/new" style={{ padding: "10px 20px", border: "none", background: "var(--amber)", color: "#000", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none" }}>
            Create your first campaign
          </Link>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
            {[
              { label: "Total Raised", value: `$${Math.round(stats.totalRaised).toLocaleString()}` },
              { label: "Active Campaigns", value: stats.activeCount },
              { label: "Total Pledges", value: stats.totalPledges },
            ].map(({ label, value }) => (
              <div
                key={label}
                style={{
                  flex: "1 1 120px",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 0,
                  padding: "14px 18px",
                }}
              >
                <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 32, color: "var(--amber)", letterSpacing: "-0.04em", lineHeight: 1 }}>{value}</p>
                <p style={{ margin: "4px 0 0", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--n-muted)" }}>{label}</p>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {FILTERS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  aria-pressed={filter === key}
                  style={{
                    padding: "6px 14px",
                    border: "1px solid var(--border)",
                    background: filter === key ? "var(--amber)" : "var(--surface)",
                    color: filter === key ? "#000" : "var(--n-text2)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sort campaigns"
              style={{
                padding: "7px 10px",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              {SORTS.map(({ key, label }) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {visible.length === 0 ? (
            <div style={{ padding: "48px 0", textAlign: "center", border: "1px solid var(--border)", background: "var(--surface)" }}>
              <p style={{ color: "var(--n-text2)", fontSize: 14, margin: 0 }}>No {filter} campaigns.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {visible.map((c) => (
                <CampaignCard
                  key={c.id}
                  campaign={c}
                  onToggleActive={(active) => toggleActive(c.id, active)}
                  onDelete={() => deleteCampaign(c.id)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <div>
          {(() => {
            const published = campaigns.filter((c) => c.slug);
            if (published.length === 0) {
              return (
                <div style={{ padding: "48px 0", textAlign: "center", border: "1px solid var(--border)", background: "var(--surface)" }}>
                  <p style={{ color: "var(--n-text2)", fontSize: 14, margin: 0 }}>Publish a campaign to get a shareable link.</p>
                </div>
              );
            }
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {published.map((c) => {
                  const url = `${typeof window !== "undefined" ? window.location.origin : "https://app.nivarro.co"}/c/${c.slug}`;
                  return (
                    <div key={c.id} style={{ border: "1px solid var(--border)", background: "var(--surface)", padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
                        <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 15, letterSpacing: "-0.01em", color: "var(--text)" }}>{c.headline}</p>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6, color: c.active ? "#22c55e" : "var(--n-text2)" }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.active ? "#22c55e" : "var(--border)", display: "inline-block" }} />
                          {c.active ? "Active" : "Draft"}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: "1px solid var(--border)", background: "var(--bg)" }}>
                          <Link2 size={13} style={{ flexShrink: 0, color: "var(--n-text2)" }} />
                          <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--n-text2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {url}
                          </span>
                        </div>
                        <button
                          onClick={() => copyShareLink(c.id, c.slug!)}
                          style={{ flexShrink: 0, padding: "8px 14px", border: "1px solid var(--border)", background: "none", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                        >
                          {copiedId === c.id ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
