"use client";

import Link from "next/link";
import { useState } from "react";
import { Copy, Check, Pencil, Trash2 } from "lucide-react";
import CampaignCanvas, { type ImageParams } from "./CampaignCanvas";

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

interface Props {
  campaign: CampaignSummary;
  onToggleActive: (active: boolean) => void;
  onDelete: () => void;
}

export default function CampaignCard({ campaign, onToggleActive, onDelete }: Props) {
  const [copied, setCopied] = useState(false);

  const publicUrl = campaign.slug
    ? `${typeof window !== "undefined" ? window.location.origin : "https://app.nivarro.co"}/c/${campaign.slug}`
    : null;

  const copy = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ border: "1px solid var(--border)", background: "var(--surface)", overflow: "hidden" }}>
      <div style={{ aspectRatio: "1200/630", overflow: "hidden", pointerEvents: "none" }}>
        <CampaignCanvas imageParams={campaign.imageParams} />
      </div>
      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15, letterSpacing: "-0.01em", color: "var(--text)", margin: 0, lineHeight: 1.3 }}>{campaign.headline}</h3>
          <span style={{ flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", padding: "2px 8px", background: campaign.pledgeCount > 0 ? "rgba(34,197,94,0.15)" : "var(--n-bg3)", color: campaign.pledgeCount > 0 ? "#22c55e" : "var(--n-text2)" }}>
            {campaign.pledgeCount} pledge{campaign.pledgeCount !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <button
            onClick={() => onToggleActive(!campaign.active)}
            style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: campaign.active ? "#22c55e" : "var(--n-text2)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: campaign.active ? "#22c55e" : "var(--border)", display: "inline-block" }} />
            {campaign.active ? "Active" : "Draft"}
          </button>
          {!campaign.slug && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--n-text2)" }}>— not published</span>}
        </div>
        {campaign.goalAmount && campaign.goalAmount > 0 ? (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)", fontWeight: 700 }}>
                ${Math.round(campaign.raised).toLocaleString()} raised
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--n-text2)" }}>
                of ${Math.round(campaign.goalAmount).toLocaleString()}
              </span>
            </div>
            <div style={{ height: 6, background: "var(--n-bg3)" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, (campaign.raised / campaign.goalAmount) * 100)}%`,
                  background: "var(--amber)",
                }}
              />
            </div>
          </div>
        ) : (
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)", fontWeight: 700, margin: "0 0 12px" }}>
            ${Math.round(campaign.raised).toLocaleString()} raised
          </p>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/campaigns/${campaign.id}/edit`} style={{ flex: 1, padding: "6px 0", border: "1px solid var(--border)", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <Pencil size={11} /> Edit
          </Link>
          {publicUrl && (
            <button onClick={copy} style={{ flex: 1, padding: "6px 0", border: "1px solid var(--border)", background: "none", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
              {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy Link</>}
            </button>
          )}
          <button onClick={onDelete} style={{ padding: "6px 10px", border: "1px solid var(--border)", background: "none", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
