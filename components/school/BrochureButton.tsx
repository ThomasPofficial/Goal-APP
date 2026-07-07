"use client";
import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";

export default function BrochureButton() {
  const [loading, setLoading] = useState(false);

  const download = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/school/brochure");
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "nivarro-brochure.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={download}
      disabled={loading}
      style={{
        padding: "8px 16px",
        borderRadius: 0,
        border: "1px solid var(--border)",
        background: "var(--n-bg2)",
        color: "var(--text)",
        fontSize: 13,
        fontWeight: 600,
        cursor: loading ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        gap: 6,
        transition: "all 0.15s",
      }}
    >
      {loading
        ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
        : <FileDown size={14} />}
      {loading ? "Generating…" : "Download Brochure"}
      <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
    </button>
  );
}
