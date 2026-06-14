"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UnsaveButton({ orgId }: { orgId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const unsave = async () => {
    setLoading(true);
    await fetch(`/api/orgs/${orgId}/save`, { method: "POST" });
    router.refresh();
  };

  return (
    <button
      onClick={unsave}
      disabled={loading}
      className="text-xs px-3 py-1.5 border font-mono uppercase tracking-widest flex-shrink-0"
      style={{
        color: "var(--muted)",
        borderColor: "var(--border-md)",
        background: "transparent",
        cursor: loading ? "default" : "pointer",
        opacity: loading ? 0.5 : 1,
      }}
    >
      {loading ? "..." : "UNSAVE"}
    </button>
  );
}
