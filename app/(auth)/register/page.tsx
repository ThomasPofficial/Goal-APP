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

  const inputStyle = {
    background: "var(--surface2)",
    color: "var(--text)",
    border: "1px solid var(--border-md)",
    borderRadius: "6px",
    padding: "10px 14px",
    width: "100%",
    fontSize: "14px",
  };

  const labelStyle = {
    display: "block",
    fontSize: "11px",
    fontWeight: 600,
    marginBottom: "6px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    color: "var(--muted)",
    fontFamily: "var(--font-display, sans-serif)",
  };

  return (
    <div
      className="rounded-xl p-8"
      style={{ background: "var(--surface)", border: "1px solid var(--border-md)", boxShadow: "0 32px 64px rgba(0,0,0,0.5)" }}
    >
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg mb-4" style={{ background: "var(--gold)" }}>
          <span className="font-black text-lg" style={{ color: "#04070F", fontFamily: "var(--font-display, sans-serif)" }}>N</span>
        </div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--text)", fontFamily: "var(--font-display, sans-serif)" }}>
          Join Nivarro
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text2)" }}>
          Create your account to get started
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label style={labelStyle}>Full Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 6 characters" minLength={6} required style={inputStyle} />
        </div>

        {error && (
          <p className="text-sm px-3 py-2 rounded-md" style={{ color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 font-bold text-sm rounded-md py-2.5 mt-2 uppercase tracking-widest disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ background: "var(--gold)", color: "#04070F", fontFamily: "var(--font-display, sans-serif)", letterSpacing: "0.1em" }}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm" style={{ color: "var(--muted)" }}>
        Already have an account?{" "}
        <Link href="/login" style={{ color: "var(--gold)" }}>Sign in</Link>
      </p>
    </div>
  );
}
