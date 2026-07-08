"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import CampaignCanvas, { type ImageParams } from "@/components/campaigns/CampaignCanvas";
import PledgeModal from "@/components/campaigns/PledgeModal";
import { extractVideoId } from "@/lib/video-embed";

interface Props {
  campaign: {
    id: string;
    headline: string;
    subheadline: string;
    body: string;
    ctaText: string;
    imageParams: ImageParams;
    videoUrl: string | null;
    active: boolean;
  };
}

export default function CampaignPublicClient({ campaign }: Props) {
  const [showPledge, setShowPledge] = useState(false);
  const embed = campaign.videoUrl ? extractVideoId(campaign.videoUrl) : null;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#fff" }}>
      <CampaignCanvas imageParams={campaign.imageParams} />

      {embed && (
        <div style={{ position: "relative", paddingBottom: "56.25%", background: "#000" }}>
          <iframe
            src={embed.url}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              border: "none",
            }}
            allow="autoplay; fullscreen; picture-in-picture"
            title="Campaign video"
          />
        </div>
      )}

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "56px 24px" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(28px, 4vw, 52px)",
            letterSpacing: "-0.03em",
            color: "#fff",
            margin: "0 0 16px",
            lineHeight: 1.15,
          }}
        >
          {campaign.headline}
        </h1>
        <p
          style={{
            fontSize: 20,
            color: "#e8893a",
            fontWeight: 600,
            margin: "0 0 32px",
            lineHeight: 1.4,
          }}
        >
          {campaign.subheadline}
        </p>
        <div
          style={{
            fontSize: 16,
            color: "rgba(255,255,255,0.75)",
            lineHeight: 1.8,
            whiteSpace: "pre-wrap",
            marginBottom: 48,
          }}
        >
          {campaign.body}
        </div>
        <button
          onClick={() => setShowPledge(true)}
          style={{
            padding: "16px 36px",
            border: "none",
            background: "#e8893a",
            color: "#000",
            fontFamily: "var(--font-mono)",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Heart size={18} /> {campaign.ctaText}
        </button>
      </div>

      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.08)",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "rgba(255,255,255,0.3)",
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.08em",
          }}
        >
          Powered by Nivarro · app.nivarro.co
        </p>
      </div>

      {showPledge && (
        <PledgeModal
          campaignId={campaign.id}
          ctaText={campaign.ctaText}
          onClose={() => setShowPledge(false)}
        />
      )}
    </div>
  );
}
