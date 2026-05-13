"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { requestPasswordReset } from "@/app/actions/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await requestPasswordReset(email);
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
    } else {
      setSubmitted(true);
    }
  }

  return (
    <div className="rounded-xl p-8" style={{ background: "var(--surface)", border: "1px solid var(--border-md)", boxShadow: "0 32px 64px rgba(0,0,0,0.5)" }}>
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg mb-4" style={{ background: "var(--gold)" }}>
          <span className="font-black text-lg" style={{ color: "#04070F", fontFamily: "var(--font-display, sans-serif)" }}>N</span>
        </div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--text)", fontFamily: "var(--font-display, sans-serif)" }}>Reset password</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text2)" }}>
          Enter your email and we&apos;ll send a reset link
        </p>
      </div>

      {submitted ? (
        <div className="text-center space-y-4">
          <p className="text-sm" style={{ color: "var(--text2)" }}>
            If an account exists for{" "}
            <span style={{ color: "var(--text)" }}>{email}</span>, you&apos;ll receive a reset link shortly.
          </p>
          <Link href="/login" style={{ color: "var(--gold)" }} className="text-sm">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-widest" style={{ color: "var(--muted)", fontFamily: "var(--font-display, sans-serif)" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
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
            {loading ? "Sending..." : "Send reset link"}
          </button>

          <p className="text-center text-sm">
            <Link href="/login" style={{ color: "var(--gold)" }}>Back to sign in</Link>
          </p>
        </form>
      )}
    </div>
  );
}
