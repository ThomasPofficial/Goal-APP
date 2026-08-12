"use client";

import { useEffect, useState } from "react";
import { CAPABILITIES, type Capability } from "@/lib/facultyPermissions";

interface Tier {
  id: string;
  name: string;
  permissions: Capability[];
  isSystemDefault: boolean;
}

interface StaffMember {
  userId: string;
  email: string | null;
  displayName: string;
  staffTitle: string | null;
  tierId: string | null;
  tierName: string | null;
  isCustom: boolean;
}

interface PendingInvite {
  userId: string;
  email: string | null;
  displayName: string;
  staffTitle: string | null;
  tierId: string | null;
  tierName: string | null;
  isCustom: boolean;
}

interface Props {
  isSchool: boolean;
  initialTiers: Tier[];
}

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: 13,
  borderRadius: 0,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  letterSpacing: "0.08em",
  color: "var(--muted)",
  marginBottom: 6,
  textTransform: "uppercase",
};

const sectionHeadingStyle: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 18,
  fontWeight: 700,
  color: "var(--text)",
  margin: "0 0 14px",
};

const sectionCardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 0,
  padding: "20px 22px",
  marginBottom: 24,
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "8px 20px",
  background: "var(--amber)",
  border: "1px solid var(--amber)",
  color: "#000",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  cursor: "pointer",
  borderRadius: 0,
  whiteSpace: "nowrap",
};

const selectStyle: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: 12,
  fontFamily: "var(--font-mono)",
  borderRadius: 0,
  outline: "none",
};

function capabilityLabel(cap: Capability): string {
  return cap.replace(":", " · ");
}

