"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
    } else {
      router.push("/login?registered=1");
    }
  }

  return (
    <div className="bg-[#16161a] border border-[#2a2a33] rounded-xl p-8 shadow-[0_24px_48px_rgba(0,0,0,0.6)]">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#c9a84c] mb-4">
          <span className="text-[#0f0f11] font-bold text-lg">N</span>
        </div>
        <h1 className="text-xl font-semibold text-[#e8e8ec]">
          Join Nivarro
        </h1>
        <p className="text-sm text-[#9898a8] mt-1">
          Create your account to get started
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="name"
            className="block text-xs font-medium text-[#9898a8] mb-1.5 uppercase tracking-wider"
          >
            Full Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
            className="w-full bg-[#1e1e24] border border-[#2a2a33] rounded-md px-3 py-2.5 text-sm text-[#e8e8ec] placeholder:text-[#5a5a6a] focus:outline-none focus:border-[#c9a84c80] focus:shadow-[0_0_0_1px_rgba(201,168,76,0.2)]"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-xs font-medium text-[#9898a8] mb-1.5 uppercase tracking-wider"
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
            className="w-full bg-[#1e1e24] border border-[#2a2a33] rounded-md px-3 py-2.5 text-sm text-[#e8e8ec] placeholder:text-[#5a5a6a] focus:outline-none focus:border-[#c9a84c80] focus:shadow-[0_0_0_1px_rgba(201,168,76,0.2)]"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-xs font-medium text-[#9898a8] mb-1.5 uppercase tracking-wider"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 6 characters"
            minLength={6}
            required
            className="w-full bg-[#1e1e24] border border-[#2a2a33] rounded-md px-3 py-2.5 text-sm text-[#e8e8ec] placeholder:text-[#5a5a6a] focus:outline-none focus:border-[#c9a84c80] focus:shadow-[0_0_0_1px_rgba(201,168,76,0.2)]"
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
          className="w-full flex items-center justify-center gap-2 bg-[#c9a84c] hover:bg-[#e3c06a] text-[#0f0f11] font-semibold text-sm rounded-md py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[#5a5a6a]">
        Already have an account?{" "}
        <Link href="/login" className="text-[#c9a84c] hover:text-[#e3c06a]">
          Sign in
        </Link>
      </p>
    </div>
  );
}
