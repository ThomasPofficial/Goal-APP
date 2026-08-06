"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import CampaignEditor, { type CampaignEditorData } from "@/components/campaigns/CampaignEditor";
import type { VersionSummary } from "@/components/campaigns/VersionHistoryDrawer";

interface Props {
  campaign: CampaignEditorData;
  versions: VersionSummary[];
  schoolId?: string;
}

export default function CampaignEditClient({ campaign, versions, schoolId }: Props) {
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const publish = async () => {
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: campaign.id }),
      });
      if (!res.ok) throw new Error("Failed to publish");
      window.location.reload();
    } catch {
      setPublishError("Failed to publish. Please try again.");
      setPublishing(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/campaigns" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--n-text2)", textDecoration: "none", marginBottom: 8 }}>
          <ArrowLeft size={12} /> My Campaigns
        </Link>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(20px, 2.6vw, 30px)", letterSpacing: "-0.02em", color: "var(--text)", margin: "6px 0 0" }}>
          Edit Campaign
        </h1>
      </div>
      {publishError && <p style={{ margin: "0 0 12px", fontSize: 13, color: "#ef4444" }}>{publishError}</p>}
      <CampaignEditor campaign={campaign} versions={versions} schoolId={schoolId} onPublish={publish} publishing={publishing} />
    </div>
  );
}
