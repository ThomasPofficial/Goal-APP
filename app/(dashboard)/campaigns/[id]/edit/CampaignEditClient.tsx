"use client";

import CampaignEditor, { type CampaignEditorData } from "@/components/campaigns/CampaignEditor";
import type { VersionSummary } from "@/components/campaigns/VersionHistoryDrawer";

interface Props {
  campaign: CampaignEditorData;
  versions: VersionSummary[];
}

export default function CampaignEditClient({ campaign, versions }: Props) {
  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ marginBottom: 20 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--amber)" }}>
          Edit Campaign
        </span>
      </div>
      <CampaignEditor campaign={campaign} versions={versions} />
    </div>
  );
}