export default function StaffClient({ isSchool, initialTiers }: Props) {
  const [tiers, setTiers] = useState<Tier[]>(initialTiers);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMode, setInviteMode] = useState<"tier" | "custom">("tier");
  const [inviteTierId, setInviteTierId] = useState(initialTiers[0]?.id ?? "");
  const [inviteCustomPerms, setInviteCustomPerms] = useState<Capability[]>([]);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  async function refreshStaff() {
    try {
      const res = await fetch("/api/school/staff");
      const data = await res.json();
      setStaff(data.staff ?? []);
      setPendingInvites(data.pendingInvites ?? []);
    } finally {
      setLoadingStaff(false);
    }
  }

  useEffect(() => {
    refreshStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError(null);
    setInviteNotice(null);
    setLastInviteLink(null);
    try {
      const res = await fetch("/api/school/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          inviteMode === "tier"
            ? { email: inviteEmail.trim(), tierId: inviteTierId }
            : { email: inviteEmail.trim(), customPermissions: inviteCustomPerms }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error ?? "Failed to send invite.");
        return;
      }
      if (data.status === "invited" && data.link) {
        setLastInviteLink(data.link);
      } else if (data.status === "already-staff") {
        setInviteNotice("This person is already staff — their tier/permissions were updated.");
      }
      setInviteEmail("");
      setInviteCustomPerms([]);
      await refreshStaff();
    } catch {
      setInviteError("Network error. Please try again.");
    } finally {
      setInviting(false);
    }
  }

  async function reassignTier(userId: string, tierId: string) {
    await fetch(`/api/school/staff/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tierId }),
    });
    await refreshStaff();
  }

  async function renameTier(tierId: string, name: string) {
    await fetch(`/api/school/staff/tiers/${tierId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const res = await fetch("/api/school/staff/tiers");
    const data = await res.json();
    setTiers(data.tiers ?? []);
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28, display: "flex", flexDirection: "column", gap: 6 }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 36,
            fontWeight: 700,
            color: "var(--text)",
            margin: 0,
            lineHeight: 1.1,
            letterSpacing: "0.01em",
          }}
        >
          Staff
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
          Invite staff, manage their permission tiers, and review pending invites.
        </p>

        {/* Stat chips */}
        <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
          {(
            [
              { label: "Active Staff", count: staff.length },
              { label: "Pending Invites", count: pendingInvites.length },
              { label: "Tiers", count: tiers.length },
            ] as const
          ).map((chip) => (
            <span
              key={chip.label}
              style={{
                display: "inline-block",
                padding: "3px 12px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "var(--font-mono)",
                borderRadius: 0,
              }}
            >
              <span style={{ color: "var(--amber)", marginRight: 4 }}>{chip.count}</span>
              {chip.label}
            </span>
          ))}
        </div>
      </div>

      {/* Invite staff */}
      <section style={sectionCardStyle}>
        <h2 style={sectionHeadingStyle}>Invite staff</h2>
        <form onSubmit={handleInvite}>
          <div style={{ marginBottom: 14, maxWidth: 360 }}>
            <label style={labelStyle}>Email *</label>
            <input
              type="email"
              placeholder="email@school.org"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              style={{ ...inputStyle, width: "100%" }}
            />
          </div>

          <div style={{ marginBottom: 14, display: "flex", gap: 20, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text)", cursor: "pointer" }}>
              <input
                type="radio"
                checked={inviteMode === "tier"}
                onChange={() => setInviteMode("tier")}
                style={{ accentColor: "var(--amber)", cursor: "pointer" }}
              />
              Assign a tier
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text)", cursor: "pointer" }}>
              <input
                type="radio"
                checked={inviteMode === "custom"}
                onChange={() => setInviteMode("custom")}
                style={{ accentColor: "var(--amber)", cursor: "pointer" }}
              />
              Custom permissions for just this person
            </label>
          </div>

          {inviteMode === "tier" && (
            <div style={{ marginBottom: 18, maxWidth: 300 }}>
              <label style={labelStyle}>Tier</label>
              <select
                value={inviteTierId}
                onChange={(e) => setInviteTierId(e.target.value)}
                style={{ ...inputStyle, width: "100%" }}
              >
                {tiers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {inviteMode === "custom" && (
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Permissions</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {CAPABILITIES.map((cap) => (
                  <label
                    key={cap}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      fontFamily: "var(--font-mono)",
                      color: "var(--text)",
                      border: "1px solid var(--border)",
                      padding: "5px 10px",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={inviteCustomPerms.includes(cap)}
                      onChange={(e) =>
                        setInviteCustomPerms((prev) =>
                          e.target.checked ? [...prev, cap] : prev.filter((p) => p !== cap)
                        )
                      }
                      style={{ accentColor: "var(--amber)", cursor: "pointer" }}
                    />
                    {capabilityLabel(cap)}
                  </label>
                ))}
              </div>
            </div>
          )}

          {inviteError && (
            <p style={{ color: "#ef4444", fontSize: 13, margin: "0 0 12px", fontFamily: "var(--font-mono)" }}>
              {inviteError}
            </p>
          )}

          <button type="submit" disabled={inviting} style={{ ...primaryButtonStyle, opacity: inviting ? 0.7 : 1, cursor: inviting ? "not-allowed" : "pointer" }}>
            {inviting ? "Sending…" : "Send invite"}
          </button>
        </form>

        {lastInviteLink && (
          <p style={{ marginTop: 16, fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
            Invite link (send this to them yourself — email delivery isn&apos;t wired up yet):{" "}
            <code
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--text)",
                background: "var(--bg)",
                border: "1px solid var(--border)",
                padding: "2px 6px",
                wordBreak: "break-all",
              }}
            >
              {lastInviteLink}
            </code>
          </p>
        )}
        {inviteNotice && (
          <p style={{ marginTop: 16, fontSize: 12, color: "var(--amber)", fontFamily: "var(--font-mono)" }}>
            {inviteNotice}
          </p>
        )}
      </section>

      {/* Active staff */}
      <section style={sectionCardStyle}>
        <h2 style={sectionHeadingStyle}>Active staff</h2>
        {loadingStaff ? (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading…</p>
        ) : staff.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>No active staff yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {staff.map((s) => (
              <div
                key={s.userId}
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{s.displayName}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
                    {s.email && <span style={{ fontSize: 12, color: "var(--muted)" }}>{s.email}</span>}
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>{s.staffTitle ?? "No title"}</span>
                  </div>
                </div>
                <select
                  value={s.tierId ?? ""}
                  onChange={(e) => reassignTier(s.userId, e.target.value)}
                  style={selectStyle}
                >
                  <option value="" disabled>
                    {s.isCustom ? "Custom" : s.tierName}
                  </option>
                  {tiers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pending invites */}
      <section style={sectionCardStyle}>
        <h2 style={sectionHeadingStyle}>Pending invites</h2>
        {loadingStaff ? (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading…</p>
        ) : pendingInvites.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>No pending invites.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {pendingInvites.map((i) => (
              <div
                key={i.userId}
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{i.displayName}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
                    {i.email && <span style={{ fontSize: 12, color: "var(--muted)" }}>{i.email}</span>}
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>{i.staffTitle ?? "No title"}</span>
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--amber)",
                    background: "rgba(232,137,58,0.12)",
                    padding: "3px 8px",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}
                >
                  {i.isCustom ? "Custom" : i.tierName}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Tiers (SCHOOL only) */}
      {isSchool && (
        <section style={sectionCardStyle}>
          <h2 style={sectionHeadingStyle}>Tiers</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {tiers.map((t) => (
              <div
                key={t.id}
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  flexWrap: "wrap",
                }}
              >
                <input
                  defaultValue={t.name}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== t.name && renameTier(t.id, e.target.value.trim())}
                  style={{ ...inputStyle, minWidth: 180, fontWeight: 700 }}
                />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, flex: 1 }}>
                  {t.permissions.length === 0 ? (
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>No permissions</span>
                  ) : (
                    t.permissions.map((p) => (
                      <span
                        key={p}
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          color: "var(--muted)",
                          border: "1px solid var(--border)",
                          padding: "2px 7px",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {capabilityLabel(p)}
                      </span>
                    ))
                  )}
                </div>
                {t.isSystemDefault && (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      color: "var(--muted)",
                      opacity: 0.7,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Default
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
