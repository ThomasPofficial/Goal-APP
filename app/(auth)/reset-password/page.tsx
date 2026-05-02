"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { resetPassword } from "@/app/actions/auth";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!token) {
    return (
      <div className="text-center space-y-3">
        <p className="text-sm text-[#f87171]">Invalid reset link.</p>
        <Link
          href="/forgot-password"
          className="text-sm text-[#c9a84c] hover:text-[#e3c06a]"
        >
          Request a new one
        </Link>
      </div>
    );
  }

  const safeToken = token;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setError("");
    setLoading(true);
    const result = await resetPassword(safeToken, password);
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
        <label
          htmlFor="password"
          className="block text-xs font-medium text-[#909098] mb-1.5 uppercase tracking-wider"
        >
          New Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Minimum 8 characters"
          required
          className="w-full bg-[#131315] border border-[#1c1c20] rounded-md px-3 py-2.5 text-sm text-[#eaeaea] placeholder:text-[#58586a] focus:outline-none focus:border-[#c9a84c80] focus:shadow-[0_0_0_1px_rgba(201,168,76,0.2)]"
        />
      </div>

      <div>
        <label
          htmlFor="confirm"
          className="block text-xs font-medium text-[#909098] mb-1.5 uppercase tracking-wider"
        >
          Confirm Password
        </label>
        <input
          id="confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repeat your password"
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
        {loading ? "Updating..." : "Set new password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="bg-[#0d0d0e] border border-[#1c1c20] rounded-xl p-8 shadow-[0_24px_48px_rgba(0,0,0,0.6)]">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#c9a84c] mb-4">
          <span className="text-[#080809] font-bold text-lg">N</span>
        </div>
        <h1 className="text-xl font-semibold text-[#eaeaea]">Set new password</h1>
        <p className="text-sm text-[#909098] mt-1">Choose a strong password</p>
      </div>
      <Suspense fallback={<div className="h-40" />}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
