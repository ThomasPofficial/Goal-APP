"use client";

import { useState } from "react";
import { X, Heart, CheckCircle, Loader2, Copy, Check } from "lucide-react";
import { calculateDonationFee, MIN_DONATION_CENTS } from "@/lib/payments/donationFees";

interface Props {
  campaignId: string;
  ctaText: string;
  schoolId?: string;
  slug?: string | null;
  onClose: () => void;
}

const PRESETS_CENTS = [1000, 2500, 5000, 10000];

export default function PledgeModal({ campaignId, ctaText, schoolId, slug, onClose }: Props) {
  const [tab, setTab] = useState<"donate" | "pledge">("donate");

  const publicUrl = slug
    ? `${typeof window !== "undefined" ? window.location.origin : "https://app.nivarro.co"}/c/${slug}`
    : null;
  const [linkCopied, setLinkCopied] = useState(false);
  const copyLink = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const [form, setForm] = useState({ name: "", email: "", phone: "", amount: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns/pledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          donorName: form.name,
          donorEmail: form.email,
          donorPhone: form.phone || undefined,
          pledgeAmount: form.amount ? parseFloat(form.amount) : undefined,
          schoolId: schoolId ?? undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to record pledge");
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [selected, setSelected] = useState<number | null>(2500);
  const [customDollars, setCustomDollars] = useState("");
  const [donating, setDonating] = useState(false);
  const [donateResult, setDonateResult] = useState<{ totalCents: number } | "error" | null>(null);

  const amountCents = customDollars.trim()
    ? Math.round(parseFloat(customDollars) * 100)
    : selected ?? 0;
  const validAmount = Number.isFinite(amountCents) && amountCents >= MIN_DONATION_CENTS;
  const { feeCents, totalCents } = calculateDonationFee(validAmount ? amountCents : 0);

  const submitDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validAmount || !donorName.trim() || !donorEmail.trim()) return;
    setDonating(true);
    setDonateResult(null);
    try {
      const res = await fetch("/api/campaigns/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          donorName: donorName.trim(),
          donorEmail: donorEmail.trim(),
          amountCents,
          schoolId: schoolId ?? undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setDonateResult({ totalCents: data.pledge.totalCents ?? totalCents });
      } else {
        setDonateResult("error");
      }
    } catch {
      setDonateResult("error");
    } finally {
      setDonating(false);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: 28, width: "100%", maxWidth: 440, position: "relative", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", color: "var(--n-text2)", cursor: "pointer" }}>
          <X size={18} />
        </button>
        {done ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <CheckCircle size={48} style={{ color: "#22c55e", margin: "0 auto 16px" }} />
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 8px" }}>Pledge Recorded!</h3>
            <p style={{ color: "var(--n-text2)", fontSize: 14, margin: 0 }}>Thank you. Your pledge has been recorded!</p>
          </div>
        ) : donateResult && donateResult !== "error" ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <CheckCircle size={48} style={{ color: "#22c55e", margin: "0 auto 16px" }} />
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 8px" }}>Thanks for donating!</h3>
            <p style={{ color: "var(--n-text2)", fontSize: 14, margin: 0 }}>
              This is a demo — you were not charged ${(donateResult.totalCents / 100).toFixed(2)}. Real payments launch soon.
            </p>
          </div>
        ) : (
          <>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 4px", wordBreak: "break-word" }}>{ctaText}</h3>

            <div style={{ display: "flex", gap: 6, margin: "14px 0 18px" }}>
              {([["donate", "Donate Online"], ["pledge", "Pledge by Check"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  style={{
                    flex: 1, padding: "8px 10px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                    fontFamily: "var(--font-mono)", cursor: "pointer",
                    border: tab === key ? "1px solid var(--amber)" : "1px solid var(--border)",
                    background: tab === key ? "var(--amber)" : "transparent",
                    color: tab === key ? "#000" : "var(--n-text2)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "donate" && publicUrl && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "8px 10px", border: "1px solid var(--border)", background: "var(--bg)" }}>
                <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--n-text2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {publicUrl}
                </span>
                <button
                  type="button"
                  onClick={copyLink}
                  style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", border: "1px solid var(--border)", background: "none", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}
                >
                  {linkCopied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy Link</>}
                </button>
              </div>
            )}

            {tab === "donate" ? (
              <form onSubmit={submitDonation} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--n-text2)", marginBottom: 4 }}>Amount</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    {PRESETS_CENTS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => { setSelected(c); setCustomDollars(""); }}
                        style={{
                          padding: "8px 16px", border: "1px solid var(--border)", cursor: "pointer", fontSize: 13,
                          background: selected === c && !customDollars ? "var(--amber)" : "transparent",
                          color: selected === c && !customDollars ? "#000" : "var(--text)",
                        }}
                      >
                        ${(c / 100).toFixed(0)}
                      </button>
                    ))}
                    <input
                      value={customDollars}
                      onChange={(e) => { setCustomDollars(e.target.value); setSelected(null); }}
                      placeholder="Custom $"
                      style={{ width: 90, padding: "8px 10px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
                    />
                  </div>
                  {validAmount ? (
                    <p style={{ color: "var(--n-text2)", fontSize: 12, margin: 0 }}>
                      ${(amountCents / 100).toFixed(2)} to this campaign + ${(feeCents / 100).toFixed(2)} Nivarro fee (5% + $0.30) = <strong style={{ color: "var(--text)" }}>${(totalCents / 100).toFixed(2)}</strong>
                    </p>
                  ) : (
                    <p style={{ color: "var(--n-text2)", fontSize: 12, margin: 0 }}>Minimum donation is $1.00.</p>
                  )}
                </div>
                {[
                  { key: "donorName",  label: "Full Name", type: "text",  placeholder: "Alex Johnson",     value: donorName,  set: setDonorName },
                  { key: "donorEmail", label: "Email",     type: "email", placeholder: "alex@example.com", value: donorEmail, set: setDonorEmail },
                ].map(({ key, label, type, placeholder, value, set }) => (
                  <div key={key}>
                    <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--n-text2)", marginBottom: 4 }}>{label}</label>
                    <input
                      type={type}
                      placeholder={placeholder}
                      required
                      value={value}
                      onChange={(e) => set(e.target.value)}
                      style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" }}
                    />
                  </div>
                ))}
                {donateResult === "error" && <p style={{ margin: 0, fontSize: 12, color: "#ef4444" }}>Something went wrong. Please try again.</p>}
                <button
                  type="submit"
                  disabled={!validAmount || donating}
                  style={{ padding: "10px 0", border: "none", background: "var(--amber)", color: "#000", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: !validAmount || donating ? "not-allowed" : "pointer", opacity: !validAmount || donating ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  {donating
                    ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Processing…</>
                    : <><Heart size={14} /> {validAmount ? `Donate $${(totalCents / 100).toFixed(2)}` : "Donate"}</>}
                </button>
              </form>
            ) : (
              <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ color: "var(--n-text2)", fontSize: 12, margin: "-6px 0 0" }}>We&apos;ll email your details so the school can follow up to collect a check.</p>
                {[
                  { key: "name",   label: "Full Name",               type: "text",   placeholder: "Alex Johnson",        required: true },
                  { key: "email",  label: "Email",                   type: "email",  placeholder: "alex@example.com",    required: true },
                  { key: "phone",  label: "Phone (optional)",        type: "tel",    placeholder: "+1 (555) 000-0000",   required: false },
                  { key: "amount", label: "Pledge Amount (optional)", type: "number", placeholder: "50",                  required: false },
                ].map(({ key, label, type, placeholder, required }) => (
                  <div key={key}>
                    <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--n-text2)", marginBottom: 4 }}>{label}</label>
                    <input
                      type={type}
                      placeholder={placeholder}
                      required={required}
                      value={form[key as keyof typeof form]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" }}
                    />
                  </div>
                ))}
                {error && <p style={{ margin: 0, fontSize: 12, color: "#ef4444" }}>{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  style={{ padding: "10px 0", border: "none", background: "var(--amber)", color: "#000", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  {loading
                    ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Submitting…</>
                    : <><Heart size={14} /> Submit Pledge</>}
                </button>
              </form>
            )}
          </>
        )}
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
