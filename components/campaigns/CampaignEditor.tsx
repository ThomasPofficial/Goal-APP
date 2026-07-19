"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Loader2, History, Heart, ExternalLink, Sparkles, Save } from "lucide-react";
import CampaignHero from "@/components/campaigns/CampaignHero";
import type { ImageParams } from "@/components/campaigns/CampaignCanvas";
import PledgeModal from "@/components/campaigns/PledgeModal";
import VersionHistoryDrawer, { type VersionSummary } from "@/components/campaigns/VersionHistoryDrawer";
import { extractVideoId } from "@/lib/video-embed";

export interface CampaignEditorData {
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

interface GeneratedFields {
  headline: string;
  subheadline: string;
  body: string;
  ctaText: string;
  imageParams: ImageParams;
  videoUrl: string | null;
}

interface Props {
  campaign: CampaignEditorData;
  versions: VersionSummary[];
  schoolId?: string;
  onPublish?: () => void | Promise<void>;
  publishing?: boolean;
}

type EditableField = "headline" | "subheadline" | "body" | "ctaText";

export default function CampaignEditor({ campaign: initial, versions: initialVersions, schoolId, onPublish, publishing }: Props) {
  const [current, setCurrent] = useState(initial);
  const [versions, setVersions] = useState(initialVersions);
  const [causeInput, setCauseInput] = useState(initial.cause);
  const [videoUrl, setVideoUrl] = useState(initial.videoUrl ?? "");
  const [feedback, setFeedback] = useState("");
  const [dirty, setDirty] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [tweaking, setTweaking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPledge, setShowPledge] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshVersions = async () => {
    const res = await fetch(`/api/campaigns/${current.id}/versions`);
    if (res.ok) setVersions(await res.json() as VersionSummary[]);
  };

  // Always sync history on mount — the "new campaign" flow starts with an
  // empty versions array even though `generate` already created one row.
  useEffect(() => {
    refreshVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateField = (key: EditableField, value: string) => {
    setCurrent((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const saveChanges = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline: current.headline,
          subheadline: current.subheadline,
          body: current.body,
          ctaText: current.ctaText,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? "Failed to save changes");
      }
      setDirty(false);
      await refreshVersions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const applyFeedback = async () => {
    if (feedback.trim().length < 3) return;
    setTweaking(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${current.id}/tweak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: feedback.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? "Failed to apply feedback");
      }
      const data = await res.json() as GeneratedFields;
      setCurrent((prev) => ({ ...prev, ...data }));
      setDirty(false);
      setFeedback("");
      await refreshVersions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setTweaking(false);
    }
  };

  const regenerate = async () => {
    setRegenerating(true);
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
      const data = await res.json() as GeneratedFields;
      setCurrent((prev) => ({ ...prev, ...data, cause: causeInput }));
      setDirty(false);
      await refreshVersions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setRegenerating(false);
    }
  };

  const restore = async (versionId: string) => {
    try {
      const res = await fetch(`/api/campaigns/${current.id}/versions/${versionId}/restore`, { method: "POST" });
      if (!res.ok) throw new Error("Restore failed");
      const data = await res.json() as { cause: string; headline: string; subheadline: string; body: string; ctaText: string; imageParams: ImageParams };
      setCurrent((prev) => ({ ...prev, ...data }));
      setCauseInput(data.cause);
      setDirty(false);
      await refreshVersions();
      setShowHistory(false);
    } catch {
      setError("Failed to restore version");
    }
  };

  const embed = current.videoUrl ? extractVideoId(current.videoUrl) : null;
  const busy = regenerating || tweaking || saving;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        {current.slug && (
          <a href={`/c/${current.slug}`} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--n-text2)", textDecoration: "none" }}>
            <ExternalLink size={13} /> View live
          </a>
        )}
        <button onClick={() => setShowHistory(true)} style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--n-text2)", background: "none", border: "1px solid var(--border)", padding: "4px 10px", cursor: "pointer" }}>
          <History size={13} /> History ({versions.length})
        </button>
        {onPublish && (
          <button onClick={onPublish} disabled={publishing} style={{ marginLeft: "auto", padding: "8px 20px", border: "none", background: "var(--amber)", color: "#000", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: publishing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            {publishing ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Publishing…</> : "Save & Publish →"}
          </button>
        )}
      </div>

      {error && <p style={{ marginBottom: 12, fontSize: 13, color: "#ef4444" }}>{error}</p>}

      <div style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
        <CampaignHero
          imageParams={current.imageParams}
          headline={current.headline}
          subheadline={current.subheadline}
          editable
          onHeadlineChange={(v) => updateField("headline", v)}
          onSubheadlineChange={(v) => updateField("subheadline", v)}
        />
        {embed && (
          <div style={{ position: "relative", paddingBottom: "56.25%", background: "#000" }}>
            <iframe src={embed.url} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }} allow="autoplay; fullscreen" title="Campaign video" />
          </div>
        )}
        <div style={{ padding: "32px 40px" }}>
          <textarea
            value={current.body}
            onChange={(e) => updateField("body", e.target.value)}
            rows={8}
            style={{ width: "100%", fontSize: 15, color: "var(--n-text2)", lineHeight: 1.75, whiteSpace: "pre-wrap", marginBottom: 24, fontFamily: "inherit", border: "1px dashed var(--border)", background: "var(--bg)", padding: 10, boxSizing: "border-box", resize: "vertical" }}
          />
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--n-text2)", marginBottom: 4 }}>
              CTA button text
            </label>
            <input
              value={current.ctaText}
              onChange={(e) => updateField("ctaText", e.target.value)}
              style={{ padding: "8px 12px", border: "1px dashed var(--border)", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, letterSpacing: "0.05em", boxSizing: "border-box" }}
            />
          </div>
          <button onClick={() => setShowPledge(true)} style={{ padding: "14px 28px", border: "none", background: "var(--amber)", color: "#000", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Heart size={16} /> Preview donor view: {current.ctaText}
          </button>
        </div>
        <div style={{ padding: "12px 40px", borderTop: "1px solid var(--border)", color: "var(--n-text2)", fontSize: 12, fontFamily: "var(--font-mono)" }}>Powered by Nivarro · app.nivarro.co</div>
      </div>

      {dirty && (
        <button onClick={saveChanges} disabled={saving} style={{ marginTop: 12, padding: "10px 20px", border: "none", background: saving ? "var(--n-bg3)" : "var(--amber)", color: saving ? "var(--n-text2)" : "#000", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          {saving ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Saving…</> : <><Save size={14} /> Save Changes</>}
        </button>
      )}

      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--n-text2)", marginBottom: 6 }}>
            Tweak with AI feedback
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="e.g. make the headline punchier, shorten the body"
              style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, fontFamily: "inherit" }}
            />
            <button onClick={applyFeedback} disabled={busy || feedback.trim().length < 3} style={{ padding: "8px 16px", border: "none", background: busy || feedback.trim().length < 3 ? "var(--n-bg3)" : "var(--amber)", color: busy || feedback.trim().length < 3 ? "var(--n-text2)" : "#000", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: busy || feedback.trim().length < 3 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
              {tweaking ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={13} />} Apply
            </button>
          </div>
        </div>

        <div>
          <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--n-text2)", marginBottom: 6 }}>
            Start over from description
          </label>
          <textarea
            value={causeInput}
            onChange={(e) => setCauseInput(e.target.value)}
            rows={4}
            style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, lineHeight: 1.5, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 8 }}
          />
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=... (optional video)"
            style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 8 }}
          />
          <button onClick={regenerate} disabled={busy || causeInput.trim().length < 10} style={{ padding: "10px 20px", border: "1px solid var(--border)", background: "none", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", cursor: busy || causeInput.trim().length < 10 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            {regenerating ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Regenerating…</> : <><RefreshCw size={14} /> Start Over From Description</>}
          </button>
        </div>
      </div>

      {showHistory && (
        <VersionHistoryDrawer versions={versions} onRestore={restore} onClose={() => setShowHistory(false)} />
      )}
      {showPledge && (
        <PledgeModal campaignId={current.id} ctaText={current.ctaText} schoolId={schoolId} onClose={() => setShowPledge(false)} />
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
