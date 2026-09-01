"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { loginAction } from "@/app/actions/auth";
import { serverSignInWithGoogle } from "@/lib/auth-actions";

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const justRegistered = searchParams.get("registered") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px" style={{ background: "var(--border-md)" }} />
        <span className="text-xs" style={{ color: "var(--muted)" }}>or</span>
        <div className="flex-1 h-px" style={{ background: "var(--border-md)" }} />
      </div>

      <form action={serverSignInWithGoogle}>
        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 text-sm py-2.5"
          style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border-md)", borderRadius: 6, fontWeight: 600 }}
        >
          <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4c-7.7 0-14.3 4.3-17.7 10.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.6-3.4-11.3-8.1l-6.5 5C9.6 39.6 16.3 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5.2C40.5 36.4 44 30.8 44 24c0-1.3-.1-2.7-.4-3.5z"/>
          </svg>
          Continue with Google
        </button>
      </form>

      <p className="mt-6 text-center text-sm" style={{ color: "var(--muted)" }}>
        Don&apos;t have an account?{" "}
        <Link href="/register" style={{ color: "var(--gold)" }}>
          Create one
        </Link>
      </p>
    </div>
  );
}
