"use client";

import { useState } from "react";
import { calculateDonationFee, MIN_DONATION_CENTS } from "@/lib/payments/donationFees";

const PRESETS_CENTS = [1000, 2500, 5000, 10000];

export default function DonationWidget({ recipientHandle, recipientName }: { recipientHandle: string; recipientName: string }) {
  const [selected, setSelected] = useState<number | null>(2500);
  const [customDollars, setCustomDollars] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ totalCents: number } | "error" | null>(null);

  const amountCents = customDollars.trim()
    ? Math.round(parseFloat(customDollars) * 100)
    : selected ?? 0;
  const validAmount = Number.isFinite(amountCents) && amountCents >= MIN_DONATION_CENTS;
  const { feeCents, totalCents } = calculateDonationFee(validAmount ? amountCents : 0);

  async function submit() {
    if (!validAmount) return;
    setSubmitting(true);
    setResult(null);
    const res = await fetch("/api/donations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientHandle, amountCents }),
    });
    setSubmitting(false);
    if (res.ok) {
      const data = await res.json();
      setResult({ totalCents: data.donation.totalCents });
    } else {
      setResult("error");
    }
  }

  if (result && result !== "error") {
    return (
      <div style={{ padding: 20, border: "1px solid var(--border)", background: "var(--surface)", textAlign: "center" }}>
        <p style={{ color: "var(--text)", fontSize: 15, fontWeight: 700, margin: "0 0 6px" }}>
          Thanks for supporting {recipientName}!
        </p>
        <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>
          This is a demo — you were not charged ${(result.totalCents / 100).toFixed(2)}. Real payments launch soon.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, border: "1px solid var(--border)", background: "var(--surface)" }}>
      <p style={{ color: "var(--text)", fontSize: 14, fontWeight: 700, margin: "0 0 12px" }}>
        Support {recipientName}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {PRESETS_CENTS.map((c) => (
          <button
            key={c}
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
        <p style={{ color: "var(--muted)", fontSize: 12, margin: "0 0 14px" }}>
          ${(amountCents / 100).toFixed(2)} to {recipientName} + ${(feeCents / 100).toFixed(2)} Nivarro fee (5% + $0.30) = <strong style={{ color: "var(--text)" }}>${(totalCents / 100).toFixed(2)}</strong>
        </p>
      ) : (
        <p style={{ color: "var(--muted)", fontSize: 12, margin: "0 0 14px" }}>Minimum donation is $1.00.</p>
      )}
      {result === "error" && (
        <p style={{ color: "#e05", fontSize: 12, margin: "0 0 10px" }}>Something went wrong — try again.</p>
      )}
      <button
        onClick={submit}
        disabled={!validAmount || submitting}
        style={{
          width: "100%", padding: "10px 0", background: "var(--amber)", border: "none", color: "#000",
          fontWeight: 700, fontSize: 13, cursor: !validAmount || submitting ? "not-allowed" : "pointer",
          opacity: !validAmount || submitting ? 0.6 : 1,
        }}
      >
        {submitting ? "Processing…" : validAmount ? `Donate $${(totalCents / 100).toFixed(2)}` : "Donate"}
      </button>
    </div>
  );
}
