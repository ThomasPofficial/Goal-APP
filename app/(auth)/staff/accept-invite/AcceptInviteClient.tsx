"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";

export default function AcceptInviteClient({ token }: { token: string }) {
  const [status, setStatus] = useState<"checking" | "valid" | "invalid">("checking");
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [staffTitle, setStaffTitle] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      setError("Missing invite token");
      return;
    }
    fetch(`/api/staff/accept-invite?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.valid) {
          setStatus("valid");
          setEmail(data.email);
        } else {
          setStatus("invalid");
          setError(data.error ?? "This invite is no longer valid");
        }
      })
      .catch(() => {
        setStatus("invalid");
        setError("Could not check this invite. Try again.");
      });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, displayName, staffTitle }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create your account");
        setSubmitting(false);
        return;
      }
      await signIn("credentials", { email, password, redirectTo: "/dashboard" });
    } catch {
      setError("Something went wrong. Try again.");
      setSubmitting(false);
    }
  }

  if (status === "checking") {
    return (
      <div
        className="rounded-xl p-8"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-md)",
          boxShadow: "0 32px 64px rgba(0,0,0,0.5)",
        }}
      >
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--gold)" }} />
        </div>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div
        className="rounded-xl p-8"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-md)",
          boxShadow: "0 32px 64px rgba(0,0,0,0.5)",
        }}
      >
        <div className="text-center space-y-3">
          <p className="text-sm" style={{ color: "#f87171" }}>
            {error}
          </p>
        </div>
      </div>
    );
  }

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
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg mb-4" style={{ background: "var(--gold)" }}>
          <span className="font-black text-lg" style={{ color: "#04070F", fontFamily: "var(--font-display, sans-serif)" }}>
            N
          </span>
        </div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--text)", fontFamily: "var(--font-display, sans-serif)" }}>
          Set up your account
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text2)" }}>
          You're joining as staff
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="text-sm px-3 py-2 rounded-md" style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border-md)" }}>
          Email: <strong>{email}</strong>
        </div>

        <div>
          <label htmlFor="displayName" className="block text-xs font-semibold mb-1.5 uppercase tracking-widest" style={{ color: "var(--muted)", fontFamily: "var(--font-display, sans-serif)" }}>
            Full Name
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your full name"
            required
            className="w-full text-sm"
            style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border-md)", borderRadius: "6px", padding: "10px 14px" }}
          />
        </div>

        <div>
          <label htmlFor="staffTitle" className="block text-xs font-semibold mb-1.5 uppercase tracking-widest" style={{ color: "var(--muted)", fontFamily: "var(--font-display, sans-serif)" }}>
            Title (Optional)
          </label>
          <input
            id="staffTitle"
            type="text"
            value={staffTitle}
            onChange={(e) => setStaffTitle(e.target.value)}
            placeholder="e.g. AP History Teacher"
            className="w-full text-sm"
            style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border-md)", borderRadius: "6px", padding: "10px 14px" }}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-xs font-semibold mb-1.5 uppercase tracking-widest" style={{ color: "var(--muted)", fontFamily: "var(--font-display, sans-serif)" }}>
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            minLength={8}
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
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 font-bold text-sm rounded-md py-2.5 mt-2 disabled:opacity-60 disabled:cursor-not-allowed uppercase tracking-widest"
          style={{ background: "var(--gold)", color: "#04070F", fontFamily: "var(--font-display, sans-serif)", letterSpacing: "0.1em" }}
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {submitting ? "Creating account..." : "Create account"}
        </button>
      </form>
    </div>
  );
}
