"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";

function LoginForm() {
  const router = useRouter();
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

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("Invalid email or password.");
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="block text-xs font-medium text-[#909098] mb-1.5 uppercase tracking-wider"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="w-full bg-[#131315] border border-[#1c1c20] rounded-md px-3 py-2.5 text-sm text-[#eaeaea] placeholder:text-[#58586a] focus:outline-none focus:border-[#c9a84c80] focus:shadow-[0_0_0_1px_rgba(201,168,76,0.2)]"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-xs font-medium text-[#909098] mb-1.5 uppercase tracking-wider"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          className="w-full bg-[#131315] border border-[#1c1c20] rounded-md px-3 py-2.5 text-sm text-[#eaeaea] placeholder:text-[#58586a] focus:outline-none focus:border-[#c9a84c80] focus:shadow-[0_0_0_1px_rgba(201,168,76,0.2)]"
        />
      </div>

      {error && (
        <p className="text-sm text-[#f87171] bg-[#f8717115] border border-[#f8717130] rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-[#c9a84c] hover:bg-[#e3c06a] text-[#080809] font-semibold text-sm rounded-md py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="bg-[#0d0d0e] border border-[#1c1c20] rounded-xl p-8 shadow-[0_24px_48px_rgba(0,0,0,0.6)]">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#c9a84c] mb-4">
          <span className="text-[#080809] font-bold text-lg">N</span>
        </div>
        <h1 className="text-xl font-semibold text-[#eaeaea]">Welcome back</h1>
        <p className="text-sm text-[#909098] mt-1">
          Sign in to your Nivarro account
        </p>
      </div>

      <Suspense fallback={<div className="h-40" />}>
        <LoginForm />
      </Suspense>

      <p className="mt-6 text-center text-sm text-[#58586a]">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-[#c9a84c] hover:text-[#e3c06a]">
          Create one
        </Link>
      </p>

      <div className="mt-4 pt-4 border-t border-[#1c1c20]">
        <p className="text-xs text-center text-[#58586a]">
          Demo: demo@nivarro.io / password123
        </p>
      </div>
    </div>
  );
}
