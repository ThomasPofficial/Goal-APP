"use client";
import { useEffect, useState } from "react";

type ScanEvent = {
  id: string;
  scannedAt: string;
  field: string;
  prevValue: string | null;
  newValue: string | null;
  user: { name: string | null; profile: { displayName: string } | null };
};

type Status = {
  year: number;
  totalPool: number;
  sent: number;
  responded: number;
  responseRate: number;
  recentScanEvents: ScanEvent[];
};

const mono: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.2em",
  textTransform: "uppercase" as const,
};

export default function SurveyDashboardPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = () =>
    fetch("/api/admin/survey/status")
      .then((r) => r.json())
      .then(setStatus);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  async function handleSend() {
    setSending(true);
    setMsg(null);
    try {
      const d = await fetch("/api/admin/survey/enqueue", { method: "POST" }).then((r) => r.json());
      setMsg(`Sent ${d.sent} surveys. Skipped ${d.skipped}.`);
      await refresh();
    } catch {
      setMsg("Something went wrong. Try again.");
    } finally {
      setSending(false);
    }
  }

  async function handleScan() {
    setScanning(true);
    setMsg(null);
    try {
      const d = await fetch("/api/admin/survey/linkedin-scan", { method: "POST" }).then((r) => r.json());
      setMsg(`Scanned ${d.scanned} profiles. ${d.changes} change(s) detected.`);
      await refresh();
    } catch {
      setMsg("Something went wrong. Try again.");
    } finally {
      setScanning(false);
    }
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px,3vw,36px)", letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 4px" }}>
        Destination Survey
      </h1>
      <p style={{ fontSize: 14, color: "var(--n-text2)", margin: "0 0 32px" }}>
        Annual alumni check-in — sends May 1 at noon ET, LinkedIn scanned monthly.
      </p>

      {loading ? (
        <p style={{ fontSize: 14, color: "var(--n-text2)" }}>Loading…</p>
      ) : status && (
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          {[
            { label: "Alumni pool",      value: status.totalPool },
            { label: `Sent ${status.year}`, value: status.sent },
            { label: "Responded",        value: status.responded },
            { label: "Response rate",    value: `${status.responseRate}%` },
          ].map(({ label, value }) => (
            <div key={label} style={{ flex: "1 1 120px", background: "var(--surface)", border: "1px solid var(--border)", padding: "14px 18px" }}>
              <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 32, color: "var(--amber)", letterSpacing: "-0.04em", lineHeight: 1 }}>{value}</p>
              <p style={{ margin: "4px 0 0", ...mono, color: "var(--n-muted)" }}>{label}</p>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <button
          onClick={handleSend}
          disabled={sending}
          style={{ background: "var(--amber)", color: "#fff", fontWeight: 600, border: "none", padding: "12px 20px", cursor: sending ? "not-allowed" : "pointer", opacity: sending ? 0.6 : 1, fontSize: 14 }}
        >
          {sending ? "Sending…" : "Send Survey Now"}
        </button>
        <button
          onClick={handleScan}
          disabled={scanning}
          style={{ background: "var(--surface)", color: "var(--text)", fontWeight: 600, border: "1px solid var(--border)", padding: "12px 20px", cursor: scanning ? "not-allowed" : "pointer", opacity: scanning ? 0.6 : 1, fontSize: 14 }}
        >
          {scanning ? "Scanning…" : "Scan LinkedIn Now"}
        </button>
      </div>

      {msg && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "12px 16px", fontSize: 14, color: "var(--text)", marginBottom: 24 }}>
          {msg}
        </div>
      )}

      {status && status.recentScanEvents.length > 0 && (
        <>
          <p style={{ ...mono, color: "var(--amber)", margin: "0 0 12px" }}>Detected LinkedIn Changes</p>
          <div style={{ border: "1px solid var(--border)" }}>
            {status.recentScanEvents.map((e) => (
              <div key={e.id} style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--n-muted)", minWidth: 90 }}>{new Date(e.scannedAt).toLocaleDateString()}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", minWidth: 120 }}>{e.user.profile?.displayName ?? e.user.name ?? "Unknown"}</span>
                <span style={{ fontSize: 13, color: "var(--n-text2)" }}>
                  <strong>{e.field}</strong>: {e.prevValue ?? "(none)"} → {e.newValue ?? "(none)"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {status && status.recentScanEvents.length === 0 && !loading && (
        <div style={{ padding: "32px 24px", border: "1px solid var(--border)", background: "var(--surface)", textAlign: "center" }}>
          <p style={{ color: "var(--n-text2)", fontSize: 14, margin: 0 }}>
            No LinkedIn changes detected yet. Click &quot;Scan LinkedIn Now&quot; to check.
          </p>
        </div>
      )}
    </div>
  );
}
