"use client";

import { useState } from "react";
import { Sparkles, Loader2, Check, Copy, ExternalLink } from "lucide-react";
import CampaignEditor from "@/components/campaigns/CampaignEditor";
import type { ImageParams } from "@/components/campaigns/CampaignCanvas";

interface GeneratedCampaign {
  campaignId: string;
  headline: string;
  subheadline: string;
  body: string;
  ctaText: string;
  imageParams: ImageParams;
  videoUrl: string | null;
}

interface CampaignsNewClientProps {
  schoolId?: string;
}

export default function CampaignsNewClient({ schoolId }: CampaignsNewClientProps) {
  const [view, setView] = useState<"input" | "preview" | "saved">("input");
  const [causeInput, setCauseInput] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedCampaign | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!causeInput.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cause: causeInput, videoUrl: videoUrl || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Failed to generate");
      }
      const data = await res.json() as GeneratedCampaign;
      setGenerated(data);
      setView("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  };

  const publish = async () => {
    if (!generated) return;
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: generated.campaignId }),
      });
      if (!res.ok) throw new Error("Failed to publish");
      const data = await res.json() as { slug: string };
      setPublishedSlug(data.slug);
      setView("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPublishing(false);
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (view === "input") {
    return (
      <div style={{ maxWidth: 720 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 3vw, 36px)", letterSpacing: "-0.02em", color: "var(--text)", margin: 0 }}>
            AI Fundraising Page Generator
          </h1>
          <p style={{ fontSize: 14, color: "var(--n-text2)", marginTop: 4, marginBottom: 0 }}>
            Describe your cause and let Claude generate a complete campaign page in seconds — you can tweak or edit anything afterward.
          </p>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: 20, marginBottom: 16 }}>
          <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--amber)", marginBottom: 8 }}>
            What are you raising funds for?
          </label>
          <textarea
            value={causeInput}
            onChange={(e) => setCauseInput(e.target.value)}
            placeholder="e.g. We're raising money to send 12 students from our robotics club to the national championship in Dallas. We need $8,000 for travel, lodging, and registration fees."
            rows={5}
            style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 14, lineHeight: 1.5, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", borderRadius: 0 }}
          />
          <div style={{ marginTop: 12 }}>
            <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--n-text2)", marginBottom: 2 }}>
              Campaign Video (optional)
            </label>
            <p style={{ fontSize: 11, color: "var(--n-text2)", margin: "0 0 6px", lineHeight: 1.4 }}>
              Paste a YouTube or Vimeo link to embed a video on your public fundraising page — great for a student pitch or team intro.
            </p>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", borderRadius: 0 }}
            />
          </div>
          {error && <p style={{ margin: "12px 0 0", fontSize: 13, color: "#ef4444" }}>{error}</p>}
          <button
            onClick={generate}
            disabled={generating || causeInput.trim().length < 10}
            style={{ marginTop: 16, padding: "10px 20px", border: "none", background: generating || causeInput.trim().length < 10 ? "var(--n-bg3)" : "var(--amber)", color: generating || causeInput.trim().length < 10 ? "var(--n-text2)" : "#000", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: generating || causeInput.trim().length < 10 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, borderRadius: 0 }}
          >
            {generating ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Generating…</> : <><Sparkles size={16} /> Generate Campaign</>}
          </button>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (view === "preview" && generated) {
    return (
      <div style={{ maxWidth: 900 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--n-text2)" }}>Preview — edit anything below, then publish</span>
          <button onClick={() => setView("input")} style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--n-text2)", background: "none", border: "1px solid var(--border)", padding: "4px 10px", cursor: "pointer", borderRadius: 0 }}>
            ← Edit Prompt
          </button>
        </div>
        <CampaignEditor
          campaign={{
            id: generated.campaignId,
            slug: null,
            cause: causeInput,
            headline: generated.headline,
            subheadline: generated.subheadline,
            body: generated.body,
            ctaText: generated.ctaText,
            imageParams: generated.imageParams,
            videoUrl: generated.videoUrl,
            active: false,
          }}
          versions={[]}
          schoolId={schoolId}
          onPublish={publish}
          publishing={publishing}
        />
      </div>
    );
  }

  if (view === "saved" && publishedSlug) {
    const url = typeof window !== "undefined" ? `${window.location.origin}/c/${publishedSlug}` : `/c/${publishedSlug}`;
    return (
      <div style={{ maxWidth: 600, padding: "48px 0" }}>
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 28, letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 8px" }}>Campaign is live!</h2>
          <p style={{ color: "var(--n-text2)", fontSize: 14, margin: 0 }}>Share this link with your community to start collecting pledges.</p>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <input readOnly value={url} style={{ flex: 1, padding: "10px 12px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, fontFamily: "var(--font-mono)", borderRadius: 0 }} />
          <button onClick={() => copyUrl(url)} style={{ padding: "10px 16px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, borderRadius: 0 }}>
            {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
          </button>
          <a href={url} target="_blank" rel="noopener noreferrer" style={{ padding: "10px 16px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none", display: "flex", alignItems: "center", gap: 6, borderRadius: 0 }}>
            <ExternalLink size={14} /> Open
          </a>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => { setView("input"); setGenerated(null); setCauseInput(""); setVideoUrl(""); setPublishedSlug(null); }} style={{ padding: "10px 20px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", borderRadius: 0 }}>
            New Campaign
          </button>
          <a href="/campaigns" style={{ padding: "10px 20px", border: "none", background: "var(--amber)", color: "#000", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none", display: "inline-block", borderRadius: 0 }}>
            My Campaigns →
          </a>
        </div>
      </div>
    );
  }

  return null;
}
