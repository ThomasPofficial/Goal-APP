"use client";

import { useState } from "react";
import { X, Heart, CheckCircle, Loader2 } from "lucide-react";

interface Props {
  campaignId: string;
  ctaText: string;
  onClose: () => void;
}

export default function PledgeModal({ campaignId, ctaText, onClose }: Props) {
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
        ) : (
          <>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 4px" }}>{ctaText}</h3>
            <p style={{ color: "var(--n-text2)", fontSize: 13, margin: "0 0 20px" }}>Fill in your details to pledge your support.</p>
            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
          </>
        )}
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
