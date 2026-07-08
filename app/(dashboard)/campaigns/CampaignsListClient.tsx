"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
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
  createdAt: string;
}

export default function CampaignsListClient({ campaigns: initial }: { campaigns: CampaignSummary[] }) {
  const [campaigns, setCampaigns] = useState(initial);

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

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {campaigns.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              onToggleActive={(active) => toggleActive(c.id, active)}
              onDelete={() => deleteCampaign(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
