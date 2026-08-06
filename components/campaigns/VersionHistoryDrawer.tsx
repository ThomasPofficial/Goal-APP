"use client";

import { X, RotateCcw } from "lucide-react";
import CampaignCanvas, { type ImageParams } from "./CampaignCanvas";

export interface VersionSummary {
  id: string;
  cause: string;
  headline: string;
  imageParams: ImageParams;
  source: string;
  note: string | null;
  restoredFrom: string | null;
  createdAt: string;
}

interface Props {
  versions: VersionSummary[];
  onRestore: (versionId: string) => void;
  onClose: () => void;
}

function versionLabel(v: VersionSummary): string {
  if (v.source === "tweak") {
    const note = v.note ?? "";
    const trimmed = note.length > 60 ? note.slice(0, 60) + "…" : note;
    return `Tweaked: "${trimmed}"`;
  }
  if (v.source === "manual") return "Manual edit";
  if (v.source === "restore") return "Restored";
  return "Generated";
}

export default function VersionHistoryDrawer({ versions, onRestore, onClose }: Props) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex" }}>
      <div style={{ flex: 1, background: "rgba(0,0,0,0.4)" }} onClick={onClose} />
      <div style={{ width: 380, background: "var(--surface)", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text)" }}>
            Version History
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--n-text2)", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {versions.map((v, i) => (
            <div key={v.id} style={{ border: "1px solid var(--border)", background: "var(--bg)", overflow: "hidden" }}>
              <div style={{ aspectRatio: "1200/630", pointerEvents: "none" }}>
                <CampaignCanvas imageParams={v.imageParams} />
              </div>
              <div style={{ padding: "10px 12px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--text)", fontWeight: 600, lineHeight: 1.3 }}>{v.headline}</span>
                  {i === 0 && (
                    <span style={{ flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--amber)", padding: "1px 6px", border: "1px solid var(--amber)" }}>Current</span>
                  )}
                </div>
                <p style={{ margin: "0 0 4px", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.05em", color: "var(--n-text2)" }}>
                  {versionLabel(v)}
                </p>
                <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--n-text2)", lineHeight: 1.4 }}>
                  {v.cause.length > 80 ? v.cause.slice(0, 80) + "…" : v.cause}
                </p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--n-text2)" }}>
                    {new Date(v.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {i > 0 && (
                    <button
                      onClick={() => onRestore(v.id)}
                      style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--n-text2)", background: "none", border: "1px solid var(--border)", padding: "3px 8px", cursor: "pointer" }}
                    >
                      <RotateCcw size={10} /> Restore
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
