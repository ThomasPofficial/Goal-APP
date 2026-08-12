"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { resetPassword } from "@/app/actions/auth";

function ActivateAccountForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!token) {
    return (
      <div className="text-center space-y-3">
        <p className="text-sm" style={{ color: "#f87171" }}>
          This activation link is invalid.
        </p>
        <p className="text-sm" style={{ color: "var(--text2)" }}>
          Ask your school admin to send you a new invite link.
        </p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setError("");
    setLoading(true);
    const result = await resetPassword(token!, password);
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
    } else {
      window.location.href = "/login";
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold mb-1.5 uppercase tracking-widest" style={{ color: "var(--muted)", fontFamily: "var(--font-display, sans-serif)" }}>
          Choose a Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Minimum 8 characters"
          required
          className="w-full text-sm"
          style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border-md)", borderRadius: "6px", padding: "10px 14px" }}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold mb-1.5 uppercase tracking-widest" style={{ color: "var(--muted)", fontFamily: "var(--font-display, sans-serif)" }}>
          Confirm Password
        </label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repeat your password"
          required
          className="w-full text-sm"
          style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border-md)", borderRadius: "6px", padding: "10px 14px" }}
        />
      </div>

      {error && (
        <p className="text-sm px-3 py-2 rounded-md" style={{ color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 font-bold text-sm rounded-md py-2.5 mt-2 disabled:opacity-60 disabled:cursor-not-allowed uppercase tracking-widest"
        style={{ background: "var(--gold)", color: "#04070F", fontFamily: "var(--font-display, sans-serif)", letterSpacing: "0.1em" }}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {loading ? "Activating..." : "Activate account"}
      </button>
    </form>
  );
}

export default function ActivateAccountPage() {
  return (
    <div className="rounded-xl p-8" style={{ background: "var(--surface)", border: "1px solid var(--border-md)", boxShadow: "0 32px 64px rgba(0,0,0,0.5)" }}>
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg mb-4" style={{ background: "var(--gold)" }}>
          <span className="font-black text-lg" style={{ color: "#04070F", fontFamily: "var(--font-display, sans-serif)" }}>N</span>
        </div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--text)", fontFamily: "var(--font-display, sans-serif)" }}>Welcome to Nivarro</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text2)" }}>Set a password to activate your account</p>
      </div>
      <Suspense fallback={<div className="h-40" />}>
        <ActivateAccountForm />
      </Suspense>
    </div>
  );
}
