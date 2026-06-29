"use client";

import { useState } from "react";
import { Sparkles, Heart, CheckCircle, Loader2, X } from "lucide-react";

interface GeneratedCampaign {
  headline: string;
  subheadline: string;
  body: string;
  ctaText: string;
  causeText: string;
}

export default function CampaignsNewClient() {
  const [causeInput, setCauseInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [campaign, setCampaign] = useState<GeneratedCampaign | null>(null);
  const [showPledge, setShowPledge] = useState(false);
  const [pledgeForm, setPledgeForm] = useState({ name: "", email: "", phone: "", amount: "" });
  const [pledging, setPledging] = useState(false);
  const [pledgeDone, setPledgeDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!causeInput.trim()) return;
    setGenerating(true);
    setError(null);
    setCampaign(null);

    try {
      const res = await fetch("/api/campaigns/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cause: causeInput }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to generate campaign");
      }
      const data = await res.json();
      setCampaign(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  };

  const submitPledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaign) return;
    setPledging(true);
    setError(null);

    try {
      const res = await fetch("/api/campaigns/pledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          causeText: campaign.causeText,
          donorName: pledgeForm.name,
          donorEmail: pledgeForm.email,
          donorPhone: pledgeForm.phone || undefined,
          pledgeAmount: pledgeForm.amount ? parseFloat(pledgeForm.amount) : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to record pledge");
      setPledgeDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPledging(false);
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 3vw, 36px)", letterSpacing: "-0.02em", color: "var(--text)", margin: 0 }}>
          AI Fundraising Page Generator
        </h1>
        <p style={{ fontSize: 14, color: "var(--n-text2)", marginTop: 4, marginBottom: 0 }}>
          Describe your cause and let Claude write compelling fundraising copy in seconds.
        </p>
      </div>

      {/* Input area */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, padding: 20, marginBottom: 20 }}>
        <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--amber)", marginBottom: 8 }}>
          What are you raising funds for?
        </label>
        <textarea
          value={causeInput}
          onChange={(e) => setCauseInput(e.target.value)}
          placeholder="e.g. We're raising money to send 12 students from our school's robotics club to the national championship in Dallas. We need $8,000 for travel, lodging, and registration fees."
          rows={4}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 0,
            border: "1px solid var(--border)",
            background: "var(--bg)",
            color: "var(--text)",
            fontSize: 14,
            lineHeight: 1.5,
            resize: "vertical",
            fontFamily: "inherit",
            boxSizing: "border-box",
          }}
        />
        <button
          onClick={generate}
          disabled={generating || !causeInput.trim()}
          style={{
            marginTop: 12,
            padding: "10px 20px",
            borderRadius: 0,
            border: "none",
            background: generating || !causeInput.trim() ? "var(--n-bg3)" : "var(--amber)",
            color: generating || !causeInput.trim() ? "var(--n-text2)" : "#000",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            cursor: generating || !causeInput.trim() ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "all 0.15s",
          }}
        >
          {generating ? (
            <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Generating…</>
          ) : (
            <><Sparkles size={16} /> Generate Campaign Page</>
          )}
        </button>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 0, marginBottom: 16 }}>
          <p style={{ margin: 0, fontSize: 13, color: "#ef4444" }}>{error}</p>
        </div>
      )}

      {/* Generated campaign preview */}
      {campaign && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, overflow: "hidden" }}>
          {/* Hero */}
          <div style={{ padding: "32px 28px 24px", background: "linear-gradient(135deg, rgba(232,137,58,0.12) 0%, rgba(232,137,58,0.03) 100%)", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(20px, 2.5vw, 30px)", letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 8px", lineHeight: 1.2 }}>
              {campaign.headline}
            </h2>
            <p style={{ fontSize: 16, color: "var(--amber)", fontWeight: 600, margin: 0 }}>
              {campaign.subheadline}
            </p>
          </div>

          {/* Body */}
          <div style={{ padding: "24px 28px" }}>
            <div style={{ fontSize: 14, color: "var(--n-text2)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
              {campaign.body}
            </div>

            <button
              onClick={() => { setShowPledge(true); setPledgeDone(false); setError(null); }}
              style={{
                marginTop: 24,
                padding: "12px 24px",
                borderRadius: 0,
                border: "none",
                background: "var(--amber)",
                color: "#000",
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Heart size={16} /> {campaign.ctaText}
            </button>
          </div>

          {/* Regenerate */}
          <div style={{ padding: "12px 28px", borderTop: "1px solid var(--border)", display: "flex", gap: 12 }}>
            <button
              onClick={generate}
              style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--n-text2)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
            >
              <Sparkles size={12} /> Regenerate
            </button>
          </div>
        </div>
      )}

      {/* Pledge modal */}
      {showPledge && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--surface)", borderRadius: 0, border: "1px solid var(--border)", padding: 28, width: "100%", maxWidth: 440, position: "relative", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
            <button
              onClick={() => setShowPledge(false)}
              style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", color: "var(--n-text2)", cursor: "pointer" }}
            >
              <X size={18} />
            </button>

            {pledgeDone ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <CheckCircle size={48} style={{ color: "#22c55e", margin: "0 auto 16px" }} />
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 8px" }}>Pledge Recorded!</h3>
                <p style={{ color: "var(--n-text2)", fontSize: 14, margin: 0 }}>
                  Thank you for your support. A confirmation has been sent to your email.
                </p>
              </div>
            ) : (
              <>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 4px" }}>Make a Pledge</h3>
                <p style={{ color: "var(--n-text2)", fontSize: 13, margin: "0 0 20px" }}>
                  Fill in your details to pledge your support.
                </p>

                <form onSubmit={submitPledge} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    { key: "name", label: "Full Name", type: "text", placeholder: "Alex Johnson", required: true },
                    { key: "email", label: "Email", type: "email", placeholder: "alex@example.com", required: true },
                    { key: "phone", label: "Phone (optional)", type: "tel", placeholder: "+1 (555) 000-0000", required: false },
                    { key: "amount", label: "Pledge Amount ($, optional)", type: "number", placeholder: "50", required: false },
                  ].map(({ key, label, type, placeholder, required }) => (
                    <div key={key}>
                      <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--n-text2)", marginBottom: 4 }}>{label}</label>
                      <input
                        type={type}
                        placeholder={placeholder}
                        required={required}
                        value={pledgeForm[key as keyof typeof pledgeForm]}
                        onChange={(e) => setPledgeForm((f) => ({ ...f, [key]: e.target.value }))}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: 0,
                          border: "1px solid var(--border)",
                          background: "var(--bg)",
                          color: "var(--text)",
                          fontSize: 14,
                          boxSizing: "border-box",
                          fontFamily: "inherit",
                        }}
                      />
                    </div>
                  ))}

                  {error && (
                    <p style={{ margin: 0, fontSize: 12, color: "#ef4444" }}>{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={pledging}
                    style={{
                      padding: "10px 0",
                      borderRadius: 0,
                      border: "none",
                      background: "var(--amber)",
                      color: "#000",
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      cursor: pledging ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    {pledging ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Submitting…</> : <><Heart size={14} /> Submit Pledge</>}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
