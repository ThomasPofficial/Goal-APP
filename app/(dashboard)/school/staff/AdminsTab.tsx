"use client";

import { useEffect, useState } from "react";
import { sectionHeadingStyle, sectionCardStyle, primaryButtonStyle } from "./styles";

interface AdminRow {
  userId: string;
  email: string | null;
  displayName: string;
}

interface AdminsData {
  owner: AdminRow | null;
  coreAdmins: AdminRow[];
}

interface Props {
  onChanged: () => void;
}

export default function AdminsTab({ onChanged }: Props) {
  const [data, setData] = useState<AdminsData | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/school/admins");
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function demote(userId: string) {
    if (!window.confirm("Remove Core Admin status from this person? They'll fall back to their previous group.")) return;
    await fetch(`/api/school/admins/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCoreAdmin: false }),
    });
    await refresh();
    onChanged();
  }

  return (
    <section style={sectionCardStyle}>
      <h2 style={sectionHeadingStyle}>Admins</h2>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>
        The owner account can never be removed here. Any Core Admin can promote or remove any other from the People tab or this list.
      </p>
      {loading ? (
        <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {data?.owner && (
            <div style={{ background: "var(--bg)", border: "1px solid var(--border)", padding: "12px 14px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{data.owner.displayName}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{data.owner.email}</div>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--amber)", textTransform: "uppercase" }}>Owner</span>
            </div>
          )}
          {data?.coreAdmins.map((a) => (
            <div key={a.userId} style={{ background: "var(--bg)", border: "1px solid var(--border)", padding: "12px 14px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{a.displayName}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{a.email}</div>
              </div>
              <button onClick={() => demote(a.userId)} style={{ ...primaryButtonStyle, background: "var(--bg)", color: "var(--text)" }}>
                Remove Core Admin
              </button>
            </div>
          ))}
          {data?.coreAdmins.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13, padding: "8px 0" }}>No Core Admins yet.</p>}
        </div>
      )}
    </section>
  );
}
