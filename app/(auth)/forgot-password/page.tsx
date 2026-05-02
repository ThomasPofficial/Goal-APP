"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { requestPasswordReset } from "@/app/actions/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await requestPasswordReset(email);
    setLoading(false);
    setSubmitted(true);
  }

  return (
    <div className="bg-[#0d0d0e] border border-[#1c1c20] rounded-xl p-8 shadow-[0_24px_48px_rgba(0,0,0,0.6)]">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#c9a84c] mb-4">
          <span className="text-[#080809] font-bold text-lg">N</span>
        </div>
        <h1 className="text-xl font-semibold text-[#eaeaea]">Reset password</h1>
        <p className="text-sm text-[#909098] mt-1">
          Enter your email and we&apos;ll send a reset link
        </p>
      </div>

      {submitted ? (
        <div className="text-center space-y-4">
          <p className="text-sm text-[#909098]">
            If an account exists for{" "}
            <span className="text-[#eaeaea]">{email}</span>, you&apos;ll
            receive a reset link shortly.
          </p>
          <Link href="/login" className="text-sm text-[#c9a84c] hover:text-[#e3c06a]">
            Back to sign in
          </Link>
        </div>
      ) : (
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

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#c9a84c] hover:bg-[#e3c06a] text-[#080809] font-semibold text-sm rounded-md py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? "Sending..." : "Send reset link"}
          </button>

          <p className="text-center text-sm text-[#58586a]">
            <Link href="/login" className="text-[#c9a84c] hover:text-[#e3c06a]">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
