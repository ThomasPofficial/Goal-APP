"use client";

import { useState } from "react";
import { CAPABILITIES, toggleCapability, capabilityState, type Capability } from "@/lib/facultyPermissions";
import type { Group, Person } from "./PermissionsClient";
import { inputStyle, labelStyle, sectionHeadingStyle, sectionCardStyle, primaryButtonStyle, selectStyle, capabilityLabel } from "./styles";

interface Props {
  people: Person[];
  loading: boolean;
  groups: Group[];
  isOwnerOrCoreAdmin: boolean;
  onChanged: () => void;
}

interface FormState {
  userId: string | null; // null = creating a new person
  name: string;
  email: string;
  staffTitle: string;
  groupId: string | null; // null = Custom
  overrides: Capability[];
  revocations: Capability[];
  makeCoreAdmin: boolean;
}

function emptyForm(defaultGroupId: string | null): FormState {
  return { userId: null, name: "", email: "", staffTitle: "", groupId: defaultGroupId, overrides: [], revocations: [], makeCoreAdmin: false };
}

export default function PeopleTab({ people, loading, groups, isOwnerOrCoreAdmin, onChanged }: Props) {
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  function openCreate() {
    setError(null);
    setInviteLink(null);
    setForm(emptyForm(groups[0]?.id ?? null));
  }

  function openEdit(p: Person) {
    setError(null);
    setInviteLink(null);
    setForm({
      userId: p.userId,
      name: p.displayName,
      email: p.email ?? "",
      staffTitle: p.staffTitle ?? "",
      groupId: p.tierId,
      overrides: p.overrides,
      revocations: p.revocations,
      makeCoreAdmin: p.isCoreAdmin,
    });
  }

  function groupPermissions(groupId: string | null): Capability[] {
    return groups.find((g) => g.id === groupId)?.permissions ?? [];
  }

  function toggle(cap: Capability) {
    if (!form) return;
    if (form.groupId === null) {
      setForm({
        ...form,
        overrides: form.overrides.includes(cap) ? form.overrides.filter((c) => c !== cap) : [...form.overrides, cap],
      });
      return;
    }
    const { overrides, revocations } = toggleCapability(cap, groupPermissions(form.groupId), form.overrides, form.revocations);
    setForm({ ...form, overrides, revocations });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (!form.userId && !form.email.trim()) {
      setError("Email is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (!form.userId) {
        const res = await fetch("/api/school/staff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            form.groupId
              ? {
                  email: form.email.trim(),
                  name: form.name.trim() || undefined,
                  staffTitle: form.staffTitle.trim() || undefined,
                  tierId: form.groupId,
                  makeCoreAdmin: form.makeCoreAdmin,
                }
              : {
                  email: form.email.trim(),
                  name: form.name.trim() || undefined,
                  staffTitle: form.staffTitle.trim() || undefined,
                  customPermissions: form.overrides,
                  makeCoreAdmin: form.makeCoreAdmin,
                }
          ),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Failed to add person.");
          return;
        }
        if (data.status === "invited" && data.link) setInviteLink(data.link);
        await onChanged();
        if (!(data.status === "invited" && data.link)) setForm(null);
      } else {
        const res = await fetch(`/api/school/staff/${form.userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim(),
            staffTitle: form.staffTitle.trim(),
            tierId: form.groupId,
            overrides: form.overrides,
            revocations: form.revocations,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Failed to save.");
          return;
        }
        await onChanged();
        setForm(null);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={openCreate} style={primaryButtonStyle}>
          + Add person
        </button>
      </div>

      {form && (
        <section style={sectionCardStyle}>
          <h2 style={sectionHeadingStyle}>{form.userId ? "Edit person" : "Add person"}</h2>
          <form onSubmit={handleSave}>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
              <div style={{ minWidth: 200 }}>
                <label style={labelStyle}>Name</label>
                <input style={{ ...inputStyle, width: "100%" }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div style={{ minWidth: 220 }}>
                <label style={labelStyle}>Email *</label>
                <input
                  type="email"
                  required
                  style={{ ...inputStyle, width: "100%" }}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div style={{ minWidth: 180 }}>
                <label style={labelStyle}>Title</label>
                <input
                  style={{ ...inputStyle, width: "100%" }}
                  placeholder="AP History Teacher"
                  value={form.staffTitle}
                  onChange={(e) => setForm({ ...form, staffTitle: e.target.value })}
                />
              </div>
            </div>

            <div style={{ marginBottom: 14, maxWidth: 260 }}>
              <label style={labelStyle}>Group</label>
              <select
                style={{ ...selectStyle, width: "100%" }}
                value={form.groupId ?? "__custom__"}
                onChange={(e) => setForm({ ...form, groupId: e.target.value === "__custom__" ? null : e.target.value })}
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
                <option value="__custom__">Custom</option>
              </select>
            </div>

            {isOwnerOrCoreAdmin && (
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text)", marginBottom: 14, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.makeCoreAdmin}
                  onChange={(e) => setForm({ ...form, makeCoreAdmin: e.target.checked })}
                  style={{ accentColor: "var(--amber)", cursor: "pointer" }}
                />
                Make Core Admin (full access, can manage other admins)
              </label>
            )}

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Permissions</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {CAPABILITIES.map((cap) => {
                  const state = form.groupId
                    ? capabilityState(cap, groupPermissions(form.groupId), form.overrides, form.revocations)
                    : form.overrides.includes(cap)
                      ? "granted"
                      : "off";
                  const disabled = cap === "staff:manage" && !isOwnerOrCoreAdmin;
                  return (
                    <button
                      type="button"
                      key={cap}
                      disabled={disabled}
                      onClick={() => toggle(cap)}
                      title={
                        state === "inherited"
                          ? "Inherited from group — click to revoke for this person"
                          : state === "granted"
                            ? "Granted directly — click to remove"
                            : "Click to grant"
                      }
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        padding: "5px 10px",
                        border: "1px solid var(--border)",
                        background: state === "off" ? "var(--bg)" : state === "inherited" ? "rgba(232,137,58,0.12)" : "var(--amber)",
                        color: state === "granted" ? "#000" : "var(--text)",
                        opacity: disabled ? 0.5 : 1,
                        cursor: disabled ? "not-allowed" : "pointer",
                      }}
                    >
                      {capabilityLabel(cap)}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{error}</p>}
            {inviteLink && (
              <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12, lineHeight: 1.6 }}>
                Invite link (send this yourself — email delivery isn&apos;t wired up yet):{" "}
                <code style={{ wordBreak: "break-all" }}>{inviteLink}</code>
              </p>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" disabled={saving} style={{ ...primaryButtonStyle, opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={() => setForm(null)} style={{ ...primaryButtonStyle, background: "var(--bg)", color: "var(--text)" }}>
                {inviteLink ? "Done" : "Cancel"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section style={sectionCardStyle}>
        <h2 style={sectionHeadingStyle}>People</h2>
        {loading ? (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading…</p>
        ) : people.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>No one added yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {people.map((p) => (
              <button
                key={p.userId}
                onClick={() => openEdit(p)}
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  flexWrap: "wrap",
                  cursor: "pointer",
                  textAlign: "left",
                  font: "inherit",
                  color: "inherit",
                }}
              >
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {p.displayName}
                    {p.isCoreAdmin && <span style={{ color: "var(--amber)", fontSize: 11, marginLeft: 6 }}>CORE ADMIN</span>}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 3, flexWrap: "wrap", fontSize: 12, color: "var(--muted)" }}>
                    {p.email && <span>{p.email}</span>}
                    <span>{p.staffTitle ?? "No title"}</span>
                    {p.isPending && <span style={{ color: "var(--amber)" }}>Pending</span>}
                  </div>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>{p.isCustom ? "Custom" : p.tierName}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
