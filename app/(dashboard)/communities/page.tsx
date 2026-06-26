import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Communities — Nivarro" };

const COMMUNITIES = [
  {
    id: "c1",
    name: "Nivarro Design Guild",
    desc: "UI/UX designers shaping the next generation of products. Weekly crits, portfolio reviews, and live feedback sessions.",
    members: 234,
    category: "Design",
    color: "#6366F1",
    tags: ["UI/UX", "Product", "Branding"],
  },
  {
    id: "c2",
    name: "The Builder's Circle",
    desc: "Engineers and founders building in public. Ship fast, share openly, learn constantly.",
    members: 412,
    category: "Engineering",
    color: "#14B8A6",
    tags: ["Dev", "Startups", "Open Source"],
  },
  {
    id: "c3",
    name: "Founders Under 20",
    desc: "Young entrepreneurs launching their first ventures — from idea to first dollar and beyond.",
    members: 189,
    category: "Entrepreneurship",
    color: "#F59E0B",
    tags: ["Startups", "Fundraising", "MVP"],
  },
  {
    id: "c4",
    name: "Social Impact Network",
    desc: "Changemakers connecting social good with real capital and organizational leverage.",
    members: 156,
    category: "Impact",
    color: "#10B981",
    tags: ["Nonprofit", "Policy", "Community"],
  },
  {
    id: "c5",
    name: "Pre-Med Pipeline",
    desc: "Pre-med students navigating research opportunities, clinical exposure, and MCAT prep together.",
    members: 298,
    category: "Healthcare",
    color: "#06B6D4",
    tags: ["Medicine", "Research", "MCAT"],
  },
  {
    id: "c6",
    name: "Code & Coffee",
    desc: "Weekly meetups for developers at all levels. Show-and-tell, debugging sessions, and peer learning.",
    members: 521,
    category: "Community",
    color: "#F97316",
    tags: ["Coding", "Peer Learning", "Weekly"],
  },
  {
    id: "c7",
    name: "Finance Forward",
    desc: "Students breaking into investment banking, PE, and hedge funds. Deal analysis, resume reviews, and cold-outreach strategies.",
    members: 187,
    category: "Finance",
    color: "#84CC16",
    tags: ["IB", "PE", "Markets"],
  },
  {
    id: "c8",
    name: "Creative Collective",
    desc: "Writers, filmmakers, photographers, and musicians building creative careers with a business edge.",
    members: 143,
    category: "Creative",
    color: "#EC4899",
    tags: ["Art", "Film", "Writing"],
  },
  {
    id: "c9",
    name: "Policy Lab",
    desc: "Students exploring government, law, and public policy. Mock hearings, case studies, and DC network access.",
    members: 99,
    category: "Policy",
    color: "#A78BFA",
    tags: ["Law", "Government", "Advocacy"],
  },
];

export default function CommunitiesPage() {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-[8px]" style={{ color: "var(--blue)" }}>◆</span>
        <h1 className="text-sm font-bold uppercase tracking-[0.18em]" style={{ color: "var(--text)" }}>Communities</h1>
      </div>
      <p className="text-sm mb-8" style={{ color: "var(--text2)" }}>
        Find your people. Every community is a network, a study group, and a launchpad.
      </p>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {COMMUNITIES.map((c) => (
          <div
            key={c.id}
            className="bracket-card"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Color accent strip */}
            <div style={{ height: 3, background: c.color, flexShrink: 0 }} />

            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
              {/* Category + member count */}
              <div className="flex items-center justify-between">
                <span
                  className="text-[9px] uppercase tracking-[0.18em] font-semibold"
                  style={{ color: c.color, fontFamily: "var(--font-mono)" }}
                >
                  {c.category}
                </span>
                <span className="text-[10px]" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                  {c.members.toLocaleString()} members
                </span>
              </div>

              {/* Name */}
              <h2 className="text-base font-semibold leading-snug" style={{ color: "var(--text)" }}>
                {c.name}
              </h2>

              {/* Description */}
              <p className="text-xs leading-relaxed" style={{ color: "var(--text2)" }}>
                {c.desc}
              </p>

              {/* Tags */}
              <div className="flex gap-1.5 flex-wrap">
                {c.tags.map((t) => (
                  <span
                    key={t}
                    className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 font-medium"
                    style={{ background: `${c.color}18`, color: c.color }}
                  >
                    {t}
                  </span>
                ))}
              </div>

              {/* CTA */}
              <div className="mt-auto pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                <button
                  className="text-xs font-medium transition-colors"
                  style={{ color: "var(--gold)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  Join community →
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Coming soon note */}
      <div className="mt-8 text-center">
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          More communities launching soon — suggest one via platform feedback.
        </p>
      </div>
    </div>
  );
}
