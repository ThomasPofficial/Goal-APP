"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function AcceptInviteClient({ token }: { token: string }) {
  const router = useRouter();
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
      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Try again.");
      setSubmitting(false);
    }
  }

  if (status === "checking") return <div style={{ padding: 32 }}>Checking invite...</div>;
  if (status === "invalid") return <div style={{ padding: 32 }}>{error}</div>;

  return (
    <div style={{ maxWidth: 420, margin: "64px auto", padding: 24 }}>
      <h1>Set up your account</h1>
      <p>You're joining as staff — email: {email}</p>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>Full name</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Title (optional, e.g. "AP History Teacher")</label>
          <input value={staffTitle} onChange={(e) => setStaffTitle(e.target.value)} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Password</label>
          <input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Creating account..." : "Create account"}
        </button>
      </form>
    </div>
  );
}
