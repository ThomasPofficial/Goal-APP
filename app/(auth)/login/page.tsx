"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { loginAction } from "@/app/actions/auth";

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await loginAction(email, password);
      if (result && "error" in result) {
        setError(result.error);
        setLoading(false);
      }
      // On success, loginAction throws NEXT_REDIRECT — browser navigates automatically
    } catch (err: unknown) {
      // Re-thrown NEXT_REDIRECT errors are expected — let them bubble
      const digest = (err as { digest?: string })?.digest ?? "";
      if (digest.startsWith("NEXT_REDIRECT")) throw err;
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
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
      <div>
        <label className="block text-xs font-semibold mb-1.5 uppercase tracking-widest" style={{ color: "var(--muted)", fontFamily: "var(--font-display, sans-serif)" }}>
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
        className="w-full flex items-center justify-center gap-2 font-bold text-sm rounded-md py-2.5 mt-2 disabled:opacity-60 disabled:cursor-not-allowed uppercase tracking-widest"
        style={{ background: "var(--gold)", color: "#04070F", fontFamily: "var(--font-display, sans-serif)", letterSpacing: "0.1em" }}
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
        <div
          className="inline-flex items-center justify-center w-10 h-10 rounded-lg mb-4"
          style={{ background: "var(--gold)" }}
        >
          <span className="font-black text-lg" style={{ color: "#04070F", fontFamily: "var(--font-display, sans-serif)" }}>N</span>
        </div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--text)", fontFamily: "var(--font-display, sans-serif)" }}>
          Welcome back
        </h1>
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
