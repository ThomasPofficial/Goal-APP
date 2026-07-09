"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { loginAction } from "@/app/actions/auth";

export default function DemoSchoolPage() {
  const [error, setError] = useState("");

  useEffect(() => {
    loginAction("school@nivarro.demo", "demo2026", "/dashboard").then((result) => {
      if (result && "error" in result) setError(result.error);
    });
  }, []);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      {error ? (
        <p className="text-sm" style={{ color: "#f87171" }}>{error}</p>
      ) : (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text2)" }}>
          <Loader2 className="w-4 h-4 animate-spin" />
          Signing you into the demo...
        </div>
      )}
    </div>
  );
}
