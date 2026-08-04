"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { loginAction } from "@/app/actions/auth";

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const justRegistered = searchParams.get("registered") === "1";
  const prefillEmail = searchParams.get("email") ?? "";
  const prefillPassword = searchParams.get("password") ?? "";
  const autoSubmit = searchParams.get("auto") === "1";

  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState(prefillPassword);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function doLogin(loginEmail: string, loginPassword: string) {
    setError("");
    setLoading(true);
    try {
      const result = await loginAction(loginEmail, loginPassword);
      if (result && "error" in result) {
        setError(result.error);
        setLoading(false);
      }
      // On success, loginAction throws NEXT_REDIRECT — browser navigates automatically
    } catch (err: unknown) {
      // Re-thrown NEXT_REDIRECT errors are expected — let them bubble
      const digest = (err as { digest?: string })?.digest ?? "";
      if (digest.startsWith("NEXT_REDIRECT")) throw err;
      setError("Unable to connect. Please wait a moment and try again.");
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await doLogin(email, password);
  }

  useEffect(() => {
    if (autoSubmit && prefillEmail && prefillPassword) {
      doLogin(prefillEmail, prefillPassword);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {justRegistered && (
        <p className="text-sm px-3 py-2 rounded-md" style={{ color: "#4ade80", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)" }}>
          Account created! Sign in below.
        </p>
      )}
      <div>
        <label className="block text-xs font-semibold mb-1.5 uppercase tracking-widest" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
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
      <div>
        <label className="block text-xs font-semibold mb-1.5 uppercase tracking-widest" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          className="w-full text-sm"
          style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border-md)", borderRadius: "6px", padding: "10px 14px" }}
        />
      </div>

      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-xs" style={{ color: "var(--gold)" }}>
          Forgot password?
        </Link>
      </div>

      {error && (
        <p className="text-sm px-3 py-2 rounded-md" style={{ color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 text-sm py-2.5 mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ background: "var(--amber, #E8893A)", color: "#000", fontFamily: "var(--font-mono, monospace)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", borderRadius: 6, boxShadow: "0 4px 20px rgba(232,137,58,0.35)", border: "none" }}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div
      className="rounded-xl p-8"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-md)",
        boxShadow: "0 32px 64px rgba(0,0,0,0.5)",
      }}
    >
      <div className="mb-8 text-center">
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 32, fontWeight: 500, letterSpacing: "-0.5px", color: "var(--text)", marginBottom: 4 }}>
          Nivarro
        </h1>
        <h2 className="text-lg" style={{ color: "var(--text)", fontFamily: "var(--font-body, sans-serif)", fontWeight: 600 }}>
          Welcome back
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--text2)" }}>
          Sign in to your Nivarro account
        </p>
      </div>

      <Suspense fallback={<div className="h-40" />}>
        <LoginForm />
      </Suspense>

      <p className="mt-6 text-center text-sm" style={{ color: "var(--muted)" }}>
        Don&apos;t have an account?{" "}
        <Link href="/register" style={{ color: "var(--gold)" }}>
          Create one
        </Link>
      </p>
    </div>
  );
}
