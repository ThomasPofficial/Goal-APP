"use client";

import { useState } from "react";
import { RefreshCw, Loader2, History, Heart, ExternalLink } from "lucide-react";
import CampaignCanvas, { type ImageParams } from "@/components/campaigns/CampaignCanvas";
import PledgeModal from "@/components/campaigns/PledgeModal";
import VersionHistoryDrawer, { type VersionSummary } from "@/components/campaigns/VersionHistoryDrawer";
import { extractVideoId } from "@/lib/video-embed";

interface CampaignData {
  id: string;
  slug: string | null;
  cause: string;
  headline: string;
  subheadline: string;
  body: string;
  ctaText: string;
  imageParams: ImageParams;
  videoUrl: string | null;
  active: boolean;
}

interface Props {
  campaign: CampaignData;
  versions: VersionSummary[];
}

export default function CampaignEditClient({ campaign: initial, versions: initialVersions }: Props) {
  const [current, setCurrent] = useState(initial);
  const [versions, setVersions] = useState(initialVersions);
  const [causeInput, setCauseInput] = useState(initial.cause);
  const [videoUrl, setVideoUrl] = useState(initial.videoUrl ?? "");
  const [generating, setGenerating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPledge, setShowPledge] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshVersions = async () => {
    const res = await fetch(`/api/campaigns/${current.id}/versions`);
    if (res.ok) setVersions(await res.json() as VersionSummary[]);
  };

  const regenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cause: causeInput, campaignId: current.id, videoUrl: videoUrl || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? "Failed to regenerate");
      }
      const data = await res.json() as { headline: string; subheadline: string; body: string; ctaText: string; imageParams: ImageParams; videoUrl: string | null };
      setCurrent((prev) => ({ ...prev, ...data }));
      await refreshVersions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  };

  const restore = async (versionId: string) => {
    try {
      const res = await fetch(`/api/campaigns/${current.id}/versions/${versionId}/restore`, { method: "POST" });
      if (!res.ok) throw new Error("Restore failed");
      const data = await res.json() as { cause: string; headline: string; subheadline: string; body: string; ctaText: string; imageParams: ImageParams };
      setCurrent((prev) => ({ ...prev, ...data }));
      setCauseInput(data.cause);
      await refreshVersions();
      setShowHistory(false);
    } catch {
      setError("Failed to restore version");
    }
  };

  const embed = current.videoUrl ? extractVideoId(current.videoUrl) : null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", minHeight: "calc(100vh - 56px)" }}>
      {/* Left panel */}
      <div style={{ borderRight: "1px solid var(--border)", padding: 20, background: "var(--surface)", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--amber)" }}>Edit Campaign</span>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {current.slug && (
              <a href={`/c/${current.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--n-text2)", display: "flex" }}>
                <ExternalLink size={13} />
              </a>
            )}
            <button
              onClick={() => setShowHistory(true)}
              style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--n-text2)", background: "none", border: "none", cursor: "pointer" }}
            >
              <History size={13} /> History ({versions.length})
            </button>
          </div>
        </div>

        <div>
          <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--n-text2)", marginBottom: 6 }}>
            Cause Description
          </label>
          <textarea
            value={causeInput}
            onChange={(e) => setCauseInput(e.target.value)}
            rows={8}
            style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, lineHeight: 1.5, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--n-text2)", marginBottom: 6 }}>
            Video URL (optional)
          </label>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" }}
          />
        </div>

        {error && <p style={{ margin: 0, fontSize: 12, color: "#ef4444" }}>{error}</p>}

        <button
          onClick={regenerate}
          disabled={generating || causeInput.trim().length < 10}
          style={{ padding: "10px 0", border: "none", background: generating || causeInput.trim().length < 10 ? "var(--n-bg3)" : "var(--amber)", color: generating || causeInput.trim().length < 10 ? "var(--n-text2)" : "#000", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: generating || causeInput.trim().length < 10 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          {generating
            ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Regenerating…</>
            : <><RefreshCw size={14} /> Regenerate</>}
        </button>
      </div>

      {/* Right panel — live preview */}
      <div style={{ overflowY: "auto" }}>
        <div style={{ borderBottom: "1px solid var(--border)", padding: "8px 20px", background: "var(--surface)" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--n-text2)" }}>Live Preview</span>
        </div>
        <CampaignCanvas imageParams={current.imageParams} />
        {embed && (
          <div style={{ position: "relative", paddingBottom: "56.25%", background: "#000" }}>
            <iframe src={embed.url} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }} allow="autoplay; fullscreen" title="Campaign video" />
          </div>
        )}
        <div style={{ padding: "40px 48px", background: "var(--bg)" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 2.5vw, 38px)", letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 12px", lineHeight: 1.2 }}>{current.headline}</h2>
          <p style={{ fontSize: 17, color: "var(--amber)", fontWeight: 600, margin: "0 0 24px" }}>{current.subheadline}</p>
          <div style={{ fontSize: 14, color: "var(--n-text2)", lineHeight: 1.75, whiteSpace: "pre-wrap", marginBottom: 32 }}>{current.body}</div>
          <button onClick={() => setShowPledge(true)} style={{ padding: "12px 24px", border: "none", background: "var(--amber)", color: "#000", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Heart size={16} /> {current.ctaText}
          </button>
        </div>
      </div>

      {showHistory && (
        <VersionHistoryDrawer versions={versions} onRestore={restore} onClose={() => setShowHistory(false)} />
      )}
      {showPledge && (
        <PledgeModal campaignId={current.id} ctaText={current.ctaText} onClose={() => setShowPledge(false)} />
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
