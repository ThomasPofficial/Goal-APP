"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, Lock } from "lucide-react";

export default function AlumniGate() {
  const router = useRouter();
  const [year, setYear] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/alumni/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ graduationYear: year }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Verification failed.");
    } else {
      router.refresh();
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "60px auto", padding: "0 16px" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "6px 12px", border: "1px solid var(--amber)", marginBottom: 20,
          fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em",
          textTransform: "uppercase", color: "var(--amber)",
        }}>
          <Lock size={10} /> Alumni Access
        </div>
        <h1 style={{
          fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4vw, 42px)",
          letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 12px",
        }}>
          Alumni Verification
        </h1>
        <p style={{ fontSize: 14, color: "var(--n-text2)", lineHeight: 1.6, margin: 0 }}>
          The alumni directory is private to verified Nivarro alumni. Confirm your graduation year to unlock access.
        </p>
      </div>

      {/* Verification form */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 0, padding: 32,
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 56, height: 56, background: "rgba(232,137,58,0.1)",
          border: "1px solid rgba(232,137,58,0.3)", marginBottom: 24,
        }}>
          <GraduationCap size={24} color="var(--amber)" />
        </div>

        <form onSubmit={handleVerify}>
          <label style={{
            display: "block", fontFamily: "var(--font-mono)", fontSize: 10,
            letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--n-muted)",
            marginBottom: 8,
          }}>
            Graduation Year
          </label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="e.g. 2023"
            min={1950}
            max={new Date().getFullYear()}
            required
            style={{
              width: "100%", background: "var(--surface2)", border: "1px solid var(--border-md)",
              borderRadius: 0, padding: "12px 16px", fontSize: 16,
              color: "var(--text)", marginBottom: 16, boxSizing: "border-box",
              fontFamily: "var(--font-mono)",
            }}
          />

          {error && (
            <p style={{
              fontSize: 13, color: "#f87171", background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.2)", padding: "10px 14px",
              marginBottom: 16,
            }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", background: "var(--amber)", color: "#000", border: "none",
              borderRadius: 0, padding: "14px 0", fontFamily: "var(--font-mono)",
              fontSize: 12, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase",
              cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? "Verifying..." : "Unlock Alumni Directory"}
          </button>
        </form>
      </div>

      <p style={{ textAlign: "center", fontSize: 12, color: "var(--n-muted)", marginTop: 20, lineHeight: 1.6 }}>
        Not an alumnus?{" "}
        <a href="/dashboard" style={{ color: "var(--amber)", textDecoration: "none" }}>
          Back to dashboard
        </a>
      </p>
    </div>
  );
}
